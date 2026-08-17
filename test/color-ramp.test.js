import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateColorRamp } from '../js/color-ramp.js';

const HEX_RE = /^#[0-9a-f]{6}$/;

/** Parses a #rrggbb hex string into an [h, s, l] triple (h in degrees, s/l in 0-100). */
function hexToHslForTest(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

describe('generateColorRamp', () => {
  for (const stepCount of [3, 4, 5, 6, 7, 8, 9]) {
    test(`produces ${stepCount} valid hex colors for step count ${stepCount}`, () => {
      const ramp = generateColorRamp('#be2633', stepCount);
      assert.equal(ramp.length, stepCount);
      for (const hex of ramp) {
        assert.match(hex, HEX_RE, `${hex} should be a valid #rrggbb hex string`);
      }
    });
  }

  test('orders colors from darkest to lightest by lightness', () => {
    const ramp = generateColorRamp('#3f9337', 5);
    const lightnesses = ramp.map((hex) => hexToHslForTest(hex)[2]);
    for (let i = 1; i < lightnesses.length; i++) {
      assert.ok(
        lightnesses[i] > lightnesses[i - 1],
        `step ${i} (L=${lightnesses[i]}) should be lighter than step ${i - 1} (L=${lightnesses[i - 1]})`
      );
    }
  });

  test('the darkest and lightest steps shift hue away from a pure lightness interpolation', () => {
    // A pure lightness interpolation holds hue/saturation constant across all
    // steps. The ramp's extremes should differ from the source hue/saturation
    // per design.md's "hue/saturation shift at the extremes" decision - this
    // is what keeps ramp ends from reading as flat black/white.
    const source = '#2ce8f4';
    const [sourceHue, sourceSat] = hexToHslForTest(source);
    const ramp = generateColorRamp(source, 7);
    const [darkestHue, darkestSat] = hexToHslForTest(ramp[0]);
    const [lightestHue, lightestSat] = hexToHslForTest(ramp[ramp.length - 1]);

    const darkestShifted =
      Math.abs(darkestHue - sourceHue) > 0.5 || Math.abs(darkestSat - sourceSat) > 0.5;
    const lightestShifted =
      Math.abs(lightestHue - sourceHue) > 0.5 || Math.abs(lightestSat - sourceSat) > 0.5;

    assert.ok(darkestShifted, 'darkest step should shift hue/saturation from the source');
    assert.ok(lightestShifted, 'lightest step should shift hue/saturation from the source');
  });

  test('round-trips a 3-digit hex input into valid 6-digit hex output', () => {
    const ramp = generateColorRamp('#f00', 5);
    assert.equal(ramp.length, 5);
    for (const hex of ramp) {
      assert.match(hex, HEX_RE);
    }
  });

  test('is deterministic for the same source color and step count', () => {
    const a = generateColorRamp('#8b2fb0', 6);
    const b = generateColorRamp('#8b2fb0', 6);
    assert.deepEqual(a, b);
  });
});
