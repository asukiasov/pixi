// Shared decode/downsample utility for the app's "import an image" flows -
// the Brush editor's Import (2m-brush-image-import, thresholds the result
// into a monochrome silhouette) and the Color Library panel's Import
// (2n-color-library-image-import, clusters the result into a palette via
// js/color-extraction.js). Needs a real <canvas>/Image/createImageBitmap,
// like LayerStack's compositing methods (js/layers.js) - DOM-dependent, so
// verified via Playwright rather than node --test, per this project's
// established convention (see js/layers.js's top-of-file doc comment).
// Thresholding/clustering logic built on top of this stays in its own
// module per feature (js/brush-import.js, js/color-extraction.js) - this
// file only decodes and downsamples.

const TRANSPARENCY_CHECK_MAX_DIM = 256; // cap on the long edge, for perf on huge source images

/**
 * Decodes a File (from an `image/*` file input) into an ImageBitmap.
 * Returns null instead of throwing on an unsupported or corrupt file, so
 * callers can fail silently - no console error, no crash - rather than
 * treat a bad pick as a hard error.
 */
export async function decodeImageFile(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/**
 * True if `image` has any pixel with alpha below 255. Checked at (a
 * capped-down copy of) the image's natural resolution, before any
 * pixelation downsampling, so a fully-opaque image never accidentally
 * reads as transparent from downsample-averaging artifacts along the
 * edge of its own silhouette. Only the Brush editor's Import needs this
 * (its alpha-vs-brightness threshold choice) - Color Library's Import
 * doesn't call it.
 */
export function hasTransparency(image) {
  const scale = Math.min(1, TRANSPARENCY_CHECK_MAX_DIM / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/**
 * Draws `image` onto an offscreen canvas sized width x height (image
 * smoothing on, so the shrink averages/blends the source region behind
 * each output cell rather than nearest-neighbor-sampling a single pixel -
 * the opposite of what Export's upscale wants) and returns the resulting
 * ImageData, one pixel per output cell - no separate box-averaging pass
 * needed since drawImage's own scaling already does that averaging. Used
 * both to fit the source to the Brush editor's current W/H and to shrink
 * it to Color Library's fixed internal sample grid.
 */
export function downsampleToImageData(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
