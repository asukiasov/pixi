const MIN_SIZE = 1;
const MAX_SIZE = 256;

function clampSize(value) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
}

/**
 * Wires the Canvas Settings panel (resize + rotate) in the Workspace
 * screen. Doesn't own or touch a LayerStack directly — reports the user's
 * intent via `onResize`/`onRotate` callbacks, so `workspace.js` keeps sole
 * ownership of the current layer stack, canvas view, and undo/auto-save.
 * Bind once, like the rest of workspace.js's DOM wiring.
 */
export function initCanvasSettings({ onResize, onRotate }) {
  const toggleButton = document.getElementById('canvas-settings-toggle');
  const panel = document.getElementById('canvas-settings-panel');
  const widthInput = document.getElementById('canvas-settings-width');
  const heightInput = document.getElementById('canvas-settings-height');
  const applyButton = document.getElementById('canvas-settings-apply');
  const rotateCWButton = document.getElementById('canvas-settings-rotate-cw');
  const rotateCCWButton = document.getElementById('canvas-settings-rotate-ccw');

  toggleButton.addEventListener('click', () => {
    panel.classList.toggle('hidden');
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
  };
}
