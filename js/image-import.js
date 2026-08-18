// Shared decode/downsample utility for the app's "import an image" flows -
// the Brush editor's Import (2m-brush-image-import, thresholds the result
// into a monochrome silhouette), the Color Library panel's Import
// (2n-color-library-image-import, clusters the result into a palette via
// js/color-extraction.js), and the reference image layer
// (reference-image-layer, js/layers.js's addReferenceImageLayer). Needs a
// real <canvas>/Image/createImageBitmap, like LayerStack's compositing
// methods (js/layers.js) - DOM-dependent, so verified via Playwright
// rather than node --test, per this project's established convention (see
// js/layers.js's top-of-file doc comment). Thresholding/clustering logic
// built on top of this stays in its own module per feature
// (js/brush-import.js, js/color-extraction.js) - this file only decodes,
// downsamples, and (for the reference image layer) fits-to-canvas.

const TRANSPARENCY_CHECK_MAX_DIM = 256; // cap on the long edge, for perf on huge source images

/**
 * Fallback decode path for files createImageBitmap() can't handle - most
 * notably SVG, which createImageBitmap() rejects outright in Chromium
 * (confirmed via direct testing: InvalidStateError, regardless of
 * whether the SVG declares explicit width/height) even though it's a
 * perfectly normal `<img>` source. Loads the file into an off-DOM Image
 * element instead. Resolves null (never rejects) on failure, matching
 * decodeImageFile's contract. A dimensionless SVG (no width/height, no
 * viewBox-derived intrinsic size) falls back to the browser's standard
 * 150x150 "default object size" - accepted as-is (see design.md) since
 * every caller downsamples to its own target size afterward regardless.
 */
function decodeViaImgElement(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Decodes a File (from an `image/*` file input) into an ImageBitmap, or
 * an HTMLImageElement for formats createImageBitmap() can't decode (see
 * decodeViaImgElement) - hasTransparency/downsampleToImageData below
 * accept either interchangeably, both exposing .width/.height and
 * working with drawImage(). Returns null instead of throwing on a file
 * neither path can decode, so callers can fail silently - no console
 * error, no crash - rather than treat a bad pick as a hard error.
 */
export async function decodeImageFile(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return decodeViaImgElement(file);
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

/**
 * Fits `image` into a `width` x `height` canvas for the reference image
 * layer (reference-image-layer), preserving full fidelity - unlike
 * downsampleToImageData above (which stretches the source to exactly fill
 * width x height, distorting aspect ratio, for the Brush editor/Color
 * Library's different use cases), this is a "contain" fit: the source's
 * aspect ratio is always preserved, and it is only ever scaled *down*,
 * never up or stretched.
 *
 * - If the source already fits within width x height, it's drawn at 1:1
 *   with smoothing off, centered - no scaling at all, so no interpolation
 *   softens a single source pixel.
 * - If the source is larger in either dimension, it's scaled down (with
 *   smoothing on, to average down cleanly) to the largest size that fits
 *   within width x height without cropping, centered on both axes.
 *
 * Returns ImageData sized exactly width x height (the canvas's own
 * dimensions, transparent outside the fitted image), ready to hand to
 * LayerStack.addReferenceImageLayer.
 */
export function fitImageToCanvas(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const scale = Math.min(1, width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return ctx.getImageData(0, 0, width, height);
}
