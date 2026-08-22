import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PixelEngine } from '../lib/pixel-engine/engine.js';
import { BRUSHES, placeBrush, rainbowColor, pixelsFromGrid } from '../js/brushes.js';

describe('BRUSHES registry', () => {
  test('includes a Heart brush with a well-formed pattern', () => {
    const heart = BRUSHES.find((b) => b.id === 'heart');
    assert.ok(heart);
    assert.equal(heart.pixels.length > 0, true);
    for (const [dx, dy] of heart.pixels) {
      assert.ok(dx >= 0 && dx < heart.width, `dx ${dx} within width ${heart.width}`);
      assert.ok(dy >= 0 && dy < heart.height, `dy ${dy} within height ${heart.height}`);
    }
  });

  test('includes a Circle brush, a filled 5x5 pattern', () => {
    const circle = BRUSHES.find((b) => b.id === 'circle');
    assert.ok(circle);
    assert.equal(circle.width, 5);
    assert.equal(circle.height, 5);
    for (const [dx, dy] of circle.pixels) {
      assert.ok(dx >= 0 && dx < circle.width, `dx ${dx} within width ${circle.width}`);
      assert.ok(dy >= 0 && dy < circle.height, `dy ${dy} within height ${circle.height}`);
    }
    // Corners of a "circle" should be empty; center should be filled.
    const has = (x, y) => circle.pixels.some(([px, py]) => px === x && py === y);
    assert.equal(has(0, 0), false);
    assert.equal(has(4, 0), false);
    assert.equal(has(2, 2), true);
  });
});

describe('pixelsFromGrid', () => {
  test('converts a 2D boolean grid to [x, y] pairs for "on" cells only', () => {
    const grid = [
      [true, false],
      [false, true],
    ];
    const pixels = pixelsFromGrid(grid);
    assert.equal(pixels.length, 2);
    assert.ok(pixels.some(([x, y]) => x === 0 && y === 0));
    assert.ok(pixels.some(([x, y]) => x === 1 && y === 1));
  });

  test('an all-false grid produces no pixels', () => {
    const grid = [
      [false, false],
      [false, false],
    ];
    assert.deepEqual(pixelsFromGrid(grid), []);
  });
});

