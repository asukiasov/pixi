import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { imageToOpacityGrid } from '../js/brush-import.js';

// Builds a fake ImageData-shaped object (no jsdom/canvas needed - just the
// {data, width, height} shape imageToOpacityGrid actually reads) from a flat
// list of [r, g, b, a] pixels in row-major order.
function fakeImageData(width, height, pixels) {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach(([r, g, b, a], i) => {
    data.set([r, g, b, a], i * 4);
  });
  return { data, width, height };
}

describe('imageToOpacityGrid', () => {
  test('alpha mode: each cell takes the pixel\'s alpha as its opacity', () => {
    const imageData = fakeImageData(3, 1, [
      [0, 0, 0, 255],
      [0, 0, 0, 128],
      [0, 0, 0, 0],
    ]);
    assert.deepEqual(imageToOpacityGrid(imageData, 3, 1, true), [[1, 0.5, 0]]);
  });

  test('brightness mode: darker is more opaque', () => {
    const imageData = fakeImageData(2, 1, [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ]);
    assert.deepEqual(imageToOpacityGrid(imageData, 2, 1, false), [[1, 0]]);
  });

  test('brightness mode uses perceptual luminance weights', () => {
    // Pure green: luminance 0.587 * 255 = 149.685, so opacity 1 - 149.685/255 = 0.41.
    const imageData = fakeImageData(1, 1, [[0, 255, 0, 255]]);
    assert.deepEqual(imageToOpacityGrid(imageData, 1, 1, false), [[0.41]]);
  });

  test('cells under 5% become off', () => {
    const imageData = fakeImageData(2, 1, [
      [0, 0, 0, 10], // 0.04 -> off
      [0, 0, 0, 13], // 0.05 -> kept
    ]);
    assert.deepEqual(imageToOpacityGrid(imageData, 2, 1, true), [[0, 0.05]]);
  });

  test('produces a grid[y][x] shape matching the requested width/height', () => {
    const imageData = fakeImageData(3, 2, Array(6).fill([0, 0, 0, 255]));
    const grid = imageToOpacityGrid(imageData, 3, 2, false);
    assert.equal(grid.length, 2);
    assert.equal(grid[0].length, 3);
  });
});
