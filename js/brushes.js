// Predefined (the Core set, or added Standard Brushes packs) or user-drawn
// custom pixel-art patterns, each pixel full or partly opaque, placeable with one
// click, or dragged as a repeating trail. DOM-free, no engine.js changes
// needed — placement relies on PixelEngine.setPixel's existing bounds
// check to silently clip out-of-canvas pixels. Adding a built-in brush is
// a data addition here, not new tool-handling code (see js/workspace.js).
// Custom brushes are built the same way (see pixelsFromGrid) and persisted
// via js/persistence.js, not stored in this file.


const HEART_PATTERN = [
  '.XX...XX.',
  'XXXX.XXXX',
  'XXXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
];

const CIRCLE_PATTERN = [
  '.XXX.',
  'XXXXX',
  'XXXXX',
  'XXXXX',
  '.XXX.',
];

const SQUARE_PATTERN = ['XXXXX', 'XXXXX', 'XXXXX', 'XXXXX', 'XXXXX'];

const DIAMOND_PATTERN = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'];

const STAR_PATTERN = [
  '...X...',
  '..XXX..',
  'XXXXXXX',
  '.XXXXX.',
  '..XXX..',
  '.XX.XX.',
  'XX...XX',
];

const PLUS_PATTERN = ['..X..', '..X..', 'XXXXX', '..X..', '..X..'];

// Opacity falls off from a solid centre (digits are 10%-90%).
const SOFT_ROUND_PATTERN = [
  '..121..',
  '.35653.',
  '158X851',
  '26XXX62',
  '158X851',
  '.35653.',
  '..121..',
];

// Scattered dots, some partial, for an airbrush-like spray.
const SPRAY_PATTERN = [
  '.5..X..',
  '...7..X',
  'X.....5',
  '..X.4..',
  '6.....X',
  '..5.X..',
  'X...6..',
];

const LEVEL_CHARS = '123456789';

/**
 * Reads a string grid into brush pixels: `X` is a full pixel `[x, y]`,
 * `1`-`9` a partial one `[x, y, a]` at 10%-90% opacity, `.` is off. Used
 * for the Core brushes here and for Standard Brushes packs
 * (js/standard-brushes.js).
 */
export function patternToPixels(rows) {
  const pixels = [];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === 'X') pixels.push([x, y]);
      else if (LEVEL_CHARS.includes(cell)) pixels.push([x, y, Number(cell) / 10]);
    });
  });
  return pixels;
}

/** A brush from a string grid (see patternToPixels), sized to the grid. */
export function brushFromRows(id, name, rows) {
  return { id, name, width: rows[0].length, height: rows.length, pixels: patternToPixels(rows) };
}

// The Core set: always in the brush palette, can't be deleted. Themed
// packs are added separately (js/standard-brushes.js).
export const BRUSHES = [
  brushFromRows('heart', 'Heart', HEART_PATTERN),
  brushFromRows('circle', 'Circle', CIRCLE_PATTERN),
  brushFromRows('square', 'Square', SQUARE_PATTERN),
  brushFromRows('diamond', 'Diamond', DIAMOND_PATTERN),
  brushFromRows('star', 'Star', STAR_PATTERN),
  brushFromRows('plus', 'Plus', PLUS_PATTERN),
  brushFromRows('soft-round', 'Soft Round', SOFT_ROUND_PATTERN),
  brushFromRows('spray', 'Spray', SPRAY_PATTERN),
];

/**
 * Converts a 2D grid of opacities (0 = off, 1 = full; `true`/`false` also
 * accepted) from the custom-brush editor into the same
 * `pixels: [[x, y] | [x, y, a], ...]` format built-in brushes use, so a
 * custom brush works identically everywhere else in the code.
 */
export function pixelsFromGrid(grid) {
  const pixels = [];
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      const alpha = Math.round(Number(cell) * 100) / 100;
      if (alpha <= 0) return;
      pixels.push(alpha >= 1 ? [x, y] : [x, y, alpha]);
    });
  });
  return pixels;
}

/**
 * What a press on a brush-editor cell holding `current` paints: the
 * editor's `opacity`, or 0 (clear) when the cell already holds exactly
 * that opacity - so at 100% a press still toggles a cell on and off.
 */
