# Small tools Implementation Plan

**Goal:** Ellipse tool, Duplicate layer + tappable Merge, Brush cursor pref.
Design: `docs/superpowers/specs/2026-10-12-small-tools-design.md`.
Three parts are independent — each ends with green `npm test` and its own
commit, in this order (smallest blast radius first).

## Part A — Duplicate layer + Merge button

### Task A1: `LayerStack.duplicateLayer(index)` (TDD)
- Tests first in `lib/pixel-engine/layers.test.js`: inserted above, active,
  pixels/opacity/blend/visibility copied, pixel buffer is a *copy* (drawing
  on one doesn't change the other), new id, name `"<name> copy"`,
  Background → unlocked layer, refused for reference layer and at 8 layers.
- Implement in `lib/pixel-engine/layers.js` next to `addLayer`; document in
  `lib/pixel-engine/README.md`.

### Task A2: Buttons + shortcut
- `index.html` Layers header: `#duplicate-layer-button` (`content_copy`)
  and `#merge-layers-button` (`merge`) beside `#add-layer-button`; add both
  glyphs to the font `icon_names` lists. Same markup in `lib/pixi.js`.
- `js/layers-ui.js`: wire Duplicate → `duplicateLayer(active)` →
  `renderCanvas(); commit()`; Merge → `mergeMarkedOrActiveDown()`. Sync
  `disabled` and the Merge tooltip ("Merge down" / "Merge N layers") inside
  `renderLayersPanel()`.
- `js/workspace.js` keydown: Cmd/Ctrl+J → duplicate (beside Cmd/Ctrl+E).

### Task A3: Docs + verify
- `docs/specs/layers/spec.md`: Duplicate requirement + Merge-button
  scenario. `docs/ui-reference.md` Layers header table.
- Playwright: add layer, draw, duplicate, merge; undo each. Commit.

## Part B — Ellipse tool

### Task B1: `drawEllipse` (TDD)
- Tests first in `test/shape-tools.test.js` for the properties listed in
  the design (bounds, touches 4 sides, symmetry, direction-independent,
  filled ⊇ outline with no holes, closed 8-connected outline without
  doubled corners, degenerate 1×1 / 1×N / 2×2 boxes, a fixed 5×5 and 4×4
  expected bitmap).
- Implement Zingl's `plotEllipseRect` in `js/shape-tools.js`. Rename
  `setRectangleFilled` → `setShapeFilled` (keep it exported under the old
  name too only if something outside the repo uses it — `lib/pixi.js`
  check; otherwise just rename and update callers/tests).

### Task B2: Register the tool
- `js/rail-tools.js`: `ellipse` after `rectangle` in `TOOL_IDS`, label
  `Ellipse`. Update `test/rail-tools.test.js`.
- `js/prefs.js`: add to `AUTO_HIDE_TOOLS`; Prefs note text mentions Ellipse.
- `index.html` + `lib/pixi.js`: rail button `data-tool="ellipse"`
  `data-shortcut="O"`, glyph `circle` (add to `icon_names`).
- Options: `data-tools="rectangle ellipse"` on the Filled group (tooltip
  "Filled shape"), `rectangle ellipse selection` on the 1:1 group;
  `#rectangle-options` / `#square-constraint-options` visibility in
  `js/rectangle-fill-ui.js` and `applyToolScopedUI()` include ellipse.
  `test/floating-layout-css.test.js`'s "names every tool exactly once" and
  "each tool with options" tests updated.

### Task B3: Wire drawing
- `js/workspace.js`: every `tool === 'line' || tool === 'rectangle'` branch
  in `onDrawStart`/`onDrawMove` includes `'ellipse'`; Shift/1:1 constraint
  applies to ellipse; `drawShapePreview()` gets an `ellipse` branch.

### Task B4: Docs + verify
- `docs/specs/shape-tools/spec.md`: Ellipse requirement + scenarios.
  `docs/specs/floating-workspace/spec.md` tool list.
  `docs/ui-reference.md` rail table.
- Playwright: draw outline / filled / Shift-circle at 16 and 64px, check
  pixels; existing user's stored rail shows Ellipse in ⋯. Commit.

## Part C — Brush cursor

### Task C1: `js/brush-cursor.js` (TDD)
- New `test/brush-cursor.test.js` first:
  - `cursorFootprint`: pencil/eraser sizes 1/2/3/8 equal
    `circleOffsets(size)`; brush returns its pixels (centred like
    `placeBrush`, respecting angle); single cell for line/rect/ellipse/
    bucket/eyedropper; `null` for move/selection/hand.
  - `footprintOutlinePath`: 1 cell → one 4-edge square; 2×1 → one 6-unit
    rectangle (collinear edges joined); a ring shape → outer and inner
    loops; output is translation-invariant up to the offset.
- Implement.

### Task C2: Pref
- `js/prefs.js`: `brushCursor` (default `true`) in typedef, defaults,
  `normalizePrefs`, `applyPrefsToScreen` → `data-brush-cursor`. Tests in
  `test/prefs.test.js`.
- `index.html` Prefs sheet: "Show Brush Cursor" switch row
  (`#prefs-brush-cursor`); `js/prefs-sheet.js` sync/read.

### Task C3: Canvas overlay + hover
- `js/canvas-view.js`: SVG overlay element in the wrapper (sized like the
  selection overlay, `pointer-events: none`), `setCursorPath(d)` /
  `hideCursor()`; `onHover` fired from pointermove for
  `pointerType !== 'touch'` pressed or not, `null` on
  pointerleave/pointercancel/second pointer.
- `js/workspace.js`: `onHover` handler → `cursorFootprint` →
  `footprintOutlinePath` → `setCursorPath`; recompute on tool/size/brush/
  rotation change using the last hover point.
- `style.css`: two-tone stroke, `vector-effect: non-scaling-stroke`,
  hidden under `[data-brush-cursor="off"]`.

### Task C4: Docs + verify
- `docs/specs/floating-workspace/spec.md` (Prefs) and
  `docs/specs/pixel-drawing-engine/spec.md` (cursor requirement),
  `docs/ui-reference.md`.
- Playwright with a mouse: cursor matches size 1/4/8 pencil and a custom
  brush at 2100% and fit zoom; toggle off hides it; touch pointer shows
  nothing. Commit.

## Wrap-up
- `npm test`; `web-design-guidelines` review (all three touch
  `index.html`/CSS/DOM); code review; update `docs/roadmap.md` and tick
  the items in `docs/feature-ideas/2026-10-12-ipad-feedback.md`; push.
