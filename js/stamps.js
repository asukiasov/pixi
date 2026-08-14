// Predefined pixel-art patterns placeable with one click. DOM-free, no
// engine.js changes needed — placement relies on PixelEngine.setPixel's
// existing bounds check to silently clip out-of-canvas pixels.

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

function patternToPixels(rows) {
  const pixels = [];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === 'X') pixels.push([x, y]);
    });
  });
  return pixels;
}

export const STAMPS = [
  {
    id: 'heart',
    name: 'Heart',
    width: HEART_PATTERN[0].length,
    height: HEART_PATTERN.length,
    pixels: patternToPixels(HEART_PATTERN),
  },
];

/**
 * Places `stamp`'s pattern on `engine`, centered on (centerX, centerY),
 * with every "on" pixel set to `rgba`. Pixels that fall outside the canvas
 * are silently dropped by setPixel's own bounds check.
 */
export function placeStamp(engine, centerX, centerY, stamp, rgba) {
  const topLeftX = centerX - Math.floor(stamp.width / 2);
  const topLeftY = centerY - Math.floor(stamp.height / 2);
  for (const [dx, dy] of stamp.pixels) {
    engine.setPixel(topLeftX + dx, topLeftY + dy, rgba);
  }
}
