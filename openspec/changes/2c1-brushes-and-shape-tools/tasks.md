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

## 12. Brush rotation

- [x] 12.1 `js/brushes.js`: `rotatedBrushPixels(brush, angleDegrees)` -
      rotates `brush.pixels` around the pattern's own center
      (nearest-neighbor, deduped); returns `brush.pixels` unchanged for a
      zero angle (the common case). `placeBrush` gains an `angleDegrees`
      (default 0) parameter and rotates via this helper before placing -
      fully backward compatible with every existing call site
- [x] 12.2 `index.html`/`style.css`: Rotation number input (0-359°) in the
      Brushes panel, alongside Spacing, same visual style
- [x] 12.3 `js/workspace.js`: `state.brushRotationStep` (default 0);
      `redrawBrushPath()` passes `placementIndex * brushRotationStep` as
      the angle to `placeBrush` for each placement that actually happens
      (mirrors how Rainbow's hue counter only advances on real
      placements, so Spacing doesn't change the rotation's cycle rate
      either); reset to 0 in `initWorkspace`'s per-project state reset
- [x] 12.4 Unit tests (`node --test`): a zero angle behaves identically to
      omitting the argument; a 90-degree rotation moves a known
      off-center pixel to its expected rotated cell; a 360-degree
      rotation returns to the original pattern
- [x] 12.5 Playwright smoke pass: drag the Heart brush with Rotation 30 and
      Spacing 6, confirm each successive stamp along the trail is visibly
      rotated further than the last; confirm Rotation 0 keeps every stamp
      upright and identical; re-run full `node --test` suite

## 13. Rainbow also applies to the Line tool

- [x] 13.1 `js/workspace.js`: `drawShapePreview()`'s `'line'` branch — when
      `state.brushRainbow` is set, rasterize the line via `bresenhamLine`
      and `setPixel` each point with `rainbowColor(i * RAINBOW_HUE_STEP)`
      instead of calling `strokeFreehand` with a fixed color (pixel-perfect
      corner removal doesn't apply here - a single straight segment has no
      multi-segment corners to remove)
- [x] 13.2 Playwright smoke pass: draw a line with Rainbow selected and
      confirm it renders with cycling colors along its length, matching
      the same sequence Brush uses; confirm a regular color still draws a
      solid-color line; re-run full `node --test` suite

## 14. Selection deselect via outside-click or Escape

- [x] 14.1 `js/workspace.js`: Selection tool's `onDrawEnd` — if the
      pointer-up point matches the pointer-down point (a tap, not a drag)
      and it falls outside the current selection, clear the selection
      instead of replacing it with a degenerate 1x1 one at the tap point
- [x] 14.2 `js/workspace.js`: a second keydown listener for Escape (no
      modifier key required, unlike the undo/redo/zoom shortcuts) that
      clears the active selection, gated on the Workspace screen being
      visible
- [x] 14.3 Playwright smoke pass: make a selection, click outside it with
      the Selection tool active, confirm it clears; make a selection,
      drag starting from inside it, confirm it replaces (not clears) the
      selection; make a selection, press Escape, confirm it clears
      regardless of the active tool; re-run full `node --test` suite
- [x] 14.4 **Added per feedback**: Cmd/Ctrl+D also clears the active
      selection (common convention in Photoshop/similar tools),
      preventing the browser's default bookmark-page action for that
      shortcut. Extracted the three-line clear sequence (already
      duplicated between the "Clear selection" button and Escape) into a
      shared `clearSelection()` helper so the button, Escape, and
      Cmd/Ctrl+D can't drift out of sync. Playwright: Cmd/Ctrl+D clears
      an active selection from any tool; re-run full `node --test` suite

## 15. Revised per feedback: Rectangle Shift-square, Filled toggle back, Rainbow+Pencil

- [x] 15.1 `js/workspace.js`: module-level `shiftHeld`, tracked via
      document keydown/keyup (independent of any single drag, since
      Shift can be pressed/released mid-drag); new `squareDragCurrent()`
      helper clamps the drag's current point so width==height, in
      whichever direction the drag is already heading; applied in
      `onDrawMove`'s Rectangle branch only
- [x] 15.2 Reintroduced a Filled toggle for Rectangle - removed earlier
      this session per explicit instruction, but the shape-tools spec's
      "toggle between outline and filled" requirement was never actually
      updated to match, so this restores spec/code alignment rather than
      reversing a decision. Implemented as a tool-scoped icon toggle
      (`#rectangle-fill-toggle`, `check_box`/`check_box_outline_blank`),
      shown only while Rectangle is active - not the old always-visible
      text button.
- [x] 15.3 `js/engine.js`: `strokeFreehandThick` now passes a third
      `index` argument to `applyPixel` (0-based order over unique pixels
      actually touched, post-dedup) - additive, existing callers that
      ignore the third argument are unaffected
- [x] 15.4 `js/workspace.js`: `pencilOrEraserApplyPixel` uses
      `rainbowColor(index * RAINBOW_HUE_STEP)` for Pencil when
      `state.brushRainbow` is set, same cycling sequence Brush/Line use
- [x] 15.5 Playwright: a very non-square Shift+drag produced a pixel-exact
      square; Filled toggle produces a filled rectangle when on; Rainbow
      selected + a Pencil stroke produced visibly different colors at two
      sampled points along it; re-run full `node --test` suite (103/103)

## 16. Color Library sequence mode for Pencil

- [x] 16.1 `index.html`: new `#pencil-library-toggle` icon button
      (Material Symbols `palette`) inside `#pencil-options`, below the
      Size/Opacity sliders
- [x] 16.2 `js/workspace.js`: `pencilOrEraserApplyPixel` gains a
      `state.pencilLibrarySequence` branch (checked after Rainbow, before
      the plain-foreground fallback) that cycles
      `colorPalettes.find(p => p.id === activePaletteId).colors` by pixel
      index, same as Rainbow's hue cycling; falls back to the plain
      foreground color if the active palette has no colors
- [x] 16.3 Toggle click handler sets `state.pencilLibrarySequence` and
      clears `state.brushRainbow` (mutual exclusivity); the Rainbow
      palette-swatch click handler now also clears
      `state.pencilLibrarySequence` and the toggle's `active` class, so
      only one is ever on
- [x] 16.4 Toggle is hidden whenever the current tool isn't Pencil
      (including Eraser, unlike the shared Size/Opacity panel) - wired
      into the same tool-button click handler that shows/hides
      `pencilOptionsPanel`
- [x] 16.5 Reset in `initWorkspace`'s per-project reset block (unhidden,
      `active` class cleared) since Pencil is the default tool
- [x] 16.6 Playwright: toggling on and drawing a stroke sampled pixel
      colors along it and confirmed they matched the active Color
      Library palette's colors in list order; switching to Eraser hid the
      toggle; re-run full `node --test` suite (103/103)
