// Rectangle drawing and selection-clip logic. DOM-free, no engine.js
// changes needed. Line reuses PixelEngine.strokeFreehand directly (see
// design.md) so there's nothing for it here.

/**
 * Rectangle's Filled toggle (js/rectangle-fill-ui.js wires the
 * #rectangle-fill-toggle button to this directly - restored from the
 * Standard/Pro split, no extension-hook indirection).
 */
let filled = false;
export function setRectangleFilled(next) {
  filled = next;
}

/**
 * Draws a rectangle between two corners (in either drag direction), either
 * filled or as an outline (perimeter only) depending on the Filled toggle
 * (see setRectangleFilled).
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
