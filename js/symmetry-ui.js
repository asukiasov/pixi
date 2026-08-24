// Symmetry/mirror drawing: wires the #symmetry-toggle button (index.html)
// to symmetry.js's mirrorApplyPixel. Restored from the Standard/Pro split
// (openspec/changes/archive/2026-08-21-split-pixi-pro-repo) - merged back
// in wired directly (no extension-hook indirection) per
// openspec/changes/merge-pixi-pro-into-standard/design.md.
//
// Known gap carried over from the split's own pixi-pro module: pre-split,
// symmetryMode lived on workspace.js's `state` object, recreated fresh per
// project open (so symmetry reset to 'off' on every project switch). This
// module's `symmetryMode` is a session-level variable instead, so symmetry
// now persists across project switches rather than resetting. Accepted as
// before: minor UX difference, not a functional break.

import { mirrorApplyPixel } from './symmetry.js';

const SYMMETRY_MODES = ['off', 'horizontal', 'vertical', 'both'];
const SYMMETRY_LABELS = {
  off: 'Symmetry: off',
  horizontal: 'Symmetry: horizontal',
  vertical: 'Symmetry: vertical',
  both: 'Symmetry: both',
};

let symmetryMode = 'off';

export function initSymmetry(root = document) {
  const symmetryToggle = root.querySelector('#symmetry-toggle');

  function updateSymmetryToggle() {
    symmetryToggle.classList.toggle('active', symmetryMode !== 'off');
    symmetryToggle.dataset.symmetryMode = symmetryMode;
    symmetryToggle.setAttribute('aria-label', SYMMETRY_LABELS[symmetryMode]);
    symmetryToggle.dataset.tooltip = SYMMETRY_LABELS[symmetryMode];
  }

  symmetryToggle.addEventListener('click', () => {
    const nextIndex = (SYMMETRY_MODES.indexOf(symmetryMode) + 1) % SYMMETRY_MODES.length;
    symmetryMode = SYMMETRY_MODES[nextIndex];
    updateSymmetryToggle();
  });
  updateSymmetryToggle();
}

/**
 * Direct hookup for workspace.js's Pencil/Eraser/Brush `applyPixel`
 * wrapping (replaces the old registerApplyPixelTransform hook): returns
 * `applyPixel` unchanged when symmetry is off, or a wrapped version that
 * fans each placement out to its mirrored copies via mirrorApplyPixel when
 * a symmetry mode is active.
 */
export function applySymmetryTransform(applyPixel, engine) {
  if (symmetryMode === 'off') return applyPixel;
  return (x, y, index) =>
    mirrorApplyPixel(x, y, (mx, my) => applyPixel(mx, my, index), symmetryMode, engine.width, engine.height);
}
