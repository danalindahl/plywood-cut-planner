import { CutPiece, StockSheet, Settings, PackingResult } from '../../types';
import { packPieces } from './guillotinePacker';

export interface Suggestion {
  type: 'trim_piece' | 'trim_some' | 'trim_all' | 'general';
  message: string;
  sheetsSaved: number;
  trimAmount?: number;
  pieceId?: string;
  pieceIds?: string[];
  dimension?: 'width' | 'height';
}

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
  const seen = new Set<string>();

  // --- Strategy 1: Trim one piece type at a time ---
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
          const msg = `Trim "${piece.label || 'Unnamed'}" ${dimLabel} by ${formatTrim(trim)}" (${original}" → ${original - trim}") — saves ${saved} sheet${saved > 1 ? 's' : ''}`;
          if (!seen.has(msg)) {
            seen.add(msg);
            suggestions.push({
              type: 'trim_piece', message: msg, sheetsSaved: saved,
              trimAmount: trim, pieceId: piece.id, dimension: dim,
            });
          }
          break;
        }
      }
    }
  }

  // --- Strategy 2: Identify pieces on the last sheet and try trimming just those ---
  if (currentResult.sheets.length > 1) {
    const lastSheet = currentResult.sheets[currentResult.sheets.length - 1];
    const lastSheetPieceIds = new Set(lastSheet.placements.map((p) => p.pieceId));

    // Try trimming only the piece types that appear on the last sheet
    for (const trim of trimAmounts) {
      const modifiedPieces = cutPieces.map((p) => {
        if (!lastSheetPieceIds.has(p.id)) return p;
        return {
          ...p,
          width: Math.max(1, p.width - trim),
          height: Math.max(1, p.height - trim),
        };
      });

      const newResult = packPieces(modifiedPieces, stockSheets, settings);
      const saved = currentSheets - newResult.totalSheets;

      if (saved > 0 && newResult.unplacedPieces.length === 0) {
        const pieceNames = cutPieces
          .filter((p) => lastSheetPieceIds.has(p.id))
          .map((p) => `"${p.label || 'Unnamed'}"`)
          .join(' and ');
        const msg = `Trim ${formatTrim(trim)}" off ${pieceNames} — saves ${saved} sheet${saved > 1 ? 's' : ''}`;
        if (!seen.has(msg)) {
          seen.add(msg);
          suggestions.push({
            type: 'trim_some', message: msg, sheetsSaved: saved,
            trimAmount: trim, pieceIds: [...lastSheetPieceIds],
          });
        }
        break;
      }
    }
  }

  // --- Strategy 3: Trim all pieces (last resort) ---
  // Only show if no per-piece suggestions found
  if (suggestions.filter((s) => s.type !== 'general').length === 0) {
    for (const trim of trimAmounts) {
      const modifiedPieces = cutPieces.map((p) => ({
        ...p,
        width: Math.max(1, p.width - trim),
        height: Math.max(1, p.height - trim),
      }));

      const newResult = packPieces(modifiedPieces, stockSheets, settings);
      const saved = currentSheets - newResult.totalSheets;

      if (saved > 0 && newResult.unplacedPieces.length === 0) {
        const msg = `Trim ${formatTrim(trim)}" off all pieces — saves ${saved} sheet${saved > 1 ? 's' : ''}`;
        if (!seen.has(msg)) {
          seen.add(msg);
          suggestions.push({ type: 'trim_all', message: msg, sheetsSaved: saved, trimAmount: trim });
        }
        break;
      }
    }
  }

  // --- Strategy 4: Thinner blade ---
  if (settings.kerfWidth > 0) {
    const thinKerf = { ...settings, kerfWidth: settings.kerfWidth / 2 };
    const thinResult = packPieces(cutPieces, stockSheets, thinKerf);
    const saved = currentSheets - thinResult.totalSheets;
    if (saved > 0 && thinResult.unplacedPieces.length === 0) {
      const msg = `Using a thinner blade (${settings.kerfWidth / 2}" kerf) would save ${saved} sheet${saved > 1 ? 's' : ''}`;
      suggestions.push({ type: 'general', message: msg, sheetsSaved: saved });
    }
  }

  // --- Strategy 5: Last sheet waste warning ---
  if (currentResult.sheets.length > 1) {
    const lastSheet = currentResult.sheets[currentResult.sheets.length - 1];
    if (lastSheet.wastePercent > 70) {
      const pieceNames = [...new Set(lastSheet.placements.map((p) => p.pieceLabel || 'Unnamed'))].join(', ');
      const msg = `Last sheet is ${lastSheet.wastePercent.toFixed(0)}% waste — only has: ${pieceNames}`;
      suggestions.push({ type: 'general', message: msg, sheetsSaved: 0 });
    }
  }

  return suggestions.sort((a, b) => {
    if (b.sheetsSaved !== a.sheetsSaved) return b.sheetsSaved - a.sheetsSaved;
    const typePriority: Record<string, number> = { trim_piece: 0, trim_some: 1, trim_all: 2, general: 3 };
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
