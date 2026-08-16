## 1. Shared image-import utility

- [x] 1.1 `js/image-import.js` (new, shared with `2m-brush-image-import` -
      coordinate via git worktree merge, see design.md): `decodeImageFile
      (file)` - `createImageBitmap(file)` wrapped in error handling
      (2m hadn't landed in this worktree yet, so this file was created
      fresh with only the surface 2n needs; 2m's `hasTransparency` can be
      added alongside these two on merge without touching them)
- [x] 1.2 `js/image-import.js`: `downsampleToImageData(image, width,
      height)` - draws `image` onto an offscreen canvas sized
      `width × height` and returns the resulting `ImageData` (same
      function `2m` uses for its editor-sized downsample; this change
      calls it with a fixed internal size instead)

## 2. Color extraction

- [x] 2.1 `js/color-extraction.js` (new): `extractPalette(imageData,
      count)` - median-cut clustering over the pixels in `imageData`:
      recursively split the bounding box of sampled colors along its
      longest channel axis until there are `count` boxes, average each
      box's pixels into one representative hex color, return the
      resulting array
- [x] 2.2 Confirm `extractPalette` is deterministic (same input always
      produces the same output - no randomness) and reasonably fast on a
      64×64 (4096-pixel) input for counts up to at least 32 (see
      test/color-extraction.test.js's "is deterministic" and "runs
      quickly on a 64x64 input" tests - 32-color extraction over 4096
      pixels completes in ~6ms, well under the 500ms budget)

## 3. Color Library panel UI wiring

- [x] 3.1 `index.html`: add an "Import" button to the Color Library panel
      plus a hidden `<input type="file" accept="image/*"
      id="color-library-import-input">`, and an import-preview section
      (swatch preview row, color-count number input/slider, name input,
      Save/Cancel) - reuse `#new-palette-row`'s naming-row styling where
      it fits
- [x] 3.2 `js/workspace.js`: on file selection, decode via
      `decodeImageFile`, downsample once via `downsampleToImageData` at a
      fixed internal size (e.g. 64×64) and cache the result, run
      `extractPalette` at the current color-count value, and render the
      preview swatches
- [x] 3.3 `js/workspace.js`: wire the color-count control to re-run
      `extractPalette` against the cached downsampled `ImageData` (not
      re-decoding/re-downsampling) whenever it changes, updating the
      preview swatches live
- [x] 3.4 `js/workspace.js`: wire Save in the import preview - takes the
      current preview's colors and the entered name, calls the existing
      `createColorPalette(name, colors)`, sets it active, closes the
      preview, and refreshes the panel (mirroring `newPaletteSave`'s
      existing flow)
- [x] 3.5 `js/workspace.js`: wire Cancel - discards the cached
      downsampled image and preview colors, closes the preview, no
      palette created

## 4. Verification

- [x] 4.1 Re-run full `node --test` suite (145/145 pass)
- [x] 4.2 Add unit tests for `extractPalette` (DOM-free - operates on a
      plain `ImageData`-shaped input, no `<canvas>` needed): a
      single-solid-color input produces one distinct color regardless of
      requested count; an input with N clearly distinct solid-color
      regions produces N (or close to N) matching representative colors;
      output length equals the requested count (or fewer only when the
      input genuinely can't support more distinct colors) - see
      test/color-extraction.test.js (9 tests, also covering transparent-
      pixel handling, determinism, and gradient non-domination)
- [x] 4.3 Playwright smoke pass: imported a generated multi-color test
      PNG (4 flat color blocks + a red->blue gradient strip) into the
      Color Library panel - confirmed the live preview showed 8 swatches
      by default; changed the color-count control from 8 to 16 and
      confirmed the preview updated to 16 swatches without re-prompting
      for a file; spot-checked the extracted hex values at count 4 were
      meaningfully distinct (not near-duplicate gradient shades); saved
      as "Imported Test" and confirmed it appeared in the palette
      dropdown, became active, and its swatches matched the preview;
      re-imported and clicked Cancel - confirmed the preview closed and
      no new palette was created (dropdown/palette count unchanged); zero
      console errors throughout - see verification notes below
