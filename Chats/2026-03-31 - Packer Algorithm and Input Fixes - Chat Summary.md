---
date: 2026-03-31
type: chat-summary
tags: [plywood-cut-planner, algorithm, ui-fix]
---

# Chat Summary — Packer Algorithm and Input Fixes

## What Was Done
- Replaced the guillotine "Best Short Side Fit" packing algorithm with shelf (strip) packing in `lib/packing/guillotinePacker.ts`
  - Every horizontal cut now goes edge-to-edge across the full sheet (table-saw friendly)
  - Shorter pieces can share a strip with taller pieces (trim waste handled separately)
  - Still tests 5 sort strategies and picks the best result
- Fixed decimal input bug across the app — created `FractionInput` component that parses on blur instead of every keystroke, so typing "7.5" or "23 1/2" works
- Renamed all user-facing "Height" / "H" labels to "Length" / "L" (correct terminology for sheet goods)
- Added settings editor panel to the results page — stock sheet dimensions, kerf, and grain toggle, all with instant recalculation
- Removed distracting red/white cut lines from cutting diagram, replaced piece borders with subtle dark lines
- Added 2 new alignment tests for shelf packing behavior
- Deployed both commits to Vercel via git push

## Key Decisions
- Shelf packing over guillotine: The old algorithm placed pieces wherever they individually minimized waste, creating jagged non-continuous cuts impossible to make on a table saw. Shelf packing guarantees straight-through cuts even if it wastes slightly more material.
- Mixed-height strips allowed: A 7" piece can go next to an 8" piece in a 24" strip. The strip height equals the tallest piece; shorter pieces just need a separate trim cut. This is more efficient than requiring exact-match heights.
- FractionInput parses on blur: The React controlled input problem (typing "7." snaps to "7") was solved by keeping raw text in state during focus and only parsing to a number on blur.

## New Information Learned
- Expo hot reload doesn't always pick up changes to deeply nested lib files — restarting with `--clear` was needed
- The app uses `(global as any).__packingResult` to pass data between screens, not persistent storage — results are always calculated fresh

## Open Items
- [ ] Slash commands from parent `.claude/commands/` are not registering in VSCode extension when working in this subfolder — may be a VS Code extension limitation vs CLI
- [ ] Verify the deployed Vercel build works correctly with the new algorithm

## Files Changed
- `lib/packing/guillotinePacker.ts` — Replaced core algorithm with shelf-based packing
- `app/project/[id].tsx` — Added FractionInput component, renamed H→L labels
- `app/results.tsx` — Added settings editor panel, FractionInput, renamed Height→Length
- `components/CuttingDiagram.tsx` — Removed red cut lines, subtle piece borders
- `__tests__/guillotinePacker.test.ts` — Added shelf packing alignment tests
