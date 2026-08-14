// Pixel buffer and pure drawing operations. DOM-free (aside from toPNGBlob,
// which needs a <canvas> to encode PNG bytes) so the rest is directly
// unit-testable with Node's test runner. See design.md for the rationale.

export class PixelEngine {
  constructor(width, height, background = 'transparent') {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    if (background === 'white') {
      this.data.fill(255);
    }
    // background === 'transparent' leaves the buffer zero-filled, which is
    // already fully transparent black.
  }

  #indexOf(x, y) {
    return (y * this.width + x) * 4;
  }

  #inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getPixel(x, y) {
    const i = this.#indexOf(x, y);
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  setPixel(x, y, rgba) {
    if (!this.#inBounds(x, y)) return;
    const i = this.#indexOf(x, y);
    this.data[i] = rgba[0];
    this.data[i + 1] = rgba[1];
    this.data[i + 2] = rgba[2];
    this.data[i + 3] = rgba[3];
  }

  /**
   * Alpha-composites `rgba` (its own alpha scaled by `opacity`, 0-1) over
   * the existing pixel using the standard "source-over" formula, instead
   * of setPixel's full overwrite. At opacity 1 with a fully-opaque rgba
   * (the normal case for a draw color), this is pixel-identical to
   * setPixel. Used by the Pencil tool's Opacity setting.
   */
  setPixelBlended(x, y, rgba, opacity) {
    if (!this.#inBounds(x, y)) return;
    const dst = this.getPixel(x, y);
    const srcA = (rgba[3] / 255) * opacity;
    const dstA = dst[3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    let outR = 0;
    let outG = 0;
    let outB = 0;
    if (outA > 0) {
      outR = (rgba[0] * srcA + dst[0] * dstA * (1 - srcA)) / outA;
      outG = (rgba[1] * srcA + dst[1] * dstA * (1 - srcA)) / outA;
      outB = (rgba[2] * srcA + dst[2] * dstA * (1 - srcA)) / outA;
    }
    this.setPixel(x, y, [Math.round(outR), Math.round(outG), Math.round(outB), Math.round(outA * 255)]);
  }

  /**
   * Reduces the existing pixel's alpha by `opacity` (0-1) instead of
   * blending toward a color - "fading out" existing content, which is
   * what a partial-opacity erase means (blending toward a transparent
   * *color* via setPixelBlended would barely affect an opaque pixel at
   * low source alpha, not the same thing). RGB is preserved unless the
   * result is fully transparent, in which case it's zeroed to match the
   * existing eraser's [0, 0, 0, 0] convention (see strokeFreehand with a
   * [0,0,0,0] rgba). Used by the Eraser tool's Opacity setting.
   */
  erasePixelBlended(x, y, opacity) {
    if (!this.#inBounds(x, y)) return;
    const dst = this.getPixel(x, y);
    const newAlpha = Math.round(dst[3] * (1 - opacity));
    const rgb = newAlpha === 0 ? [0, 0, 0] : [dst[0], dst[1], dst[2]];
    this.setPixel(x, y, [...rgb, newAlpha]);
  }

  /**
   * Draws a freehand stroke through `points` (grid coordinates, in order).
   * Consecutive points are connected with a Bresenham line so drags that
   * skip grid cells between pointer-move events still produce a continuous
   * stroke. When `pixelPerfect` is true, redundant corner pixels on
   * diagonal turns are dropped so the line stays 1px thin (Aseprite-style).
   */
  strokeFreehand(points, rgba, pixelPerfect) {
    if (points.length === 0) return;
    const rawPath = interpolatePath(points);
    const finalPath = pixelPerfect ? removeRedundantCorners(rawPath) : rawPath;
    for (const p of finalPath) this.setPixel(p.x, p.y, rgba);
  }

  /**
   * 4-directional flood fill of the region containing (x, y) that matches
   * its original color. No-ops if the target color already equals fill color.
   */
  floodFill(x, y, rgba) {
    if (!this.#inBounds(x, y)) return;
    const target = this.getPixel(x, y);
    if (colorsEqual(target, rgba)) return;

    const stack = [[x, y]];
    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      if (!this.#inBounds(cx, cy)) continue;
      if (!colorsEqual(this.getPixel(cx, cy), target)) continue;
      this.setPixel(cx, cy, rgba);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  /**
   * Serializes the current buffer to a PNG Blob at native resolution.
   * Requires a DOM (canvas element + toBlob), so this method only works in
   * a browser environment, unlike the rest of this module.
   */
  toPNGBlob() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(new Uint8ClampedArray(this.data), this.width, this.height);
    ctx.putImageData(imageData, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }
}

function colorsEqual(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/**
 * Connects consecutive `points` with Bresenham segments (so a drag that
 * skips grid cells between pointer-move events still produces a
 * continuous path) and dedupes back-to-back repeats. Shared by
 * strokeFreehand and strokeFreehandThick.
 */
function interpolatePath(points) {
  const rawPath = [];
  let prev = null;
  for (const point of points) {
    const segment = prev ? bresenhamLine(prev.x, prev.y, point.x, point.y) : [point];
    for (const p of segment) {
      const last = rawPath[rawPath.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) rawPath.push(p);
    }
    prev = point;
  }
  return rawPath;
}

/** Exported for reuse outside this module (e.g. the Stamps tool's dragged path). */
export function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

/**
 * Aseprite-style pixel-perfect corner removal: walk the rasterized path and
 * whenever three consecutive pixels form an L-shaped corner (the first and
 * third are diagonal neighbors, the middle one is orthogonally adjacent to
 * both), drop the middle pixel so the diagonal stays a single pixel wide.
 */
function removeRedundantCorners(path) {
  const out = [];
  for (const p of path) {
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const dxAP = p.x - a.x;
      const dyAP = p.y - a.y;
      const isDiagonalSkip = Math.abs(dxAP) === 1 && Math.abs(dyAP) === 1;
      const bIsCorner =
        (b.x === a.x + dxAP && b.y === a.y) || (b.x === a.x && b.y === a.y + dyAP);
      if (isDiagonalSkip && bIsCorner) {
        out.pop();
      }
    }
    out.push(p);
  }
  return out;
}

const circleOffsetsCache = new Map();

/**
 * Returns (and caches) the [dx, dy] offsets of a filled circle of the
 * given pixel diameter, centered on (0, 0) - membership by
 * dx*dx + dy*dy <= (size/2)^2, generated procedurally rather than a
 * stored pattern (Size is a continuous slider range, not a small fixed
 * set of shapes the way Brush's predefined patterns are). At size 5 this
 * happens to reproduce the same shape as brushes.js's built-in Circle
 * brush pattern, a useful sanity check on the formula.
 */
export function circleOffsets(size) {
  if (circleOffsetsCache.has(size)) return circleOffsetsCache.get(size);
  const radius = size / 2;
  const r2 = radius * radius;
  const half = Math.floor(size / 2);
  const offsets = [];
  for (let dy = -half; dy < size - half; dy++) {
    for (let dx = -half; dx < size - half; dx++) {
      // dx/dy === 0 ? 0 : ... normalizes -0 (e.g. -half when half is 0)
      // to plain 0 - Object.is/deepStrictEqual treat them as different
      // values even though === and all the arithmetic above don't care.
      if (dx * dx + dy * dy <= r2) offsets.push([dx === 0 ? 0 : dx, dy === 0 ? 0 : dy]);
    }
  }
  circleOffsetsCache.set(size, offsets);
  return offsets;
}

/**
 * Like strokeFreehand, but stamps a circular area of the given `size`
 * (diameter, in pixels) at every path point instead of a single pixel,
 * and calls `applyPixel(x, y)` for the pixel operation instead of always
 * overwriting with a fixed color - lets the caller choose blended-paint
 * (Pencil) or alpha-reduction (Eraser) semantics (see PixelEngine's
 * setPixelBlended/erasePixelBlended). Pixel-perfect corner removal only
 * applies at size 1 - it has no meaning for a multi-pixel-wide stroke.
 *
 * Every unique pixel touched by ANY stamp along the path gets exactly
 * one `applyPixel` call, computed by unioning every stamp's offsets
 * before calling back - not one call per stamp placement. Without this,
 * a slow/dense drag would place many overlapping stamps and compound an
 * Opacity-style blend far past what a single pass at that Opacity should
 * produce; a fast, sparse drag over the same path would look different
 * purely from pointer-event timing. Deduping first makes the result
 * depend only on the path's geometry and Size, not stroke speed.
 */
export function strokeFreehandThick(points, size, pixelPerfect, applyPixel) {
  if (points.length === 0) return;
  const rawPath = interpolatePath(points);
  const finalPath = size === 1 && pixelPerfect ? removeRedundantCorners(rawPath) : rawPath;
  const offsets = circleOffsets(size);
  const touched = new Set();
  for (const p of finalPath) {
    for (const [dx, dy] of offsets) {
      const x = p.x + dx;
      const y = p.y + dy;
      const key = `${x},${y}`;
      if (touched.has(key)) continue;
      touched.add(key);
      applyPixel(x, y);
    }
  }
}
