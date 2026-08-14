## 1. Layer stack (`js/layers.js`)

- [x] 1.1 Implement `Layer` (id, name, `PixelEngine` instance, visible,
      opacity, blendMode)
- [x] 1.2 Implement `LayerStack` construction: one starting layer at the
      chosen background
- [x] 1.3 Implement `addLayer` (transparent, above active, up to 8-layer cap)
- [x] 1.4 Implement `deleteLayer` (blocked when it's the only layer;
      reassigns active layer per design.md)
- [x] 1.5 Implement `moveLayerUp` / `moveLayerDown`
- [x] 1.6 Implement `renameLayer`
- [x] 1.7 Implement `setVisibility`, `setOpacity`, `setBlendMode`
- [x] 1.8 Implement `setActiveLayer` / `getActiveLayer`
- [x] 1.9 Unit tests (`node --test`) for all of the above (add, delete incl.
      last-layer guard, reorder, rename, visibility, opacity, blend mode,
      active-layer tracking, 8-layer cap)

## 2. Compositing

- [x] 2.1 Implement `LayerStack.composite()`: offscreen per-layer canvases →
      draw bottom-to-top onto a shared compositing canvas with
      `globalAlpha`/`globalCompositeOperation`, skipping hidden layers
- [x] 2.2 Map the four exposed blend modes (Normal, Multiply, Screen,
      Overlay) to their native `globalCompositeOperation` values
- [x] 2.3 Implement `LayerStack.toPNGBlob()` (composite + encode, mirroring
      `PixelEngine.toPNGBlob()`)

## 3. Wire into the app

- [x] 3.1 `js/new-canvas.js`: create a `LayerStack` (one starting layer)
      instead of a bare `PixelEngine`
- [x] 3.2 `js/canvas-view.js`: render `layerStack.composite()` instead of a
      single engine's buffer; no changes to pointer/pan/zoom logic
- [x] 3.3 `js/workspace.js`: pencil/eraser/bucket act on
      `layerStack.getActiveLayer().engine` instead of a single engine
- [x] 3.4 `js/workspace.js`: undo/redo snapshots capture the full layer
      stack (per layer: id, name, buffer copy, visible, opacity, blendMode)
      plus the active index, not a single buffer
- [x] 3.5 `js/workspace.js`: export button uses `layerStack.toPNGBlob()`

## 4. Layers panel UI

- [x] 4.1 `index.html`/`style.css`: add a Layers panel to the Workspace
      screen (list, add/delete buttons, up/down reorder, visibility toggle,
      opacity slider, blend-mode dropdown, rename, active-layer selection)
- [x] 4.2 `js/workspace.js`: wire the panel to `LayerStack`, re-rendering the
      list and the canvas on every layer change, disabling add past 8 layers
      and delete when only one layer remains

## 5. Verification

- [x] 5.1 Playwright smoke pass: add/delete/reorder/hide/opacity/blend-mode
      through the UI; confirm exported PNG reflects the composited result;
      confirm drawing on one layer doesn't touch another
- [x] 5.2 Re-run the full `node --test` suite (engine, undo, layers) to
      confirm no regressions
