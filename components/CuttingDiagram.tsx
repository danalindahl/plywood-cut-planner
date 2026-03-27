import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Defs, Pattern } from 'react-native-svg';

import { SheetLayout } from '@/types';
import { PIECE_COLORS } from '@/constants/Colors';

interface CuttingDiagramProps {
  layout: SheetLayout;
  sheetIndex: number;
  zoom?: number;
  showLabels?: boolean;
}

export default function CuttingDiagram({ layout, sheetIndex, zoom = 1.0, showLabels = true }: CuttingDiagramProps) {
  const { width: windowWidth } = useWindowDimensions();
  const padding = 32;
  const maxWidth = (windowWidth - padding * 2) * zoom;

  const sheetW = layout.stockSheet.width;
  const sheetH = layout.stockSheet.height;

  // Extra space for edge dimension labels
  const labelMargin = 20;
  const scale = Math.min((maxWidth - labelMargin) / sheetW, (500 * zoom) / sheetH);
  const svgW = sheetW * scale;
  const svgH = sheetH * scale;

  // Viewbox includes margin for labels
  const vbLeft = -labelMargin;
  const vbTop = -2;
  const vbW = sheetW + labelMargin + 2;
  const vbH = sheetH + labelMargin + 2;

  // Build a color map: unique piece IDs get consistent colors
  const pieceIds = [...new Set(layout.placements.map((p) => p.pieceId))];
  const colorMap = new Map<string, string>();
  pieceIds.forEach((id, i) => {
    colorMap.set(id, PIECE_COLORS[i % PIECE_COLORS.length]);
  });

  const edgeLabelSize = Math.max(4, Math.min(sheetW * 0.04, 8));

  return (
    <View style={styles.container}>
      <Svg
        width={svgW + labelMargin}
        height={svgH + labelMargin}
        viewBox={`${vbLeft} ${vbTop} ${vbW} ${vbH}`}
      >
        {/* Waste hatching pattern */}
        <Defs>
          <Pattern
            id={`hatch-${sheetIndex}`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Line x1="0" y1="0" x2="0" y2="8" stroke="#bbb" strokeWidth="1" opacity="0.4" />
          </Pattern>
        </Defs>

        {/* Sheet background (waste area) */}
        <Rect x={0} y={0} width={sheetW} height={sheetH} fill="#e8e8e8" stroke="#999" strokeWidth={0.5} />
        <Rect x={0} y={0} width={sheetW} height={sheetH} fill={`url(#hatch-${sheetIndex})`} />

        {/* Placed pieces */}
        {layout.placements.map((placement, i) => {
          const color = colorMap.get(placement.pieceId) || '#42A5F5';
          const fontSize = Math.min(placement.width, placement.height) * 0.2;
          const clampedFontSize = Math.max(3, Math.min(fontSize, 8));

          const dimText = placement.rotated
            ? `${placement.height}×${placement.width} ↻`
            : `${placement.width}×${placement.height}`;

          return (
            <React.Fragment key={i}>
              <Rect
                x={placement.x}
                y={placement.y}
                width={placement.width}
                height={placement.height}
                fill={color}
                stroke="#fff"
                strokeWidth={0.5}
                opacity={0.85}
              />
              {/* Piece label */}
              {showLabels && placement.width > 6 && placement.height > 6 && (
                <SvgText
                  x={placement.x + placement.width / 2}
                  y={placement.y + placement.height / 2 - clampedFontSize * 0.3}
                  fontSize={clampedFontSize}
                  fill="#fff"
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {placement.pieceLabel || placement.pieceId}
                </SvgText>
              )}
              {/* Dimensions on piece */}
              {showLabels && placement.width > 10 && placement.height > 8 && (
                <SvgText
                  x={placement.x + placement.width / 2}
                  y={placement.y + placement.height / 2 + clampedFontSize * 0.8}
                  fontSize={clampedFontSize * 0.75}
                  fill="#fff"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  opacity={0.9}
                >
                  {dimText}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}

        {/* Sheet border */}
        <Rect x={0} y={0} width={sheetW} height={sheetH} fill="none" stroke="#333" strokeWidth={1} />

        {/* Edge dimension labels */}
        {/* Bottom: width */}
        <Line x1={0} y1={sheetH + 4} x2={sheetW} y2={sheetH + 4} stroke="#c00" strokeWidth={0.5} />
        <Line x1={0} y1={sheetH + 2} x2={0} y2={sheetH + 6} stroke="#c00" strokeWidth={0.5} />
        <Line x1={sheetW} y1={sheetH + 2} x2={sheetW} y2={sheetH + 6} stroke="#c00" strokeWidth={0.5} />
        <SvgText
          x={sheetW / 2}
          y={sheetH + 4 + edgeLabelSize}
          fontSize={edgeLabelSize}
          fill="#c00"
          textAnchor="middle"
          fontWeight="bold"
        >
          {sheetW}
        </SvgText>

        {/* Left: height */}
        <Line x1={-4} y1={0} x2={-4} y2={sheetH} stroke="#c00" strokeWidth={0.5} />
        <Line x1={-6} y1={0} x2={-2} y2={0} stroke="#c00" strokeWidth={0.5} />
        <Line x1={-6} y1={sheetH} x2={-2} y2={sheetH} stroke="#c00" strokeWidth={0.5} />
        <SvgText
          x={-4 - edgeLabelSize * 0.3}
          y={sheetH / 2}
          fontSize={edgeLabelSize}
          fill="#c00"
          textAnchor="middle"
          fontWeight="bold"
          transform={`rotate(-90, ${-4 - edgeLabelSize * 0.3}, ${sheetH / 2})`}
        >
          {sheetH}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
});
