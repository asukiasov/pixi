## 1. Shared image-import utility

- [ ] 1.1 `js/image-import.js` (new): `decodeImageFile(file)` -
      `createImageBitmap(file)` wrapped in error handling (reject
      unsupported/corrupt files gracefully - no console error, no crash)
- [ ] 1.2 `js/image-import.js`: `hasTransparency(image)` - draws the
      full decoded image to an offscreen canvas at its natural size (or a
      capped max, e.g. 256×256, for perf on huge images) and checks
      whether any pixel's alpha is below 255
- [ ] 1.3 `js/image-import.js`: `downsampleToImageData(image, width,
      height)` - draws `image` onto an offscreen canvas sized
      `width × height` via `drawImage` (smoothing on) and returns the
      resulting `ImageData`

## 2. Thresholding

- [ ] 2.1 `js/brushes.js` or a new `js/brush-import.js`:
      `thresholdToGrid(imageData, width, height, useAlpha)` - for each
      cell, if `useAlpha` set true when `alpha > 127`, else set true when
      luminance (`0.299r + 0.587g + 0.114b`) `< 127.5`; returns a
      `grid[y][x]` boolean array matching `brushEditorGridState`'s shape

## 3. Brush editor UI wiring

- [ ] 3.1 `index.html`: add an "Import" button to `#brush-editor-panel`
      plus a hidden `<input type="file" accept="image/*"
      id="brush-editor-import-input">` triggered by it
- [ ] 3.2 `js/workspace.js`: on file selection, decode via
      `decodeImageFile`, store the decoded image at module scope
      (`brushEditorSourceImage`), determine `useAlpha` via
      `hasTransparency`, downsample+threshold at the editor's current
      `brushEditorWidth`/`brushEditorHeight`, and set
      `brushEditorGridState` to the result - then re-render the grid
      (reuse `rebuildBrushEditorGrid`'s cell-rendering, but populate
      cells from the new grid instead of blank)
- [ ] 3.3 `js/workspace.js`: update the W/H `change` handlers - if
      `brushEditorSourceImage` is set, re-run downsample+threshold at the
      new size instead of blanking; if not set, keep today's
      blank-on-resize behavior unchanged
- [ ] 3.4 `js/workspace.js`: clear `brushEditorSourceImage` when the
      editor opens fresh (`openBrushEditor` or equivalent), when Cancel
      is pressed, and when Clear is pressed (Clear drops back to a blank
      grid and forgets the import, per design.md's decision)
- [ ] 3.5 Confirm hand-editing cells after an import still works
      (painting/erasing on the grid is unaffected by where the initial
      state came from) and that Save behaves identically regardless of
      import vs. hand-drawn origin

## 4. Verification

- [ ] 4.1 Re-run full `node --test` suite
- [ ] 4.2 Playwright smoke pass: import a transparent-background PNG
      (e.g. a simple icon) into the brush editor - confirm the grid
      pre-fills with a recognizable silhouette matching the icon's
      opaque region; import a fully-opaque JPG/PNG - confirm brightness
      thresholding produces a non-solid pattern (not all cells "on");
      change W/H after import - confirm the grid re-pixelates from the
      same source rather than clearing; hand-edit a few cells after
      import, save, and confirm the saved brush reflects the hand
      edits; click Clear after an import and confirm the grid blanks and
      a subsequent resize no longer re-pixelates (import was forgotten);
      place the saved imported brush while a non-default color is
      selected and confirm it paints in that color, not any color from
      the source image; zero console errors throughout
