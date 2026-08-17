// Predefined (or user-drawn custom) pixel-art patterns placeable with one
// click, or dragged as a repeating trail. DOM-free, no engine.js changes
// needed — placement relies on PixelEngine.setPixel's existing bounds
// check to silently clip out-of-canvas pixels. Adding a built-in brush is
// a data addition here, not new tool-handling code (see js/workspace.js).
// Custom brushes are built the same way (see pixelsFromGrid) and persisted
// via js/persistence.js, not stored in this file.

import { mirrorApplyPixel } from './symmetry.js';

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
 * Rotates `brush.pixels` by `angleDegrees` around the pattern's own center,
 * nearest-neighbor style (pixel art has no sub-pixel positions, so a
 * rotated pixel snaps to the nearest integer cell). Returns the pattern
 * unchanged for a zero angle - the common case (Rotation defaults to 0),
 * and avoids the rounding/dedup work when nothing actually rotates.
 * Rotating a pixel grid at an arbitrary angle can map two source pixels
 * onto the same rounded destination cell, or leave small gaps versus the
 * original silhouette - an inherent tradeoff of rotating a grid pattern
 * rather than a vector shape, acceptable for a pixel-art brush trail.
 */
function rotatedBrushPixels(brush, angleDegrees) {
  if (!angleDegrees) return brush.pixels;
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const cx = (brush.width - 1) / 2;
  const cy = (brush.height - 1) / 2;
  const seen = new Set();
  const pixels = [];
  for (const [x, y] of brush.pixels) {
    const dx = x - cx;
    const dy = y - cy;
    const rx = Math.round(dx * cos - dy * sin + cx);
    const ry = Math.round(dx * sin + dy * cos + cy);
    const key = `${rx},${ry}`;
    if (!seen.has(key)) {
      seen.add(key);
      pixels.push([rx, ry]);
    }
  }
  return pixels;
}

/**
 * Places `brush`'s pattern on `engine`, centered on (centerX, centerY),
 * with every "on" pixel set to `rgba`. Pixels that fall outside the canvas
 * are silently dropped by setPixel's own bounds check. `angleDegrees`
 * (default 0) rotates the pattern around its own center before placing -
 * used by the Brush tool's Rotation setting, which advances the angle by a
 * fixed step per placement along a drag.
 *
 * `symmetryMode` (5-add-symmetry-drawing-mode, default 'off' - a no-op)
 * mirrors every placed pixel across `engine`'s center axis/axes via
 * mirrorApplyPixel, the same helper Pencil/Eraser wrap their applyPixel
 * with (see js/workspace.js's withSymmetry) - kept here rather than at
 * every call site since placeBrush is Brush's one placement seam,
 * mirroring the "wrap applyPixel, don't fork the stroke tracer" approach
 * from design.md for Brush's own (non-applyPixel-shaped) placement API.
 */
export function placeBrush(engine, centerX, centerY, brush, rgba, angleDegrees = 0, symmetryMode = 'off') {
  const topLeftX = centerX - Math.floor(brush.width / 2);
  const topLeftY = centerY - Math.floor(brush.height / 2);
  for (const [dx, dy] of rotatedBrushPixels(brush, angleDegrees)) {
    const x = topLeftX + dx;
    const y = topLeftY + dy;
    mirrorApplyPixel(x, y, (mx, my) => engine.setPixel(mx, my, rgba), symmetryMode, engine.width, engine.height);
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
