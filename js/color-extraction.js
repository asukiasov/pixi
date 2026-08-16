// Median-cut palette extraction - DOM-free and unit-testable (operates on
// a plain ImageData-shaped input: { data: Uint8ClampedArray, width,
// height }, same shape a real canvas ImageData has, but doesn't require
// one - see js/image-import.js for the <canvas>-dependent decode/
// downsample step that produces the real thing).
//
// Chosen over k-means per design.md: deterministic (no random
// initialization/convergence), simple to implement without a library, and
// the standard algorithm for exactly this "reduce an image to N
// representative colors" problem (classic GIF-palette reduction).

/**
 * Extracts up to `count` representative colors from `imageData` via
 * median-cut: recursively splits the bounding box of sampled pixel colors
 * along its longest channel (R/G/B) axis - splitting at the median so
 * each half holds roughly equal pixel weight - until there are `count`
 * boxes, then averages each box's pixels into one representative hex
 * color. Fully-transparent pixels (alpha 0) are ignored, since they carry
 * no visible color. Returns fewer than `count` colors only when the input
 * doesn't have enough genuinely distinct source colors to keep splitting
 * (see design.md's Risks/Trade-offs) - never more.
 */
export function extractPalette(imageData, count) {
  const { data } = imageData;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // fully transparent - no visible color to contribute
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length === 0) return [];

  const boxes = [pixels];
  // Repeatedly split the box with the largest color range (widest single
  // channel span weighted by pixel count) until we have `count` boxes or
  // every box is a single unsplittable color.
  while (boxes.length < count) {
    const splitIndex = pickBoxToSplit(boxes);
    if (splitIndex === -1) break; // nothing left worth splitting
    const [a, b] = splitBox(boxes[splitIndex]);
    boxes.splice(splitIndex, 1, a, b);
  }

  return boxes.map(boxAverageHex);
}

/** Index of the box with the widest channel range, or -1 if all boxes are single-color (can't split further). */
function pickBoxToSplit(boxes) {
  let best = -1;
  let bestRange = 0;
  boxes.forEach((box, i) => {
    const { range } = longestAxis(box);
    if (range > bestRange) {
      bestRange = range;
      best = i;
    }
  });
  return best;
}

/** The channel (0=R, 1=G, 2=B) with the widest value range in `box`, and that range. */
function longestAxis(box) {
  const mins = [255, 255, 255];
  const maxs = [0, 0, 0];
  for (const [r, g, b] of box) {
    const px = [r, g, b];
    for (let c = 0; c < 3; c++) {
      if (px[c] < mins[c]) mins[c] = px[c];
      if (px[c] > maxs[c]) maxs[c] = px[c];
    }
  }
  const ranges = [maxs[0] - mins[0], maxs[1] - mins[1], maxs[2] - mins[2]];
  let axis = 0;
  if (ranges[1] > ranges[axis]) axis = 1;
  if (ranges[2] > ranges[axis]) axis = 2;
  return { axis, range: ranges[axis] };
}

/** Splits `box` in half at the median along its longest channel axis. */
function splitBox(box) {
  const { axis } = longestAxis(box);
  const sorted = [...box].sort((p, q) => p[axis] - q[axis]);
  const mid = Math.floor(sorted.length / 2);
  return [sorted.slice(0, mid), sorted.slice(mid)];
}

/** Average color of a box's pixels, as a `#rrggbb` hex string. */
function boxAverageHex(box) {
  const sum = box.reduce(
    (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
    [0, 0, 0]
  );
  const avg = sum.map((c) => Math.round(c / box.length));
  return `#${avg.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
