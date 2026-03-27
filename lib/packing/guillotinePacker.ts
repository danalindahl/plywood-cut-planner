import {
  CutPiece,
  StockSheet,
  Placement,
  SheetLayout,
  PackingResult,
  Settings,
  Offcut,
  ShoppingListItem,
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

function fitPiece(
  piece: PieceToPlace,
  rect: FreeRect
): 'normal' | 'rotated' | null {
  if (piece.width <= rect.width && piece.height <= rect.height) {
    return 'normal';
  }
  if (
    piece.canRotate &&
    piece.height <= rect.width &&
    piece.width <= rect.height
  ) {
    return 'rotated';
  }
  return null;
}

/**
 * Best Short Side Fit — minimizes leftover on the shorter side.
 */
function findBestRect(
  piece: PieceToPlace,
  freeRects: FreeRect[],
  kerf: number
): { rectIndex: number; orientation: 'normal' | 'rotated' } | null {
  let bestIndex = -1;
  let bestOrientation: 'normal' | 'rotated' = 'normal';
  let bestShortSide = Infinity;

  for (let i = 0; i < freeRects.length; i++) {
    const rect = freeRects[i];
    const orientation = fitPiece(piece, rect);
    if (!orientation) continue;

    const placedW = orientation === 'normal' ? piece.width : piece.height;
    const placedH = orientation === 'normal' ? piece.height : piece.width;

    const leftoverW = rect.width - placedW - kerf;
    const leftoverH = rect.height - placedH - kerf;
    const shortSide = Math.min(
      Math.max(0, leftoverW),
      Math.max(0, leftoverH)
    );

    if (shortSide < bestShortSide) {
      bestShortSide = shortSide;
      bestIndex = i;
      bestOrientation = orientation;
    }
  }

  if (bestIndex === -1) return null;
  return { rectIndex: bestIndex, orientation: bestOrientation };
}

/**
 * Guillotine split: after placing a piece, split remaining space
 * into two rectangles using an edge-to-edge cut.
 * Chooses the split that produces the larger single rectangle.
 */
function guillotineSplit(
  rect: FreeRect,
  placedW: number,
  placedH: number,
  kerf: number
): FreeRect[] {
  const newRects: FreeRect[] = [];
  const rightW = rect.width - placedW - kerf;
  const bottomH = rect.height - placedH - kerf;

  const areaA_right = rightW * rect.height;
  const areaA_bottom = placedW * bottomH;
  const areaB_right = rightW * placedH;
  const areaB_bottom = rect.width * bottomH;

  const maxA = Math.max(areaA_right, areaA_bottom);
  const maxB = Math.max(areaB_right, areaB_bottom);

  if (maxA >= maxB) {
    if (rightW > 0) {
      newRects.push({
        x: rect.x + placedW + kerf,
        y: rect.y,
        width: rightW,
        height: rect.height,
      });
    }
    if (bottomH > 0) {
      newRects.push({
        x: rect.x,
        y: rect.y + placedH + kerf,
        width: placedW,
        height: bottomH,
      });
    }
  } else {
    if (rightW > 0) {
      newRects.push({
        x: rect.x + placedW + kerf,
        y: rect.y,
        width: rightW,
        height: placedH,
      });
    }
    if (bottomH > 0) {
      newRects.push({
        x: rect.x,
        y: rect.y + placedH + kerf,
        width: rect.width,
        height: bottomH,
      });
    }
  }

  return newRects;
}

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
 * Pack pieces onto a single stock sheet.
 */
function packSingleSheet(
  pieces: PieceToPlace[],
  sheet: StockSheet,
  settings: Settings
): { placements: Placement[]; placedIndices: Set<number>; freeRects: FreeRect[] } {
  const kerf = settings.kerfWidth;
  const usable = applyTrimming(sheet, settings);
  const freeRects: FreeRect[] = [
    { x: usable.x, y: usable.y, width: usable.width, height: usable.height },
  ];
  const placements: Placement[] = [];
  const placedIndices = new Set<number>();

  for (let i = 0; i < pieces.length; i++) {
    if (placedIndices.has(i)) continue;

    const piece = pieces[i];

    // Material matching: skip if piece has a material that doesn't match
    if (piece.material && piece.material !== sheet.material) continue;

    const best = findBestRect(piece, freeRects, kerf);
    if (!best) continue;

    const rect = freeRects[best.rectIndex];
    const rotated = best.orientation === 'rotated';
    const placedW = rotated ? piece.height : piece.width;
    const placedH = rotated ? piece.width : piece.height;

    placements.push({
      pieceId: piece.pieceId,
      pieceLabel: piece.pieceLabel,
      x: rect.x,
      y: rect.y,
      width: placedW,
      height: placedH,
      rotated,
    });

    const newRects = guillotineSplit(rect, placedW, placedH, kerf);
    freeRects.splice(best.rectIndex, 1, ...newRects);

    placedIndices.add(i);
  }

  return { placements, placedIndices, freeRects };
}

/**
 * Convert remaining free rectangles into offcuts.
 */
function computeOffcuts(freeRects: FreeRect[]): Offcut[] {
  return freeRects
    .filter((r) => r.width > 0.5 && r.height > 0.5) // ignore slivers
    .map((r) => ({
      x: r.x,
      y: r.y,
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
      area: Math.round(r.width * r.height * 100) / 100,
      usable: r.width >= MIN_USABLE_OFFCUT && r.height >= MIN_USABLE_OFFCUT,
    }))
    .sort((a, b) => b.area - a.area);
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

    const usedArea = placements.reduce((sum, p) => sum + p.width * p.height, 0);
    const totalArea = sheet.width * sheet.height;

    sheets.push({
      stockSheet: sheet,
      placements,
      offcuts: computeOffcuts(freeRects),
      usedArea,
      wasteArea: totalArea - usedArea,
      wastePercent: ((totalArea - usedArea) / totalArea) * 100,
    });

    remaining = remaining.filter((_, i) => !placedIndices.has(i));
    sheetIndex++;
  }

  // If we ran out of available sheets, add more of the best-matching stock type
  while (remaining.length > 0) {
    // Find the stock sheet type that can fit the largest remaining piece
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

    const usedArea = placements.reduce((sum, p) => sum + p.width * p.height, 0);
    const totalArea = bestStock.width * bestStock.height;

    sheets.push({
      stockSheet: bestStock,
      placements,
      offcuts: computeOffcuts(freeRects),
      usedArea,
      wasteArea: totalArea - usedArea,
      wastePercent: ((totalArea - usedArea) / totalArea) * 100,
    });

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
  let bestResult: PackingResult | null = null;

  for (const sortFn of SORT_STRATEGIES) {
    const result = packWithSort(cutPieces, stockSheets, settings, sortFn);

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
