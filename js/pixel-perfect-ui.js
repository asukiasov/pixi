// Pixel-perfect drawing toggle: wires the #pixel-perfect-toggle button
// (index.html) to lib/pixel-engine/engine.js's setPixelPerfectEnabled
// directly. Restored from the Standard/Pro split
// (openspec/changes/archive/2026-08-21-split-pixi-pro-repo) - merged back
// wired directly (no extension-hook indirection) per
// openspec/changes/merge-pixi-pro-into-standard/design.md.
//
// Same known gap as symmetry-ui.js: this toggle's state is a session-level
// variable rather than reset per project open (pre-split, it lived on
// workspace.js's per-project `state` object). Accepted for now - see that
// file's own comment for the reasoning.

import { setPixelPerfectEnabled } from '../lib/pixel-engine/engine.js';

let enabled = false;

export function initPixelPerfect(root = document) {
  const toggle = root.querySelector('#pixel-perfect-toggle');

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    toggle.classList.toggle('active', enabled);
    setPixelPerfectEnabled(enabled);
  });
}
