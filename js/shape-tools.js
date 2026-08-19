// Rectangle drawing and selection-clip logic. DOM-free, no engine.js
// changes needed. Line reuses PixelEngine.strokeFreehand directly (see
// design.md) so there's nothing for it here.

/**
 * Pro extension point (split-pixi-pro-repo): `pixi-pro` registers a
 * rectangle-draw override here (e.g. filled rectangles - Standard's
 * baseline is outline-only) via registerRectangleDrawOverride. Called
 * before drawRectangle's own outline logic with the same arguments minus
 * `rgba`'s caller-facing shape; returning `true` means the override drew
 * the rectangle itself and drawRectangle's outline fallback is skipped,
 * `false`/no registration falls through to outline. No-op passthrough
 * when no Pro module is present.
 */
let rectangleDrawOverride = null;
export function registerRectangleDrawOverride(fn) {
  rectangleDrawOverride = fn;
}

/**
 * Draws a rectangle between two corners (in either drag direction) as an
 * outline (perimeter only) - Standard's only rectangle mode. A registered
 * Pro override (see registerRectangleDrawOverride, e.g. a "Filled" toggle)
 * gets first refusal on drawing it instead.
 */
export function drawRectangle(engine, x0, y0, x1, y1, rgba) {
  if (rectangleDrawOverride && rectangleDrawOverride(engine, x0, y0, x1, y1, rgba)) return;

  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

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
