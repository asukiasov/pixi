// Palette-aware color ramp generator (7-add-palette-color-ramp-generator).
// Pure, DOM-free hex-in/hex-out function - see design.md's "Generate in HSL
// space, with a hue/saturation shift at the extremes" decision: a pure
// lightness interpolation (hue/saturation held constant) reads as flatly
// desaturated at the ramp's ends, so the darkest and lightest steps nudge
// hue toward blue (shadow) / yellow (highlight) and pull saturation in
// slightly less than the lightness curve alone would, keeping the source
// hue recognizable across the whole ramp.

/** #rgb or #rrggbb, with or without the leading #. */
const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

function normalizeHex(hex) {
  if (!HEX_RE.test(hex)) throw new Error(`Invalid hex color: ${hex}`);
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return h.toLowerCase();
}

function hexToHsl(hex) {
  const n = Number.parseInt(normalizeHex(hex), 16);
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

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r, g, b;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (
    '#' +
    [toByte(r), toByte(g), toByte(b)].map((v) => v.toString(16).padStart(2, '0')).join('')
  );
}

// How many steps at each end of the ramp get the hue/saturation shift, and
// how strong that shift is at the very extreme (tapering to zero by the
// time it reaches a non-shifted middle step). Tuned by eye against a range
// of source hues (see design.md's Risks/Trade-offs - this is a taste
// choice, not a hard spec).
const SHIFT_STEPS = 2; // shift tapers across the outermost 2 steps at each end
const SHADOW_HUE_SHIFT = -12; // degrees, toward blue, at the darkest step
const HIGHLIGHT_HUE_SHIFT = 12; // degrees, toward yellow, at the lightest step
const SHADOW_SAT_BOOST = 10; // percentage points added back at the darkest step
const HIGHLIGHT_SAT_CUT = -8; // percentage points removed at the lightest step
const MIN_LIGHTNESS = 12; // avoid pure black, which has no hue to show
const MAX_LIGHTNESS = 92; // avoid pure white, which has no hue to show

/**
 * Generates a pixel-art-style shading ramp from `hex` (a source color) with
 * `stepCount` steps (3-9), ordered darkest to lightest. Steps vary
 * lightness evenly across the range, with a hue/saturation shift applied
 * at the darkest and lightest steps (see module comment) so the ramp's
 * extremes don't read as flat black/white. Returns an array of `#rrggbb`
 * hex strings, one per step.
 */
export function generateColorRamp(hex, stepCount) {
  const [h, s] = hexToHsl(hex);
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 0.5 : i / (stepCount - 1); // 0 (darkest) to 1 (lightest)
    const lightness = MIN_LIGHTNESS + t * (MAX_LIGHTNESS - MIN_LIGHTNESS);

    // Shift weight: 1 at the very edge, tapering linearly to 0 once we're
    // SHIFT_STEPS steps in from that edge.
    const distFromDark = i;
    const distFromLight = stepCount - 1 - i;
    const darkWeight = Math.max(0, 1 - distFromDark / SHIFT_STEPS);
    const lightWeight = Math.max(0, 1 - distFromLight / SHIFT_STEPS);

    const hue = h + darkWeight * SHADOW_HUE_SHIFT + lightWeight * HIGHLIGHT_HUE_SHIFT;
    const saturation =
      s + darkWeight * SHADOW_SAT_BOOST + lightWeight * HIGHLIGHT_SAT_CUT;

    steps.push(hslToHex(hue, saturation, lightness));
  }
  return steps;
}
