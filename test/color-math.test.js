import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rgbToHsv, hsvToRgb, ringHue, squareSV, pushHistory } from '../js/color-math.js';

describe('rgbToHsv / hsvToRgb', () => {
  test('primaries and greys', () => {
    assert.deepEqual(rgbToHsv([255, 0, 0]), { h: 0, s: 1, v: 1 });
    assert.deepEqual(rgbToHsv([0, 255, 0]), { h: 120, s: 1, v: 1 });
    assert.deepEqual(rgbToHsv([0, 0, 255]), { h: 240, s: 1, v: 1 });
    assert.deepEqual(rgbToHsv([0, 0, 0]), { h: 0, s: 0, v: 0 });
    const grey = rgbToHsv([128, 128, 128]);
    assert.equal(grey.s, 0);
    assert.ok(Math.abs(grey.v - 128 / 255) < 1e-9);
  });

  test('hsvToRgb returns opaque rgba', () => {
    assert.deepEqual(hsvToRgb({ h: 60, s: 1, v: 1 }), [255, 255, 0, 255]);
    assert.deepEqual(hsvToRgb({ h: 0, s: 0, v: 1 }), [255, 255, 255, 255]);
    assert.deepEqual(hsvToRgb({ h: 360, s: 1, v: 1 }), [255, 0, 0, 255]);
  });

  test('round trips every 17th colour exactly', () => {
    for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
      assert.deepEqual(hsvToRgb(rgbToHsv([r, g, b])), [r, g, b, 255], `${r},${g},${b}`);
    }
  });
});

describe('ringHue', () => {
  test('0 at the top, clockwise', () => {
    assert.equal(ringHue(0, -10), 0);
    assert.equal(ringHue(10, 0), 90);
    assert.equal(ringHue(0, 10), 180);
    assert.equal(ringHue(-10, 0), 270);
  });
});

describe('squareSV', () => {
  test('saturation left to right, brightness bottom to top, clamped', () => {
    assert.deepEqual(squareSV(0, 0, 100, 100), { s: 0, v: 1 });
    assert.deepEqual(squareSV(100, 100, 100, 100), { s: 1, v: 0 });
    assert.deepEqual(squareSV(50, 25, 100, 100), { s: 0.5, v: 0.75 });
    assert.deepEqual(squareSV(-5, 150, 100, 100), { s: 0, v: 0 });
  });
});

describe('pushHistory', () => {
  test('newest first, no duplicates, capped', () => {
    assert.deepEqual(pushHistory(['#111111', '#222222'], '#333333', 10), ['#333333', '#111111', '#222222']);
    assert.deepEqual(pushHistory(['#111111', '#222222'], '#222222', 10), ['#222222', '#111111']);
    assert.deepEqual(pushHistory(['#a', '#b', '#c'], '#d', 3), ['#d', '#a', '#b']);
  });
});
