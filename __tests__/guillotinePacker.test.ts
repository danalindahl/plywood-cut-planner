import { packPieces } from '../lib/packing/guillotinePacker';
import { CutPiece, StockSheet, Settings } from '../types';

function sheet(
  width: number,
  height: number,
  quantity = 10,
  label = 'Plywood'
): StockSheet {
  return { id: 's1', width, height, quantity, label, pricePerSheet: 0, material: 'default' };
}

function piece(
  id: string,
  label: string,
  width: number,
  height: number,
  quantity = 1,
  canRotate = true
): CutPiece {
  return { id, label, width, height, quantity, canRotate };
}

const defaultSettings: Settings = {
  kerfWidth: 0,
  units: 'imperial',
  optimizationMode: 'less_waste',
  trimming: { top: 0, bottom: 0, left: 0, right: 0 },
};

const settingsWithKerf: Settings = {
  ...defaultSettings,
  kerfWidth: 0.125,
};

describe('Guillotine Packer', () => {
  describe('Basic packing', () => {
    test('single piece that exactly fills a sheet', () => {
      const result = packPieces(
        [piece('a', 'Full Sheet', 48, 96)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.totalWastePercent).toBeCloseTo(0);
      expect(result.unplacedPieces).toHaveLength(0);
    });

    test('two half-sheets fill one sheet', () => {
      const result = packPieces(
        [piece('a', 'Half', 48, 48, 2)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.totalWastePercent).toBeCloseTo(0);
    });

    test('four quarter-sheets fill one sheet', () => {
      const result = packPieces(
        [piece('a', 'Quarter', 24, 48, 4)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.totalWastePercent).toBeCloseTo(0);
    });

    test('eight pieces of 24x24 from a 48x96 sheet', () => {
      const result = packPieces(
        [piece('a', 'Small', 24, 24, 8)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.totalWastePercent).toBeCloseTo(0);
    });
  });

  describe('Multiple sheets', () => {
    test('9 pieces of 24x24 require 2 sheets', () => {
      const result = packPieces(
        [piece('a', 'Small', 24, 24, 9)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(2);
      expect(result.unplacedPieces).toHaveLength(0);
    });

    test('pieces overflow to additional sheets', () => {
      const result = packPieces(
        [piece('a', 'Big', 48, 96, 3)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(3);
      expect(result.unplacedPieces).toHaveLength(0);
    });
  });

  describe('Rotation', () => {
    test('piece rotates to fit when canRotate is true', () => {
      const result = packPieces(
        [piece('a', 'Tall', 20, 96, 1, true)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.unplacedPieces).toHaveLength(0);
    });

    test('piece does NOT rotate when canRotate is false', () => {
      const result = packPieces(
        [piece('a', 'Wide', 96, 20, 1, false)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.unplacedPieces).toHaveLength(1);
    });

    test('piece rotates to fit a tight space', () => {
      const result = packPieces(
        [piece('a', 'Needs Rotation', 60, 30, 1, true)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.sheets[0].placements[0].rotated).toBe(true);
    });
  });

  describe('Kerf handling', () => {
    test('kerf reduces usable space', () => {
      const resultNoKerf = packPieces(
        [piece('a', 'Half', 24, 48, 4)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(resultNoKerf.totalSheets).toBe(1);

      const resultWithKerf = packPieces(
        [piece('a', 'Half', 24, 48, 4)],
        [sheet(48, 96)],
        settingsWithKerf
      );
      expect(resultWithKerf.totalSheets).toBeGreaterThanOrEqual(1);
      expect(resultWithKerf.totalSheets).toBeLessThanOrEqual(2);
      expect(resultWithKerf.totalWastePercent).toBeGreaterThan(0);
    });

    test('kerf can push pieces to additional sheets', () => {
      const result = packPieces(
        [piece('a', 'Tight', 24, 24, 8)],
        [sheet(48, 96)],
        settingsWithKerf
      );
      expect(result.unplacedPieces).toHaveLength(0);
      expect(result.totalWastePercent).toBeGreaterThan(0);
    });
  });

  describe('Trimming', () => {
    test('trimming reduces usable area', () => {
      const trimSettings: Settings = {
        ...defaultSettings,
        trimming: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      };
      // 48x96 with 0.5" trim on all sides = 47x95 usable
      // A piece of exactly 48x96 won't fit
      const result = packPieces(
        [piece('a', 'Full', 48, 96)],
        [sheet(48, 96)],
        trimSettings
      );
      expect(result.unplacedPieces).toHaveLength(1);
    });

    test('trimmed piece still fits', () => {
      const trimSettings: Settings = {
        ...defaultSettings,
        trimming: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      };
      const result = packPieces(
        [piece('a', 'Fits', 47, 95)],
        [sheet(48, 96)],
        trimSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.unplacedPieces).toHaveLength(0);
    });
  });

  describe('Offcut tracking', () => {
    test('offcuts are reported for partially used sheets', () => {
      const result = packPieces(
        [piece('a', 'Small', 24, 24)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.sheets[0].offcuts.length).toBeGreaterThan(0);
      const usableOffcuts = result.sheets[0].offcuts.filter((o) => o.usable);
      expect(usableOffcuts.length).toBeGreaterThan(0);
    });

    test('no offcuts on perfectly filled sheet', () => {
      const result = packPieces(
        [piece('a', 'Full', 48, 96)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.sheets[0].offcuts).toHaveLength(0);
    });
  });

  describe('Shopping list', () => {
    test('shopping list shows correct quantities', () => {
      const result = packPieces(
        [piece('a', 'Big', 48, 96, 3)],
        [sheet(48, 96, 10, 'Ply')],
        defaultSettings
      );
      expect(result.shoppingList).toHaveLength(1);
      expect(result.shoppingList[0].quantityNeeded).toBe(3);
    });

    test('shopping list calculates cost', () => {
      const s: StockSheet = {
        id: 's1', width: 48, height: 96, quantity: 10,
        label: 'Ply', pricePerSheet: 52, material: 'default',
      };
      const result = packPieces(
        [piece('a', 'Big', 48, 96, 2)],
        [s],
        defaultSettings
      );
      expect(result.totalCost).toBe(104);
      expect(result.shoppingList[0].totalCost).toBe(104);
    });
  });

  describe('Edge cases', () => {
    test('piece larger than any stock sheet is unplaced', () => {
      const result = packPieces(
        [piece('a', 'Huge', 100, 100)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(0);
      expect(result.unplacedPieces).toHaveLength(1);
    });

    test('empty cut list returns empty result', () => {
      const result = packPieces([], [sheet(48, 96)], defaultSettings);
      expect(result.totalSheets).toBe(0);
      expect(result.unplacedPieces).toHaveLength(0);
    });

    test('mixed piece sizes pack efficiently', () => {
      const result = packPieces(
        [
          piece('a', 'Large', 24, 48, 2),
          piece('b', 'Medium', 24, 24, 4),
          piece('c', 'Small', 12, 12, 8),
        ],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBeGreaterThanOrEqual(1);
      expect(result.unplacedPieces).toHaveLength(0);
    });

    test('multiple stock sheet sizes', () => {
      const result = packPieces(
        [
          piece('a', 'Full', 48, 96, 1),
          piece('b', 'Small', 24, 24, 1),
        ],
        [
          { id: 's1', width: 48, height: 96, quantity: 1, label: 'Full', pricePerSheet: 0, material: 'default' },
          { id: 's2', width: 24, height: 24, quantity: 5, label: 'Cutoff', pricePerSheet: 0, material: 'default' },
        ],
        defaultSettings
      );
      expect(result.totalSheets).toBe(2);
      expect(result.unplacedPieces).toHaveLength(0);
    });
  });

  describe('Result statistics', () => {
    test('waste percentage is calculated correctly', () => {
      const result = packPieces(
        [piece('a', 'Small', 24, 24)],
        [sheet(48, 96)],
        defaultSettings
      );
      expect(result.totalSheets).toBe(1);
      expect(result.totalUsedArea).toBe(576);
      expect(result.totalWasteArea).toBe(4032);
      expect(result.totalWastePercent).toBeCloseTo(87.5);
    });

    test('placement coordinates are within sheet bounds', () => {
      const result = packPieces(
        [piece('a', 'Piece', 12, 12, 20)],
        [sheet(48, 96)],
        defaultSettings
      );
      for (const sheetLayout of result.sheets) {
        for (const p of sheetLayout.placements) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.x + p.width).toBeLessThanOrEqual(sheetLayout.stockSheet.width);
          expect(p.y + p.height).toBeLessThanOrEqual(sheetLayout.stockSheet.height);
        }
      }
    });

    test('no placements overlap', () => {
      const result = packPieces(
        [
          piece('a', 'A', 20, 30, 3),
          piece('b', 'B', 15, 25, 4),
          piece('c', 'C', 10, 10, 6),
        ],
        [sheet(48, 96)],
        defaultSettings
      );

      for (const sheetLayout of result.sheets) {
        const placements = sheetLayout.placements;
        for (let i = 0; i < placements.length; i++) {
          for (let j = i + 1; j < placements.length; j++) {
            const a = placements[i];
            const b = placements[j];
            const noOverlap =
              a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y;
            expect(noOverlap).toBe(true);
          }
        }
      }
    });
  });
});
