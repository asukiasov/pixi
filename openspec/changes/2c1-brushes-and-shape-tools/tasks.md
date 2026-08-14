## 1. Brushes (`js/brushes.js`)

- [x] 1.1 Define the brush pattern registry (`{ id, name, width, height,
      pixels }`); implement the Heart pattern (9×8, per design.md)
- [x] 1.2 Implement `placeBrush(engine, centerX, centerY, brush, rgba)`:
      centers on the point, relies on `setPixel`'s existing bounds check
      for edge clipping
- [x] 1.3 Unit tests (`node --test`): placement centering, edge clipping
      (partially off-canvas placement), pattern registry shape

## 2. Shape tools (`js/shape-tools.js`)

- [x] 2.1 Implement `drawRectangle(engine, x0, y0, x1, y1, rgba, filled)`:
      normalizes corners; outline (perimeter) and filled (full bounding
      box) modes
- [x] 2.2 Implement `clipToSelection(engine, backup, selection)`: restores
      every pixel outside the selection rect from `backup`
- [x] 2.3 Unit tests (`node --test`): rectangle outline/filled correctness
      (including 1px-wide/tall edge cases), clipToSelection correctness

## 3. Wire tools into the Workspace (`js/workspace.js`)

- [x] 3.1 Add Line tool: `onDrawStart` backs up + captures start point,
      `onDrawMove` restores backup + `engine.strokeFreehand([start,
      current], color, pixelPerfect)`, `onDrawEnd` applies selection clip
      (if active) + `commit()`
- [x] 3.2 Add Rectangle tool (with an outline/filled toggle): same
      backup/restore/preview/commit pattern as Line, using
      `drawRectangle()`
- [x] 3.3 Add Brush tool: `onDrawStart` backs up, calls `placeBrush()`,
      applies selection clip (if active), `commit()`; ignores
      `onDrawMove`/`onDrawEnd`. **Superseded by section 7** — the Brushes
      tool now supports continuous placement while dragging
- [x] 3.4 Add Selection tool: `onDrawStart` captures start point,
      `onDrawMove` updates `canvasView.setSelectionRect()` with the current
      drag rect (no pixel writes), `onDrawEnd` finalizes
      `state.selection`; selection persists across tool switches
- [x] 3.5 Add "Clear selection" control: sets `state.selection = null`,
      hides the overlay; not part of undo history
- [x] 3.6 Add "Delete" control (enabled only while a selection is active):
      backs up the active layer, clears every pixel within the selection to
      `[0,0,0,0]`, `commit()`
- [x] 3.7 Apply the selection clip universally: after pencil/eraser
      (`onDrawEnd`) and bucket fill (`onDrawStart`) write their pixels, run
      `clipToSelection()` too if a selection is active, before `commit()`

## 4. Selection overlay (`js/canvas-view.js`)

- [x] 4.1 Implement `setSelectionRect(rect | null)`: shows/hides/positions
      a sibling overlay `<div>` sized and positioned in the same pre-zoom
      pixel-to-CSS-px scale as the canvas
- [x] 4.2 Keep the overlay's transform in sync with the canvas's own
      `#applyTransform()` (pan/zoom)

## 5. HTML/CSS

- [x] 5.1 `index.html`: Brushes picker row (mirroring the palette row), Line/
      Rectangle/Selection tool buttons, outline/filled toggle, Clear
      selection + Delete controls. **Revised**: the selection overlay
      element is created dynamically in `canvas-view.js`'s constructor
      (appended to the container), not static HTML — keeps it colocated
      with the transform logic that positions it
- [x] 5.2 `style.css`: styles for all of the above

## 6. Verification

- [x] 6.1 Playwright smoke pass: place the Heart brush (including near an
      edge), draw a line, draw outline and filled rectangles, make a
      selection and confirm pencil/bucket/brush are clipped to it, delete a
      selection's contents, undo each action type
