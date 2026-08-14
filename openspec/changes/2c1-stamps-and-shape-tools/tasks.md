## 1. Stamps (`js/stamps.js`)

- [ ] 1.1 Define the stamp pattern registry (`{ id, name, width, height,
      pixels }`); implement the Heart pattern (9×8, per design.md)
- [ ] 1.2 Implement `placeStamp(engine, centerX, centerY, stamp, rgba)`:
      centers on the point, relies on `setPixel`'s existing bounds check
      for edge clipping
- [ ] 1.3 Unit tests (`node --test`): placement centering, edge clipping
      (partially off-canvas placement), pattern registry shape

## 2. Shape tools (`js/shape-tools.js`)

- [ ] 2.1 Implement `drawRectangle(engine, x0, y0, x1, y1, rgba, filled)`:
      normalizes corners; outline (perimeter) and filled (full bounding
      box) modes
- [ ] 2.2 Implement `clipToSelection(engine, backup, selection)`: restores
      every pixel outside the selection rect from `backup`
- [ ] 2.3 Unit tests (`node --test`): rectangle outline/filled correctness
      (including 1px-wide/tall edge cases), clipToSelection correctness

## 3. Wire tools into the Workspace (`js/workspace.js`)

- [ ] 3.1 Add Line tool: `onDrawStart` backs up + captures start point,
      `onDrawMove` restores backup + `engine.strokeFreehand([start,
      current], color, pixelPerfect)`, `onDrawEnd` applies selection clip
      (if active) + `commit()`
- [ ] 3.2 Add Rectangle tool (with an outline/filled toggle): same
      backup/restore/preview/commit pattern as Line, using
      `drawRectangle()`
- [ ] 3.3 Add Stamps tool: `onDrawStart` backs up, calls `placeStamp()`,
      applies selection clip (if active), `commit()`; ignores
      `onDrawMove`/`onDrawEnd`
- [ ] 3.4 Add Selection tool: `onDrawStart` captures start point,
      `onDrawMove` updates `canvasView.setSelectionRect()` with the current
      drag rect (no pixel writes), `onDrawEnd` finalizes
      `state.selection`; selection persists across tool switches
- [ ] 3.5 Add "Clear selection" control: sets `state.selection = null`,
      hides the overlay; not part of undo history
- [ ] 3.6 Add "Delete" control (enabled only while a selection is active):
      backs up the active layer, clears every pixel within the selection to
      `[0,0,0,0]`, `commit()`
- [ ] 3.7 Apply the selection clip universally: after pencil/eraser
      (`onDrawEnd`) and bucket fill (`onDrawStart`) write their pixels, run
      `clipToSelection()` too if a selection is active, before `commit()`

## 4. Selection overlay (`js/canvas-view.js`)

- [ ] 4.1 Implement `setSelectionRect(rect | null)`: shows/hides/positions
      a sibling overlay `<div>` sized and positioned in the same pre-zoom
      pixel-to-CSS-px scale as the canvas
- [ ] 4.2 Keep the overlay's transform in sync with the canvas's own
      `#applyTransform()` (pan/zoom)

## 5. HTML/CSS

- [ ] 5.1 `index.html`: Stamps picker row (mirroring the palette row), Line/
      Rectangle/Selection tool buttons, outline/filled toggle, Clear
      selection + Delete controls, selection overlay element
- [ ] 5.2 `style.css`: styles for all of the above

## 6. Verification

- [ ] 6.1 Playwright smoke pass: place the Heart stamp (including near an
      edge), draw a line, draw outline and filled rectangles, make a
      selection and confirm pencil/bucket/stamp are clipped to it, delete a
      selection's contents, undo each action type
- [ ] 6.2 Re-run the full `node --test` suite to confirm no regressions
