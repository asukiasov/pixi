const MIN_SIZE = 1;
const MAX_SIZE = 256;

function clampSize(value) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
}

/**
 * Positions `panel` as a popover below `anchorEl` (the gear icon in the
 * top bar), clamped to the viewport - flips above if it would overflow
 * the bottom, clamped horizontally too. Same unhide-to-measure-then-clamp
 * pattern workspace.js's openColorPicker uses for the color picker
 * popover, just anchored below rather than to the side (top-bar buttons
 * sit close together horizontally, so beside would risk covering a
 * neighbor, the same reasoning the top-bar tooltips already follow).
 */
function positionPanel(panel, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const margin = 8;

  let top = rect.bottom + 8;
  if (top + panelRect.height > window.innerHeight - margin) {
    top = rect.top - panelRect.height - 8;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - panelRect.height - margin));

  let left = rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - panelRect.width - margin));

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

/**
 * Wires the Canvas Settings popover (name, resize, rotate) in the
 * Workspace screen. Doesn't own or touch a LayerStack/project record
 * directly — reports the user's intent via `onResize`/`onRotate`/
 * `onRename` callbacks, so `workspace.js` keeps sole ownership of the
 * current layer stack, canvas view, and undo/auto-save. Bind once, like
 * the rest of workspace.js's DOM wiring.
 */
export function initCanvasSettings({ onResize, onRotate, onRename }) {
  const toggleButton = document.getElementById('canvas-settings-toggle');
  const panel = document.getElementById('canvas-settings-panel');
  const closeButton = document.getElementById('canvas-settings-close');
  const nameInput = document.getElementById('canvas-settings-name');
  const widthInput = document.getElementById('canvas-settings-width');
  const heightInput = document.getElementById('canvas-settings-height');
  const applyButton = document.getElementById('canvas-settings-apply');
  const rotateCWButton = document.getElementById('canvas-settings-rotate-cw');
  const rotateCCWButton = document.getElementById('canvas-settings-rotate-ccw');

  function close() {
    panel.classList.add('hidden');
  }

  toggleButton.addEventListener('click', () => {
    const wasHidden = panel.classList.contains('hidden');
    // Unhide before measuring - .hidden is display:none, which has no box
    // to read a size from.
    panel.classList.remove('hidden');
    if (wasHidden) {
      positionPanel(panel, toggleButton);
    } else {
      close();
    }
  });

  closeButton.addEventListener('click', close);

  // Close on outside click/Escape too, not just the explicit close button
  // or re-clicking the toggle - standard popover behavior, same as the
  // color-picker popover.
  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(e.target)) return;
    if (e.target === toggleButton || toggleButton.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) close();
  });

  nameInput.addEventListener('change', () => {
    const name = nameInput.value.trim();
    if (name) onRename(name);
  });

  applyButton.addEventListener('click', () => {
    const width = clampSize(Number(widthInput.value));
    const height = clampSize(Number(heightInput.value));
    onResize(width, height);
  });

  rotateCWButton.addEventListener('click', () => onRotate('cw'));
  rotateCCWButton.addEventListener('click', () => onRotate('ccw'));

  return {
    /** Called by workspace.js whenever the current canvas's size may have changed. */
    setCurrentSize(width, height) {
      widthInput.value = String(width);
      heightInput.value = String(height);
    },
    /** Called by workspace.js whenever the current project's name may have changed. */
    setCurrentName(name) {
      nameInput.value = name;
    },
    /** Called by workspace.js's per-project reset - a freshly opened project starts with the popover closed. */
    close,
  };
}
