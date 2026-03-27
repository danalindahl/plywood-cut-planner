import { Project, Settings, StockSheet, CutPiece } from '../types';

let nextId = 1;
export function generateId(): string {
  return `id_${Date.now()}_${nextId++}`;
}

export const DEFAULT_SETTINGS: Settings = {
  kerfWidth: 0.125,
  units: 'imperial',
  optimizationMode: 'less_waste',
  trimming: { top: 0, bottom: 0, left: 0, right: 0 },
};

export const DEFAULT_STOCK_SHEET: StockSheet = {
  id: generateId(),
  width: 48,
  height: 96,
  quantity: 10,
  label: '3/4" Plywood (4×8)',
  pricePerSheet: 0,
  material: 'default',
};

export function createDefaultPiece(): CutPiece {
  return {
    id: generateId(),
    label: '',
    width: 0,
    height: 0,
    quantity: 1,
    canRotate: true,
  };
}

export function createNewProject(): Project {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: 'New Project',
    folder: '',
    createdAt: now,
    updatedAt: now,
    stockSheets: [{ ...DEFAULT_STOCK_SHEET, id: generateId() }],
    cutPieces: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

// Minimum offcut dimensions to be considered "usable" (in inches)
export const MIN_USABLE_OFFCUT = 6;
