// Rotate, flip and align for a layer or a selection (the Transform
// popover, js/transform-ui.js). Works on a PixelEngine in place through
// its extractRegion/clearRegion/stampRegion, like the Move tool: content
// overwrites what's under it, the area it left becomes transparent, and
// anything pushed off the canvas is lost (undo brings it back).
// Rects are { x, y, width, height } in pixels.

/** `rect` clipped to the canvas, or null if nothing is left. */
function clampRect(rect, width, height) {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const right = Math.min(width, rect.x + rect.width);
  const bottom = Math.min(height, rect.y + rect.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** A new w*h*4 buffer whose pixel (x, y) comes from `source(x, y)`'s index in `buffer`. */
function remap(buffer, w, h, source) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const from = source(x, y) * 4;
      out.set(buffer.subarray(from, from + 4), (y * w + x) * 4);
    }
  }
  return out;
}

/** Mirrors the pixels inside `rect`, `axis` 'horizontal' (left-right) or 'vertical'. */
export function flipRegion(engine, rect, axis) {
  const { x, y, width: w, height: h } = rect;
  const buffer = engine.extractRegion(x, y, w, h);
  const flipped = axis === 'horizontal'
    ? remap(buffer, w, h, (px, py) => py * w + (w - 1 - px))
    : remap(buffer, w, h, (px, py) => (h - 1 - py) * w + px);
  engine.stampRegion(x, y, w, h, flipped);
}

/**
 * Turns the pixels inside `rect` by `turn` ('cw', 'ccw' or '180') about
 * the rect's centre. A quarter turn swaps width and height; the new rect
 * is centred on the same point (rounded down). Returns the new rect,
 * clamped to the canvas (null if it fell entirely off).
 */
export function rotateRegion(engine, rect, turn) {
  const { x, y, width: w, height: h } = rect;
  const buffer = engine.extractRegion(x, y, w, h);
  if (turn === '180') {
    engine.stampRegion(x, y, w, h, remap(buffer, w, h, (px, py) => (h - 1 - py) * w + (w - 1 - px)));
    return clampRect(rect, engine.width, engine.height);
  }
  // Destination is h wide, w tall. Clockwise, destination (px, py) comes
  // from source (py, h - 1 - px); counter-clockwise from (w - 1 - py, px).
  const turned = turn === 'cw'
    ? remap(buffer, h, w, (px, py) => (h - 1 - px) * w + py)
    : remap(buffer, h, w, (px, py) => px * w + (w - 1 - py));
  const next = {
    x: Math.floor(x + w / 2 - h / 2),
    y: Math.floor(y + h / 2 - w / 2),
    width: h,
    height: w,
  };
  engine.clearRegion(x, y, w, h);
  engine.stampRegion(next.x, next.y, next.width, next.height, turned);
  return clampRect(next, engine.width, engine.height);
}

/** The box around the non-transparent pixels inside `rect`, or null if there are none. */
export function contentBounds(engine, rect) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let py = rect.y; py < rect.y + rect.height; py++) {
    for (let px = rect.x; px < rect.x + rect.width; px++) {
      if (engine.data[(py * engine.width + px) * 4 + 3] === 0) continue;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * How far to move `bounds` so it touches the canvas's `edge` ('left',
 * 'center', 'right', 'top', 'middle', 'bottom'). Centring rounds down.
 */
export function alignOffset(bounds, width, height, edge) {
  switch (edge) {
    case 'left': return { dx: -bounds.x, dy: 0 };
    case 'center': return { dx: Math.floor((width - bounds.width) / 2) - bounds.x, dy: 0 };
    case 'right': return { dx: width - bounds.width - bounds.x, dy: 0 };
    case 'top': return { dx: 0, dy: -bounds.y };
    case 'middle': return { dx: 0, dy: Math.floor((height - bounds.height) / 2) - bounds.y };
    case 'bottom': return { dx: 0, dy: height - bounds.height - bounds.y };
    default: return { dx: 0, dy: 0 };
  }
}

/** Moves the pixels inside `rect` by (dx, dy), like a Move drag. Returns the moved rect, clamped to the canvas. */
export function moveRegion(engine, rect, dx, dy) {
  const { x, y, width: w, height: h } = rect;
  const buffer = engine.extractRegion(x, y, w, h);
  engine.clearRegion(x, y, w, h);
  engine.stampRegion(x + dx, y + dy, w, h, buffer);
  return clampRect({ x: x + dx, y: y + dy, width: w, height: h }, engine.width, engine.height);
}