describe('placeBrush', () => {
  test('centers the pattern on the given point', () => {
    const engine = new PixelEngine(20, 20, 'transparent');
    const brush = { id: 'square', name: 'Square', width: 3, height: 3, pixels: [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ] };
    placeBrush(engine, 10, 10, brush, [255, 0, 0, 255]);
    // Center of a 3x3 brush at (10,10): top-left = (10-1, 10-1) = (9,9)
    for (let y = 9; y <= 11; y++) {
      for (let x = 9; x <= 11; x++) {
        assert.deepEqual(engine.getPixel(x, y), [255, 0, 0, 255], `(${x},${y})`);
      }
    }
    // Outside the brush, untouched
    assert.deepEqual(engine.getPixel(8, 9), [0, 0, 0, 0]);
    assert.deepEqual(engine.getPixel(12, 9), [0, 0, 0, 0]);
  });

  test('only sets "on" pixels, leaves "off" pixels of the pattern untouched', () => {
    const engine = new PixelEngine(10, 10, 'white');
    const brush = { id: 'diag', name: 'Diag', width: 2, height: 2, pixels: [[0, 0], [1, 1]] };
    placeBrush(engine, 5, 5, brush, [0, 0, 0, 255]);
    // top-left = (5-1, 5-1) = (4,4)
    assert.deepEqual(engine.getPixel(4, 4), [0, 0, 0, 255]);
    assert.deepEqual(engine.getPixel(5, 5), [0, 0, 0, 255]);
    // (5,4) and (4,5) are "off" cells of this pattern - untouched (still white background)
    assert.deepEqual(engine.getPixel(5, 4), [255, 255, 255, 255]);
    assert.deepEqual(engine.getPixel(4, 5), [255, 255, 255, 255]);
  });

  test('a zero angle behaves exactly like no angle argument at all', () => {
    const engine = new PixelEngine(10, 10, 'transparent');
    const brush = { id: 'diag', name: 'Diag', width: 2, height: 2, pixels: [[0, 0], [1, 1]] };
    placeBrush(engine, 5, 5, brush, [9, 9, 9, 255], 0);
    assert.deepEqual(engine.getPixel(4, 4), [9, 9, 9, 255]);
    assert.deepEqual(engine.getPixel(5, 5), [9, 9, 9, 255]);
  });

  test('a 90-degree rotation maps a non-symmetric pattern onto its rotated cells', () => {
    // A single off-center pixel at the top-right of a 3x3 pattern: rotating
    // 90 degrees clockwise around the center should move it to the
    // bottom-right, the same way rotating a physical shape would.
    const engine = new PixelEngine(20, 20, 'transparent');
    const brush = { id: 'corner', name: 'Corner', width: 3, height: 3, pixels: [[2, 0]] };
    placeBrush(engine, 10, 10, brush, [255, 0, 0, 255], 90);
    // top-left = (9,9); pre-rotation pixel (2,0) -> post-rotation (2,2)
    assert.deepEqual(engine.getPixel(11, 11), [255, 0, 0, 255]);
    // The original (un-rotated) location should be untouched.
    assert.deepEqual(engine.getPixel(11, 9), [0, 0, 0, 0]);
  });

  test('a 360-degree rotation returns to the original pattern', () => {
    const engine = new PixelEngine(20, 20, 'transparent');
    const brush = { id: 'corner', name: 'Corner', width: 3, height: 3, pixels: [[2, 0]] };
    placeBrush(engine, 10, 10, brush, [255, 0, 0, 255], 360);
    assert.deepEqual(engine.getPixel(11, 9), [255, 0, 0, 255]);
  });

  test('clips the out-of-bounds portion silently near an edge', () => {
    const engine = new PixelEngine(5, 5, 'transparent');
    const brush = { id: 'square', name: 'Square', width: 3, height: 3, pixels: [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ] };
    assert.doesNotThrow(() => placeBrush(engine, 0, 0, brush, [1, 2, 3, 255]));
    // top-left = (0-1, 0-1) = (-1,-1); only (0,0) of the pattern is in-bounds
    assert.deepEqual(engine.getPixel(0, 0), [1, 2, 3, 255]);
  });

  test('defaults to no transform when applyPixelTransform is omitted', () => {
    const engine = new PixelEngine(20, 20, 'transparent');
    const brush = { id: 'dot', name: 'Dot', width: 1, height: 1, pixels: [[0, 0]] };
    placeBrush(engine, 3, 3, brush, [255, 0, 0, 255]);
    assert.deepEqual(engine.getPixel(3, 3), [255, 0, 0, 255]);
    // No transform registered, so nothing placed anywhere else.
    assert.deepEqual(engine.getPixel(16, 3), [0, 0, 0, 0]);
  });

  // Symmetry/mirror drawing itself moved to pixi-pro (split-pixi-pro-repo)
  // - see that repo's test suite for mirrorApplyPixel coverage. This just
  // proves placeBrush's `applyPixelTransform` hook is actually honored,
  // via a stand-in transform (not mirroring) that any Pro module could
  // register the same shape of.
  test('honors an applyPixelTransform hook when one is given', () => {
    const engine = new PixelEngine(20, 20, 'transparent');
    const brush = { id: 'dot', name: 'Dot', width: 1, height: 1, pixels: [[0, 0]] };
    // Places at (x, y) and its mirror across x=19 - the same shape a Pro
    // symmetry hook would use, without depending on that module.
    const mirrorHorizontal = (applyPixel, hookEngine) => (x, y) => {
      applyPixel(x, y);
      applyPixel(hookEngine.width - 1 - x, y);
    };
    placeBrush(engine, 3, 3, brush, [255, 0, 0, 255], 0, mirrorHorizontal);
    assert.deepEqual(engine.getPixel(3, 3), [255, 0, 0, 255]);
    assert.deepEqual(engine.getPixel(16, 3), [255, 0, 0, 255]);
  });
});

describe('rainbowColor', () => {
  test('returns known RGB values at canonical hues', () => {
    assert.deepEqual(rainbowColor(0), [255, 0, 0, 255]); // red
    assert.deepEqual(rainbowColor(120), [0, 255, 0, 255]); // green
    assert.deepEqual(rainbowColor(240), [0, 0, 255, 255]); // blue
  });

  test('wraps hues past 360 to the same color as their mod-360 equivalent', () => {
    assert.deepEqual(rainbowColor(360), rainbowColor(0));
    assert.deepEqual(rainbowColor(480), rainbowColor(120));
    assert.deepEqual(rainbowColor(-120), rainbowColor(240));
  });

  test('always returns fully opaque alpha', () => {
    for (const hue of [0, 45, 90, 200, 359]) {
      assert.equal(rainbowColor(hue)[3], 255);
    }
  });
});
