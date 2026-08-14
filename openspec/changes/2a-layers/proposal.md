## Why

Phase 1 shipped a single flat pixel buffer. Real pixel-art work needs layers
(sketch under lineart, separate shading, etc.) — this is the first slice of
Phase 2 (`openspec/roadmap.md`) and everything else in Phase 2 (persistence,
Gallery, full toolset) assumes a layered canvas exists.

## What Changes

- Add a layer stack to the Workspace: each canvas now holds an ordered list
  of layers instead of one flat buffer.
- Add layer operations: add, delete, reorder (move up/down), rename, toggle
  visibility, set opacity (0–100%), set blend mode (Normal, Multiply,
  Screen, Overlay).
- Add a Layers panel to the Workspace UI listing all layers with these
  controls, and letting the user pick the **active layer** — pencil, eraser,
  and bucket fill all act on the active layer only.
- Compositing (for on-screen render and PNG export) happens via the browser
  Canvas 2D API's `globalCompositeOperation`/`globalAlpha`, not hand-rolled
  pixel math — keeps this dependency-free per the project's no-bundler,
  no-framework stance.
- New Canvas creation now produces a single starting layer (using the chosen
  background: transparent or white) rather than a bare buffer. Every
  additional layer the user adds starts transparent, regardless of the
  canvas's original background choice.
- **BREAKING** (internal only, no persisted data exists yet to migrate):
  `js/engine.js`'s `PixelEngine` becomes the per-layer buffer type; a new
  `js/layers.js` owns the ordered stack and compositing. `js/canvas-view.js`
  and `js/workspace.js` are updated to render/operate through the layer
  stack instead of a single engine instance.

Out of scope for this slice (later Phase 2 sub-changes per the roadmap):
local save/load, Gallery, Canvas settings (resize/crop/rotate), full color
picker, symmetry/grid tools, line/shape/selection tools, the full Export
screen. This slice's PNG export stays the same single-button,
native-resolution export from Phase 1 — it now flattens all visible layers
into that one PNG instead of exporting a single buffer.

## Capabilities

### New Capabilities
- `layers`: layer stack management (add/delete/reorder/rename/visibility/
  opacity/blend mode), active-layer selection scoping pencil/eraser/bucket,
  and layer compositing for render and export.

### Modified Capabilities
(none — `pixel-drawing-engine` and `canvas-creation`'s existing requirements
remain accurate as written; layers change how drawing/export/undo are
implemented, not what they promise at the requirement level)

## Impact

- New file: `js/layers.js` (LayerStack: ordered layers, active-layer
  tracking, canvas-based compositing).
- Modified files: `js/engine.js` (PixelEngine becomes the per-layer buffer,
  no other API changes), `js/canvas-view.js` (renders the composited output
  instead of a single engine's buffer), `js/workspace.js` (Layers panel UI,
  tools scoped to the active layer, undo/redo snapshots now cover the full
  layer stack), `js/new-canvas.js` (creates a LayerStack with one starting
  layer instead of a bare PixelEngine), `index.html`/`style.css` (Layers
  panel markup and styles).
- New tests: `test/layers.test.js` covering stack operations and
  compositing, DOM-free like `engine.test.js`.
- No persisted data exists yet (Phase 2b hasn't shipped save/load), so
  there's nothing to migrate.
