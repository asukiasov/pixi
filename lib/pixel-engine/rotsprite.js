// Free-angle rotation for pixel art (the Rotate popover's dial,
// js/transform-ui.js). Pure functions over RGBA buffers - no DOM, no
// PixelEngine. rotSprite is the RotSprite method Aseprite uses: Scale2x
// the source up 8x, then rotate it and sample it back at 1x, so outlines
// stay clean and no new colours appear. rotateNearest is the fast version
// the dial previews with while dragging. Positive degrees turn clockwise
// on screen.

// Floating-point slack: cos(90°) is 6e-17, not 0.
const EPS = 1e-9;

function samePixel(d, i, j) {
  return d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3];
}

/** Scale2x (EPX): doubles the image, rounding off staircase corners. Edges repeat the border pixel. */
export function scale2x(data, w, h) {
  const width = w * 2;
  const height = h * 2;
  const out = new Uint8ClampedArray(width * height * 4);
  const at = (x, y) => (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
  const put = (x, y, from) => out.set(data.subarray(from, from + 4), (y * width + x) * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const b = at(x, y - 1);
      const d = at(x - 1, y);
      const f = at(x + 1, y);
      const hh = at(x, y + 1);
      const bd = samePixel(data, b, d);
      const bf = samePixel(data, b, f);
      const dh = samePixel(data, d, hh);
      const fh = samePixel(data, f, hh);
      put(2 * x, 2 * y, bd && !bf && !dh ? d : p);
      put(2 * x + 1, 2 * y, bf && !bd && !fh ? f : p);
      put(2 * x, 2 * y + 1, dh && !bd && !fh ? d : p);
      put(2 * x + 1, 2 * y + 1, fh && !bf && !dh ? f : p);
    }
  }
  return { data: out, width, height };
}

/**
 * The box a w x h image needs once turned by `degrees`. Exact at quarter
 * turns. Otherwise each side is bumped by one where needed to keep the
 * source's parity (w, or h when the turn is nearer a quarter than
 * upright), so output pixel centres line up with source pixel centres
 * and a lone pixel never falls between them.
 */
export function rotatedSize(w, h, degrees) {
  const turn = ((degrees % 360) + 360) % 360;
  if (turn === 0 || turn === 180) return { width: w, height: h };
  if (turn === 90 || turn === 270) return { width: h, height: w };
  const rad = (degrees * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  let width = Math.ceil(w * c + h * s - EPS);
  let height = Math.ceil(w * s + h * c - EPS);
  const upright = c >= s;
  if ((width - (upright ? w : h)) % 2) width += 1;
  if ((height - (upright ? h : w)) % 2) height += 1;
  return { width, height };
}

/**
 * Inverse-maps each output pixel's centre into `src` - the source scaled
 * up by `scale` to sw x sh - and copies that one sample. Outside the
 * source is transparent.
 */
function sampleRotated(src, sw, sh, scale, degrees) {
  const w = sw / scale;
  const h = sh / scale;
  const { width, height } = rotatedSize(w, h, degrees);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let oy = 0; oy < height; oy++) {
    for (let ox = 0; ox < width; ox++) {
      const dx = ox + 0.5 - width / 2;
      const dy = oy + 0.5 - height / 2;
      const sx = Math.floor((cos * dx + sin * dy + w / 2) * scale + EPS);
      const sy = Math.floor((-sin * dx + cos * dy + h / 2) * scale + EPS);
      if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue;
      const from = (sy * sw + sx) * 4;
      out.set(src.subarray(from, from + 4), (oy * width + ox) * 4);
    }
  }
  return { data: out, width, height };
}

/** Nearest-neighbour rotation about the centre - fast, used for the live drag preview. */
export function rotateNearest(data, w, h, degrees) {
  return sampleRotated(data, w, h, 1, degrees);
}

/** RotSprite: Scale2x three times (8x), then rotate and take one sample per 1x pixel. */
export function rotSprite(data, w, h, degrees) {
  if (degrees % 90 === 0) return rotateNearest(data, w, h, degrees);
  let big = { data, width: w, height: h };
  for (let i = 0; i < 3; i++) big = scale2x(big.data, big.width, big.height);
  return sampleRotated(big.data, big.width, big.height, 8, degrees);
}
