## 1. Layer model

- [x] 1.1 `js/layers.js`: `Layer` gains `isBackground` (default `false`);
      `LayerStack`'s constructor sets it `true` on the starting layer
      only when `background === 'white'`
- [x] 1.2 `js/layers.js`: `moveLayerUp`/`moveLayerDown` no-op when the
      target layer's `isBackground` is `true`
- [x] 1.3 `js/layers.js`: `toProjectRecord`/`fromProjectRecord` persist
      `isBackground` per layer (defaults falsy for old records with no
      such field - see design.md's Migration/Risk note)
- [x] 1.4 Unit tests (`node --test`): white background → starting layer
      `isBackground === true`; transparent background → `false`;
      `moveLayerUp`/`moveLayerDown` are no-ops on a Background layer
      (stack order unchanged) but work normally on others; round-trip
      through `toProjectRecord`/`fromProjectRecord` preserves the flag;
      loading a record with no `isBackground` field defaults to `false`

## 2. Layers panel UI

- [x] 2.1 `js/workspace.js`: `buildLayerRow()` shows a lock icon
      (Material Symbols `lock`, added to the `icon_names` subsetting
      list) next to the Background layer's name, and disables its
      up/down reorder buttons regardless of stacking position
- [x] 2.2 Confirm a newly-added layer (via "+ Layer") is never marked
      `isBackground`, even when added while a Background layer exists

## 3. Eraser exception

- [x] 3.1 `js/workspace.js`: `pencilOrEraserApplyPixel(engine)` - when
      the active layer's `isBackground` is `true` and the tool is
      Eraser, use `(x, y) => engine.setPixelBlended(x, y,
      state.backgroundColor, state.pencilOpacity)` instead of
      `erasePixelBlended`; every other case (non-Background layer, or
      Pencil) unchanged
- [x] 3.2 Confirm the active layer is read once per stroke (matching the
      existing `strokeEngine` capture-once-per-drag pattern), not
      re-checked per pixel

## 4. Verification

- [x] 4.1 Re-run full `node --test` suite
- [x] 4.2 Playwright smoke pass: create a white-background canvas,
      confirm its one layer shows a lock icon and disabled reorder
      buttons; create a transparent-background canvas, confirm no lock
      icon and normal reorder buttons; on the white-background canvas,
      set a non-default Background color and erase part of the
      Background layer - confirm the erased pixels become that color
      (sampled via `getImageData`), not transparent; add a second
      (regular) layer, make it active, erase part of it - confirm it
      still produces full transparency; add a third layer above the
      Background layer and confirm it reorders freely among non-
      Background layers while the Background layer itself stays pinned
      at the bottom; zero console errors throughout
