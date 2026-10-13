// Rectangle's Filled toggle: wires the #rectangle-fill-toggle button
// (index.html) to shape-tools.js's setShapeFilled directly, and owns
// the whole "#rectangle-options" panel's show/hide-on-tool-change behavior,
// since that panel exists only to house this toggle. Restored from the
// Standard/Pro split (docs/history/2026-08-21-split-pixi-pro-
// repo) - merged back wired directly (no extension-hook indirection) per
// docs/history/2026-08-24-merge-pixi-pro-into-standard/design.md.
//
// Panel visibility: adds its own click listener to every tool-rail button
// (the same DOM elements workspace.js's own bindDomOnce listens on) rather
// than needing a workspace.js change - multiple listeners on one element
// coexist fine.
//
// The toggle's icon follows the active shape tool (rectangle or ellipse).

import { setShapeFilled } from './shape-tools.js';

let filled = false;
let tool = 'rectangle';

/** Which of the toggle's four icons shows, for the active shape tool. */
export function fillIconFor(activeTool, isFilled) {
  return `${activeTool === 'ellipse' ? 'ellipse' : 'rectangle'}-${isFilled ? 'filled' : 'outline'}`;
}

export function initRectangleFill(root = document) {
  const panel = root.querySelector('#rectangle-options');
  const toggle = root.querySelector('#rectangle-fill-toggle');
  if (!toggle) return; // standalone-only (absent from lib/pixi.js's embed markup)
  const icons = toggle.querySelectorAll('[data-fill-icon]');
  toggle.setAttribute('aria-pressed', 'false');

  function render() {
    const key = fillIconFor(tool, filled);
    for (const icon of icons) icon.classList.toggle('hidden', icon.dataset.fillIcon !== key);
    toggle.classList.toggle('active', filled);
    toggle.setAttribute('aria-pressed', String(filled));
    toggle.dataset.tooltip = tool === 'ellipse' ? 'Filled ellipse' : 'Filled rectangle';
  }

  toggle.addEventListener('click', () => {
    filled = !filled;
    setShapeFilled(filled);
    render();
  });

  root.querySelectorAll('.tool-button[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.tool;
      panel.classList.toggle('hidden', next !== 'rectangle' && next !== 'ellipse');
      if (next === 'rectangle' || next === 'ellipse') {
        tool = next;
        render();
      }
    });
  });
}
