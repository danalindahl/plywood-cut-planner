import {
  CutPiece,
  StockSheet,
  Placement,
  SheetLayout,
  PackingResult,
  Settings,
  Offcut,
  ShoppingListItem,
  CutInstruction,
} from '../../types';
import { MIN_USABLE_OFFCUT } from '../defaults';

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PieceToPlace {
  pieceId: string;
  pieceLabel: string;
  width: number;
  height: number;
  canRotate: boolean;
  material?: string;
}

/**
 * Expand cut pieces by quantity into individual pieces.
 */
function expandPieces(cutPieces: CutPiece[], sortFn: (a: PieceToPlace, b: PieceToPlace) => number): PieceToPlace[] {
  const pieces: PieceToPlace[] = [];
  for (const cp of cutPieces) {
    for (let i = 0; i < cp.quantity; i++) {
      pieces.push({
        pieceId: cp.id,
        pieceLabel: cp.label,
        width: cp.width,
        height: cp.height,
        canRotate: cp.canRotate,
        material: cp.material,
      });
    }
  }
  pieces.sort(sortFn);
  return pieces;
}

/**
 * Different sorting strategies to try — the best result wins.
 */
const SORT_STRATEGIES: ((a: PieceToPlace, b: PieceToPlace) => number)[] = [
  // Area descending (classic)
  (a, b) => b.width * b.height - a.width * a.height,
  // Longest side descending (helps tall narrow pieces pack with wide ones)
  (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
  // Width descending
  (a, b) => b.width - a.width || b.height - a.height,
  // Height descending
  (a, b) => b.height - a.height || b.width - a.width,
  // Perimeter descending
  (a, b) => (b.width + b.height) - (a.width + a.height),
];


/**
 * Compute the usable area of a stock sheet after applying edge trimming.
 */
function applyTrimming(
  sheet: StockSheet,
  settings: Settings
): { x: number; y: number; width: number; height: number } {
  const t = settings.trimming;
  return {
    x: t.left,
    y: t.top,
    width: Math.max(0, sheet.width - t.left - t.right),
    height: Math.max(0, sheet.height - t.top - t.bottom),
  };
}

/**
 * Pack pieces onto a single stock sheet using shelf (strip) packing.
 * The strip height is set by the first piece placed. Pieces with height
 * <= the strip height can share the strip — shorter pieces just leave
 * trim waste. This ensures all main cut lines are continuous edge-to-edge
 * (table-saw friendly): one horizontal cut across the full sheet separates
 * each strip, and vertical cuts within each strip go top-to-bottom.
 */
function packSingleSheet(
  pieces: PieceToPlace[],
  sheet: StockSheet,
  settings: Settings
): { placements: Placement[]; placedIndices: Set<number>; freeRects: FreeRect[] } {
  const kerf = settings.kerfWidth;
  const usable = applyTrimming(sheet, settings);
  const placements: Placement[] = [];
  const placedIndices = new Set<number>();
  const freeRects: FreeRect[] = [];

  let currentY = usable.y;

  while (currentY < usable.y + usable.height - 0.5) {
    const remainingHeight = usable.y + usable.height - currentY;

    // Determine strip height from the first unplaced piece that fits
    let stripHeight = 0;
    for (let i = 0; i < pieces.length; i++) {
      if (placedIndices.has(i)) continue;
      const p = pieces[i];
      if (settings.considerMaterial && p.material && p.material !== sheet.material) continue;

      if (p.height <= remainingHeight && p.width <= usable.width) {
        stripHeight = p.height;
        break;
      }
      if (p.canRotate && p.width <= remainingHeight && p.height <= usable.width) {
        stripHeight = p.width;
        break;
      }
    }

    if (stripHeight === 0) break;

    // Helper to try placing a piece in the current strip
    const tryPlace = (i: number, exactOnly: boolean): boolean => {
      if (placedIndices.has(i)) return false;
      const p = pieces[i];
      if (settings.considerMaterial && p.material && p.material !== sheet.material) return false;

      let placedW: number | null = null;
      let placedH: number | null = null;
      let rotated = false;

      // Normal orientation
      if (p.height <= stripHeight && currentX + p.width <= usable.x + usable.width + 0.01) {
        if (!exactOnly || p.height === stripHeight) {
          placedW = p.width;
          placedH = p.height;
        }
      }
      // Rotated orientation
      if (placedW === null && p.canRotate &&
          p.width <= stripHeight && currentX + p.height <= usable.x + usable.width + 0.01) {
        if (!exactOnly || p.width === stripHeight) {
          placedW = p.height;
          placedH = p.width;
          rotated = true;
        }
      }

      if (placedW === null || placedH === null) return false;

      placements.push({
        pieceId: p.pieceId,
        pieceLabel: p.pieceLabel,
        x: currentX,
        y: currentY,
        width: placedW,
        height: placedH,
        rotated,
      });
      placedIndices.add(i);
      currentX += placedW + kerf;
      return true;
    };

    // Fill strip in two passes:
    // Pass 1: exact height match (no trim waste)
    // Pass 2: shorter pieces that fit (some trim waste, but uses strip width)
    let currentX = usable.x;
    let piecesInStrip = 0;

    for (let i = 0; i < pieces.length; i++) {
      if (tryPlace(i, true)) piecesInStrip++;
    }
    for (let i = 0; i < pieces.length; i++) {
      if (tryPlace(i, false)) piecesInStrip++;
    }

    // Remaining width in strip is an offcut
    const remainW = usable.x + usable.width - currentX + kerf;
    if (remainW > 0.5 && piecesInStrip > 0) {
      freeRects.push({
        x: currentX - kerf,
        y: currentY,
        width: remainW,
        height: stripHeight,
      });
    }

    currentY += stripHeight + kerf;
  }

  // Remaining height at bottom is an offcut
  const remainH = usable.y + usable.height - currentY + kerf;
  if (remainH > 0.5) {
    freeRects.push({
      x: usable.x,
      y: currentY - kerf,
      width: usable.width,
      height: remainH,
    });
  }

  return { placements, placedIndices, freeRects };
}

/**
 * Generate step-by-step cut instructions from placements.
 * Simulates the guillotine cutting process to produce ordered cuts.
 */
function generateCutInstructions(
  placements: Placement[],
  sheetW: number,
  sheetH: number,
  kerf: number
): { instructions: CutInstruction[]; totalCuts: number; totalCutLength: number } {
  const instructions: CutInstruction[] = [];
  let step = 0;

  // Build a set of placed piece rects for matching
  const placedRects = placements.map((p) => ({
    x: p.x, y: p.y, w: p.width, h: p.height,
    label: p.pieceLabel, id: p.pieceId,
  }));

  // Recursive function: given a rectangle, determine what cuts to make
  function processPiece(
    rx: number, ry: number, rw: number, rh: number
  ) {
    if (rw < 0.5 || rh < 0.5) return;

    // Check if this rect exactly matches a placed piece
    const exact = placedRects.find(
      (p) => Math.abs(p.x - rx) < 0.01 && Math.abs(p.y - ry) < 0.01 &&
             Math.abs(p.w - rw) < 0.01 && Math.abs(p.h - rh) < 0.01
    );
    if (exact) return; // no cut needed, this IS a piece

    // Find pieces that start at the top-left of this rect
    const piecesHere = placedRects.filter(
      (p) => p.x >= rx - 0.01 && p.y >= ry - 0.01 &&
             p.x + p.w <= rx + rw + 0.01 && p.y + p.h <= ry + rh + 0.01
    );

    if (piecesHere.length === 0) return; // empty waste area

    // Find the best guillotine cut that separates pieces
    // Try horizontal cuts (y = constant)
    const yCuts = new Set<number>();
    const xCuts = new Set<number>();
    for (const p of piecesHere) {
      if (p.y + p.h + kerf < ry + rh - 0.01) yCuts.add(p.y + p.h);
      if (p.x + p.w + kerf < rx + rw - 0.01) xCuts.add(p.x + p.w);
    }

    // Try the first valid horizontal cut
    for (const yVal of yCuts) {
      const topPieces = piecesHere.filter((p) => p.y + p.h <= yVal + 0.01);
      const bottomPieces = piecesHere.filter((p) => p.y >= yVal + kerf - 0.01);
      if (topPieces.length + bottomPieces.length === piecesHere.length && topPieces.length > 0 && bottomPieces.length >= 0) {
        step++;
        const topH = yVal - ry;
        const bottomH = rh - topH - kerf;
        const topMatch = topPieces.length === 1 && Math.abs(topPieces[0].w - rw) < 0.01 && Math.abs(topPieces[0].h - topH) < 0.01;
        const bottomMatch = bottomPieces.length === 1 && Math.abs(bottomPieces[0].w - rw) < 0.01 && Math.abs(bottomPieces[0].h - bottomH) < 0.01;
        const surplus = bottomPieces.length === 0 && bottomH > 0.5 ? `${r(rw)}×${r(bottomH)}` : null;

        instructions.push({
          step,
          panelSize: `${r(rw)}×${r(rh)}`,
          cutPosition: `y=${r(yVal - ry)}`,
          cutDirection: 'horizontal',
          cutValue: yVal,
          resultPiece: topMatch ? `${r(topPieces[0].w)}×${r(topPieces[0].h)}` : null,
          resultPieceLabel: topMatch ? topPieces[0].label : null,
          surplus,
        });

        processPiece(rx, ry, rw, topH);
        if (bottomH > 0.5) processPiece(rx, yVal + kerf, rw, bottomH);
        return;
      }
    }

    // Try the first valid vertical cut
    for (const xVal of xCuts) {
      const leftPieces = piecesHere.filter((p) => p.x + p.w <= xVal + 0.01);
      const rightPieces = piecesHere.filter((p) => p.x >= xVal + kerf - 0.01);
      if (leftPieces.length + rightPieces.length === piecesHere.length && leftPieces.length > 0 && rightPieces.length >= 0) {
        step++;
        const leftW = xVal - rx;
        const rightW = rw - leftW - kerf;
        const leftMatch = leftPieces.length === 1 && Math.abs(leftPieces[0].h - rh) < 0.01 && Math.abs(leftPieces[0].w - leftW) < 0.01;
        const rightMatch = rightPieces.length === 1 && Math.abs(rightPieces[0].h - rh) < 0.01 && Math.abs(rightPieces[0].w - rightW) < 0.01;
        const surplus = rightPieces.length === 0 && rightW > 0.5 ? `${r(rightW)}×${r(rh)}` : null;

        instructions.push({
          step,
          panelSize: `${r(rw)}×${r(rh)}`,
          cutPosition: `x=${r(xVal - rx)}`,
          cutDirection: 'vertical',
          cutValue: xVal,
          resultPiece: leftMatch ? `${r(leftPieces[0].w)}×${r(leftPieces[0].h)}` : null,
          resultPieceLabel: leftMatch ? leftPieces[0].label : null,
          surplus,
        });

        processPiece(rx, ry, leftW, rh);
        if (rightW > 0.5) processPiece(rx + leftW + kerf, ry, rightW, rh);
        return;
      }
    }
  }

  processPiece(0, 0, sheetW, sheetH);

  const totalCutLength = instructions.reduce((sum, inst) => {
    return sum + (inst.cutDirection === 'horizontal'
      ? parseFloat(inst.panelSize.split('×')[0])
      : parseFloat(inst.panelSize.split('×')[1]));
  }, 0);

  return { instructions, totalCuts: instructions.length, totalCutLength };
}

function r(n: number): string {
  return Math.round(n * 100) / 100 + '';
}

/**
 * Convert remaining free rectangles into offcuts.
 */
function computeOffcuts(freeRects: FreeRect[], minDim: number = MIN_USABLE_OFFCUT): Offcut[] {
  return freeRects
    .filter((r) => r.width > 0.5 && r.height > 0.5)
    .map((r) => ({
      x: r.x,
      y: r.y,
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
      area: Math.round(r.width * r.height * 100) / 100,
      usable: r.width >= minDim && r.height >= minDim,
    }))
    .sort((a, b) => b.area - a.area);
}

/**
 * Build a complete SheetLayout with all stats and cut instructions.
 */
function buildSheetLayout(
  sheet: StockSheet,
  placements: Placement[],
  freeRects: FreeRect[],
  kerf: number,
  minOffcutDim: number = MIN_USABLE_OFFCUT
): SheetLayout {
  const usedArea = placements.reduce((sum, p) => sum + p.width * p.height, 0);
  const totalArea = sheet.width * sheet.height;
  const offcuts = computeOffcuts(freeRects, minOffcutDim);
  const { instructions, totalCuts, totalCutLength } = generateCutInstructions(
    placements, sheet.width, sheet.height, kerf
  );

  return {
    stockSheet: sheet,
    placements,
    offcuts,
    cutInstructions: instructions,
    totalCuts,
    totalCutLength,
    usedArea,
    wasteArea: totalArea - usedArea,
    wastePercent: ((totalArea - usedArea) / totalArea) * 100,
    wastedPanelCount: offcuts.filter((o) => !o.usable).length,
  };
}

/**
 * Run the packing algorithm with a specific sort order.
 */
function packWithSort(
  cutPieces: CutPiece[],
  stockSheets: StockSheet[],
  settings: Settings,
  sortFn: (a: PieceToPlace, b: PieceToPlace) => number
): PackingResult {
  let remaining = expandPieces(cutPieces, sortFn);
  const sheets: SheetLayout[] = [];

  // Build a flat list of available sheets (expanded by quantity)
  const availableSheets: StockSheet[] = [];
  for (const ss of stockSheets) {
    for (let i = 0; i < ss.quantity; i++) {
      availableSheets.push(ss);
    }
  }

  // Pack sheets one at a time, only using as many as needed
  let sheetIndex = 0;
  while (remaining.length > 0 && sheetIndex < availableSheets.length) {
    const sheet = availableSheets[sheetIndex];
    const { placements, placedIndices, freeRects } = packSingleSheet(
      remaining,
      sheet,
      settings
    );

    if (placements.length === 0) {
      sheetIndex++;
      continue;
    }

    sheets.push(buildSheetLayout(sheet, placements, freeRects, settings.kerfWidth, settings.minOffcutDimension || MIN_USABLE_OFFCUT));
    remaining = remaining.filter((_, i) => !placedIndices.has(i));
    sheetIndex++;
  }

  // If we ran out of available sheets, add more of the best-matching stock type
  while (remaining.length > 0) {
    const bestStock = stockSheets.find((ss) => {
      const usable = applyTrimming(ss, settings);
      return remaining.some(
        (p) =>
          (!p.material || p.material === ss.material) &&
          ((p.width <= usable.width && p.height <= usable.height) ||
            (p.canRotate && p.height <= usable.width && p.width <= usable.height))
      );
    });

    if (!bestStock) break;

    const { placements, placedIndices, freeRects } = packSingleSheet(
      remaining,
      bestStock,
      settings
    );

    if (placements.length === 0) break;

    sheets.push(buildSheetLayout(bestStock, placements, freeRects, settings.kerfWidth, settings.minOffcutDimension || MIN_USABLE_OFFCUT));
    remaining = remaining.filter((_, i) => !placedIndices.has(i));
  }

  // Compute totals
  const totalUsedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
  const totalSheetArea = sheets.reduce(
    (sum, s) => sum + s.stockSheet.width * s.stockSheet.height,
    0
  );

  // Build shopping list: how many of each stock sheet type do we actually need?
  const shoppingMap = new Map<string, { sheet: StockSheet; count: number }>();
  for (const sl of sheets) {
    const key = sl.stockSheet.id;
    const entry = shoppingMap.get(key);
    if (entry) {
      entry.count++;
    } else {
      shoppingMap.set(key, { sheet: sl.stockSheet, count: 1 });
    }
  }
  const shoppingList: ShoppingListItem[] = [];
  let totalCost = 0;
  for (const { sheet, count } of shoppingMap.values()) {
    const cost = count * sheet.pricePerSheet;
    totalCost += cost;
    shoppingList.push({
      stockSheet: sheet,
      quantityNeeded: count,
      totalCost: cost,
    });
  }

  // Unplaced pieces
  const unplacedPieces: CutPiece[] = [];
  if (remaining.length > 0) {
    const unplacedMap = new Map<string, number>();
    for (const p of remaining) {
      unplacedMap.set(p.pieceId, (unplacedMap.get(p.pieceId) || 0) + 1);
    }
    for (const cp of cutPieces) {
      const count = unplacedMap.get(cp.id);
      if (count) {
        unplacedPieces.push({ ...cp, quantity: count });
      }
    }
  }

  return {
    sheets,
    totalSheets: sheets.length,
    totalUsedArea,
    totalWasteArea: totalSheetArea - totalUsedArea,
    totalWastePercent:
      totalSheetArea > 0
        ? ((totalSheetArea - totalUsedArea) / totalSheetArea) * 100
        : 0,
    totalCuts: sheets.reduce((sum, s) => sum + s.totalCuts, 0),
    totalCutLength: sheets.reduce((sum, s) => sum + s.totalCutLength, 0),
    unplacedPieces,
    shoppingList,
    totalCost,
  };
}

/**
 * Main entry point: try multiple sort strategies and return the best result.
 * "Best" = fewest sheets used, then lowest waste percentage.
 */
export function packPieces(
  cutPieces: CutPiece[],
  stockSheets: StockSheet[],
  settings: Settings
): PackingResult {
  // Filter to only enabled pieces, apply global grain setting
  const enabledPieces = cutPieces
    .filter((p) => p.enabled !== false)
    .map((p) => settings.considerGrain ? p : { ...p, canRotate: true });

  // If useOneSheetType, only use the first stock sheet type
  const activeSheets = settings.useOneSheetType && stockSheets.length > 0
    ? [stockSheets[0]]
    : stockSheets;

  let bestResult: PackingResult | null = null;

  for (const sortFn of SORT_STRATEGIES) {
    const result = packWithSort(enabledPieces, activeSheets, settings, sortFn);

    if (!bestResult) {
      bestResult = result;
      continue;
    }

    // Prefer: fewer unplaced pieces, then fewer sheets, then less waste
    const betterUnplaced = result.unplacedPieces.length < bestResult.unplacedPieces.length;
    const sameUnplaced = result.unplacedPieces.length === bestResult.unplacedPieces.length;
    const fewerSheets = result.totalSheets < bestResult.totalSheets;
    const sameSheets = result.totalSheets === bestResult.totalSheets;
    const lessWaste = result.totalWastePercent < bestResult.totalWastePercent;

    if (betterUnplaced || (sameUnplaced && fewerSheets) || (sameUnplaced && sameSheets && lessWaste)) {
      bestResult = result;
    }
  }

  return bestResult!;
}
