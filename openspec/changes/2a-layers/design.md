## Context

See proposal.md for motivation. Building on Phase 1's `js/engine.js`
(`PixelEngine`: a DOM-free flat `Uint8ClampedArray` buffer with
`setPixel`/`strokeFreehand`/`floodFill`/`toPNGBlob`), `js/canvas-view.js`
(render + pointer/touch interaction), `js/undo.js` (generic snapshot
undo/redo stack — already accepts any snapshot shape, not just a raw
buffer), and `js/workspace.js` (tool wiring). No persisted data exists yet
(Phase 2b hasn't shipped), so there's no migration to design for.

## Goals / Non-Goals

**Goals:**
- Multiple independently-drawable layers per canvas, composited correctly
  for both live render and PNG export.
- Reuse `PixelEngine` unchanged as the per-layer buffer — no duplicated
  pixel-manipulation logic.
- Keep compositing dependency-free by using the Canvas 2D API's own
  `globalCompositeOperation`/`globalAlpha`, not hand-rolled blending math.

**Non-Goals:**
- Layer thumbnails (needed for Gallery, which is Phase 2b, not this slice).
- More than 4 blend modes, or a "Normal" mode that's actually anything but
  standard alpha-over compositing.
- Any persistence — layers live in memory only until Phase 2b.

## Decisions

**`PixelEngine` becomes the per-layer buffer type, unchanged.** Each layer
*is* a `PixelEngine` instance (via composition, not subclassing) plus layer
metadata. This avoids extracting/duplicating `setPixel`/`strokeFreehand`/
`floodFill` into a separate "buffer ops" module — the existing DOM-free,
already-unit-tested engine API is reused as-is.

```js
// js/layers.js
class Layer {
  constructor(id, name, width, height, background = 'transparent') {
    this.id = id;
    this.name = name;
    this.engine = new PixelEngine(width, height, background);
    this.visible = true;
    this.opacity = 1; // 0-1
    this.blendMode = 'normal'; // 'normal' | 'multiply' | 'screen' | 'overlay'
  }
}

class LayerStack {
  #layers = []; // bottom-to-top order
  #activeIndex = 0;
  #width; #height;
  // addLayer, deleteLayer, moveLayerUp/Down, renameLayer, setVisibility,
  // setOpacity, setBlendMode, setActiveLayer, getActiveLayer
  // composite(): returns a flattened Uint8ClampedArray/ImageData
  // toPNGBlob(): composite() + PixelEngine.toPNGBlob()'s canvas-encode step
}
```

**Compositing via an offscreen canvas, not manual alpha math.** `putImageData`
ignores `globalAlpha`/`globalCompositeOperation`, so each visible layer's
`ImageData` is first painted onto a small per-layer offscreen `<canvas>`
(`layer.engine.data` → `putImageData`), then that offscreen canvas is
`drawImage`'d onto the shared compositing canvas bottom-to-top with
`ctx.globalAlpha = layer.opacity` and
`ctx.globalCompositeOperation = <mapped mode>`. The four exposed modes map
directly to native `globalCompositeOperation` values (`source-over`,
`multiply`, `screen`, `overlay`), so "supporting a blend mode" is just
exposing it in the UI — no custom math to get wrong. This runs on every
render (including live per-move-event redraws inherited from Phase 1's
pixel-perfect stroke handling), which is cheap enough at ≤256×256 canvases
with ≤8 layers.

**Layer cap of 8.** Not requested explicitly, but an unbounded stack risks
compositing cost and undo-snapshot memory growing without limit (each
snapshot now serializes every layer's buffer). 8 is generous for the target
canvas sizes and cheap to raise later if it's too restrictive.

**Undo snapshots now cover the whole layer stack, not one buffer.** A
snapshot becomes `{ layers: [{ id, name, data: Uint8ClampedArray (copy),
visible, opacity, blendMode }], activeIndex }`. `js/undo.js` itself needs no
changes — it already stores opaque snapshots; only what `workspace.js`
constructs as "the current state" changes. This does mean each snapshot is
now sized `layerCount × width × height × 4` instead of a single buffer,
which is what motivates the layer cap above.

**Active-layer scoping happens in `workspace.js`, not `layers.js`.**
`LayerStack.getActiveLayer()` returns the target `PixelEngine`; the existing
pencil/eraser/bucket handlers in `workspace.js` just call
`activeLayer.engine.strokeFreehand(...)` / `.floodFill(...)` instead of
`engine.strokeFreehand(...)` directly. No change to the tool logic itself.

**`canvas-view.js` renders `layerStack.composite()` instead of a raw
engine's buffer.** Its `render()` method's `putImageData` call source
changes; its pointer/touch/pan/zoom logic is untouched (it doesn't know or
care that there are multiple layers underneath).

## Risks / Trade-offs

- [Per-move-event full recomposite (inherited from Phase 1's
  restore-and-redraw pixel-perfect approach) could get slow with 8 layers at
  256×256] → Acceptable for this slice; if it's noticeably laggy in manual
  testing, the fix is compositing only up through the active layer live and
  compositing the rest lazily — deferred unless it's actually a problem.
- [8-layer cap may be too low for some users] → Easy to raise later; chosen
  as a starting bound, not a promise.
- [Undo snapshot memory grows with layer count] → Still capped at 50
  snapshots (`js/undo.js`, unchanged) × up to 8 layers × buffer size; at
  256×256×4 bytes × 8 layers × 50 snapshots ≈ 100MB worst case. Acceptable
  for a single active session; revisit if it's a real problem before Phase
  2b adds persistence pressure.

## Testing

- `js/layers.js` stays DOM-free for its stack-management logic (add/delete/
  reorder/rename/visibility/opacity/blend-mode/active-layer), tested with
  `node --test` like `engine.js` and `undo.js`. `composite()`/`toPNGBlob()`
  need a `<canvas>`, so — consistent with `PixelEngine.toPNGBlob()` — those
  aren't unit tested; they're covered by the Playwright smoke pass below.
- Playwright smoke pass (as used for Phase 1): add/delete/reorder/hide/
  opacity/blend-mode through the UI, confirm exported PNG reflects the
  composited result, confirm drawing on one layer doesn't touch another.
