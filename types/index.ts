// ---- Units & Settings ----

export type UnitSystem = 'imperial' | 'metric';

export type OptimizationMode = 'less_waste' | 'fewer_cuts';

export interface TrimSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Settings {
  kerfWidth: number; // blade thickness in current units (e.g., 0.125" for 1/8")
  units: UnitSystem;
  optimizationMode: OptimizationMode;
  trimming: TrimSettings; // factory edge trim per side
}

// ---- Stock Sheets ----

export interface StockSheet {
  id: string;
  width: number;
  height: number;
  quantity: number;
  label: string; // e.g., "3/4 Baltic Birch"
  pricePerSheet: number; // cost per sheet in user's currency
  material: string; // material group (e.g., "3/4 Plywood", "1/4 Plywood")
}

// ---- Cut Pieces ----

export interface EdgeBanding {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface CutPiece {
  id: string;
  label: string;
  width: number;
  height: number;
  quantity: number;
  canRotate: boolean; // false = grain direction matters
  edgeBanding?: EdgeBanding;
  material?: string; // must match a stock sheet material (optional — if blank, fits any)
}

// ---- Packing Results ----

export interface Placement {
  pieceId: string;
  pieceLabel: string;
  x: number;
  y: number;
  width: number; // as placed (may be swapped if rotated)
  height: number;
  rotated: boolean;
}

export interface Offcut {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  usable: boolean; // large enough to be worth keeping (> 6" on both sides)
}

export interface SheetLayout {
  stockSheet: StockSheet;
  placements: Placement[];
  offcuts: Offcut[];
  usedArea: number;
  wasteArea: number;
  wastePercent: number;
}

export interface ShoppingListItem {
  stockSheet: StockSheet;
  quantityNeeded: number;
  totalCost: number;
}

export interface PackingResult {
  sheets: SheetLayout[];
  totalSheets: number;
  totalUsedArea: number;
  totalWasteArea: number;
  totalWastePercent: number;
  unplacedPieces: CutPiece[];
  shoppingList: ShoppingListItem[];
  totalCost: number;
}

// ---- Projects ----

export interface Project {
  id: string;
  name: string;
  createdAt: string; // ISO date
  updatedAt: string;
  stockSheets: StockSheet[];
  cutPieces: CutPiece[];
  settings: Settings;
  lastResult?: PackingResult;
}
