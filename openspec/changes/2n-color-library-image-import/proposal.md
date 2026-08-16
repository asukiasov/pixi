## Why

The Color Library panel (`2f`) already supports named, persisted
palettes, but every palette is built one swatch at a time (typing a hex
value, or sampling with the Eyedropper). Extracting a palette from a
reference image - a piece of concept art, a photo, an existing sprite -
today means manually eyedropping colors out of it one at a time. Letting
the user import an image and have its main colors extracted
automatically removes that manual step while producing a normal named
palette indistinguishable from any hand-built one.

## What Changes

- Adds an "Import" entry point to the Color Library panel that opens a
  file picker (`image/*`), decodes the chosen image, and extracts a set
  of representative colors from it.
- Extraction downsamples the image to a small, fixed, internal grid
  purely as a color-reduction step (not shown to the user), then runs a
  clustering algorithm (median-cut) over those pixels to group similar
  shades together, taking one representative color per cluster - so
  anti-aliasing and gradients don't crowd the result with near-duplicate
  colors.
- The number of extracted colors is **user-adjustable** (not fixed).
- Shows a **live preview**: swatches update as the user adjusts the color
  count, before anything is saved - mirroring the "import, refine, then
  commit" shape `2m-brush-image-import`'s editor already uses.
- Saving the preview creates a new named palette through the existing
  "+ New Palette" flow (`2f`) - same naming UI, same storage, indistinguishable
  from a hand-built palette afterward (addable to, deletable, switchable
  like any other).
- No new dependencies - image decoding and clustering are plain
  JavaScript/canvas, consistent with this project's no-build-step
  approach.

## Capabilities

### New Capabilities
- None strictly new - this extends how a palette can be created, covered
  by a modified `color-library` requirement.

### Modified Capabilities
- `color-library`: the "Named palettes" requirement gains a second
  creation path (import-from-image, with a live preview and adjustable
  color count) alongside the existing "+ New Palette" flow; every other
  color-library requirement (persistence, deletion, panel layout,
  collapse) is unaffected.

## Impact

- `index.html`: an "Import" control in the Color Library panel, a hidden
  `<input type="file" accept="image/*">`, and a small preview area
  (extracted swatches + color-count control + name input + Save/Cancel),
  likely reusing `newPaletteRow`'s naming pattern.
- `js/workspace.js`: wires the import control - file selection, decoding,
  invoking downsampling + clustering, rendering the live preview, and
  handing off to the existing `createColorPalette(name, colors)` call on
  save.
- New shared utility (`js/image-import.js`, built in parallel with
  `2m-brush-image-import` since both need "decode a File into pixel
  data" - see that change's design.md for the shared-file coordination
  note).
- New color-clustering logic (median-cut or similar), likely
  `js/color-extraction.js` - specific to this change, not shared with
  `2m` (which does thresholding, not clustering).
- No persistence/schema changes - an imported palette is stored exactly
  like a hand-built one via the existing palette storage (`2f`).
