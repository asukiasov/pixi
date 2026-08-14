// Predefined (or user-drawn custom) pixel-art patterns placeable with one
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

function patternToPixels(rows) {
  const pixels = [];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === 'X') pixels.push([x, y]);
    });
  });
  return pixels;
}

export const BRUSHES = [
  {
    id: 'heart',
    name: 'Heart',
    width: HEART_PATTERN[0].length,
    height: HEART_PATTERN.length,
    pixels: patternToPixels(HEART_PATTERN),
  },
  {
    id: 'circle',
    name: 'Circle',
    width: CIRCLE_PATTERN[0].length,
    height: CIRCLE_PATTERN.length,
    pixels: patternToPixels(CIRCLE_PATTERN),
  },
];

/**
 * Converts a 2D boolean grid (grid[y][x] === true means "on") from the
 * custom-brush editor into the same `pixels: [[x, y], ...]` format
 * built-in brushes use, so a custom brush works identically everywhere
 * else in the code.
 */
export function pixelsFromGrid(grid) {
  const pixels = [];
  grid.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) pixels.push([x, y]);
    });
  });
  return pixels;
}

/**
 * Places `brush`'s pattern on `engine`, centered on (centerX, centerY),
 * with every "on" pixel set to `rgba`. Pixels that fall outside the canvas
 * are silently dropped by setPixel's own bounds check.
 */
export function placeBrush(engine, centerX, centerY, brush, rgba) {
  const topLeftX = centerX - Math.floor(brush.width / 2);
  const topLeftY = centerY - Math.floor(brush.height / 2);
  for (const [dx, dy] of brush.pixels) {
    engine.setPixel(topLeftX + dx, topLeftY + dy, rgba);
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
