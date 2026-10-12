// Rectangle drawing and selection-clip logic. DOM-free, no engine.js
// changes needed. Line reuses PixelEngine.strokeFreehand directly (see
// design.md) so there's nothing for it here.

/**
 * The shapes' Filled toggle, shared by Rectangle and Ellipse
 * (js/rectangle-fill-ui.js wires the #rectangle-fill-toggle button to
 * this directly - restored from the Standard/Pro split, no extension-hook
 * indirection).
 */
let filled = false;
export function setShapeFilled(next) {
  filled = next;
}

/**
 * Draws a rectangle between two corners (in either drag direction), either
 * filled or as an outline (perimeter only) depending on the Filled toggle
 * (see setShapeFilled).
 */
export function drawRectangle(engine, x0, y0, x1, y1, rgba) {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        engine.setPixel(x, y, rgba);
      }
    }
    return;
  }

  for (let x = minX; x <= maxX; x++) {
    engine.setPixel(x, minY, rgba);
    engine.setPixel(x, maxY, rgba);
  }
  for (let y = minY; y <= maxY; y++) {
    engine.setPixel(minX, y, rgba);
    engine.setPixel(maxX, y, rgba);
  }
}

/**
 * Draws the ellipse that fits the box between two corners (in either drag
 * direction), as an outline or filled per the Filled toggle. Uses Alois
 * Zingl's bounding-box midpoint ellipse ("plotEllipseRect", from "A
 * Rasterizing Algorithm for Drawing Curves"), which fits even and odd
 * sizes exactly - a 4x4 box gives a symmetric 4x4 circle, not a 5x5 one.
 * Filled fills each row between its outermost outline pixels.
 */
export function drawEllipse(engine, x0, y0, x1, y1, rgba) {
  const points = ellipseOutline(x0, y0, x1, y1);
  if (!filled) {
    for (const [x, y] of points) engine.setPixel(x, y, rgba);
    return;
  }
  const rows = new Map();
  for (const [x, y] of points) {
    const span = rows.get(y);
    if (!span) rows.set(y, [x, x]);
    else rows.set(y, [Math.min(span[0], x), Math.max(span[1], x)]);
  }
  for (const [y, [minX, maxX]] of rows) {
    for (let x = minX; x <= maxX; x++) engine.setPixel(x, y, rgba);
  }
}

/** The outline pixels of drawEllipse's ellipse, as [x, y] pairs (may repeat). */
function ellipseOutline(x0, y0, x1, y1) {
  const points = [];
  const plot = (x, y) => points.push([x, y]);
  let a = Math.abs(x1 - x0);
  const b = Math.abs(y1 - y0);
  let b1 = b & 1;
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;

  if (x0 > x1) { x0 = x1; x1 += a; }
  if (y0 > y1) y0 = y1;
  y0 += Math.floor((b + 1) / 2);
  y1 = y0 - b1;
  a = 8 * a * a;
  b1 = 8 * b * b;

  do {
    plot(x1, y0);
    plot(x0, y0);
    plot(x0, y1);
    plot(x1, y1);
    const e2 = 2 * err;
    if (e2 <= dy) { y0++; y1--; dy += a; err += dy; }
    if (e2 >= dx || 2 * err > dy) { x0++; x1--; dx += b1; err += dx; }
  } while (x0 <= x1);

  // Very flat ellipses (width 1-2) stop early - finish their tips.
  while (y0 - y1 <= b) {
    plot(x0 - 1, y0);
    plot(x1 + 1, y0++);
    plot(x0 - 1, y1);
    plot(x1 + 1, y1--);
  }
  return points;
}

/**
 * Restores every pixel outside `selection` ({x, y, width, height}) on
 * `engine` from `backup` (a Uint8ClampedArray matching engine.data's
 * layout) — undoes anything a draw operation wrote outside the selection,
 * without engine.js needing to know selections exist. A null selection is
 * a no-op.
 */
export function clipToSelection(engine, backup, selection) {
  if (!selection) return;
  const { x: selX, y: selY, width, height } = selection;

  for (let y = 0; y < engine.height; y++) {
    for (let x = 0; x < engine.width; x++) {
      const inSelection = x >= selX && x < selX + width && y >= selY && y < selY + height;
      if (inSelection) continue;
      const i = (y * engine.width + x) * 4;
      engine.data[i] = backup[i];
      engine.data[i + 1] = backup[i + 1];
      engine.data[i + 2] = backup[i + 2];
      engine.data[i + 3] = backup[i + 3];
    }
  }
}
