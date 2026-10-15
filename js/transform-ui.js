// Align and Rotate popovers (2026-10-15 align-rotate-popovers): align,
// flip and rotate the selection or the active layer. js/workspace.js's
// transformActiveLayer runs align and flip; previewRotate / applyRotate /
// cancelRotate run the dial (js/rotate-dial.js). Pixel work is in
// lib/pixel-engine/transform.js and rotsprite.js. Opened from
// #align-toggle and #rotate-toggle in the top bar, one at a time
// (pressing the other toggle is a press outside); wired once from
// js/app.js. Standalone only - embeds have neither panel, so this returns
// without wiring anything.

import {
  getTransformTarget,
  transformActiveLayer,
  previewRotate,
  applyRotate,
  cancelRotate,
  onRotateEnd,
  onWorkspaceReset,
} from './workspace.js';
import { initRotateDial } from './rotate-dial.js';

// data-transform value -> transformActiveLayer op.
const OPS = {
  'flip-horizontal': { kind: 'flip', axis: 'horizontal' },
  'flip-vertical': { kind: 'flip', axis: 'vertical' },
  'align-left': { kind: 'align', edge: 'left' },
  'align-center': { kind: 'align', edge: 'center' },
  'align-right': { kind: 'align', edge: 'right' },
  'align-top': { kind: 'align', edge: 'top' },
  'align-middle': { kind: 'align', edge: 'middle' },
  'align-bottom': { kind: 'align', edge: 'bottom' },
};

/** Below the toggle, clamped to the viewport (flips above when there's no room). */
function positionPanel(panel, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const margin = 8;
  let top = rect.bottom + 8;
  if (top + panelRect.height > window.innerHeight - margin) top = rect.top - panelRect.height - 8;
  top = Math.max(margin, Math.min(top, window.innerHeight - panelRect.height - margin));
  const left = Math.max(margin, Math.min(rect.right - panelRect.width, window.innerWidth - panelRect.width - margin));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

/** Open/close for one popover: its toggle, close button, Escape, a press outside, a workspace reset. */
function wirePopover(toggle, panel, { onOpen, onClose = () => {} }) {
  const isOpen = () => !panel.classList.contains('hidden');
  function close() {
    if (!isOpen()) return;
    panel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    onClose();
  }
  function open() {
    onOpen();
    panel.classList.remove('hidden'); // unhide before measuring
    toggle.setAttribute('aria-expanded', 'true');
    positionPanel(panel, toggle);
  }
  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  panel.querySelector('.transform-close').addEventListener('click', close);
  document.addEventListener('pointerdown', (e) => {
    if (!isOpen() || panel.contains(e.target) || toggle.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });
  onWorkspaceReset(close);
}

/** Wires the panel's [data-transform] buttons to transformActiveLayer; returns them. */
function wireActions(panel, afterEach) {
  const buttons = [...panel.querySelectorAll('[data-transform]')];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      transformActiveLayer(OPS[button.dataset.transform]);
      afterEach();
    });
  }
  return buttons;
}

const targetNoun = () => (getTransformTarget().kind === 'selection' ? 'Selection' : 'Layer');

function initAlign(root) {
  const toggle = root.querySelector('#align-toggle');
  const panel = root.querySelector('#align-panel');
  if (!toggle || !panel) return;
  const title = panel.querySelector('#align-title');

  // Refreshed on open and after every action.
  function sync() {
    const { alignDisabled } = getTransformTarget();
    for (const button of buttons) button.disabled = alignDisabled;
  }
  const buttons = wireActions(panel, sync);

  wirePopover(toggle, panel, {
    onOpen: () => {
      title.textContent = `Align ${targetNoun()}`;
      sync();
    },
  });
}

function initRotate(root) {
  const toggle = root.querySelector('#rotate-toggle');
  const panel = root.querySelector('#rotate-panel');
  if (!toggle || !panel) return;
  const title = panel.querySelector('#rotate-title');
  const dialEl = panel.querySelector('#rotate-dial');
  const steps = [...panel.querySelectorAll('[data-rotate-step]')];
  const reset = panel.querySelector('#rotate-reset');
  const apply = panel.querySelector('#rotate-apply');

  const dial = initRotateDial(dialEl, {
    onInput: (deg) => {
      previewRotate(deg, 'fast');
      sync();
    },
    onChange: (deg) => {
      previewRotate(deg, 'smooth');
      sync();
    },
  });

  // Flips wait while a rotation is pending; Reset and Apply need one.
  function sync() {
    const { disabled } = getTransformTarget();
    const pending = dial.value !== 0;
    dialEl.setAttribute('aria-disabled', String(disabled));
    for (const button of steps) button.disabled = disabled;
    for (const button of flips) button.disabled = disabled || pending;
    reset.disabled = disabled || !pending;
    apply.disabled = disabled || !pending;
  }
  const flips = wireActions(panel, sync);

  for (const button of steps) {
    button.addEventListener('click', () => {
      dial.set(dial.value + Number(button.dataset.rotateStep));
      previewRotate(dial.value, 'smooth');
      sync();
    });
  }
  // Both disable themselves, so focus goes back to the dial.
  reset.addEventListener('click', () => {
    cancelRotate();
    dialEl.focus();
  });
  apply.addEventListener('click', () => {
    applyRotate(dial.value);
    dial.set(0);
    sync();
    dialEl.focus();
  });

  // Cancel, undo/redo, another edit or a new project ended the preview.
  onRotateEnd(() => {
    dial.set(0);
    sync();
  });

  wirePopover(toggle, panel, {
    onOpen: () => {
      title.textContent = `Rotate ${targetNoun()}`;
      sync();
    },
    onClose: cancelRotate,
  });
}

export function initTransform(root = document) {
  initAlign(root);
  initRotate(root);
}
