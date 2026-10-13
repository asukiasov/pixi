// Rectangle's Filled toggle: wires the #rectangle-fill-toggle button
// (index.html) to shape-tools.js's setShapeFilled directly, and owns
// the whole "#rectangle-options" panel's show/hide-on-tool-change behavior,
// since that panel exists only to house this toggle. Restored from the
// Standard/Pro split (docs/history/2026-08-21-split-pixi-pro-
// repo) - merged back wired directly (no extension-hook indirection) per
// docs/history/2026-08-24-merge-pixi-pro-into-standard/design.md.
//
// Panel visibility follows the active tool through syncRectangleFillTool,
// which js/workspace.js's applyToolScopedUI calls on every tool change
// (rail click, R/O shortcut, overflow menu, start-up tool) - not from
// rail-button clicks, which a shortcut never fires.
//
// The toggle's icon follows the active shape tool (rectangle or ellipse).

import { setShapeFilled } from './shape-tools.js';

let filled = false;
let tool = 'rectangle';
let panel = null;
let toggle = null;
let icons = [];

/** Which of the toggle's four icons shows, for the active shape tool. */
export function fillIconFor(activeTool, isFilled) {
  return `${activeTool === 'ellipse' ? 'ellipse' : 'rectangle'}-${isFilled ? 'filled' : 'outline'}`;
}

function render() {
  const key = fillIconFor(tool, filled);
  for (const icon of icons) icon.classList.toggle('hidden', icon.dataset.fillIcon !== key);
  toggle.classList.toggle('active', filled);
  toggle.setAttribute('aria-pressed', String(filled));
  toggle.dataset.tooltip = tool === 'ellipse' ? 'Filled ellipse' : 'Filled rectangle';
}

export function initRectangleFill(root = document) {
  panel = root.querySelector('#rectangle-options');
  toggle = root.querySelector('#rectangle-fill-toggle');
  if (!toggle) return; // standalone-only (absent from lib/pixi.js's embed markup)
  icons = [...toggle.querySelectorAll('[data-fill-icon]')];
  toggle.setAttribute('aria-pressed', 'false');

  toggle.addEventListener('click', () => {
    filled = !filled;
    setShapeFilled(filled);
    render();
  });
}

/** Shows the Filled toggle for Rectangle and Ellipse, with that tool's icons. */
export function syncRectangleFillTool(activeTool) {
  if (!toggle) return;
  const isShape = activeTool === 'rectangle' || activeTool === 'ellipse';
  panel.classList.toggle('hidden', !isShape);
  if (isShape) {
    tool = activeTool;
    render();
  }
}
