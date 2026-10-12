// Colour maths for the colour picker (js/color-picker.js): RGB <-> HSV,
// and mapping pointer positions on the hue ring and the
// saturation/brightness square. DOM-free, unit-tested
// (test/color-math.test.js). Hue in degrees [0, 360); s and v in [0, 1].

/** [r, g, b(, a)] 0-255 -> { h, s, v }. Greys get hue 0. */
export function rgbToHsv([r, g, b]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** { h, s, v } -> opaque [r, g, b, 255], rounded. */
export function hsvToRgb({ h, s, v }) {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), 255];
}

/** Hue for a point (dx, dy) from the ring's centre: 0 at the top, increasing clockwise. */
export function ringHue(dx, dy) {
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return ((Math.round(degrees * 1e6) / 1e6) + 360) % 360;
}

/** Saturation (left to right) and brightness (bottom to top) for a point in a width x height square, clamped. */
export function squareSV(x, y, width, height) {
  const clamp = (n) => Math.max(0, Math.min(1, n));
  return { s: clamp(x / width), v: clamp(1 - y / height) };
}

/** `hex` added to the front of the history, any older copy dropped, at most `max` long. */
export function pushHistory(list, hex, max) {
  return [hex, ...list.filter((h) => h !== hex)].slice(0, max);
}
