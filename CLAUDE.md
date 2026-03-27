# Plywood Cut Planner

## What This Is
A plywood/sheet goods cut optimizer app. Users enter stock sheet sizes and required cut pieces, and the app calculates optimal cutting layouts to minimize waste. Targets woodworkers, DIYers, and cabinet makers.

## Business Model
- **One-time purchase: $7.99** (competitors charge $5-15/mo subscriptions)
- Free tier: 3 projects, unlimited calculations, view diagrams, single optimization mode
- Premium: unlimited projects, PDF export, "fewer cuts" mode, edge banding, custom sheets
- Marketing angle: "No subscription. Pay once, use forever."

## Tech Stack
- **Expo + React Native + TypeScript** — one codebase for iOS, Android, web
- **Expo Router** — file-based navigation
- **react-native-svg** — visual cutting diagrams
- **expo-sqlite** — local project storage (no backend)
- **expo-print + expo-sharing** — PDF export
- **RevenueCat** — in-app purchase handling

## Project Structure
```
app/                          — Expo Router screens
  (tabs)/index.tsx            — Projects list
  project/[id].tsx            — Project editor
  results/[id].tsx            — Results with diagrams
  paywall.tsx                 — Premium upgrade
components/
  CuttingDiagram.tsx          — SVG diagram renderer
  PieceInput.tsx              — Cut piece input row
  SheetInput.tsx              — Stock sheet input row
lib/
  packing/guillotinePacker.ts — Core bin-packing algorithm
  storage/projectStore.ts     — SQLite CRUD
  export/pdfTemplate.ts       — HTML template for PDF
  purchases/premium.ts        — RevenueCat wrapper
types/index.ts                — All TypeScript interfaces
hooks/
  useProject.ts               — Project state management
  usePacker.ts                — Run packing algorithm
  usePremium.ts               — Premium status check
__tests__/                    — Jest unit tests
```

## Core Algorithm
Custom **Guillotine Cut** packer in `lib/packing/guillotinePacker.ts`. NOT a generic bin-packing library — specifically handles:
- **Blade kerf** — each cut removes material (configurable width)
- **Grain direction** — `canRotate: false` prevents piece rotation
- **Guillotine constraint** — cuts go edge-to-edge (models real table saw behavior)
- **Multiple stock sheets** — packs across available inventory
- **Best Short Side Fit** heuristic for rectangle selection

## Commands
```bash
npm test              # Run Jest unit tests
npx expo start        # Start dev server
npx expo start --web  # Web only
```

## Milestones
1. ~~Scaffolding + Algorithm~~ ✅
2. Input UI — project list, editor, forms
3. Visual Cutting Diagrams — SVG renderer (MVP shippable)
4. Local Persistence — SQLite
5. PDF Export
6. Monetization — RevenueCat
7. Polish + Ship

## Defaults
- Stock sheet: 4' × 8' (48" × 96")
- Kerf: 1/8" (0.125")
- Units: Imperial (inches)
- Pieces default to canRotate: true (no grain preference)
