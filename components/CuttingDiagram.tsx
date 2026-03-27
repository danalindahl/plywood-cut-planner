import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Defs, Pattern } from 'react-native-svg';

import { SheetLayout, Placement } from '@/types';
import { PIECE_COLORS } from '@/constants/Colors';

interface CuttingDiagramProps {
  layout: SheetLayout;
  sheetIndex: number;
}

export default function CuttingDiagram({ layout, sheetIndex }: CuttingDiagramProps) {
  const { width: windowWidth } = useWindowDimensions();
  const padding = 32;
  const maxWidth = windowWidth - padding * 2;

  const sheetW = layout.stockSheet.width;
  const sheetH = layout.stockSheet.height;

  // Scale to fit the screen width, maintaining aspect ratio
  const scale = Math.min(maxWidth / sheetW, 500 / sheetH);
  const svgW = sheetW * scale;
  const svgH = sheetH * scale;

  // Build a color map: unique piece IDs get consistent colors
  const pieceIds = [...new Set(layout.placements.map((p) => p.pieceId))];
  const colorMap = new Map<string, string>();
  pieceIds.forEach((id, i) => {
    colorMap.set(id, PIECE_COLORS[i % PIECE_COLORS.length]);
  });

  return (
    <View style={styles.container}>
      <Svg width={svgW + 2} height={svgH + 2} viewBox={`-1 -1 ${sheetW + 2} ${sheetH + 2}`}>
        {/* Waste hatching pattern */}
        <Defs>
          <Pattern id={`hatch-${sheetIndex}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1="0" y1="0" x2="0" y2="8" stroke="#bbb" strokeWidth="1" opacity="0.4" />
          </Pattern>
        </Defs>

        {/* Sheet background (waste area) */}
        <Rect
          x={0}
          y={0}
          width={sheetW}
          height={sheetH}
          fill="#e8e8e8"
          stroke="#999"
          strokeWidth={0.5}
        />
        {/* Hatching over waste */}
        <Rect
          x={0}
          y={0}
          width={sheetW}
          height={sheetH}
          fill={`url(#hatch-${sheetIndex})`}
        />

        {/* Placed pieces */}
        {layout.placements.map((placement, i) => {
          const color = colorMap.get(placement.pieceId) || '#42A5F5';
          const fontSize = Math.min(placement.width, placement.height) * 0.2;
          const clampedFontSize = Math.max(3, Math.min(fontSize, 8));

          // Dimension label
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
              {placement.width > 6 && placement.height > 6 && (
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
              {/* Dimensions */}
              {placement.width > 10 && placement.height > 8 && (
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
        <Rect
          x={0}
          y={0}
          width={sheetW}
          height={sheetH}
          fill="none"
          stroke="#333"
          strokeWidth={1}
        />
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
