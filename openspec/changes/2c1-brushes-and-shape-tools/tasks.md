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
