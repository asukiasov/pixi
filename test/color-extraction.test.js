import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractPalette } from '../js/color-extraction.js';

/**
 * Builds a plain ImageData-shaped object ({ data: Uint8ClampedArray,
 * width, height }) from an array of [r, g, b, a] pixels - extractPalette
 * only reads .data/.width/.height, so this avoids needing a real
 * ImageData/<canvas> (see js/color-extraction.js's doc comment).
 */
function fakeImageData(pixels, width) {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a = 255], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  });
  return { data, width, height: Math.ceil(pixels.length / width) };
}

describe('extractPalette', () => {
  test('a single solid color produces one distinct color regardless of requested count', () => {
    const pixels = Array.from({ length: 16 }, () => [200, 50, 50]);
    const result = extractPalette(fakeImageData(pixels, 4), 8);
    assert.equal(result.length, 1);
    assert.equal(result[0], '#c83232');
  });

  test('N clearly distinct solid-color regions produce N matching representative colors', () => {
    const pixels = [
      ...Array.from({ length: 8 }, () => [255, 0, 0]),
      ...Array.from({ length: 8 }, () => [0, 255, 0]),
      ...Array.from({ length: 8 }, () => [0, 0, 255]),
      ...Array.from({ length: 8 }, () => [255, 255, 0]),
    ];
    const result = extractPalette(fakeImageData(pixels, 8), 4);
    assert.equal(result.length, 4);
    assert.deepEqual(
      [...result].sort(),
      ['#0000ff', '#00ff00', '#ff0000', '#ffff00'].sort()
    );
  });

  test('output length equals the requested count when the input supports it', () => {
    // A smooth gradient has plenty of genuinely distinct source colors,
    // so requesting fewer boxes than pixels should yield exactly `count`.
    const pixels = Array.from({ length: 64 }, (_, i) => [i * 4, 0, 255 - i * 4]);
    const result = extractPalette(fakeImageData(pixels, 8), 6);
    assert.equal(result.length, 6);
  });

  test('output length is at most the requested count, never more', () => {
    const pixels = Array.from({ length: 16 }, () => [10, 20, 30]);
    const result = extractPalette(fakeImageData(pixels, 4), 32);
    assert.ok(result.length <= 32);
  });

  test('is deterministic - same input always produces the same output', () => {
    const pixels = [
      [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0],
      [255, 0, 255], [0, 255, 255], [128, 128, 128], [10, 200, 90],
    ];
    const imageData = fakeImageData(pixels, 4);
    const first = extractPalette(imageData, 5);
    const second = extractPalette(imageData, 5);
    assert.deepEqual(first, second);
  });

  test('a gradient does not produce a palette dominated by near-duplicate shades', () => {
    // Two flat blocks plus a smooth gradient strip between them - the
    // gradient's many near-identical pixels shouldn't crowd out the two
    // flat colors when count is small.
    const pixels = [
      ...Array.from({ length: 20 }, () => [255, 0, 0]),
      ...Array.from({ length: 20 }, (_, i) => [255 - i * 10, 0, i * 10]), // gradient red->blue
      ...Array.from({ length: 20 }, () => [0, 0, 255]),
    ];
    const result = extractPalette(fakeImageData(pixels, 12), 3);
    assert.equal(result.length, 3);
    // The colors should be meaningfully different from each other, not
    // clustered together (checks pairwise channel distance is non-trivial).
    function hexToRgb(hex) {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const rgbs = result.map(hexToRgb);
    for (let i = 0; i < rgbs.length; i++) {
      for (let j = i + 1; j < rgbs.length; j++) {
        const dist = Math.sqrt(
          rgbs[i].reduce((sum, c, k) => sum + (c - rgbs[j][k]) ** 2, 0)
        );
        assert.ok(dist > 30, `colors ${result[i]} and ${result[j]} too similar (dist ${dist})`);
      }
    }
  });

  test('ignores fully-transparent pixels when computing representative colors', () => {
    const pixels = [
      ...Array.from({ length: 8 }, () => [255, 0, 0, 255]),
      ...Array.from({ length: 8 }, () => [0, 0, 0, 0]), // transparent - should not skew the result
    ];
    const result = extractPalette(fakeImageData(pixels, 4), 1);
    assert.equal(result.length, 1);
    assert.equal(result[0], '#ff0000');
  });

  test('an empty (fully transparent) input produces an empty palette', () => {
    const pixels = Array.from({ length: 16 }, () => [0, 0, 0, 0]);
    const result = extractPalette(fakeImageData(pixels, 4), 8);
    assert.deepEqual(result, []);
  });

  test('runs quickly on a 64x64 (4096-pixel) input at a high count', () => {
    const pixels = Array.from({ length: 4096 }, (_, i) => [
      (i * 7) % 256,
      (i * 13) % 256,
      (i * 29) % 256,
    ]);
    const start = Date.now();
    const result = extractPalette(fakeImageData(pixels, 64), 32);
    const elapsed = Date.now() - start;
    assert.ok(result.length <= 32);
    assert.ok(elapsed < 500, `extractPalette took ${elapsed}ms, expected < 500ms`);
  });
});
