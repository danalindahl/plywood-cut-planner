import { CutPiece } from '../types';
import { generateId } from './defaults';

/**
 * Export cut pieces to CSV string.
 */
export function exportPiecesToCsv(pieces: CutPiece[]): string {
  const header = 'Label,Width,Height,Quantity,Can Rotate,Enabled';
  const rows = pieces.map((p) =>
    [
      `"${(p.label || '').replace(/"/g, '""')}"`,
      p.width,
      p.height,
      p.quantity,
      p.canRotate !== false ? 'Yes' : 'No',
      p.enabled !== false ? 'Yes' : 'No',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Import cut pieces from CSV string.
 * Flexible — auto-detects columns by header names.
 */
export function importPiecesFromCsv(csv: string): CutPiece[] {
  const lines = csv.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header to find column indices
  const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  const col = (names: string[]): number =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  const labelCol = col(['label', 'name', 'piece']);
  const widthCol = col(['width', 'w']);
  const heightCol = col(['height', 'h', 'length', 'l']);
  const qtyCol = col(['qty', 'quantity', 'count', '#']);
  const rotateCol = col(['rotate', 'grain', 'orientation']);

  // Need at least width and height columns
  if (widthCol === -1 || heightCol === -1) {
    // Try positional: assume Label, Width, Height, Qty
    return lines.slice(1).map((line) => {
      const cols = parseCsvRow(line);
      return {
        id: generateId(),
        label: cols[0] || '',
        width: parseFloat(cols[1]) || 0,
        height: parseFloat(cols[2]) || 0,
        quantity: parseInt(cols[3]) || 1,
        canRotate: true,
        enabled: true,
      };
    }).filter((p) => p.width > 0 && p.height > 0);
  }

  return lines.slice(1).map((line) => {
    const cols = parseCsvRow(line);
    const yesNo = (val: string | undefined): boolean => {
      if (!val) return true;
      const v = val.toLowerCase().trim();
      return v !== 'no' && v !== 'false' && v !== '0';
    };

    return {
      id: generateId(),
      label: labelCol >= 0 ? cols[labelCol] || '' : '',
      width: parseFloat(cols[widthCol]) || 0,
      height: parseFloat(cols[heightCol]) || 0,
      quantity: qtyCol >= 0 ? parseInt(cols[qtyCol]) || 1 : 1,
      canRotate: rotateCol >= 0 ? yesNo(cols[rotateCol]) : true,
      enabled: true,
    };
  }).filter((p) => p.width > 0 && p.height > 0);
}

/**
 * Parse a single CSV row, handling quoted fields.
 */
function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',' || ch === '\t') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
