// Symmetry/mirror drawing mode. Pure, DOM-free, and directly unit-testable
// (see openspec/changes/5-add-symmetry-drawing-mode, pre-split history, for
// the wrap-applyPixel-don't-fork-the-stroke-tracer rationale and
// test/symmetry.test.js for coverage).

/**
 * Computes the mirrored coordinates of (x, y) under `mode` for a canvas of
 * `width` x `height`, dedupes any that coincide with the original or with
 * each other, and calls `baseApplyPixel(mirroredX, mirroredY)` once per
 * resulting unique pixel (always including the original (x, y) itself).
 *
 * `mode` is one of 'off' | 'horizontal' | 'vertical' | 'both'. The mirror
 * axis is fixed at the canvas's center: `mirroredX = width - 1 - x`,
 * `mirroredY = height - 1 - y`, composed independently for each axis. On an
 * odd width/height, the exact center column/row reflects to itself, which
 * the dedup naturally collapses to a single call - no special-casing
 * needed.
 *
 * Deduping before calling `baseApplyPixel` (rather than after) matters for
 * callers that blend rather than overwrite (e.g. Pencil's Opacity setting)
 * - calling twice on the same pixel would double-blend it.
 */
export function mirrorApplyPixel(x, y, baseApplyPixel, mode, width, height) {
  const mirroredX = width - 1 - x;
  const mirroredY = height - 1 - y;

  const candidates = [[x, y]];
  if (mode === 'horizontal' || mode === 'both') candidates.push([mirroredX, y]);
  if (mode === 'vertical' || mode === 'both') candidates.push([x, mirroredY]);
  if (mode === 'both') candidates.push([mirroredX, mirroredY]);

  const seen = new Set();
  for (const [px, py] of candidates) {
    const key = `${px},${py}`;
    if (seen.has(key)) continue;
    seen.add(key);
    baseApplyPixel(px, py);
  }
}
