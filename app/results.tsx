import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import CuttingDiagram from '@/components/CuttingDiagram';
import { PackingResult, CutPiece, StockSheet, Settings } from '@/types';
import { generatePdfHtml } from '@/lib/export/pdfTemplate';
import { generateSuggestions } from '@/lib/packing/suggestions';

export default function ResultsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [exporting, setExporting] = useState(false);

  const result: PackingResult | undefined = (global as any).__packingResult;
  const inputData: { pieces: CutPiece[]; sheets: StockSheet[]; settings: Settings } | undefined =
    (global as any).__packingInput;

  const suggestions = useMemo(() => {
    if (!result || !inputData) return [];
    return generateSuggestions(inputData.pieces, inputData.sheets, inputData.settings, result);
  }, [result, inputData]);

  if (!result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>No results yet</Text>
        <Text style={{ color: colors.secondaryText }}>Go back and calculate a cutting plan.</Text>
      </View>
    );
  }

  async function handleExport() {
    if (!result) return;
    setExporting(true);
    try {
      const html = generatePdfHtml(result);

      if (Platform.OS === 'web') {
        // On web, open a print dialog with the HTML
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        // On native, generate PDF and share
        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Cutting Plan',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF Saved', `PDF saved to: ${uri}`);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to export PDF';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Export Error', msg);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Summary Stats */}
      <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
        <View style={[styles.statsHeader, { backgroundColor: colors.card }]}>
          <Text style={[styles.statsTitle, { color: colors.text }]}>Summary</Text>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.tint }]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportBtnText}>Export PDF</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <StatBox
            label="Sheets"
            value={String(result.totalSheets)}
            colors={colors}
          />
          <StatBox
            label="Waste"
            value={`${result.totalWastePercent.toFixed(1)}%`}
            colors={colors}
            highlight={result.totalWastePercent > 30}
          />
          <StatBox
            label="Used"
            value={`${(100 - result.totalWastePercent).toFixed(1)}%`}
            colors={colors}
          />
        </View>
        <Text style={[styles.statsDetail, { color: colors.secondaryText }]}>
          {result.totalUsedArea.toFixed(0)} in² used of{' '}
          {(result.totalUsedArea + result.totalWasteArea).toFixed(0)} in² total
        </Text>
      </View>

      {/* Optimization Suggestions */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsCard, { backgroundColor: '#e8f5e9', borderColor: '#81C784' }]}>
          <Text style={[styles.suggestionsTitle, { color: '#2E7D32' }]}>
            Optimization Tips
          </Text>
          {suggestions.map((s, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Text style={[styles.suggestionBullet, { color: '#2E7D32' }]}>
                {s.sheetsSaved > 1 ? '!!' : ''}
              </Text>
              <Text style={[styles.suggestionText, { color: '#1b5e20' }]}>
                {s.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Unplaced pieces warning */}
      {result.unplacedPieces.length > 0 && (
        <View style={[styles.warningCard, { backgroundColor: '#fff3e0' }]}>
          <Text style={[styles.warningText, { color: '#e65100' }]}>
            ⚠ {result.unplacedPieces.length} piece(s) couldn't be placed:
          </Text>
          {result.unplacedPieces.map((p) => (
            <Text key={p.id} style={{ color: '#e65100', marginLeft: 16 }}>
              • {p.label || 'Unnamed'} ({p.width}×{p.height}) ×{p.quantity}
            </Text>
          ))}
        </View>
      )}

      {/* Shopping List */}
      {result.shoppingList && result.shoppingList.length > 0 && (
        <View style={[styles.sheetSection, { backgroundColor: colors.card }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Shopping List</Text>
          {result.shoppingList.map((item, i) => (
            <View key={i} style={[styles.cutListRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.cutListLabel, { color: colors.text }]}>
                {item.stockSheet.label}
              </Text>
              <Text style={[styles.cutListDim, { color: colors.secondaryText }]}>
                ×{item.quantityNeeded}
              </Text>
              <Text style={[styles.cutListPos, { color: colors.text, fontWeight: '600' }]}>
                {item.totalCost > 0 ? `$${item.totalCost.toFixed(2)}` : '—'}
              </Text>
            </View>
          ))}
          {result.totalCost > 0 && (
            <View style={[styles.totalRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.tint }]}>
                ${result.totalCost.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Sheet Diagrams */}
      {result.sheets.map((sheetLayout, i) => (
        <View key={i} style={[styles.sheetSection, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHeader, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Sheet {i + 1} of {result.totalSheets}
            </Text>
            <Text style={[styles.sheetStats, { color: colors.secondaryText }]}>
              {sheetLayout.stockSheet.width}×{sheetLayout.stockSheet.height} •{' '}
              {sheetLayout.placements.length} pieces •{' '}
              {sheetLayout.wastePercent.toFixed(1)}% waste
            </Text>
          </View>

          <CuttingDiagram layout={sheetLayout} sheetIndex={i} />

          {/* Cut list for this sheet */}
          <View style={[styles.cutList, { backgroundColor: colors.card }]}>
            <Text style={[styles.cutListTitle, { color: colors.secondaryText }]}>
              Cut List
            </Text>
            {sheetLayout.placements.map((p, j) => (
              <View key={j} style={[styles.cutListRow, { backgroundColor: colors.card }]}>
                <Text style={[styles.cutListLabel, { color: colors.text }]}>
                  {p.pieceLabel || `Piece ${j + 1}`}
                </Text>
                <Text style={[styles.cutListDim, { color: colors.secondaryText }]}>
                  {p.width}×{p.height}
                  {p.rotated ? ' (rotated)' : ''}
                </Text>
                <Text style={[styles.cutListPos, { color: colors.secondaryText }]}>
                  @ ({p.x}, {p.y})
                </Text>
              </View>
            ))}
          </View>

          {/* Usable Offcuts */}
          {sheetLayout.offcuts.filter((o) => o.usable).length > 0 && (
            <View style={[styles.cutList, { backgroundColor: colors.card }]}>
              <Text style={[styles.cutListTitle, { color: colors.tint }]}>
                Usable Offcuts
              </Text>
              {sheetLayout.offcuts
                .filter((o) => o.usable)
                .map((o, j) => (
                  <View key={j} style={[styles.cutListRow, { backgroundColor: colors.card }]}>
                    <Text style={[styles.cutListLabel, { color: colors.text }]}>
                      Offcut {j + 1}
                    </Text>
                    <Text style={[styles.cutListDim, { color: colors.secondaryText }]}>
                      {o.width}×{o.height}
                    </Text>
                    <Text style={[styles.cutListPos, { color: colors.secondaryText }]}>
                      {o.area.toFixed(0)} in²
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      ))}

      <View style={{ height: 40, backgroundColor: 'transparent' }} />
    </ScrollView>
  );
}

function StatBox({
  label,
  value,
  colors,
  highlight,
}: {
  label: string;
  value: string;
  colors: any;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
      <Text
        style={[
          styles.statValue,
          { color: highlight ? colors.danger : colors.tint },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.secondaryText }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 40 },
  statsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  exportBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  statsDetail: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 4,
  },
  warningCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningText: {
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sheetHeader: {
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetStats: {
    fontSize: 13,
    marginTop: 2,
  },
  cutList: {
    marginTop: 12,
  },
  cutListTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  cutListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  cutListLabel: {
    flex: 2,
    fontSize: 14,
  },
  cutListDim: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  cutListPos: {
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  suggestionsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 6,
  },
  suggestionBullet: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
});
