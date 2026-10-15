// Opacity step of the brush image-import feature (js/image-import.js
// holds the shared decode/downsample step this builds on; see
// docs/history/2026-08-16-2m-brush-image-import/design.md for why alpha-vs-
// brightness and the luminance formula were chosen the way they are).
// Pure and DOM-free, unlike image-import.js's canvas-dependent half - it
// takes an already-downsampled ImageData (or anything shaped like one),
// so this half is unit-testable with node --test.

const MIN_OPACITY = 0.05; // fainter cells are noise, not part of the brush

/**
 * Converts a downsampled ImageData into a grid[y][x] of opacities (0 =
 * off, up to 1) for the brush editor - one cell per source pixel.
 * `useAlpha` (images with any transparency) uses each pixel's alpha;
 * otherwise (fully opaque images) darker pixels are more opaque, using
 * perceptual luminance `0.299r + 0.587g + 0.114b`. Values are rounded to
 * 2 decimals and anything under 5% becomes off.
 */
export function imageToOpacityGrid(imageData, width, height, useAlpha) {
  const { data } = imageData;
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const raw = useAlpha
        ? data[i + 3] / 255
        : 1 - (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const opacity = Math.round(raw * 100) / 100;
      row.push(opacity < MIN_OPACITY ? 0 : opacity);
    }
    grid.push(row);
  }
  return grid;
}
