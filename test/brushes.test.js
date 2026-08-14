import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PixelEngine } from '../js/engine.js';
import { BRUSHES, placeBrush, rainbowColor } from '../js/brushes.js';

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
