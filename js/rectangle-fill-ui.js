// Rectangle's Filled toggle: wires the #rectangle-fill-toggle button
// (index.html) to shape-tools.js's setRectangleFilled directly, and owns
// the whole "#rectangle-options" panel's show/hide-on-tool-change behavior,
// since that panel exists only to house this toggle. Restored from the
// Standard/Pro split (openspec/changes/archive/2026-08-21-split-pixi-pro-
// repo) - merged back wired directly (no extension-hook indirection) per
// openspec/changes/merge-pixi-pro-into-standard/design.md.
//
// Panel visibility: adds its own click listener to every tool-rail button
// (the same DOM elements workspace.js's own bindDomOnce listens on) rather
// than needing a workspace.js change - multiple listeners on one element
// coexist fine.

import { setRectangleFilled } from './shape-tools.js';

let filled = false;

export function initRectangleFill(root = document) {
  const panel = root.querySelector('#rectangle-options');
  const toggle = root.querySelector('#rectangle-fill-toggle');
  const iconOutline = root.querySelector('#rectangle-fill-icon-outline');
  const iconFilled = root.querySelector('#rectangle-fill-icon-filled');

  function setFilled(next) {
    filled = next;
    toggle.classList.toggle('active', filled);
    iconOutline.classList.toggle('hidden', filled);
    iconFilled.classList.toggle('hidden', !filled);
    setRectangleFilled(filled);
  }

  toggle.addEventListener('click', () => setFilled(!filled));

  root.querySelectorAll('.tool-button[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      panel.classList.toggle('hidden', button.dataset.tool !== 'rectangle');
    });
  });
}
