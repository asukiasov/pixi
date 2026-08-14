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
   * stroke. When `pixelPerfect` is true, redundant corner pixels on
   * diagonal turns are dropped so the line stays 1px thin (Aseprite-style).
   */
  strokeFreehand(points, rgba, pixelPerfect) {
    if (points.length === 0) return;

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
