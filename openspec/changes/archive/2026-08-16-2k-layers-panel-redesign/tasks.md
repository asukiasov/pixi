## 1. Toolbar (Blend mode + Opacity, active-layer-scoped)

- [x] 1.1 `index.html`: `#layers-panel` gains `.layers-panel-toolbar`
      between the header and `#layers-panel-list` - a Blend mode
      `<select>` (`#layers-panel-blend-select`) and an Opacity row
      (icon + `<input type="range">` + percentage readout), stacked as
      two full-width rows rather than sharing one line
- [x] 1.2 `js/workspace.js`: `layersPanelBlendSelect`/
      `layersPanelOpacitySlider`/`layersPanelOpacityReadout` module
      vars; populated/wired once in `bindDomOnce` - `change`/`input`
      handlers call `state.layerStack.setBlendMode`/`setOpacity` with
      `state.layerStack.getActiveIndex()`, mirroring the old per-row
      handlers' logic exactly, just reading the active index instead of
      a closed-over row index
- [x] 1.3 New `syncLayersPanelToolbar()`: reads the active layer's
      `blendMode`/`opacity`, updates the select/slider/readout to
      match; called at the end of `renderLayersPanel()` so switching
      the active layer (or any other panel-affecting action) always
      leaves the toolbar in sync

## 2. Compact single-row layers with real thumbnails

- [x] 2.1 New `buildLayerThumbnailCanvas(layer)`: draws
      `layer.engine.data` into a `<canvas>` via `ImageData`, sized to
      the layer's actual width/height (scaled down by CSS/
      `image-rendering: pixelated`, same pattern
      `buildBrushPreviewCanvas` already uses for brush swatches)
- [x] 2.2 `buildLayerRow` rewritten from two sub-rows
      (`.layer-row-top`/`.layer-row-bottom`) to one row: visibility
      toggle, thumbnail, name input, then a `.layer-row-actions`
      cluster (up/down reorder + delete) - opacity slider and blend
      select removed from the row entirely (now toolbar-level, see
      section 1)
- [x] 2.3 `style.css`: full restyle - `.layer-row` is a single flex
      row; `.layer-row.active` uses a solid accent-blue background
      (Photoshop's own selection-highlight style) with white text/icon
      overrides for contrast; new `.layer-thumbnail` (flat light
      background standing in for transparency, matching the Gallery's
      own project-thumbnail convention); `.layer-row-actions` groups
      the small reorder/delete icons

## 3. Verification

- [x] 3.1 `npx openspec validate 2k-layers-panel-redesign --strict`
- [x] 3.2 Re-run full `node --test` suite - unaffected (workspace.js
      has no unit tests, per this project's established convention;
      verification here is Playwright-only)
- [x] 3.3 Playwright: created a project, drew on a layer, added a
      second layer, confirmed both layers render with correct
      thumbnails and exactly one row carries `.active`; selected the
      other layer and confirmed the toolbar's Blend mode/Opacity
      updated to that layer's own values (not the previous layer's);
      confirmed no console errors
- [x] 3.4 **Bug found and fixed during verification**: an initial
      single-line toolbar layout (Blend select + Opacity label/slider/
      readout all in one row) measured overflowing the right sidebar's
      right edge by several pixels at both a typical (1280px) and the
      narrowest clamped (~128px) sidebar width - confirmed via
      Playwright bounding-box checks (`getBoundingClientRect`-based),
      not just visual inspection. Fixed by splitting into two stacked
      rows and replacing the "Opacity" text label with an icon (see
      design.md's Decisions); re-verified overflow is gone once
      settled (a transient icon-webfont-loading race can briefly widen
      a fallback glyph before the font loads, self-correcting - the
      same trade-off already accepted everywhere else in this app's
      icon usage, not something newly introduced here)