export function editorPaintValue(current, opacity) {
  return current === opacity ? 0 : opacity;
}

/**
 * Rotates `brush.pixels` by `angleDegrees` around the pattern's own center,
 * nearest-neighbor style (pixel art has no sub-pixel positions, so a
 * rotated pixel snaps to the nearest integer cell). Returns the pattern
 * unchanged for a zero angle - the common case (Rotation defaults to 0),
 * and avoids the rounding/dedup work when nothing actually rotates.
 * Rotating a pixel grid at an arbitrary angle can map two source pixels
 * onto the same rounded destination cell, or leave small gaps versus the
 * original silhouette - an inherent tradeoff of rotating a grid pattern
 * rather than a vector shape, acceptable for a pixel-art brush trail.
 * Each pixel keeps its opacity; when two land on the same cell the more
 * opaque one wins.
 */
function rotatedBrushPixels(brush, angleDegrees) {
  if (!angleDegrees) return brush.pixels;
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const cx = (brush.width - 1) / 2;
  const cy = (brush.height - 1) / 2;
  const byCell = new Map();
  for (const [x, y, alpha = 1] of brush.pixels) {
    const dx = x - cx;
    const dy = y - cy;
    const rx = Math.round(dx * cos - dy * sin + cx);
    const ry = Math.round(dx * sin + dy * cos + cy);
    const key = `${rx},${ry}`;
    const previous = byCell.get(key);
    if (!previous || alpha > previous[2]) byCell.set(key, [rx, ry, alpha]);
  }
  return [...byCell.values()];
}

/**
 * Places `brush`'s pattern on `engine`, centered on (centerX, centerY),
 * with every "on" pixel set to `rgba`. Pixels that fall outside the canvas
 * are silently dropped by setPixel's own bounds check. `angleDegrees`
 * (default 0) rotates the pattern around its own center before placing -
 * used by the Brush tool's Rotation setting, which advances the angle by a
 * fixed step per placement along a drag.
 *
 * `applyPixelTransform` (default `null` - a no-op), if given, is the same
 * `(applyPixel, engine) => wrappedApplyPixel` shape Pencil/Eraser wrap
 * their applyPixel with (see js/symmetry-ui.js's applySymmetryTransform,
 * for symmetry/mirror drawing) - kept here rather than at every call site
 * since placeBrush is Brush's one placement seam, mirroring the "wrap
 * applyPixel, don't fork the stroke tracer" approach from design.md for
 * Brush's own (non-applyPixel-shaped) placement API.
 *
 * Each pixel is drawn at its own opacity: a full pixel replaces what is
 * there with `rgba` exactly, a partial one blends over it with
 * setPixelBlended, so overlapping stamps build up. The per-pixel function
 * is called as `(x, y, alpha)`; symmetry's wrapper passes the third
 * argument through.
 */
export function placeBrush(engine, centerX, centerY, brush, rgba, angleDegrees = 0, applyPixelTransform = null) {
  const topLeftX = centerX - Math.floor(brush.width / 2);
  const topLeftY = centerY - Math.floor(brush.height / 2);
  const setPixel = (x, y, alpha = 1) =>
    alpha >= 1 ? engine.setPixel(x, y, rgba) : engine.setPixelBlended(x, y, rgba, alpha);
  const place = applyPixelTransform ? applyPixelTransform(setPixel, engine) : setPixel;
  for (const [dx, dy, alpha = 1] of rotatedBrushPixels(brush, angleDegrees)) {
    place(topLeftX + dx, topLeftY + dy, alpha);
  }
}

/**
 * Converts a hue (degrees, any range - wraps to 0-360) to a fully-opaque
 * RGBA color at full saturation/mid lightness (HSL(hue, 100%, 50%)), in
 * the engine's [r, g, b, a] array format. Used for Rainbow brush mode.
 */
export function rainbowColor(hue) {
  const h = ((hue % 360) + 360) % 360;
  const c = 255; // chroma at S=100%, L=50%: full-intensity component
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round(r), Math.round(g), Math.round(b), 255];
}
