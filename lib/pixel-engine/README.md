# Pixel Engine

Pixi's pixel data model — the drawing buffer, layer compositing, and undo/
redo — extracted into a standalone folder so it can be used outside the
Pixi app. This folder is self-contained: everything you need to use it is
on this page. No other file from the Pixi repo is required.

**Get it**: download or copy this folder (`lib/pixel-engine/`) from the
[Pixi GitHub repo](https://github.com/asukiasov/pixi). There's no npm
package, no CDN bundle, no build step — copy the three `.js` files and
import them directly as ES modules. Last verified against commit
[`a1de045`](https://github.com/asukiasov/pixi/commit/a1de0450144b1b6a522418f1d4092e0adfdd1ac6)
(shortly after tag `v0.3.0`).

**License**: MIT, matching the repo root [`LICENSE`](../../LICENSE).

## What's in here

Three files, each a plain ES module with no import beyond the others in
this folder:

| File | Exports | What it does |
|---|---|---|
| `engine.js` | `PixelEngine`, `bresenhamLine`, `circleOffsets`, `strokeFreehandThick`, `registerPathTransform` | A single layer's pixel buffer (`Uint8ClampedArray`, RGBA) and pure drawing operations on it: freehand stroke, flood fill, region extract/clear/stamp, PNG encode |
| `layers.js` | `LayerStack`, `BLEND_MODES` | An ordered stack of `PixelEngine` buffers (up to 8) with per-layer visibility/opacity/blend mode, compositing, merge, resize, rotate, and project-record (de)serialization |
| `undo.js` | `UndoStack` | A capped (20-deep) undo/redo stack of opaque snapshots — you decide what a "snapshot" is; typically a `LayerStack.snapshot()` result |

**Browser-only aside from that**: the only browser API these files touch
is `document.createElement('canvas')`, used for offscreen PNG encoding and
layer compositing (`PixelEngine.toPNGBlob()`, `LayerStack.toPNGBlob()`,
`LayerStack.composite()`). Every other method is plain data manipulation
and runs anywhere JS runs.

## Usage example

A complete draw → layer → undo → export workflow:

```js
import { LayerStack } from './layers.js';
import { UndoStack } from './undo.js';

// Create a 32x32 canvas with one starting layer.
const stack = new LayerStack(32, 32, 'transparent');
const undo = new UndoStack();

// Draw a freehand stroke on the active layer.
const active = stack.getActiveLayer();
active.engine.strokeFreehand(
  [{ x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }],
  [255, 0, 0, 255] // red
);

// Commit the stroke to the undo stack (call this after each completed
// user action — a finished stroke, fill, or layer change — not per pixel).
undo.push(stack.snapshot());

// Add a second layer and draw on it too.
stack.addLayer('Layer 2');
stack.getActiveLayer().engine.floodFill(0, 0, [0, 255, 0, 255]); // green fill
undo.push(stack.snapshot());

// Undo the fill; the stack reverts to the single red stroke.
stack.restore(undo.undo());

// Get the current composited result as a PNG Blob (browser only).
const pngBlob = await stack.toPNGBlob();
```

### API reference

**`new PixelEngine(width, height, background = 'transparent')`**
- `background`: `'transparent'` (default) or `'white'`
- `.getPixel(x, y)` → `[r, g, b, a]`
- `.setPixel(x, y, [r, g, b, a])` — no-ops if out of bounds
- `.strokeFreehand(points, rgba)` — connects `points` with Bresenham lines, sets each pixel
- `.floodFill(x, y, rgba)` — 4-directional flood fill from `(x, y)`
- `.extractRegion(x, y, width, height)` / `.clearRegion(...)` / `.stampRegion(x, y, width, height, buffer)` — copy/clear/paste a rectangular region
- `.toPNGBlob()` → `Promise<Blob>` — native-resolution PNG of just this buffer (browser only)

**`new LayerStack(width, height, background = 'transparent')`**
- `.getLayers()` → array of `{ id, name, engine, visible, opacity, blendMode, isBackground, isReferenceImage, ... }`
- `.getActiveLayer()` / `.setActiveLayer(index)` / `.getActiveIndex()`
- `.addLayer(name)` → new `Layer` or `null` if at the 8-layer cap
- `.deleteLayer(index)`, `.moveLayerUp(index)`, `.moveLayerDown(index)`, `.renameLayer(index, name)`
- `.setVisibility(index, visible)`, `.setOpacity(index, opacity)`, `.setBlendMode(index, mode)` — `mode` is one of `BLEND_MODES` (`'normal' | 'multiply' | 'screen' | 'overlay'`)
- `.mergeLayers(indices)` / `.mergeDown(index)` — flattens 2+ layers into one, respecting each layer's opacity/blend mode
- `.resize(width, height)` — anchored top-left; crops or pads transparently
- `.rotate90('cw' | 'ccw')`
- `.composite()` → `ImageData` of the full stack, respecting visibility/opacity/blend mode
- `.toPNGBlob({ skipBackground, scale, format } = {})` → `Promise<Blob>` — `format` is `'png' | 'webp' | 'jpg'`
- `.snapshot()` / `.restore(snapshot)` — deep-copy state for undo/redo
- `.toProjectRecord()` / `LayerStack.fromProjectRecord(record)` — plain-object (de)serialization for storage

**`new UndoStack()`**
- `.push(snapshot)` — commits a new state; discards any redo history ahead of the current pointer
- `.undo()` → previous snapshot, or `undefined` if nothing to undo
- `.redo()` → next snapshot, or `undefined` if nothing to redo
- `.canUndo()` / `.canRedo()` / `.size()`

## Tests

`engine.test.js`, `layers.test.js`, `undo.test.js` sit alongside the
source and run with Node's built-in test runner (`node --test
lib/pixel-engine/*.test.js`) — no browser or DOM required for the
non-canvas methods; the handful of canvas-dependent tests run under
`fake-indexeddb`/jsdom-free Node the same way the main repo's test suite
does. See the main repo's `package.json` for the exact command.

## Relationship to the rest of Pixi

This library is the data model only — no rendering to screen, no
pointer/tool handling, no UI. The Pixi app (`js/` in the main repo) builds
its Workspace screen, tool behavior, and Canvas rendering on top of these
three classes. If you want a ready-made mountable editor instead of just
the data model, see `../pixi.js`'s embeddable editor API.

**When this library alone is the right call, instead of `../pixi.js`'s
`Pixi.mount()`:** your host already owns its own canvas rendering and
pointer/touch input — a game engine's own render loop, a canvas
component your framework already manages — and only needs the pixel data
underneath: layer compositing, undo/redo, PNG export. Going this route
means building, yourself, everything `mount()` would otherwise give you
for free: translating pointer events into `(x, y)` calls on
`PixelEngine`/`LayerStack`, a tool state machine (what "pencil mode" vs.
"fill mode" even means for your input), and any UI at all (a color
picker, a tool palette) if your use case needs one. For most embeds —
including an avatar picker that just needs a drawing surface — `mount()`
is less work; reach for this library alone only when the host's own
rendering/input already exists and re-hosting `mount()`'s UI would be the
redundant part.
