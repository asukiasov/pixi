## Why

Pixi has no code yet. Before building anything else (layers, save/load, gallery,
accounts), we need one canvas that can be drawn on and exported to PNG, working
on mobile Android web — this is Phase 1 of the project roadmap
(see `openspec/roadmap.md`) and the foundation every later phase depends on.

## What Changes

- Add a no-build-step repo scaffold (`index.html`, `style.css`, ES modules under
  `js/`) with a tiny in-page router between two screens: New Canvas and Workspace.
- Add a New Canvas screen: size presets (16/32/64/128) plus custom width/height
  (clamped 1–256px), and background choice (transparent or white).
- Add a DOM-free, unit-testable drawing engine (`js/engine.js`) backed by a flat
  `Uint8ClampedArray` RGBA buffer: `setPixel`, `strokeFreehand` (with an
  Aseprite-style pixel-perfect mode), 4-directional `floodFill`, and
  `toPNGBlob` export.
- Add a Workspace screen wiring pencil, eraser, bucket fill, a pixel-perfect
  toggle, a fixed ~16-swatch color palette, undo/redo buttons, and a single
  "Export PNG" button (native resolution only) to the engine.
- Add touch/pointer interaction via the Pointer Events API: one-finger draw,
  two-finger pan, pinch-zoom, with `touch-action: none` so mobile browsers don't
  intercept gestures.
- Add an undo/redo stack of full-buffer snapshots (capped at 50, with redo-stack
  truncation on new commits after an undo).

Explicitly out of scope for this slice (deferred to later changes per the
project brief): layers, local save/load, Gallery screen, custom color picker,
symmetry/grid tools, Firebase auth/sync, Stripe, community feed, the full
Export screen (scale multiplier / transparency toggle), adjustable brush size,
and gesture-based undo/redo.

## Capabilities

### New Capabilities
- `canvas-creation`: the New Canvas screen — size presets, custom size input,
  background choice, and handing off an allocated canvas to the Workspace.
- `pixel-drawing-engine`: the pixel buffer and drawing operations (pencil,
  eraser, bucket fill, pixel-perfect freehand), touch/pointer interaction
  (draw/pan/zoom), undo/redo, and native-resolution PNG export.

### Modified Capabilities
(none — this is the first change in the project)

## Impact

- New files: `index.html`, `style.css`, `js/app.js`, `js/new-canvas.js`,
  `js/workspace.js`, `js/engine.js`, `js/canvas-view.js`, `js/undo.js`.
- New test files under Node's built-in test runner (`node --test`) for
  `engine.js` — no new dependencies.
- No existing code affected (greenfield).
