// Shared decode/downsample utility for "import an image" flows - used by
// the Color Library panel's Import (2n-color-library-image-import) and,
// eventually, the Brush editor's Import (2m-brush-image-import; see that
// change's design.md for the shared-file coordination note). Needs a
// real <canvas>/Image, so unlike js/color-extraction.js this isn't
// unit-testable under `node --test` - verified via Playwright instead
// (same DOM-vs-Node split as js/layers.js's compositing).

/**
 * Decodes a File (from a file picker) into an ImageBitmap. Rejects
 * unsupported/corrupt files gracefully - callers should catch and show a
 * message rather than let this throw uncaught.
 */
export async function decodeImageFile(file) {
  return createImageBitmap(file);
}

/**
 * Draws `image` (an ImageBitmap or other CanvasImageSource) onto an
 * offscreen canvas sized `width` x `height` and returns the resulting
 * ImageData. Used both to shrink a large source image down to a small,
 * fixed internal sample grid (image-import's use, see
 * extractPalette in js/color-extraction.js) and to fit it to a
 * caller-chosen target size (the brush editor's use). Smoothing is left
 * on (canvas default) so the downsample softly blends source pixels
 * rather than nearest-neighbor sampling, matching how a human would
 * eyeball-summarize the image's colors.
 */
export function downsampleToImageData(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
