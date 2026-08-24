// hasTransparency, restored from the Standard/Pro split
// (openspec/changes/archive/2026-08-21-split-pixi-pro-repo) - its only
// caller is the Brush editor's Import (js/brush-import-ui.js). Kept as its
// own small module rather than folded into js/image-import.js, matching
// how it was split out originally (that file's own decode/downsample
// helpers are shared with Color Library import and the reference image
// layer, which don't need this).

const TRANSPARENCY_CHECK_MAX_DIM = 256; // cap on the long edge, for perf on huge source images

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
