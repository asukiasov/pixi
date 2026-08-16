## 1. Shared image-import utility

- [x] 1.1 `js/image-import.js` (new): `decodeImageFile(file)` -
      `createImageBitmap(file)` wrapped in error handling (reject
      unsupported/corrupt files gracefully - no console error, no crash)
- [x] 1.2 `js/image-import.js`: `hasTransparency(image)` - draws the
      full decoded image to an offscreen canvas at its natural size (or a
      capped max, e.g. 256×256, for perf on huge images) and checks
      whether any pixel's alpha is below 255
- [x] 1.3 `js/image-import.js`: `downsampleToImageData(image, width,
      height)` - draws `image` onto an offscreen canvas sized
      `width × height` via `drawImage` (smoothing on) and returns the
      resulting `ImageData`

## 2. Thresholding

- [x] 2.1 `js/brush-import.js` (new, per design.md keeping thresholding
      separate from `2n`'s clustering): `thresholdToGrid(imageData, width,
      height, useAlpha)` - for each cell, if `useAlpha` set true when
      `alpha > 127`, else set true when luminance
      (`0.299r + 0.587g + 0.114b`) `< 127.5`; returns a `grid[y][x]`
      boolean array matching `brushEditorGridState`'s shape

## 3. Brush editor UI wiring

- [x] 3.1 `index.html`: added an "Import" button to `#brush-editor-panel`
      plus a hidden `<input type="file" accept="image/*"
      id="brush-editor-import-input">` triggered by it
- [x] 3.2 `js/workspace.js`: on file selection, decodes via
      `decodeImageFile`, stores the decoded image at module scope
      (`brushEditorSourceImage`), determines `useAlpha` via
      `hasTransparency`, downsamples+thresholds at the editor's current
      `brushEditorWidth`/`brushEditorHeight` (new
      `applyBrushEditorSourceImage()` helper), and sets
      `brushEditorGridState` to the result, re-rendering the grid's `on`
      classes in place (reuses the DOM cells `rebuildBrushEditorGrid`
      already built)
- [x] 3.3 `js/workspace.js`: updated the W/H `change` handlers - after
      `rebuildBrushEditorGrid()`, calls `applyBrushEditorSourceImage()`,
      which re-runs downsample+threshold at the new size when
      `brushEditorSourceImage` is set, and is a no-op (today's
      blank-on-resize behavior unchanged) when it isn't
- [x] 3.4 `js/workspace.js`: clears `brushEditorSourceImage` when the
      editor opens fresh (`openBrushEditor`), when Cancel is pressed or
      the panel otherwise closes (`closeBrushEditor`, also called by
      Save), and when Clear is pressed (Clear drops back to a blank grid
      and forgets the import, per design.md's decision)
- [x] 3.5 Confirmed hand-editing cells after an import still works
      (painting/erasing on the grid is unaffected by where the initial
      state came from) and that Save behaves identically regardless of
      import vs. hand-drawn origin - see Playwright pass in 4.2

## 4. Verification

- [x] 4.1 Re-ran full `node --test` suite: 141/141 pass (5 new tests in
      `test/brush-import.test.js` for the pure `thresholdToGrid`
      function - alpha-mode on/off, the alpha threshold's strict `>`
      boundary at 127, brightness-mode on/off, the perceptual-luminance
      formula specifically vs. a flat RGB average, and grid shape).
      `decodeImageFile`/`hasTransparency`/`downsampleToImageData` in
      `js/image-import.js` need a real `<canvas>`/`Image`/
      `createImageBitmap`, which `node --test` doesn't provide (same
      reason `LayerStack`'s compositing methods in `js/layers.js` were
      never unit-testable, per that file's own doc comment) - verified
      via the Playwright pass below instead of Node unit tests.
- [x] 4.2 Playwright smoke pass (chromium, served via
      `python3 -m http.server`, test images generated with Pillow - a
      transparent-background PNG with an opaque circular silhouette, and
      a fully-opaque JPG with a dark rectangle on a light background):
      opened a 32×32 project, opened the brush editor, set it to 20×20 -
      importing the transparent PNG pre-filled the grid with a partial
      silhouette (116/400 cells on - neither blank nor solid) matching
      the circle, confirmed visually via screenshot; importing the opaque
      JPG produced a non-solid brightness-thresholded pattern (128/400 on,
      the dark rectangle's shape), also confirmed visually; changing W/H
      to 10×10 after the import re-pixelated from the same source
      (32/100 on, same rectangle shape at the new resolution) rather than
      clearing; hand-clicking a cell after import toggled it as expected;
      saved as "Imported Test Brush" with the hand edit intact; re-opened
      the editor, imported the transparent PNG again, confirmed on-cells
      appeared, clicked Clear - confirmed the grid blanked (0 on) - then
      resized to 15×15 and confirmed it stayed blank (0 on, import
      forgotten) instead of re-pixelating; selected the Brush tool, set
      the foreground color to magenta (#ff00ff), selected "Imported Test
      Brush" from the picker (confirmed present by name), placed it on
      the canvas, and confirmed via pixel sampling that the placed pixels
      were magenta - the current drawing color - not any color sampled
      from the source image (which had none, being a monochrome
      silhouette by design); zero console errors throughout the entire
      pass.
