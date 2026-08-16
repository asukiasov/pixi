## 1. Shared image-import utility

- [ ] 1.1 `js/image-import.js` (new, shared with `2m-brush-image-import` -
      coordinate via git worktree merge, see design.md): `decodeImageFile
      (file)` - `createImageBitmap(file)` wrapped in error handling
- [ ] 1.2 `js/image-import.js`: `downsampleToImageData(image, width,
      height)` - draws `image` onto an offscreen canvas sized
      `width × height` and returns the resulting `ImageData` (same
      function `2m` uses for its editor-sized downsample; this change
      calls it with a fixed internal size instead)

## 2. Color extraction

- [ ] 2.1 `js/color-extraction.js` (new): `extractPalette(imageData,
      count)` - median-cut clustering over the pixels in `imageData`:
      recursively split the bounding box of sampled colors along its
      longest channel axis until there are `count` boxes, average each
      box's pixels into one representative hex color, return the
      resulting array
- [ ] 2.2 Confirm `extractPalette` is deterministic (same input always
      produces the same output - no randomness) and reasonably fast on a
      64×64 (4096-pixel) input for counts up to at least 32

## 3. Color Library panel UI wiring

- [ ] 3.1 `index.html`: add an "Import" button to the Color Library panel
      plus a hidden `<input type="file" accept="image/*"
      id="color-library-import-input">`, and an import-preview section
      (swatch preview row, color-count number input/slider, name input,
      Save/Cancel) - reuse `#new-palette-row`'s naming-row styling where
      it fits
- [ ] 3.2 `js/workspace.js`: on file selection, decode via
      `decodeImageFile`, downsample once via `downsampleToImageData` at a
      fixed internal size (e.g. 64×64) and cache the result, run
      `extractPalette` at the current color-count value, and render the
      preview swatches
- [ ] 3.3 `js/workspace.js`: wire the color-count control to re-run
      `extractPalette` against the cached downsampled `ImageData` (not
      re-decoding/re-downsampling) whenever it changes, updating the
      preview swatches live
- [ ] 3.4 `js/workspace.js`: wire Save in the import preview - takes the
      current preview's colors and the entered name, calls the existing
      `createColorPalette(name, colors)`, sets it active, closes the
      preview, and refreshes the panel (mirroring `newPaletteSave`'s
      existing flow)
- [ ] 3.5 `js/workspace.js`: wire Cancel - discards the cached
      downsampled image and preview colors, closes the preview, no
      palette created

## 4. Verification

- [ ] 4.1 Re-run full `node --test` suite
- [ ] 4.2 Add unit tests for `extractPalette` (DOM-free - operates on a
      plain `ImageData`-shaped input, no `<canvas>` needed): a
      single-solid-color input produces one distinct color regardless of
      requested count; an input with N clearly distinct solid-color
      regions produces N (or close to N) matching representative colors;
      output length equals the requested count (or fewer only when the
      input genuinely can't support more distinct colors)
- [ ] 4.3 Playwright smoke pass: import a multi-color image (e.g. a
      simple test image with a few flat color regions and one gradient)
      into the Color Library panel - confirm the live preview shows
      swatches; change the color-count control and confirm the preview
      updates without re-prompting for a file; confirm a gradient region
      doesn't dominate the palette with near-duplicate shades (spot-check
      the extracted hex values are meaningfully different from each
      other); save with a name and confirm a new palette appears in the
      dropdown, becomes active, and its swatches match the preview;
      confirm Cancel discards the preview and creates no palette; zero
      console errors throughout
