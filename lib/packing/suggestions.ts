import { CutPiece, StockSheet, Settings, PackingResult } from '../../types';
import { packPieces } from './guillotinePacker';

export interface Suggestion {
  type: 'trim_piece' | 'trim_all' | 'general';
  message: string;
  sheetsSaved: number;
}

/**
 * Analyze a packing result and suggest small dimension tweaks that save sheets.
 * Tries reducing individual pieces and uniform reductions across all pieces.
 */
export function generateSuggestions(
  cutPieces: CutPiece[],
  stockSheets: StockSheet[],
  settings: Settings,
  currentResult: PackingResult
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const currentSheets = currentResult.totalSheets;

  if (currentSheets <= 1) return [];

  const trimAmounts = [0.125, 0.25, 0.375, 0.5, 0.75, 1.0];
  const seen = new Set<string>(); // prevent duplicate messages

  // --- Strategy 1: Trim one piece at a time ---
  for (const piece of cutPieces) {
    if (piece.width <= 0 || piece.height <= 0) continue;

    for (const dim of ['width', 'height'] as const) {
      for (const trim of trimAmounts) {
        const original = piece[dim];
        if (original - trim < 1) continue;

        const modifiedPieces = cutPieces.map((p) =>
          p.id === piece.id ? { ...p, [dim]: original - trim } : p
        );

        const newResult = packPieces(modifiedPieces, stockSheets, settings);
        const saved = currentSheets - newResult.totalSheets;

        if (saved > 0 && newResult.unplacedPieces.length === 0) {
          const dimLabel = dim === 'width' ? 'width' : 'height';
          const msg = `Reducing "${piece.label || 'Unnamed'}" ${dimLabel} by ${formatTrim(trim)}" (${original}" → ${original - trim}") saves ${saved} sheet${saved > 1 ? 's' : ''}`;
          if (!seen.has(msg)) {
            seen.add(msg);
            suggestions.push({ type: 'trim_piece', message: msg, sheetsSaved: saved });
          }
          break; // smallest effective trim for this piece+dim
        }
      }
    }
  }

  // --- Strategy 2: Uniform trim on all pieces ---
  for (const trim of trimAmounts) {
    const modifiedPieces = cutPieces.map((p) => ({
      ...p,
      width: Math.max(1, p.width - trim),
      height: Math.max(1, p.height - trim),
    }));

    const newResult = packPieces(modifiedPieces, stockSheets, settings);
    const saved = currentSheets - newResult.totalSheets;

    if (saved > 0 && newResult.unplacedPieces.length === 0) {
      const msg = `Trimming ${formatTrim(trim)}" off all pieces saves ${saved} sheet${saved > 1 ? 's' : ''}`;
      if (!seen.has(msg)) {
        seen.add(msg);
        suggestions.push({ type: 'trim_all', message: msg, sheetsSaved: saved });
      }
      break;
    }
  }

  // --- Strategy 3: Check if different kerf saves sheets ---
  if (settings.kerfWidth > 0) {
    const thinKerf = { ...settings, kerfWidth: settings.kerfWidth / 2 };
    const thinResult = packPieces(cutPieces, stockSheets, thinKerf);
    const saved = currentSheets - thinResult.totalSheets;
    if (saved > 0 && thinResult.unplacedPieces.length === 0) {
      const msg = `Using a thinner blade (${settings.kerfWidth / 2}" kerf) saves ${saved} sheet${saved > 1 ? 's' : ''}`;
      suggestions.push({ type: 'general', message: msg, sheetsSaved: saved });
    }
  }

  // --- Strategy 4: Check waste on last sheet ---
  if (currentResult.sheets.length > 1) {
    const lastSheet = currentResult.sheets[currentResult.sheets.length - 1];
    if (lastSheet.wastePercent > 70) {
      const piecesOnLast = lastSheet.placements.length;
      const totalPieces = currentResult.sheets.reduce((s, sh) => s + sh.placements.length, 0);
      const msg = `Last sheet is ${lastSheet.wastePercent.toFixed(0)}% waste with only ${piecesOnLast} of ${totalPieces} pieces — see if you can adjust dimensions to avoid it`;
      suggestions.push({ type: 'general', message: msg, sheetsSaved: 0 });
    }
  }

  // Sort: most sheets saved first, then by type priority
  return suggestions.sort((a, b) => {
    if (b.sheetsSaved !== a.sheetsSaved) return b.sheetsSaved - a.sheetsSaved;
    const typePriority = { trim_piece: 0, trim_all: 1, general: 2 };
    return typePriority[a.type] - typePriority[b.type];
  });
}

function formatTrim(inches: number): string {
  if (inches === 0.125) return '1/8';
  if (inches === 0.25) return '1/4';
  if (inches === 0.375) return '3/8';
  if (inches === 0.5) return '1/2';
  if (inches === 0.75) return '3/4';
  return String(inches);
}
