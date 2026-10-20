// Pixel-mask selections: Rectangle Select, Ellipse Select, Lasso and
// Polygonal Lasso all produce one of these. DOM-free (see
// test/selection-mask.test.js).
//
// A selection is { x, y, width, height, mask, canvasWidth, canvasHeight }:
// `mask` holds one byte per canvas pixel (1 = selected) and x..height is
// its bounding box, so code that only needs a box (the action bar, the
// overlay's position) keeps reading it as a rect. An empty mask is null -
// "no selection".

import { ellipseOutline } from './shape-tools.js';

/** The selection for `mask` (Uint8Array, canvasWidth*canvasHeight), or null when nothing is set. */
export function maskSelection(mask, canvasWidth, canvasHeight) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      if (!mask[y * canvasWidth + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, mask, canvasWidth, canvasHeight };
}

function setIn(mask, w, h, x, y) {
  if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1;
}

/** The rectangle between two corners `a` and `b` ({x, y}, either order). */
export function rectSelection(w, h, a, b) {
  const mask = new Uint8Array(w * h);
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) setIn(mask, w, h, x, y);
  }
  return maskSelection(mask, w, h);
}

/** The ellipse in the box between `a` and `b` - the same pixels as a filled Ellipse there. */
export function ellipseSelection(w, h, a, b) {
  const mask = new Uint8Array(w * h);
  const rows = new Map();
  for (const [x, y] of ellipseOutline(a.x, a.y, b.x, b.y)) {
    const span = rows.get(y);
    rows.set(y, span ? [Math.min(span[0], x), Math.max(span[1], x)] : [x, x]);
  }
  for (const [y, [minX, maxX]] of rows) {
    for (let x = minX; x <= maxX; x++) setIn(mask, w, h, x, y);
  }
  return maskSelection(mask, w, h);
}

/** Integer points on the segment a-b (Bresenham). */
function linePoints(a, b) {
  const points = [];
  let { x, y } = a;
  const dx = Math.abs(b.x - x);
  const dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    points.push([x, y]);
    if (x === b.x && y === b.y) return points;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/**
 * The closed shape through `points` (pixel coordinates, in drawing order):
 * every pixel the outline passes through, plus every pixel inside it
 * (non-zero winding, so both loops of a figure 8 count).
 */
export function polygonSelection(w, h, points) {
  const mask = new Uint8Array(w * h);
  if (!points.length) return null;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (const [x, y] of linePoints(points[i], points[(i + 1) % n])) setIn(mask, w, h, x, y);
  }
  // One scanline per row (fast enough to rerun on every Lasso pointermove):
  // an edge crossing row y at xi winds +1 (upward) or -1 (downward) every
  // pixel x < xi, so `cross[k]` collects the edges with ceil(xi) = k and a
  // running sum from the right gives each pixel's winding number.
  const cross = new Int32Array(w + 1);
  for (let y = 0; y < h; y++) {
    cross.fill(0);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const q = points[(i + 1) % n];
      const dir = p.y <= y && q.y > y ? 1 : p.y > y && q.y <= y ? -1 : 0;
      if (!dir) continue;
      const xi = p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y);
      cross[Math.min(Math.max(Math.ceil(xi), 0), w)] += dir;
    }
    let winding = cross[w];
    for (let x = w - 1; x >= 0; x--) {
      if (winding) mask[y * w + x] = 1;
      winding += cross[x];
    }
  }
  return maskSelection(mask, w, h);
}

/** `shape` applied to `current` by `mode`: 'new' (replace), 'add' or 'subtract'. */
export function combineSelections(current, shape, mode) {
  if (mode === 'new' || !current) return mode === 'subtract' ? null : shape;
  if (!shape) return current;
  const mask = current.mask.slice();
  for (let i = 0; i < mask.length; i++) {
    if (mode === 'add') mask[i] |= shape.mask[i];
    else if (shape.mask[i]) mask[i] = 0;
  }
  return maskSelection(mask, current.canvasWidth, current.canvasHeight);
}

