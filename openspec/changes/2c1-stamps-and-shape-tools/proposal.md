## Why

Phase 1/2a's toolset is pencil, eraser, and bucket only. Phase 2c1
(`openspec/roadmap.md`) adds the next tier of drawing tools: an extensible
stamp tool for placing predefined pixel patterns (starting with a heart),
and line/rectangle/selection tools — the "shape" tools any pixel-art
workflow needs beyond freehand strokes.

## What Changes

- Add a **Stamps** tool: pick a predefined pixel pattern from a small
  picker (like the color palette row) and click to place it, filled with
  the current draw color, on the active layer. Ships with one stamp
  (**Heart**, a fixed ~9×8px pattern) but the picker/data structure is
  built to take more shapes later without new plumbing — adding a shape is
  adding a pattern definition, not new tool-handling code.
- Add a **Line** tool: drag from one point to another; releases draws a
  1px line between them (reusing the existing pixel-perfect corner-removal
  logic pencil already has), live-previewed while dragging.
- Add a **Rectangle** tool: drag to define a rectangle; a toggle switches
  between outline and filled. Live-previewed while dragging.
- Add a **Selection** tool: drag to define a rectangular selection. While
  a selection is active, pencil/eraser/bucket/stamp/line/rectangle are
  clipped to it (drawing outside the selection has no effect). A "Clear
  selection" control deselects; a "Delete" control clears the selected
  pixels to transparent on the active layer. Moving/copying selected
  content is out of scope for this slice.
- All of the above act on the active layer only (like existing tools), are
  undoable/redoable, and auto-save through the same `commit()` path as
  every other tool — no new persistence work.

Out of scope for this slice (later Phase 2c sub-changes or beyond, per the
roadmap): the full color/palette panel, symmetry/grid tools, the full
Export screen, moving/cutting/copying a selection, stamp rotation/flip/
resizing, and any stamp beyond Heart (the picker supports adding more, but
none are added in this slice).

## Capabilities

### New Capabilities
- `stamps`: the Stamps tool — picker, placement, and the extensible shape
  data structure (Heart is the only shape shipped).
- `shape-tools`: Line, Rectangle (outline/filled), and rectangular
  Selection (with clear/delete), including how they interact with existing
  tools while a selection is active.

### Modified Capabilities
(none — existing tool requirements are unaffected; selection clipping is
new behavior added by the `shape-tools` capability, not a change to what
pencil/eraser/bucket already promise)

## Impact

- New files: `js/stamps.js` (stamp pattern data + placement logic),
  `js/shape-tools.js` (line/rectangle geometry + selection-clip logic).
- Modified files: `js/workspace.js` (new tool modes, selection-clip applied
  after any draw operation, live shape preview reusing the existing
  drag-point-stream handlers), `js/canvas-view.js` (a selection-outline
  overlay element that tracks the canvas's pan/zoom transform — the only
  part of this change canvas-view.js actually needs; drag-preview itself
  reuses the existing onDrawStart/onDrawMove/onDrawEnd interface as-is),
  `index.html`/`style.css` (Stamps picker row, tool buttons, outline/filled
  toggle, selection clear/delete controls).
- New tests: `test/stamps.test.js`, `test/shape-tools.test.js` — DOM-free
  pattern/geometry logic, following the project's existing testing pattern.
