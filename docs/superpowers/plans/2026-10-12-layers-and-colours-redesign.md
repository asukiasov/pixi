# Layers and colours redesign Implementation Plan

**Goal:** see `docs/superpowers/specs/2026-10-12-layers-and-colours-redesign-design.md`.
Six parts, each ending with green `npm test`, a browser check, docs, and
its own commit. Then merge into `main`.

## Part 1 — Standard libraries
1. `assets/palettes/standard.json`; `STANDARD_PALETTES` (built-in
   fallback, same list) in `js/default-color-library.js`.
2. `js/standard-libraries.js` (TDD, `test/standard-libraries.test.js`):
   `standardLibraryRows(standard, existingNames)` → rows with `added`;
   `parseStandardLibraries(json)` validates (names, `#rrggbb` colours),
   drops bad entries; `loadStandardLibraries(fetchFn)` → parsed list or
   the fallback.
3. Sheet markup (`<dialog id="standard-libraries-sheet">`) styled like
   Prefs; wired in `js/color-library-ui.js` (`Add` → `createColorPalette`,
   row flips to Added, palette becomes active).
4. One-time "Pixi Basics" seed for existing users (localStorage flag).
5. Spec `color-library`, ui-reference.

## Part 2 — Colour bar, Layers alone on the right
1. Markup: `#color-bar` in `.options-card` — `#palette-menu-button`,
   `#color-library-grid` (moved), `#palette-row` (now only Rainbow), `+`
   (`#add-current-color-button`). `#palette-menu` (role=menu) holding the
   palette list and the action items, reusing today's ids
   (`add-palette-button`, `import-palette-button`,
   `library-generate-ramp-button`, `edit-palette-colors-button`,
   `delete-palette-button`) plus `#standard-libraries-button`. The inline
   new-palette name row moves into the menu.
2. Remove `#color-library-panel` card, its rail button and collapse code;
   move import/ramp popovers to screen level; drop the `.slot-panels`
   lift rule (update its test to assert the popovers are outside slots).
3. `js/workspace.js`: the fixed `PALETTE` row goes; `#palette-row` keeps
   Rainbow only; default foreground stays black.
4. `js/color-library-ui.js`: render the palette list into the menu;
   active swatch scrolled into view; menu open/close (Escape, outside).
5. Prefs: `pinned` keeps `layers` (colors/brushes ignored);
   `openCardDefaults`/`applyOpenCardDefaults` updated; tests.
6. CSS: the bar (glass pill, 44px targets, horizontal scroll, no visible
   scrollbar), menu.
7. Specs `color-library`, `floating-workspace`, ui-reference.

## Part 3 — Brush palette popover
1. `#brushes-panel` moves into `#brush-popover` (screen level, fixed).
2. Options bar Brush group: `#brush-picker-button` showing the current
   brush preview; toggles the popover; closes on tool change/Escape/outside.
3. Remove the Brushes rail button and card-open plumbing
   (`setBrushesCardOpen` → popover open/close).
4. Specs `brushes`, `floating-workspace`, ui-reference.

## Part 4 — Colour picker
1. `js/color-math.js` (TDD): `rgbToHsv`, `hsvToRgb` (round trips),
   `ringHue(dx, dy)`, `squareSV(x, y, size)`, `pushHistory(list, hex,
   max)`.
2. Markup: rebuilt `#color-picker-popover` keeping the ids JS relies on
   (`#color-picker-hex`, `-r/-g/-b`, `-native`, `-add`,
   `-generate-ramp`, `-close`, `-popover-title`); tabs, disc canvas,
   classic canvas + hue slider, value sliders, palettes list, history row,
   current/previous pair.
3. `js/color-picker.js`: renders and wires the tabs; calls back into
   workspace's `applyPickedColor`; history in localStorage.
4. Spec `pixel-drawing-engine` (colour picker requirement), ui-reference.

## Part 5 — Layer groups (engine, TDD)
1. Tests in `lib/pixel-engine/layers.test.js` for every API in the design
   (contiguity, up/down join/leave rules, moveGroup, delete/merge/
   duplicate interplay, snapshot/record round trip, legacy record).
2. Implement in `lib/pixel-engine/layers.js`; compositing visibility and
   opacity; README.

## Part 6 — Layers panel redesign
1. Markup: new card header (⋯, title, +, close), `#layers-panel-list`,
   select bar, row/panel menus (one shared `#layer-menu` popover filled
   per use), Opacity & Blend popover (today's controls moved).
2. `js/layers-ui.js`: row builder (layer and group rows, switch, ⋯),
   menus, select mode (reuses `markedLayerIds`), drag reorder by grip
   (pointer events; pure `dropTarget(rows, y)` helper tested).
3. Keep `computeLayerMarkState`, `mergeButtonState`, rename helpers and
   their tests working; Merge/Duplicate shortcuts unchanged.
4. Specs `layers`, ui-reference.

## Wrap-up
- `npm test`; browser pass over every part at 1180 px and 390 px wide.
- Roadmap + feature-ideas updated.
- Merge into `main` (`git merge --no-ff`, like the repo's earlier
  merges), push `main` and the branch.