/** Whether pixel (x, y) is selected; everywhere counts with no selection. */
export function isSelected(selection, x, y) {
  if (!selection) return true;
  if (x < 0 || y < 0 || x >= selection.canvasWidth || y >= selection.canvasHeight) return false;
  return selection.mask[y * selection.canvasWidth + x] === 1;
}

/** Whether the selection is exactly its bounding box. */
export function isRectangular(selection) {
  const { x, y, width, height, mask, canvasWidth } = selection;
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) if (!mask[py * canvasWidth + px]) return false;
  }
  return true;
}

/** The selection moved by (dx, dy); parts pushed off the canvas are dropped. */
export function translateSelection(selection, dx, dy) {
  const { mask, canvasWidth: w, canvasHeight: h } = selection;
  const next = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (mask[y * w + x]) setIn(next, w, h, x + dx, y + dy);
  }
  return maskSelection(next, w, h);
}

/**
 * (dx, dy) pulled back toward (0, 0) just enough that `selection` moved
 * by it keeps at least one selected pixel on the canvas - a Move can't
 * push it off entirely and lose it.
 */
export function clampSelectionOffset(selection, dx, dy) {
  const { x, y, width, height, canvasWidth: w, canvasHeight: h } = selection;
  dx = Math.min(Math.max(dx, -(x + width - 1)), w - 1 - x);
  dy = Math.min(Math.max(dy, -(y + height - 1)), h - 1 - y);
  // The box still touches the canvas; a shaped selection may not.
  while (!translateSelection(selection, dx, dy)) {
    dx -= Math.sign(dx);
    dy -= Math.sign(dy);
  }
  return { dx, dy };
}

/** The pixels of `data` (RGBA, w*h) with any alpha, as a selection - Select Content, transformed masks. */
export function alphaSelection(data, w, h) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] ? 1 : 0;
  return maskSelection(mask, w, h);
}

/** The mask as an RGBA buffer: opaque white where selected, so the pixel transforms can carry it. */
export function selectionToRGBA(selection) {
  const data = new Uint8ClampedArray(selection.mask.length * 4);
  for (let i = 0; i < selection.mask.length; i++) {
    if (selection.mask[i]) data.fill(255, i * 4, i * 4 + 4);
  }
  return data;
}

/**
 * SVG path data in canvas pixel units: `fill` covers the selected pixels
 * (one rectangle per row run), `outline` traces every edge between a
 * selected and an unselected pixel - the marching ants.
 */
export function selectionPaths(selection) {
  const { x: bx, y: by, width, height } = selection;
  const at = (x, y) => isSelected(selection, x, y);
  let fill = '';
  let outline = '';
  for (let y = by; y < by + height; y++) {
    let start = -1;
    for (let x = bx; x <= bx + width; x++) {
      const on = x < bx + width && at(x, y);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        fill += `M${start} ${y}h${x - start}v1h${start - x}z`;
        start = -1;
      }
    }
  }
  // Horizontal edges at each row line y, vertical edges at each column line x, merged into runs.
  for (let y = by; y <= by + height; y++) {
    let start = -1;
    for (let x = bx; x <= bx + width; x++) {
      const edge = x < bx + width && at(x, y - 1) !== at(x, y);
      if (edge && start < 0) start = x;
      if (!edge && start >= 0) {
        outline += `M${start} ${y}H${x}`;
        start = -1;
      }
    }
  }
  for (let x = bx; x <= bx + width; x++) {
    let start = -1;
    for (let y = by; y <= by + height; y++) {
      const edge = y < by + height && at(x - 1, y) !== at(x, y);
      if (edge && start < 0) start = y;
      if (!edge && start >= 0) {
        outline += `M${x} ${start}V${y}`;
        start = -1;
      }
    }
  }
  return { fill, outline };
}
