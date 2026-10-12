// Transform popover: rotate, flip and align the selection or the active
// layer (js/workspace.js's transformActiveLayer, pixel work in
// lib/pixel-engine/transform.js). Opened from #transform-toggle in the top
// bar; wired once from js/app.js. Standalone only - embeds have no
// #transform-panel, so this returns without wiring anything.

import { getTransformTarget, transformActiveLayer, onWorkspaceReset } from './workspace.js';

// data-transform value -> transformActiveLayer op.
const OPS = {
  'rotate-ccw': { kind: 'rotate', turn: 'ccw' },
  'rotate-cw': { kind: 'rotate', turn: 'cw' },
  'rotate-180': { kind: 'rotate', turn: '180' },
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

export function initTransform(root = document) {
  const toggle = root.querySelector('#transform-toggle');
  const panel = root.querySelector('#transform-panel');
  if (!toggle || !panel) return;
  const title = panel.querySelector('#transform-title');
  const buttons = [...panel.querySelectorAll('[data-transform]')];

  // Title and disabled states follow the current target - refreshed on
  // open and after every action (a rotate can push all of the content
  // off the canvas, leaving nothing to align).
  function sync() {
    const target = getTransformTarget();
    title.textContent = target.kind === 'selection' ? 'Transform Selection' : 'Transform Layer';
    for (const button of buttons) {
      const isAlign = button.dataset.transform.startsWith('align-');
      button.disabled = target.disabled || (isAlign && target.alignDisabled);
    }
  }

  function close() {
    panel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    if (!panel.classList.contains('hidden')) {
      close();
      return;
    }
    sync();
    panel.classList.remove('hidden'); // unhide before measuring
    toggle.setAttribute('aria-expanded', 'true');
    positionPanel(panel, toggle);
  });

  panel.querySelector('#transform-close').addEventListener('click', close);

  for (const button of buttons) {
    button.addEventListener('click', () => {
      transformActiveLayer(OPS[button.dataset.transform]);
      sync();
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || toggle.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) close();
  });

  onWorkspaceReset(close);
}
