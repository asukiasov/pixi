// Shared decode/downsample utility for the app's "import an image" flows -
// the Color Library panel's Import (2n-color-library-image-import,
// clusters the result into a palette via js/color-extraction.js) and the
// reference image layer (reference-image-layer, js/layers-ui.js, via
// LayerStack's addReferenceImageLayer). Needs a real
// <canvas>/Image/createImageBitmap, like LayerStack's compositing methods
// (lib/pixel-engine/layers.js) - DOM-dependent, so verified via Playwright
// rather than node --test, per this project's established convention (see
// lib/pixel-engine/layers.js's top-of-file doc comment). Thresholding/
// clustering logic built on top of this stays in its own module per
// feature (js/color-extraction.js here) - this file only decodes,
// downsamples, and (for the reference image layer) fits-to-canvas.

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
 * decodeViaImgElement) - downsampleToImageData below accepts either
 * interchangeably, both exposing .width/.height and working with
 * drawImage(). Returns null instead of throwing on a file neither path
 * can decode, so callers can fail silently - no console error, no crash -
 * rather than treat a bad pick as a hard error.
 */
export async function decodeImageFile(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return decodeViaImgElement(file);
  }
}

/**
 * Draws `image` onto an offscreen canvas sized width x height (image
 * smoothing on, so the shrink averages/blends the source region behind
 * each output cell rather than nearest-neighbor-sampling a single pixel -
 * the opposite of what Export's upscale wants) and returns the resulting
 * ImageData, one pixel per output cell - no separate box-averaging pass
 * needed since drawImage's own scaling already does that averaging. Used
 * to shrink an imported image to Color Library's fixed internal sample
 * grid.
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
 * width x height, distorting aspect ratio, for Color Library's different
 * use case), this is a "contain" fit: the source's aspect ratio is
 * always preserved, and it is only ever scaled *down*, never up or
 * stretched.
 *
 * - If the source already fits within width x height, it's drawn at 1:1
 *   regardless of `smooth` - no scaling at all, so there's nothing to
 *   interpolate.
 * - If the source is larger in either dimension, it's scaled down to the
 *   largest size that fits within width x height without cropping,
 *   centered on both axes. `smooth` (default true) controls whether that
 *   downscale averages/blends the source region behind each output pixel
 *   (smooth photographic look, but on a canvas this small - 16-128px -
 *   most real photos collapse into flat, low-detail color blocks, which
 *   reads as "vectorized"; see the reference-image-layer follow-up's
 *   design.md) or nearest-neighbor-samples it (blockier, more literally
 *   "pixelated," no blending) - both still lose the same real detail to
 *   the tiny target resolution, this only changes how that loss looks.
 *   Callers re-run this from the same source image when the user flips
 *   the toggle (js/layers-ui.js's referenceImageSmoothing).
 *
 * Returns ImageData sized exactly width x height (the canvas's own
 * dimensions, transparent outside the fitted image), ready to hand to
 * LayerStack.addReferenceImageLayer/updateReferenceImageData. A
 * degenerate zero-width/zero-height source (e.g. a dimensionless SVG that
 * somehow still reaches this point) is treated as "draw nothing" -
 * returns a fully transparent width x height ImageData rather than
 * dividing by zero into a scale of Infinity.
 */
export function fitImageToCanvas(image, width, height, smooth = true) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (image.width <= 0 || image.height <= 0) {
    return ctx.getImageData(0, 0, width, height);
  }

  const scale = Math.min(1, width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.imageSmoothingEnabled = smooth && scale < 1;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return ctx.getImageData(0, 0, width, height);
}
