import { LayerStack } from '../lib/pixel-engine/layers.js';
import { createProject } from './persistence.js';
import {
  PRESET_SIZES,
  initialState,
  selectTile,
  setSize,
  swapSize,
  setBackground,
  tileLabel,
} from './new-canvas-state.js';

const GRID_MAX = 32;

/**
 * Wires up the New Canvas screen (New Canvas redesign): preset tiles
 * (Last used, 16/32/64/128, and Custom while the size matches neither),
 * and an inspector with the size, a swap button, the background tiles,
 * Cancel and Create. Create allocates a LayerStack (one starting layer at
 * the chosen background), persists it as a project record before any
 * drawing happens, remembers the size and background through `saveLast`,
 * and hands `{ layerStack, projectId, projectName }` to `onCanvasCreated`.
 *
 * Returns `{ open }`, called each time the screen is shown: it reselects
 * Last used from `getLast()`.
 */
export function initNewCanvasScreen({ onCanvasCreated, onCancel, getLast, saveLast }) {
  const tilesEl = document.getElementById('size-presets');
  const form = document.getElementById('new-canvas-form');
  const widthInput = document.getElementById('custom-width');
  const heightInput = document.getElementById('custom-height');
  const swapButton = document.getElementById('swap-size');
  const presetName = document.getElementById('new-canvas-preset-name');
  const presetSize = document.getElementById('new-canvas-preset-size');
  const backgroundTiles = document.querySelectorAll('#background-choice .picture-tile');
  const createButton = document.getElementById('create-canvas-button');

  let state = initialState(getLast());
  let creating = false;

  function tileButton(tile, name, width, height) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'picture-tile size-tile';
    button.dataset.tile = String(tile);
    button.setAttribute('aria-pressed', String(state.selected === tile));
    const preview = document.createElement('span');
    preview.className = 'tile-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.dataset.background = state.background;
    // At most 32 grid cells a side: denser lines read as flat grey.
    const cells = Math.min(1, GRID_MAX / Math.max(width, height));
    preview.style.setProperty('--cols', Math.max(1, Math.round(width * cells)));
    preview.style.setProperty('--rows', Math.max(1, Math.round(height * cells)));
    preview.style.setProperty('--ratio', width / height);
    const label = document.createElement('span');
    label.className = 'tile-name';
    label.textContent = name;
    const size = document.createElement('span');
    size.className = 'tile-size';
    size.textContent = `${width} × ${height}`;
    button.append(preview, label, size);
    return button;
  }

  // Re-renders everything from `state`; `writeInputs` is false while the
  // user is mid-typing so the field isn't rewritten under them.
  function render({ writeInputs = true } = {}) {
    const focusedTile = document.activeElement?.closest?.('.size-tile')?.dataset.tile;
    const tiles = [tileButton('last', 'Last used', state.last.width, state.last.height)];
    for (const size of PRESET_SIZES) tiles.push(tileButton(size, `${size} px`, size, size));
    if (state.selected === 'custom') tiles.push(tileButton('custom', 'Custom', state.width, state.height));
    tilesEl.replaceChildren(...tiles);
    if (focusedTile) tilesEl.querySelector(`[data-tile="${focusedTile}"]`)?.focus();

    presetName.textContent = tileLabel(state);
    presetSize.textContent = `${state.width} × ${state.height} px`;
    if (writeInputs) {
      widthInput.value = String(state.width);
      heightInput.value = String(state.height);
    }
    swapButton.hidden = state.width === state.height;
    backgroundTiles.forEach((tile) => {
      tile.setAttribute('aria-pressed', String(tile.dataset.background === state.background));
    });
  }

  tilesEl.addEventListener('click', (event) => {
    const button = event.target.closest('.size-tile');
    if (!button || button.dataset.tile === 'custom') return;
    const tile = button.dataset.tile === 'last' ? 'last' : Number(button.dataset.tile);
    state = selectTile(state, tile);
    render();
  });

  function typedSize() {
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    return widthInput.value && heightInput.value && width >= 1 && height >= 1 ? [width, height] : null;
  }

  // While typing: follow valid numbers, leave the field alone.
  for (const input of [widthInput, heightInput]) {
    input.addEventListener('input', () => {
      const size = typedSize();
      if (!size) return;
      state = setSize(state, ...size);
      render({ writeInputs: false });
    });
    // On commit: write the clamped value back (an empty field restores it).
    input.addEventListener('change', () => render());
  }

  swapButton.addEventListener('click', () => {
    state = swapSize(state);
    render();
  });

  backgroundTiles.forEach((tile) => {
    tile.addEventListener('click', () => {
      state = setBackground(state, tile.dataset.background);
      render();
    });
  });

  document.getElementById('cancel-new-canvas').addEventListener('click', () => onCancel());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (creating) return;
    creating = true;
    createButton.disabled = true;
    try {
      const size = typedSize();
      if (size) state = setSize(state, ...size);
      const { width, height, background } = state;
      saveLast({ width, height, background });
      const layerStack = new LayerStack(width, height, background);
      const thumbnail = await layerStack.toPNGBlob();
      const record = await createProject(layerStack, undefined, thumbnail);
      onCanvasCreated({ layerStack, projectId: record.id, projectName: record.name });
    } finally {
      creating = false;
      createButton.disabled = false;
    }
  });

  function open() {
    state = initialState(getLast());
    render();
  }

  render();
  return { open };
}
