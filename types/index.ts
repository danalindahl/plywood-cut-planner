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
  enabled: boolean; // toggle piece on/off without deleting
  edgeBanding?: EdgeBanding;
  material?: string; // must match a stock sheet material (optional — if blank, fits any)
}

// ---- Cut Instructions ----

export interface CutInstruction {
  step: number;
  panelSize: string; // e.g., "96×48" — the piece being cut from
  cutPosition: string; // e.g., "y=36" or "x=24"
  cutDirection: 'horizontal' | 'vertical';
  cutValue: number; // the coordinate of the cut
  resultPiece: string | null; // e.g., "36×30" — a finished piece, or null if intermediate
  resultPieceLabel: string | null;
  surplus: string | null; // e.g., "surplus 30×24" — leftover from this cut
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
  cutInstructions: CutInstruction[];
  totalCuts: number;
  totalCutLength: number;
  usedArea: number;
  wasteArea: number;
  wastePercent: number;
  wastedPanelCount: number; // number of small unusable waste pieces
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
  totalCuts: number;
  totalCutLength: number;
  unplacedPieces: CutPiece[];
  shoppingList: ShoppingListItem[];
  totalCost: number;
}

// ---- Projects ----

export interface Project {
  id: string;
  name: string;
  folder: string; // folder/category name, empty string = unfiled
  createdAt: string; // ISO date
  updatedAt: string;
  stockSheets: StockSheet[];
  cutPieces: CutPiece[];
  settings: Settings;
  lastResult?: PackingResult;
}
