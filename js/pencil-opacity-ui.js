// Pencil/Eraser Opacity slider: wires the #pencil-opacity-slider (index.html,
// inside #pencil-options) to lib/pixel-engine/engine.js's
// setPixelBlended/erasePixelBlended methods, via workspace.js's
// paintPixel/erasePixel (see getPencilOpacity below). Restored from the
// Standard/Pro split (openspec/changes/archive/2026-08-21-split-pixi-pro-
// repo) - merged back wired directly (no extension-hook indirection) per
// openspec/changes/merge-pixi-pro-into-standard/design.md.
//
// Same known gap as the other restored toggles (see symmetry-ui.js's
// comment): opacity is a session-level variable here rather than reset per
// project open.

import { bindSliderWheel } from './workspace.js';

let opacity = 1;

/** Direct hookup for workspace.js's paintPixel/erasePixel. */
export function getPencilOpacity() {
  return opacity;
}

export function initPencilOpacity(root = document) {
  const slider = root.querySelector('#pencil-opacity-slider');
  const readout = root.querySelector('#pencil-opacity-readout');

  slider.addEventListener('input', () => {
    const value = Number(slider.value);
    opacity = value / 100;
    readout.textContent = `${value}%`;
  });
  bindSliderWheel(slider);
}
