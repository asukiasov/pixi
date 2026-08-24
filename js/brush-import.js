// Thresholding step of the brush image-import feature (js/image-import.js
// holds the shared decode/downsample step this builds on; see
// openspec/changes/2m-brush-image-import/design.md for why alpha-vs-
// brightness and the luminance formula were chosen the way they are).
// Pure and DOM-free, unlike image-import.js's canvas-dependent half - it
// takes an already-downsampled ImageData (or anything shaped like one),
// so this half is unit-testable with node --test.

const ALPHA_THRESHOLD = 127; // strictly greater than: "mostly opaque"
const LUMINANCE_MIDPOINT = 127.5; // strictly less than: "darker than half"

/**
 * Converts a downsampled ImageData into a grid[y][x] boolean array
 * matching the brush editor's grid state shape - one cell per source
 * pixel. `useAlpha` selects alpha-based thresholding (cell "on" when more
 * opaque than not) for images with any transparency, or brightness-based
 * thresholding (cell "on" when darker than the midpoint, standard
 * perceptual luminance weighting `0.299r + 0.587g + 0.114b`) as the
 * fallback for fully-opaque images - see design.md's Decisions.
 */
export function thresholdToGrid(imageData, width, height, useAlpha) {
  const { data } = imageData;
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const on = useAlpha ? a > ALPHA_THRESHOLD : 0.299 * r + 0.587 * g + 0.114 * b < LUMINANCE_MIDPOINT;
      row.push(on);
    }
    grid.push(row);
  }
  return grid;
}
