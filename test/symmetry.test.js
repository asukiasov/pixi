import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mirrorApplyPixel } from '../js/symmetry.js';

/** Collects every (x, y) mirrorApplyPixel calls baseApplyPixel with, in call order. */
function collect(x, y, mode, width, height) {
  const calls = [];
  mirrorApplyPixel(x, y, (px, py) => calls.push([px, py]), mode, width, height);
  return calls;
}

describe('mirrorApplyPixel', () => {
  test('off mode calls baseApplyPixel once, at the original coordinates', () => {
    assert.deepEqual(collect(2, 3, 'off', 10, 10), [[2, 3]]);
  });

  test('horizontal mirror on even width', () => {
    // width 10: mirrorX = 10 - 1 - x
    assert.deepEqual(collect(2, 3, 'horizontal', 10, 10), [
      [2, 3],
      [7, 3],
    ]);
  });

  test('vertical mirror on even height', () => {
    assert.deepEqual(collect(2, 3, 'vertical', 10, 10), [
      [2, 3],
      [2, 6],
    ]);
  });

  test('both axes (4-way) on an off-center pixel', () => {
    assert.deepEqual(collect(2, 3, 'both', 10, 10), [
      [2, 3],
      [7, 3],
      [2, 6],
      [7, 6],
    ]);
  });

  test('horizontal mirror on odd width: center column mirrors to itself (no duplicate)', () => {
    // width 17: center column is x=8 (17 - 1 - 8 = 8)
    assert.deepEqual(collect(8, 5, 'horizontal', 17, 17), [[8, 5]]);
  });

  test('vertical mirror on odd height: center row mirrors to itself (no duplicate)', () => {
    // height 17: center row is y=8
    assert.deepEqual(collect(5, 8, 'vertical', 17, 17), [[5, 8]]);
  });

  test('both axes on odd width/height at the exact center: single point, no duplicates', () => {
    assert.deepEqual(collect(8, 8, 'both', 17, 17), [[8, 8]]);
  });

  test('both axes: pixel on the vertical center line only dedupes the horizontal-mirror pair', () => {
    // width 17 (center col 8), height 10 (no self-mirroring row). x=8 mirrors to itself
    // horizontally, so 'both' should produce 2 unique points, not 4.
    assert.deepEqual(collect(8, 2, 'both', 17, 10), [
      [8, 2],
      [8, 7],
    ]);
  });

  test('both axes: pixel on the horizontal center line only dedupes the vertical-mirror pair', () => {
    // height 17 (center row 8), width 10. y=8 mirrors to itself vertically, so
    // 'both' should produce 2 unique points, not 4.
    assert.deepEqual(collect(2, 8, 'both', 10, 17), [
      [2, 8],
      [7, 8],
    ]);
  });

  test('horizontal mirror at the leftmost column reflects to the rightmost column', () => {
    assert.deepEqual(collect(0, 0, 'horizontal', 8, 8), [
      [0, 0],
      [7, 0],
    ]);
  });

  test('does not call baseApplyPixel more times than there are unique mirrored coordinates', () => {
    const calls = collect(8, 8, 'both', 17, 17);
    assert.equal(calls.length, 1);
  });
});
