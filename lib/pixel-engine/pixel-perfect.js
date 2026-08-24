// Pixel-perfect drawing: Aseprite-style corner removal. Pure, DOM-free,
// directly unit-testable (see pixel-perfect.test.js, alongside this file),
// same as before the Standard/Pro split moved it out - restored here
// alongside engine.js per
// openspec/changes/merge-pixi-pro-into-standard/design.md (wired directly
// into engine.js, no extension-hook indirection).

/**
 * Aseprite-style pixel-perfect corner removal: walk the rasterized path and
 * whenever three consecutive pixels form an L-shaped corner (the first and
 * third are diagonal neighbors, the middle one is orthogonally adjacent to
 * both), drop the middle pixel so the diagonal stays a single pixel wide.
 */
export function removeRedundantCorners(path) {
  const out = [];
  for (const p of path) {
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const dxAP = p.x - a.x;
      const dyAP = p.y - a.y;
      const isDiagonalSkip = Math.abs(dxAP) === 1 && Math.abs(dyAP) === 1;
      const bIsCorner =
        (b.x === a.x + dxAP && b.y === a.y) || (b.x === a.x && b.y === a.y + dyAP);
      if (isDiagonalSkip && bIsCorner) {
        out.pop();
      }
    }
    out.push(p);
  }
  return out;
}