- [x] 6.2 Re-run the full `node --test` suite to confirm no regressions
- [x] 6.3 **Bug found during verification**: clicking Bucket *outside* an
      active selection still changed pixels *inside* it — flood fill
      spreads through the whole connected region from the click point
      before `clipToSelection` runs, so a click outside a selection on a
      uniform-color canvas filled the selection anyway, violating "drawing
      outside a selection has no effect." Fixed by adding an explicit
      `isPointInSelection` origin guard on Bucket and Brush (point-origin
      tools) that no-ops the whole operation if the tap point itself is
      outside the selection — before even computing the fill/placement.
      Drag-based tools (pencil/eraser/line/rectangle) didn't need this: their
      existing per-pixel `clipToSelection` already correctly handles a drag
      that starts outside and enters the selection.

## 7. Continuous brush placement + Rainbow color mode

- [x] 7.1 `js/engine.js`: export the existing (previously private)
      `bresenhamLine` helper for reuse — no behavior change
- [x] 7.2 `js/brushes.js`: implement `rainbowColor(hue)` — HSL(hue, 100%,
      50%) to the engine's RGBA array format
- [x] 7.3 `js/workspace.js`: rework the Brush tool to handle
      `onDrawMove`/`onDrawEnd`: `onDrawStart` seeds `state.brushPath` with
      the first point; `onDrawMove` appends the new point plus every
      intermediate pixel since the last one (via `bresenhamLine`, so fast
      drags don't skip brushes), then calls `redrawBrushPath()`; `onDrawEnd`
      commits the whole trail as one undo step
- [x] 7.4 Implement `redrawBrushPath()`: restores the pre-drag backup, then
      places one brush per point in `state.brushPath`, colored
      `state.brushRainbow ? rainbowColor(i * RAINBOW_HUE_STEP) :
      state.currentColor` (`i` = point index), then applies the selection
      clip
- [x] 7.5 Add Rainbow as a selectable entry in the color palette row
      (`index.html`/`style.css`/`js/workspace.js`), not a separate toggle
      button — **revised per feedback after initial toggle-button
      implementation**. Mutually exclusive with picking a regular color
      (picking either deselects the other); sets `state.brushRainbow`,
      read only by the Brush tool — every other tool keeps using
      `state.currentColor`, which selecting Rainbow never touches
- [x] 7.6 Unit tests (`node --test`) for `rainbowColor`: known hue → RGB
      values, wraps correctly past 360°

## 8. Verification (continuous brushes + rainbow)

- [x] 8.1 Playwright smoke pass: drag the Brush tool with Rainbow off
      (confirm a same-color trail, not just one brush), drag with Rainbow
      on (confirm visibly different colors along the trail), undo a dragged
      trail (confirm it reverts as one action, not brush-by-brush), confirm
      the trail still respects an active selection
- [x] 8.2 Re-run the full `node --test` suite to confirm no regressions
- [x] 8.3 Mid-implementation rename: "Stamps" → "Brushes" throughout (files,
      code, tests, UI, specs) per feedback, to avoid an awkward name once
      more shapes/custom brushes exist. Custom (user-drawn) brush creation
      noted in `openspec/roadmap.md`'s "Not yet scheduled" section, not
      built in this slice per explicit direction

## 9. Circle brush, Brushes panel, custom brush creation, spacing

- [x] 9.1 `js/brushes.js`: add Circle pattern (5×5 filled) to `BRUSHES`
- [x] 9.2 `js/brushes.js`: implement `pixelsFromGrid(grid)` — converts a 2D
      boolean grid to the `pixels: [[x,y], ...]` format
- [x] 9.3 `js/persistence.js`: add `customBrushes` Dexie table (version
      bump 1→2), `createCustomBrush(name, width, height, pixels)`,
      `listCustomBrushes()`, `deleteCustomBrush(id)`. Record includes
      `userId: null` (reserved for Phase 3 ownership, unused today)
- [x] 9.4 `index.html`/`style.css`: replace `#brushes-row` with a
      Photoshop-style Brushes panel — header, Spacing number input,
      thumbnail grid, bottom toolbar with Add/Delete icon buttons (Material
      Symbols, matching tools/undo/redo)
- [x] 9.5 `index.html`/`style.css`: brush editor panel — fixed 9×9 grid of
      toggleable cells, name input, Clear/Cancel/Save controls
- [x] 9.6 `js/workspace.js`: load custom brushes on startup, merge with
      `BRUSHES` for the picker; wire Add (opens editor) / Save (builds
      pixels via `pixelsFromGrid`, persists, adds to picker) / Cancel /
      Delete (only enabled for a selected custom brush)
- [x] 9.7 `js/workspace.js`: add `state.brushSpacing` (default 1) and a
      Spacing input; `redrawBrushPath()` places only at path indices where
      `index % brushSpacing === 0` (index 0 always included, so a
      stationary tap is unaffected by Spacing)
- [x] 9.8 Unit tests (`node --test`): Circle pattern shape, `pixelsFromGrid`,
      `createCustomBrush`/`listCustomBrushes`/`deleteCustomBrush`
- [x] 9.9 Playwright smoke pass: place Circle; create a custom brush via the
      editor and place it; delete it and confirm it's gone from the picker;
      confirm a custom brush survives a project switch; set Spacing > 1 and
      confirm a sparser trail; re-run full `node --test` suite

## 10. Brushes panel scoped to tool, thumbnail previews, custom brush sizing

- [x] 10.1 `js/workspace.js`/`style.css`: Brushes panel visible only while
      the Brush tool is selected (toggled alongside the existing tool
      button `active` state, via the shared global `.hidden` utility
      class); reset to hidden in `initWorkspace()`'s per-project state
      reset (default tool is Pencil)
- [x] 10.2 `js/workspace.js`: `renderBrushesPanel()` renders each swatch as
      a small black-on-white `<canvas>` preview of `brush.pixels` at
      `brush.width x brush.height` (CSS `image-rendering: pixelated` to
      scale up crisply) instead of `brush.name` as text; name kept as the
      `title` tooltip
- [x] 10.3 `index.html`/`js/workspace.js`: brush editor gets Width/Height
      number inputs (min 3, max = current canvas width/height
      respectively) shown before the grid; changing either re-grids from
      blank at the new size; grid cell size computed dynamically so large
      custom sizes still fit the panel (`style.css` custom properties)
- [x] 10.4 `js/persistence.js`/`createCustomBrush` unchanged (already took
      width/height as parameters) — editor now passes the user-chosen size
      instead of the fixed 9×9 default
- [x] 10.5 Playwright smoke pass: confirm Brushes panel hidden on Pencil,
      visible on Brush, hidden again after switching away; confirm width/
      height inputs clamp to [3, canvas size]; resize the editor grid and
      save a non-square (5×4) custom brush; confirm its picker thumbnail
      renders the pattern; re-run full `node --test` suite

## 11. Move Brushes panel to a right-side sidebar

- [x] 11.1 `index.html`: move `#brushes-panel` (and the nested brush
      editor) out of `.workspace-main`'s vertical stack into its own
      `<aside>`, a sibling of `.workspace-main` inside `.workspace-screen`
      — a separate right-hand column, not stacked below Layers
- [x] 11.2 `style.css`: `.brushes-panel` becomes a fixed-width (13rem)
      full-height sidebar with a left border, instead of a bottom-docked,
      height-capped panel; brush editor's Clear/Cancel/Save row wraps and
      shrinks to fit the narrower column
- [x] 11.3 `js/workspace.js`: brush editor grid's max pixel width reduced
      to fit inside the narrower sidebar (was sized for the old
      full-width bottom panel)
- [x] 11.4 Playwright smoke pass: confirm the Brushes panel renders as a
      right-side column (not below Layers) at the expected width, brush
      placement on the canvas still works with the sidebar present, editor
      buttons aren't clipped; re-run full `node --test` suite
