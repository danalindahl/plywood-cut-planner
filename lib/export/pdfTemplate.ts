import { PackingResult, SheetLayout, Placement } from '../../types';
import { PIECE_COLORS } from '../../constants/Colors';

function buildColorMap(placements: Placement[]): Map<string, string> {
  const ids = [...new Set(placements.map((p) => p.pieceId))];
  const map = new Map<string, string>();
  ids.forEach((id, i) => map.set(id, PIECE_COLORS[i % PIECE_COLORS.length]));
  return map;
}

function sheetBlock(layout: SheetLayout, index: number): string {
  const { stockSheet, placements } = layout;
  const w = stockSheet.width;
  const h = stockSheet.height;

  // Cap the diagram to fit within ~350px max height so diagram + cut list fit on one page together
  const maxW = 380;
  const maxH = 300;
  const scale = Math.min(maxW / w, maxH / h);
  const svgW = w * scale;
  const svgH = h * scale;

  const colorMap = buildColorMap(placements);

  let pieces = '';
  for (const p of placements) {
    const color = colorMap.get(p.pieceId) || '#42A5F5';
    const fontSize = Math.min(p.width, p.height) * 0.18 * scale;
    const clampedFont = Math.max(6, Math.min(fontSize, 12));
    const dimFont = clampedFont * 0.75;
    const dimText = p.rotated
      ? `${p.height}&times;${p.width} &#8635;`
      : `${p.width}&times;${p.height}`;

    pieces += `<rect x="${p.x * scale}" y="${p.y * scale}" width="${p.width * scale}" height="${p.height * scale}"
          fill="${color}" stroke="#fff" stroke-width="0.5" opacity="0.85"/>`;

    if (p.width * scale > 24 && p.height * scale > 16) {
      pieces += `<text x="${(p.x + p.width / 2) * scale}" y="${(p.y + p.height / 2) * scale - clampedFont * 0.15}"
          font-size="${clampedFont}" fill="#fff" font-weight="bold"
          text-anchor="middle" dominant-baseline="middle">${p.pieceLabel || p.pieceId}</text>`;
      pieces += `<text x="${(p.x + p.width / 2) * scale}" y="${(p.y + p.height / 2) * scale + clampedFont * 0.7}"
          font-size="${dimFont}" fill="#fff"
          text-anchor="middle" dominant-baseline="middle" opacity="0.9">${dimText}</text>`;
    }
  }

  // Compact cut list as inline rows
  let cutRows = '';
  for (const p of placements) {
    const rot = p.rotated ? ' <span class="rot">R</span>' : '';
    cutRows += `<div class="cl-row"><span class="cl-name">${p.pieceLabel || '—'}</span><span class="cl-dim">${p.width}&times;${p.height}${rot}</span></div>`;
  }

  return `
    <div class="sheet-block">
      <div class="sheet-title">Sheet ${index + 1} — ${w}&times;${h} · ${placements.length} pcs · ${layout.wastePercent.toFixed(1)}% waste</div>
      <div class="sheet-row">
        <div class="sheet-svg">
          <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="h${index}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#bbb" stroke-width="0.8" opacity="0.35"/>
              </pattern>
            </defs>
            <rect width="${svgW}" height="${svgH}" fill="#e8e8e8" stroke="#999" stroke-width="0.5"/>
            <rect width="${svgW}" height="${svgH}" fill="url(#h${index})"/>
            ${pieces}
            <rect width="${svgW}" height="${svgH}" fill="none" stroke="#333" stroke-width="1"/>
          </svg>
        </div>
        <div class="sheet-cuts">
          <div class="cl-header"><span class="cl-name">Piece</span><span class="cl-dim">Size</span></div>
          ${cutRows}
        </div>
      </div>
    </div>`;
}

export function generatePdfHtml(result: PackingResult): string {
  const totalArea = result.totalUsedArea + result.totalWasteArea;
  const usedPercent = totalArea > 0 ? (100 - result.totalWastePercent).toFixed(1) : '0';

  let sheetsHtml = '';
  for (let i = 0; i < result.sheets.length; i++) {
    sheetsHtml += sheetBlock(result.sheets[i], i);
  }

  let unplacedHtml = '';
  if (result.unplacedPieces.length > 0) {
    unplacedHtml = `
      <div class="warning">
        <strong>&#9888; Unplaced:</strong>
        ${result.unplacedPieces
          .map((p) => `${p.label || '?'} (${p.width}&times;${p.height}) &times;${p.quantity}`)
          .join(', ')}
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a1a;
    padding: 12px 16px;
    font-size: 10px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 2px solid #2E7D32;
    padding-bottom: 6px;
    margin-bottom: 10px;
  }
  h1 { font-size: 18px; color: #2E7D32; }
  .header-stats { font-size: 11px; color: #444; }
  .header-stats strong { color: #2E7D32; font-size: 13px; }
  .header-stats .warn { color: #d32f2f; }

  .sheet-block {
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .sheet-title {
    font-size: 11px;
    font-weight: 700;
    color: #333;
    margin-bottom: 4px;
    padding: 3px 6px;
    background: #f0f0f0;
    border-radius: 3px;
  }
  .sheet-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .sheet-svg { flex-shrink: 0; }
  .sheet-svg svg { display: block; }
  .sheet-cuts {
    flex: 1;
    min-width: 140px;
  }
  .cl-header {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: 9px;
    color: #666;
    border-bottom: 1px solid #ccc;
    padding-bottom: 2px;
    margin-bottom: 2px;
  }
  .cl-row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
    font-size: 9px;
    border-bottom: 1px solid #f0f0f0;
  }
  .cl-name { flex: 1; }
  .cl-dim { text-align: right; white-space: nowrap; }
  .rot {
    display: inline-block;
    background: #666;
    color: #fff;
    font-size: 7px;
    padding: 0 3px;
    border-radius: 2px;
    margin-left: 3px;
    font-weight: 700;
  }

  .warning {
    background: #fff3e0;
    border: 1px solid #ffb74d;
    border-radius: 4px;
    padding: 6px 10px;
    margin-bottom: 10px;
    color: #e65100;
    font-size: 10px;
  }
  .footer {
    margin-top: 12px;
    text-align: center;
    font-size: 8px;
    color: #bbb;
  }
  @media print {
    body { padding: 8px; }
    .sheet-block { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Cutting Plan</h1>
    <div class="header-stats">
      <strong>${result.totalSheets}</strong> sheets ·
      <strong class="${result.totalWastePercent > 30 ? 'warn' : ''}">${result.totalWastePercent.toFixed(1)}%</strong> waste ·
      <strong>${usedPercent}%</strong> used ·
      ${result.totalUsedArea.toFixed(0)} in&sup2; of ${totalArea.toFixed(0)} in&sup2;
    </div>
  </div>
  ${unplacedHtml}
  ${sheetsHtml}
  <div class="footer">Plywood Cut Planner</div>
</body>
</html>`;
}
