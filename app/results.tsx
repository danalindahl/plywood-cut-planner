import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import { generateSuggestions, Suggestion } from '@/lib/packing/suggestions';
import { packPieces } from '@/lib/packing/guillotinePacker';
import { parseFraction } from '@/lib/fractions';

export default function ResultsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [exporting, setExporting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0); // for per-sheet navigation
  const [showAllSheets, setShowAllSheets] = useState(true);
  const [diagramZoom, setDiagramZoom] = useState(1.0);

  const initialResult: PackingResult | undefined = (global as any).__packingResult;
  const inputData: { pieces: CutPiece[]; sheets: StockSheet[]; settings: Settings } | undefined =
    (global as any).__packingInput;

  // Editable state — starts from the original input
  const [pieces, setPieces] = useState<CutPiece[]>(inputData?.pieces || []);
  const [sheets] = useState<StockSheet[]>(inputData?.sheets || []);
  const [settings] = useState<Settings>(inputData?.settings || { kerfWidth: 0.125, units: 'imperial', optimizationMode: 'less_waste', trimming: { top: 0, bottom: 0, left: 0, right: 0 } });
  const [result, setResult] = useState<PackingResult | undefined>(initialResult);

  const recalculate = useCallback((updatedPieces: CutPiece[]) => {
    const validPieces = updatedPieces.filter((p) => p.width > 0 && p.height > 0 && p.quantity > 0);
    const validSheets = sheets.filter((s) => s.width > 0 && s.height > 0 && s.quantity > 0);
    if (validPieces.length === 0 || validSheets.length === 0) return;
    const newResult = packPieces(validPieces, validSheets, settings);
    setResult(newResult);
    (global as any).__packingResult = newResult;
    (global as any).__packingInput = { pieces: updatedPieces, sheets, settings };
  }, [sheets, settings]);

  function updatePiece(index: number, field: 'width' | 'height' | 'quantity', value: number) {
    const updated = [...pieces];
    updated[index] = { ...updated[index], [field]: value };
    setPieces(updated);
    recalculate(updated);
  }

  const suggestions = useMemo(() => {
    if (!result || pieces.length === 0) return [];
    return generateSuggestions(pieces, sheets, settings, result);
  }, [result, pieces, sheets, settings]);

  function applySuggestion(suggestion: Suggestion) {
    let updated: CutPiece[];
    if (suggestion.type === 'trim_all' && suggestion.trimAmount) {
      updated = pieces.map((p) => ({
        ...p,
        width: Math.max(1, p.width - suggestion.trimAmount!),
        height: Math.max(1, p.height - suggestion.trimAmount!),
      }));
    } else if (suggestion.type === 'trim_some' && suggestion.pieceIds && suggestion.trimAmount) {
      const ids = new Set(suggestion.pieceIds);
      const dim = suggestion.dimension; // undefined means both
      updated = pieces.map((p) => {
        if (!ids.has(p.id)) return p;
        return {
          ...p,
          width: (!dim || dim === 'width') ? Math.max(1, p.width - suggestion.trimAmount!) : p.width,
          height: (!dim || dim === 'height') ? Math.max(1, p.height - suggestion.trimAmount!) : p.height,
        };
      });
    } else if (suggestion.type === 'trim_piece' && suggestion.pieceId && suggestion.dimension) {
      updated = pieces.map((p) => {
        if (p.id !== suggestion.pieceId) return p;
        return {
          ...p,
          [suggestion.dimension!]: Math.max(1, p[suggestion.dimension!] - suggestion.trimAmount!),
        };
      });
    } else {
      return;
    }
    setPieces(updated);
    recalculate(updated);
  }

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
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
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
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Export Error', msg);
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
          <View style={[styles.headerBtns, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[styles.headerBtn, { borderColor: colors.tint }]}
              onPress={() => setShowEditor(!showEditor)}
            >
              <Text style={{ color: colors.tint, fontSize: 13, fontWeight: '600' }}>
                {showEditor ? 'Hide Editor' : 'Edit Pieces'}
              </Text>
            </TouchableOpacity>
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
        </View>
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <StatBox label="Sheets" value={String(result.totalSheets)} colors={colors} />
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
          <StatBox label="Cuts" value={String(result.totalCuts || 0)} colors={colors} />
        </View>
        <Text style={[styles.statsDetail, { color: colors.secondaryText }]}>
          {result.totalUsedArea.toFixed(0)} in² used of{' '}
          {(result.totalUsedArea + result.totalWasteArea).toFixed(0)} in² total
          {result.totalCutLength ? ` · ${result.totalCutLength.toFixed(0)}" total cut length` : ''}
        </Text>
      </View>

      {/* Inline Piece Editor */}
      {showEditor && (
        <View style={[styles.editorCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.editorTitle, { color: colors.text }]}>Edit Dimensions</Text>
          <Text style={[styles.editorHint, { color: colors.secondaryText }]}>
            Changes recalculate instantly
          </Text>
          <View style={[styles.editorHeaderRow, { backgroundColor: colors.card }]}>
            <Text style={[styles.editorHeaderLabel, { color: colors.secondaryText }]}>Piece</Text>
            <View style={[styles.editorHeaderInputs, { backgroundColor: colors.card }]}>
              <Text style={[styles.editorHeaderCol, { color: colors.secondaryText }]}>Width</Text>
              <Text style={[styles.editorHeaderSpacer, { color: colors.card }]}>×</Text>
              <Text style={[styles.editorHeaderCol, { color: colors.secondaryText }]}>Height</Text>
              <Text style={[styles.editorHeaderSpacer, { color: colors.card }]}>×</Text>
              <Text style={[styles.editorHeaderQty, { color: colors.secondaryText }]}>Qty</Text>
            </View>
          </View>
          {pieces.map((piece, i) => (
            <View key={piece.id} style={[styles.editorRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <Text style={[styles.editorLabel, { color: colors.text }]} numberOfLines={1}>
                {piece.label || 'Unnamed'}
              </Text>
              <View style={[styles.editorInputs, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.editorInput, { color: colors.text, borderColor: colors.border }]}
                  value={piece.width ? String(piece.width) : ''}
                  onChangeText={(t) => updatePiece(i, 'width', parseFraction(t))}
                  placeholder="W"
                  placeholderTextColor={colors.secondaryText}
                />
                <Text style={[styles.editorX, { color: colors.secondaryText }]}>×</Text>
                <TextInput
                  style={[styles.editorInput, { color: colors.text, borderColor: colors.border }]}
                  value={piece.height ? String(piece.height) : ''}
                  onChangeText={(t) => updatePiece(i, 'height', parseFraction(t))}
                  placeholder="H"
                  placeholderTextColor={colors.secondaryText}
                />
                <Text style={[styles.editorX, { color: colors.secondaryText }]}>×</Text>
                <TextInput
                  style={[styles.editorInput, styles.editorQty, { color: colors.text, borderColor: colors.border }]}
                  value={piece.quantity ? String(piece.quantity) : ''}
                  onChangeText={(t) => updatePiece(i, 'quantity', parseInt(t) || 0)}
                  keyboardType="number-pad"
                  placeholder="#"
                  placeholderTextColor={colors.secondaryText}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Optimization Suggestions */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsCard, { backgroundColor: '#e8f5e9', borderColor: '#81C784' }]}>
          <Text style={[styles.suggestionsTitle, { color: '#2E7D32' }]}>
            Optimization Tips
          </Text>
          {suggestions.map((s, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Text style={[styles.suggestionText, { color: '#1b5e20' }]}>
                {s.message}
              </Text>
              {(s.type === 'trim_piece' || s.type === 'trim_some' || s.type === 'trim_all') && (
                <TouchableOpacity
                  style={[styles.applyBtn, { backgroundColor: '#2E7D32' }]}
                  onPress={() => applySuggestion(s)}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Unplaced pieces warning */}
      {result.unplacedPieces.length > 0 && (
        <View style={[styles.warningCard, { backgroundColor: '#fff3e0' }]}>
          <Text style={[styles.warningText, { color: '#e65100' }]}>
            {result.unplacedPieces.length} piece(s) couldn't be placed:
          </Text>
          {result.unplacedPieces.map((p) => (
            <Text key={p.id} style={{ color: '#e65100', marginLeft: 16 }}>
              {p.label || 'Unnamed'} ({p.width}×{p.height}) ×{p.quantity}
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

      {/* Sheet Navigation & Toolbar */}
      {result.sheets.length > 1 && (
        <View style={[styles.sheetNav, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.navBtn, { borderColor: colors.border }]}
            onPress={() => setShowAllSheets(!showAllSheets)}
          >
            <Text style={{ color: colors.tint, fontSize: 12, fontWeight: '600' }}>
              {showAllSheets ? 'Show One at a Time' : 'Show All Sheets'}
            </Text>
          </TouchableOpacity>
          {!showAllSheets && (
            <View style={[styles.navArrows, { backgroundColor: colors.card }]}>
              <TouchableOpacity
                onPress={() => setActiveSheet(Math.max(0, activeSheet - 1))}
                disabled={activeSheet === 0}
                style={[styles.arrowBtn, { opacity: activeSheet === 0 ? 0.3 : 1 }]}
              >
                <Text style={{ color: colors.tint, fontSize: 20, fontWeight: '700' }}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.navLabel, { color: colors.text }]}>
                Sheet {activeSheet + 1} of {result.totalSheets}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveSheet(Math.min(result.totalSheets - 1, activeSheet + 1))}
                disabled={activeSheet >= result.totalSheets - 1}
                style={[styles.arrowBtn, { opacity: activeSheet >= result.totalSheets - 1 ? 0.3 : 1 }]}
              >
                <Text style={{ color: colors.tint, fontSize: 20, fontWeight: '700' }}>›</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.zoomControls, { backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={() => setDiagramZoom(Math.max(0.5, diagramZoom - 0.25))} style={styles.zoomBtn}>
              <Text style={{ color: colors.secondaryText, fontSize: 16, fontWeight: '700' }}>−</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.secondaryText, fontSize: 11 }}>{Math.round(diagramZoom * 100)}%</Text>
            <TouchableOpacity onPress={() => setDiagramZoom(Math.min(2.0, diagramZoom + 0.25))} style={styles.zoomBtn}>
              <Text style={{ color: colors.secondaryText, fontSize: 16, fontWeight: '700' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sheet Diagrams */}
      {(showAllSheets ? result.sheets : [result.sheets[activeSheet]]).filter(Boolean).map((sheetLayout, displayIdx) => {
        const i = showAllSheets ? displayIdx : activeSheet;
        return (
        <View key={i} style={[styles.sheetSection, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHeader, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Sheet {i + 1} of {result.totalSheets}
            </Text>
            <Text style={[styles.sheetStats, { color: colors.secondaryText }]}>
              {sheetLayout.stockSheet.width}×{sheetLayout.stockSheet.height} •{' '}
              {sheetLayout.placements.length} pieces •{' '}
              {sheetLayout.wastePercent.toFixed(1)}% waste •{' '}
              {sheetLayout.totalCuts} cuts
              {sheetLayout.wastedPanelCount > 0 ? ` • ${sheetLayout.wastedPanelCount} waste pieces` : ''}
            </Text>
          </View>

          <CuttingDiagram layout={sheetLayout} sheetIndex={i} zoom={diagramZoom} />

          <View style={[styles.cutList, { backgroundColor: colors.card }]}>
            <Text style={[styles.cutListTitle, { color: colors.secondaryText }]}>Cut List</Text>
            {sheetLayout.placements.map((p, j) => (
              <View key={j} style={[styles.cutListRow, { backgroundColor: colors.card }]}>
                <Text style={[styles.cutListLabel, { color: colors.text }]}>
                  {p.pieceLabel || `Piece ${j + 1}`}
                </Text>
                <Text style={[styles.cutListDim, { color: colors.secondaryText }]}>
                  {p.width}×{p.height}{p.rotated ? ' (rotated)' : ''}
                </Text>
                <Text style={[styles.cutListPos, { color: colors.secondaryText }]}>
                  @ ({p.x}, {p.y})
                </Text>
              </View>
            ))}
          </View>

          {/* Step-by-step cut instructions */}
          {sheetLayout.cutInstructions && sheetLayout.cutInstructions.length > 0 && (
            <View style={[styles.cutList, { backgroundColor: colors.card }]}>
              <Text style={[styles.cutListTitle, { color: colors.text, fontSize: 14, fontWeight: '700' }]}>
                Cuts ({sheetLayout.totalCuts} cuts · {sheetLayout.totalCutLength.toFixed(0)}" total)
              </Text>
              <View style={[styles.cutInstructionHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.cutInstCol1, { color: colors.secondaryText }]}>#</Text>
                <Text style={[styles.cutInstCol2, { color: colors.secondaryText }]}>Panel</Text>
                <Text style={[styles.cutInstCol3, { color: colors.secondaryText }]}>Cut</Text>
                <Text style={[styles.cutInstCol4, { color: colors.secondaryText }]}>Result</Text>
              </View>
              {sheetLayout.cutInstructions.map((inst, j) => (
                <View key={j} style={[styles.cutInstructionRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                  <Text style={[styles.cutInstCol1, { color: colors.secondaryText }]}>{inst.step}</Text>
                  <Text style={[styles.cutInstCol2, { color: colors.text }]}>{inst.panelSize}</Text>
                  <Text style={[styles.cutInstCol3, { color: colors.tint, fontWeight: '600' }]}>{inst.cutPosition}</Text>
                  <Text style={[styles.cutInstCol4, { color: colors.text }]}>
                    {inst.resultPiece || '—'}
                    {inst.surplus ? ` · surplus ${inst.surplus}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {sheetLayout.offcuts.filter((o) => o.usable).length > 0 && (
            <View style={[styles.cutList, { backgroundColor: colors.card }]}>
              <Text style={[styles.cutListTitle, { color: colors.tint }]}>Usable Offcuts</Text>
              {sheetLayout.offcuts
                .filter((o) => o.usable)
                .map((o, j) => (
                  <View key={j} style={[styles.cutListRow, { backgroundColor: colors.card }]}>
                    <Text style={[styles.cutListLabel, { color: colors.text }]}>Offcut {j + 1}</Text>
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
        );
      })}

      <View style={{ height: 40, backgroundColor: 'transparent' }} />
    </ScrollView>
  );
}

function StatBox({ label, value, colors, highlight }: {
  label: string; value: string; colors: any; highlight?: boolean;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
      <Text style={[styles.statValue, { color: highlight ? colors.danger : colors.tint }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 40 },
  statsCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  statsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  statsTitle: { fontSize: 18, fontWeight: '700' },
  exportBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minWidth: 100, alignItems: 'center' },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 13, marginTop: 2 },
  statsDetail: { textAlign: 'center', fontSize: 13, marginTop: 4 },

  editorCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  editorTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  editorHint: { fontSize: 12, marginBottom: 12 },
  editorHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 4, marginBottom: 4, gap: 8,
  },
  editorHeaderLabel: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  editorHeaderInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editorHeaderCol: { width: 55, fontSize: 11, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase' },
  editorHeaderQty: { width: 40, fontSize: 11, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase' },
  editorHeaderSpacer: { fontSize: 14 },
  editorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, gap: 8,
  },
  editorLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  editorInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editorInput: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 15, width: 55, textAlign: 'center',
  },
  editorQty: { width: 40 },
  editorX: { fontSize: 14 },

  suggestionsCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  suggestionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, gap: 8,
  },
  suggestionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  applyBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  warningCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  warningText: { fontWeight: '700', marginBottom: 4 },
  sheetSection: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sheetHeader: { marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetStats: { fontSize: 13, marginTop: 2 },
  cutList: { marginTop: 12 },
  cutListTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  cutListRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  cutListLabel: { flex: 2, fontSize: 14 },
  cutListDim: { flex: 1, fontSize: 14, textAlign: 'center' },
  cutListPos: { flex: 1, fontSize: 12, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 8, borderTopWidth: 1,
  },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  sheetNav: {
    borderRadius: 12, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
  },
  navBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  navArrows: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  arrowBtn: { padding: 4 },
  navLabel: { fontSize: 14, fontWeight: '600' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoomBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  cutInstructionHeader: {
    flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, marginBottom: 2,
  },
  cutInstructionRow: {
    flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5,
  },
  cutInstCol1: { width: 24, fontSize: 12, fontWeight: '600' },
  cutInstCol2: { width: 60, fontSize: 12 },
  cutInstCol3: { width: 50, fontSize: 12 },
  cutInstCol4: { flex: 1, fontSize: 12 },
});
