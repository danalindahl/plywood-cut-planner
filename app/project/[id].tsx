import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { CutPiece, StockSheet, Settings, Project } from '@/types';
import { generateId, DEFAULT_SETTINGS, DEFAULT_STOCK_SHEET } from '@/lib/defaults';
import { packPieces } from '@/lib/packing/guillotinePacker';
import { parseFraction } from '@/lib/fractions';
import { useProject } from '@/hooks/useProjects';

export default function ProjectEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { project, loading, save } = useProject(id ?? null);

  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [stockSheets, setStockSheets] = useState<StockSheet[]>([]);
  const [cutPieces, setCutPieces] = useState<CutPiece[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);
  const [showTrimming, setShowTrimming] = useState(false);

  useEffect(() => {
    if (project && !initialized) {
      setName(project.name);
      // Check if a folder was passed from the project list
      const passedFolder = (global as any).__newProjectFolder;
      setFolder(passedFolder || project.folder || '');
      if (passedFolder) delete (global as any).__newProjectFolder;
      setStockSheets(
        project.stockSheets.map((s) => ({
          ...DEFAULT_STOCK_SHEET,
          ...s,
        }))
      );
      setCutPieces(
        project.cutPieces.length > 0
          ? project.cutPieces
          : [
              { id: generateId(), label: 'Shelf', width: 24, height: 30, quantity: 6, canRotate: true },
              { id: generateId(), label: 'Side Panel', width: 12, height: 36, quantity: 4, canRotate: false },
              { id: generateId(), label: 'Back', width: 30, height: 36, quantity: 2, canRotate: true },
            ]
      );
      setSettings({ ...DEFAULT_SETTINGS, ...project.settings });
      setInitialized(true);
    }
  }, [project, initialized]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSave = useCallback(
    (n: string, f: string, ss: StockSheet[], cp: CutPiece[], st: Settings) => {
      if (!project) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        save({
          ...project,
          name: n,
          folder: f,
          stockSheets: ss,
          cutPieces: cp,
          settings: st,
          updatedAt: new Date().toISOString(),
        });
      }, 500);
    },
    [project, save]
  );

  useEffect(() => {
    if (initialized) autoSave(name, folder, stockSheets, cutPieces, settings);
  }, [name, folder, stockSheets, cutPieces, settings, initialized, autoSave]);

  function addSheet() {
    setStockSheets([...stockSheets, { ...DEFAULT_STOCK_SHEET, id: generateId() }]);
  }

  function removeSheet(index: number) {
    if (stockSheets.length <= 1) return;
    setStockSheets(stockSheets.filter((_, i) => i !== index));
  }

  function updateSheet(index: number, field: keyof StockSheet, value: string | number) {
    const updated = [...stockSheets];
    updated[index] = { ...updated[index], [field]: value };
    setStockSheets(updated);
  }

  function addPiece() {
    setCutPieces([
      ...cutPieces,
      { id: generateId(), label: '', width: 0, height: 0, quantity: 1, canRotate: true, enabled: true },
    ]);
  }

  function duplicatePiece(index: number) {
    const original = cutPieces[index];
    const copy = { ...original, id: generateId(), label: original.label ? `${original.label} (copy)` : '' };
    const updated = [...cutPieces];
    updated.splice(index + 1, 0, copy);
    setCutPieces(updated);
  }

  function autoLabelPieces() {
    const updated = cutPieces.map((p) => ({
      ...p,
      label: p.width && p.height ? `${p.width}×${p.height}` : p.label,
    }));
    setCutPieces(updated);
  }

  function updatePiece(index: number, field: keyof CutPiece, value: string | number | boolean) {
    const updated = [...cutPieces];
    updated[index] = { ...updated[index], [field]: value };
    setCutPieces(updated);
  }

  function removePiece(index: number) {
    setCutPieces(cutPieces.filter((_, i) => i !== index));
  }

  function showAlert(title: string, msg: string) {
    Platform.OS === 'web' ? alert(msg) : Alert.alert(title, msg);
  }

  function calculate() {
    const validPieces = cutPieces.filter((p) => p.width > 0 && p.height > 0 && p.quantity > 0);
    if (validPieces.length === 0) return showAlert('No Pieces', 'Add at least one cut piece with valid dimensions.');

    const validSheets = stockSheets.filter((s) => s.width > 0 && s.height > 0 && s.quantity > 0);
    if (validSheets.length === 0) return showAlert('No Stock', 'Add at least one stock sheet with valid dimensions.');

    const result = packPieces(validPieces, validSheets, settings);
    (global as any).__packingResult = result;
    (global as any).__packingInput = { pieces: validPieces, sheets: validSheets, settings };
    router.push('/results');
  }

  if (loading || !initialized) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </>
    );
  }

  const unitLabel = settings.units === 'imperial' ? 'in' : 'mm';

  return (
    <>
      <Stack.Screen options={{ title: name || 'Edit Project' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Project Name & Folder */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Project</Text>
          <TextInput
            style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="My Bookshelf"
            placeholderTextColor={colors.secondaryText}
          />
          <TextInput
            style={[styles.folderInput, { color: colors.text, borderColor: colors.border }]}
            value={folder}
            onChangeText={setFolder}
            placeholder="Folder (optional)"
            placeholderTextColor={colors.secondaryText}
          />
        </View>

        {/* Stock Sheets */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Stock Sheets</Text>

          {stockSheets.map((sheet, i) => (
            <View key={sheet.id} style={[styles.sheetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.pieceTopRow, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.labelInput, { color: colors.text, borderColor: colors.border }]}
                  value={sheet.label}
                  onChangeText={(t) => updateSheet(i, 'label', t)}
                  placeholder="3/4&quot; Plywood (4x8)"
                  placeholderTextColor={colors.secondaryText}
                />
                {stockSheets.length > 1 && (
                  <TouchableOpacity onPress={() => removeSheet(i)} style={styles.removeBtn}>
                    <Text style={{ color: colors.danger, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.row, { backgroundColor: colors.card }]}>
                <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>W</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={sheet.width ? String(sheet.width) : ''}
                    onChangeText={(t) => updateSheet(i, 'width', parseFraction(t))}
                    placeholder="48"
                    placeholderTextColor={colors.secondaryText}
                  />
                </View>
                <Text style={[styles.times, { color: colors.secondaryText }]}>×</Text>
                <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>H</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={sheet.height ? String(sheet.height) : ''}
                    onChangeText={(t) => updateSheet(i, 'height', parseFraction(t))}
                    placeholder="96"
                    placeholderTextColor={colors.secondaryText}
                  />
                </View>
                <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Qty</Text>
                  <TextInput
                    style={[styles.input, styles.qtyInput, { color: colors.text, borderColor: colors.border }]}
                    value={sheet.quantity ? String(sheet.quantity) : ''}
                    onChangeText={(t) => updateSheet(i, 'quantity', parseInt(t) || 0)}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={colors.secondaryText}
                  />
                </View>
              </View>
              <View style={[styles.row, { backgroundColor: colors.card }]}>
                <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>$/sheet</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={sheet.pricePerSheet ? String(sheet.pricePerSheet) : ''}
                    onChangeText={(t) => updateSheet(i, 'pricePerSheet', parseFloat(t) || 0)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.secondaryText}
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.tint }]}
            onPress={addSheet}
          >
            <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '600' }}>+ Add Stock Size</Text>
          </TouchableOpacity>

          {/* Settings row */}
          <View style={[styles.settingsBlock, { backgroundColor: colors.card }]}>
            <View style={[styles.settingsRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Blade Kerf ({unitLabel}):</Text>
              <TextInput
                style={[styles.input, styles.kerfInput, { color: colors.text, borderColor: colors.border }]}
                value={settings.kerfWidth ? String(settings.kerfWidth) : ''}
                onChangeText={(t) => setSettings({ ...settings, kerfWidth: parseFraction(t) })}
                placeholder="0.125"
                placeholderTextColor={colors.secondaryText}
              />
            </View>

            <View style={[styles.settingsRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Units:</Text>
              <View style={[styles.toggleRow, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    settings.units === 'imperial' && { backgroundColor: colors.tint },
                    { borderColor: colors.tint },
                  ]}
                  onPress={() => setSettings({ ...settings, units: 'imperial' })}
                >
                  <Text style={{ color: settings.units === 'imperial' ? '#fff' : colors.tint, fontSize: 13, fontWeight: '600' }}>
                    Inches
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    settings.units === 'metric' && { backgroundColor: colors.tint },
                    { borderColor: colors.tint },
                  ]}
                  onPress={() => setSettings({ ...settings, units: 'metric' })}
                >
                  <Text style={{ color: settings.units === 'metric' ? '#fff' : colors.tint, fontSize: 13, fontWeight: '600' }}>
                    mm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.settingsRow, { backgroundColor: colors.card }]}
              onPress={() => setShowTrimming(!showTrimming)}
            >
              <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>
                Edge Trimming {showTrimming ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {showTrimming && (
              <View style={[styles.trimGrid, { backgroundColor: colors.card }]}>
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                  <View key={side} style={[styles.trimItem, { backgroundColor: colors.card }]}>
                    <Text style={[styles.trimLabel, { color: colors.secondaryText }]}>
                      {side.charAt(0).toUpperCase() + side.slice(1)}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.trimInput, { color: colors.text, borderColor: colors.border }]}
                      value={settings.trimming[side] ? String(settings.trimming[side]) : ''}
                      onChangeText={(t) =>
                        setSettings({
                          ...settings,
                          trimming: { ...settings.trimming, [side]: parseFraction(t) },
                        })
                      }
                      placeholder="0"
                      placeholderTextColor={colors.secondaryText}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Cut Pieces */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cut Pieces</Text>
          <Text style={[styles.hint, { color: colors.secondaryText }]}>
            Supports fractions: type "23 1/2" or "23.5"
          </Text>

          {cutPieces.map((piece, i) => (
            <View
              key={piece.id}
              style={[
                styles.pieceCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                piece.enabled === false && { opacity: 0.45 },
              ]}
            >
              <View style={[styles.pieceTopRow, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  onPress={() => updatePiece(i, 'enabled', piece.enabled !== false ? false : true)}
                  style={styles.enableBtn}
                >
                  <View
                    style={[
                      styles.enableDot,
                      { backgroundColor: piece.enabled !== false ? colors.tint : colors.border },
                    ]}
                  />
                </TouchableOpacity>
                <TextInput
                  style={[styles.labelInput, { color: colors.text, borderColor: colors.border }]}
                  value={piece.label}
                  onChangeText={(t) => updatePiece(i, 'label', t)}
                  placeholder="Piece name"
                  placeholderTextColor={colors.secondaryText}
                />
                <TouchableOpacity onPress={() => duplicatePiece(i)} style={styles.actionBtn}>
                  <Text style={{ color: colors.secondaryText, fontSize: 16 }}>⧉</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePiece(i)} style={styles.actionBtn}>
                  <Text style={{ color: colors.danger, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.row, { backgroundColor: colors.card }]}>
                <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>W</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={piece.width ? String(piece.width) : ''}
                    onChangeText={(t) => updatePiece(i, 'width', parseFraction(t))}
                    placeholder="0"
                    placeholderTextColor={colors.secondaryText}
                  />
                </View>
                <Text style={[styles.times, { color: colors.secondaryText }]}>×</Text>
                <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>H</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={piece.height ? String(piece.height) : ''}
                    onChangeText={(t) => updatePiece(i, 'height', parseFraction(t))}
                    placeholder="0"
                    placeholderTextColor={colors.secondaryText}
                  />
                </View>
                <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Qty</Text>
                  <TextInput
                    style={[styles.input, styles.qtyInput, { color: colors.text, borderColor: colors.border }]}
                    value={piece.quantity ? String(piece.quantity) : ''}
                    onChangeText={(t) => updatePiece(i, 'quantity', parseInt(t) || 0)}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={colors.secondaryText}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.rotateToggle, { backgroundColor: colors.card }]}
                onPress={() => updatePiece(i, 'canRotate', !piece.canRotate)}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: colors.tint,
                      backgroundColor: piece.canRotate ? colors.tint : 'transparent',
                    },
                  ]}
                >
                  {piece.canRotate && (
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                  )}
                </View>
                <Text style={[styles.rotateLabel, { color: colors.secondaryText }]}>
                  Can rotate (no grain direction)
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={[styles.pieceActions, { backgroundColor: colors.card }]}>
            <TouchableOpacity style={[styles.addBtn, { borderColor: colors.tint, flex: 1 }]} onPress={addPiece}>
              <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '600' }}>+ Add Piece</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: colors.secondaryText }]}
              onPress={autoLabelPieces}
            >
              <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '600' }}>Auto-Label</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Calculate */}
        <TouchableOpacity style={[styles.calculateBtn, { backgroundColor: colors.tint }]} onPress={calculate}>
          <Text style={styles.calculateBtnText}>Calculate Cutting Plan</Text>
        </TouchableOpacity>

        <View style={{ height: 40, backgroundColor: 'transparent' }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  hint: { fontSize: 12, marginBottom: 10, marginTop: -6 },
  nameInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18,
  },
  folderInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginTop: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  inputGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600' },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16,
  },
  qtyInput: { maxWidth: 60 },
  kerfInput: { maxWidth: 80 },
  trimInput: { maxWidth: 60 },
  times: { fontSize: 18, fontWeight: '300' },
  sheetCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  pieceCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  pieceTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  labelInput: {
    flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, marginRight: 8,
  },
  removeBtn: { padding: 4 },
  actionBtn: { padding: 4, marginLeft: 4 },
  enableBtn: { padding: 4, marginRight: 4 },
  enableDot: { width: 12, height: 12, borderRadius: 6 },
  pieceActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rotateToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  checkbox: {
    width: 22, height: 22, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  rotateLabel: { fontSize: 13 },
  addBtn: {
    borderWidth: 2, borderStyle: 'dashed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4,
  },
  settingsBlock: { marginTop: 12 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  toggleRow: { flexDirection: 'row', gap: 0 },
  toggleBtn: {
    borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6,
  },
  trimGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8,
  },
  trimItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '45%' },
  trimLabel: { fontSize: 12, fontWeight: '600', width: 50 },
  calculateBtn: { borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  calculateBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
