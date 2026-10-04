## Why

The custom brush editor (`2c1`) already lets a user hand-draw a monochrome
pixel pattern and save it as a reusable brush, but every pattern starts
from a blank grid. Turning an existing image (an icon, a sticker, a
silhouette) into a brush today means manually re-drawing it cell by cell.
Letting the user import an image and have it auto-pixelate into the same
grid editor - which they can still hand-tweak before saving - removes
that manual re-tracing step while keeping every other part of brush
creation unchanged.

## What Changes

- Adds an "Import" entry point to the Brushes panel/brush editor that
  opens a file picker (`image/*`), decodes the chosen image, and
  pre-fills the existing brush editor's grid (instead of a blank grid) at
  its current width/height.
- Pre-filling thresholds the image to on/off cells: alpha-based (a cell is
  "on" if its downsampled region is mostly opaque) when the image has any
  transparency; falls back to brightness-based thresholding (darker →
  "on") for a fully-opaque image, so a plain photo/JPG still produces a
  real shape instead of a solid block.
- The imported brush is always a **monochrome silhouette**, placed in
  whatever color the user is currently drawing with - same as every other
  brush (Heart, Circle, hand-drawn custom ones). The image's own colors
  are discarded during thresholding, not preserved.
- Changing the editor's W/H **after** an import re-pixelates from the
  stored source image at the new size, instead of clearing the grid (the
  existing behavior for hand-drawn brushes, which still applies whenever
  no source image is loaded).
- Everything downstream of the grid (hand-editing cells, naming, Save,
  Cancel, persistence via `2c1`'s custom-brush storage) is unchanged.
- No new dependencies - image decoding uses the browser's native
  `<canvas>`/`Image`/`createImageBitmap` APIs, consistent with this
  project's no-build-step, no-npm-dependency approach for the shipped app.

## Capabilities

### Modified Capabilities
- `brushes`: the "Custom brush creation" requirement gains an
  image-import entry point and the resize-re-pixelates-from-source
  behavior; every other brushes requirement (picker, placement, spacing,
  rotation, Rainbow, persistence) is unaffected.

## Impact

- `index.html`: an "Import" button/control in the brush editor panel
  (`#brush-editor-panel`) or Brushes panel, plus a hidden
  `<input type="file" accept="image/*">` to trigger the OS file picker.
- `js/workspace.js`: wires the import control - file selection, decoding,
  invoking the pixelation step, populating `brushEditorGridState`, and
  tracking the in-memory source image so W/H changes can re-pixelate.
- New shared utility (likely `js/image-import.js`, built in parallel with
  `2n-color-library-image-import` since both need "decode a File into
  pixel data" - kept small and focused so each change's specific
  algorithm - thresholding here, color clustering there - stays separate).
- `js/brushes.js`: no changes expected - `pixelsFromGrid` already converts
  a boolean grid to the `pixels: [[x,y], ...]` format brushes use; the new
  code produces that same grid shape, just via pixelation instead of
  hand-drawing.
- No persistence/schema changes - imported brushes are stored exactly like
  hand-drawn custom brushes today.
