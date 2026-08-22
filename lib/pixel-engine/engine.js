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
   * Draws a freehand stroke through `points` (grid coordinates, in order).
   * Consecutive points are connected with a Bresenham line so drags that
   * skip grid cells between pointer-move events still produce a continuous
   * stroke. If a Pro path transform is registered (see
   * registerPathTransform, e.g. pixel-perfect corner removal on diagonal
   * turns, Aseprite-style), it runs on the raw path before pixels are set.
   */
  strokeFreehand(points, rgba) {
    if (points.length === 0) return;
    const rawPath = interpolatePath(points);
    const finalPath = pathTransform ? pathTransform(rawPath) : rawPath;
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
   * Returns a compact `width*height*4` `Uint8ClampedArray` copy of the
   * rectangle at (x, y). Out-of-canvas source pixels read as fully
   * transparent ([0,0,0,0]) rather than throwing - mirrors setPixel's own
   * "silently drop out-of-canvas writes" convention, just for reads. Used
   * by the Move tool to snapshot a region's content once at drag-start,
   * before clearing/re-stamping it elsewhere (see stampRegion/clearRegion).
   */
  extractRegion(x, y, width, height) {
    const buffer = new Uint8ClampedArray(width * height * 4);
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const rgba = this.#inBounds(x + dx, y + dy) ? this.getPixel(x + dx, y + dy) : [0, 0, 0, 0];
        const i = (dy * width + dx) * 4;
        buffer[i] = rgba[0];
        buffer[i + 1] = rgba[1];
        buffer[i + 2] = rgba[2];
        buffer[i + 3] = rgba[3];
      }
    }
    return buffer;
  }

  /**
   * Sets every pixel in the rectangle at (x, y) to `rgba` (default fully
   * transparent), via setPixel - so it's automatically bounds-checked, a
   * region straddling the canvas edge just clips silently. Used by the
   * Move tool to clear a region's original footprint before stamping it
   * back at an offset.
   */
  clearRegion(x, y, width, height, rgba = [0, 0, 0, 0]) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.setPixel(x + dx, y + dy, rgba);
      }
    }
  }

  /**
   * Writes a `width*height*4` `buffer` (the shape extractRegion returns)
   * back into the canvas at (x, y), via setPixel - bounds-checked per
   * pixel, so a stamp that lands partially off-canvas just loses the
   * off-canvas portion silently, same as placeBrush already does at
   * canvas edges. Used by the Move tool to re-stamp extracted content at
   * its new, dragged-to position.
   */
  stampRegion(x, y, width, height, buffer) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const i = (dy * width + dx) * 4;
        this.setPixel(x + dx, y + dy, [buffer[i], buffer[i + 1], buffer[i + 2], buffer[i + 3]]);
      }
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
 * Pro extension point (split-pixi-pro-repo): `pixi-pro` registers a raw-
 * path transform here (e.g. pixel-perfect corner removal - see
 * js/pro/pixel-perfect.js in that repo for the algorithm, which used to
 * live directly in this file) via registerPathTransform. Runs on
 * strokeFreehand/strokeFreehandThick's interpolated path before pixels are
 * set. No-op passthrough when no Pro module is present.
 */
let pathTransform = null;
export function registerPathTransform(fn) {
  pathTransform = fn;
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
 * setPixelBlended/erasePixelBlended). A registered Pro path transform (see
 * registerPathTransform) only applies at size 1 - corner removal has no
 * meaning for a multi-pixel-wide stroke.
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
export function strokeFreehandThick(points, size, applyPixel) {
  if (points.length === 0) return;
  const rawPath = interpolatePath(points);
  const finalPath = size === 1 && pathTransform ? pathTransform(rawPath) : rawPath;
  const offsets = circleOffsets(size);
  const touched = new Set();
  let index = 0;
  for (const p of finalPath) {
    for (const [dx, dy] of offsets) {
      const x = p.x + dx;
      const y = p.y + dy;
      const key = `${x},${y}`;
      if (touched.has(key)) continue;
      touched.add(key);
      // Third argument: a 0-based order over unique pixels actually
      // touched (not raw path position) - lets a caller cycle something
      // (e.g. Rainbow's hue) once per real placement, the same way
      // Brush's placementIndex does, without it being skewed by
      // dedup-skipped pixels.
      applyPixel(x, y, index);
      index++;
    }
  }
}
