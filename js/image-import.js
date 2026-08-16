// Shared image-decode/downsample utility for the app's image-import
// features (this change's brush pixelation; 2n-color-library-image-import's
// color-clustering panel needs the same "decode a File into pixel data"
// starting point). Needs a real <canvas>/Image/createImageBitmap, like
// LayerStack's compositing methods (js/layers.js) - DOM-dependent, so
// verified via Playwright rather than node --test, per this project's
// established convention (see js/layers.js's top-of-file doc comment).
// Thresholding/clustering logic built on top of this stays in its own
// module per feature (js/brush-import.js here) - this file only decodes
// and downsamples.

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
 * edge of its own silhouette.
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
 * needed since drawImage's own scaling already does that averaging.
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
