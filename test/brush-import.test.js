import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdToGrid } from '../js/brush-import.js';

// Builds a fake ImageData-shaped object (no jsdom/canvas needed - just the
// {data, width, height} shape thresholdToGrid actually reads) from a flat
// list of [r, g, b, a] pixels in row-major order.
function fakeImageData(width, height, pixels) {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach(([r, g, b, a], i) => {
    data.set([r, g, b, a], i * 4);
  });
  return { data, width, height };
}

describe('thresholdToGrid', () => {
  test('alpha mode: opaque pixels become "on", transparent pixels become "off"', () => {
    const imageData = fakeImageData(2, 1, [
      [10, 20, 30, 255], // opaque -> on
      [10, 20, 30, 0], // fully transparent -> off
    ]);
    const grid = thresholdToGrid(imageData, 2, 1, true);
    assert.deepEqual(grid, [[true, false]]);
  });

  test('alpha mode: alpha exactly at the 127 threshold is "off" (strictly greater than, not >=)', () => {
    const imageData = fakeImageData(2, 1, [
      [0, 0, 0, 127],
      [0, 0, 0, 128],
    ]);
    const grid = thresholdToGrid(imageData, 2, 1, true);
    assert.deepEqual(grid, [[false, true]]);
  });

  test('brightness mode: dark pixels become "on", light pixels become "off"', () => {
    const imageData = fakeImageData(2, 1, [
      [0, 0, 0, 255], // black -> on
      [255, 255, 255, 255], // white -> off
    ]);
    const grid = thresholdToGrid(imageData, 2, 1, false);
    assert.deepEqual(grid, [[true, false]]);
  });

  test('brightness mode uses the standard perceptual luminance weighting, not a flat average', () => {
    // Pure green (0,255,0) has luminance 0.587*255 ≈ 149.7, above the 127.5
    // midpoint -> "off", even though a flat RGB average would put it right
    // at the midpoint (255/3 = 85, well under 127.5, which would wrongly
    // say "on"). This pins down which formula is in use.
    const imageData = fakeImageData(1, 1, [[0, 255, 0, 255]]);
    const grid = thresholdToGrid(imageData, 1, 1, false);
    assert.deepEqual(grid, [[false]]);
  });

  test('produces a grid[y][x] shape matching the requested width/height', () => {
    const imageData = fakeImageData(3, 2, [
      [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255],
      [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255],
    ]);
    const grid = thresholdToGrid(imageData, 3, 2, false);
    assert.equal(grid.length, 2); // rows (height)
    assert.equal(grid[0].length, 3); // cols (width)
  });
});
