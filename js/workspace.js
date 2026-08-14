import { UndoStack } from './undo.js';

const PALETTE = [
  '#000000', '#ffffff', '#9d9d9d', '#4a4a4a',
  '#be2633', '#e06f8b', '#ea4f36', '#f7a417',
  '#f2ca30', '#a2ce29', '#3f9337', '#39a6a3',
  '#2ce8f4', '#1a5fb4', '#5843c0', '#8b2fb0',
];

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay'];

function hexToRgba(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

// Module-level state, not per-call: the Workspace screen is a singleton in
// this app (one workspace <canvas>), reused across every canvas the user
// creates in a session. DOM listeners are bound exactly once, the first time
// initWorkspace runs; later calls just rebind state to the new layer stack.
let state = null;
let domBound = false;

function updateUndoRedoButtons() {
  state.undoButton.disabled = !state.undoStack.canUndo();
  state.redoButton.disabled = !state.undoStack.canRedo();
}

function commit() {
  state.undoStack.push(state.layerStack.snapshot());
  updateUndoRedoButtons();
}

function colorForCurrentTool() {
  return state.currentTool === 'eraser' ? [0, 0, 0, 0] : state.currentColor;
}

function renderLayersPanel() {
  const layers = state.layerStack.getLayers();
  const activeIndex = state.layerStack.getActiveIndex();
  state.layersPanelList.innerHTML = '';

  // Topmost layer (end of the bottom-to-top array) listed first.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    state.layersPanelList.appendChild(buildLayerRow(layer, i, i === activeIndex, layers.length));
  }

  state.addLayerButton.disabled = layers.length >= 8;
}

function buildLayerRow(layer, index, isActive, layerCount) {
  const row = document.createElement('div');
  row.className = 'layer-row' + (isActive ? ' active' : '');
  row.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select')) return;
    state.layerStack.setActiveLayer(index);
    renderLayersPanel();
  });

  const visibilityButton = document.createElement('button');
  visibilityButton.type = 'button';
  visibilityButton.className = 'layer-visibility-toggle';
  visibilityButton.textContent = layer.visible ? '\u{1F441}' : '\u{1F6AB}'; // 👁 / 🚫
  visibilityButton.title = layer.visible ? 'Hide layer' : 'Show layer';
  visibilityButton.addEventListener('click', () => {
    state.layerStack.setVisibility(index, !layer.visible);
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'layer-name-input';
  nameInput.value = layer.name;
  nameInput.addEventListener('change', () => {
    state.layerStack.renameLayer(index, nameInput.value.trim() || layer.name);
    commit();
    renderLayersPanel();
  });

  const opacityInput = document.createElement('input');
  opacityInput.type = 'range';
  opacityInput.min = '0';
  opacityInput.max = '100';
  opacityInput.value = String(Math.round(layer.opacity * 100));
  opacityInput.className = 'layer-opacity-slider';
  opacityInput.title = 'Opacity';
  opacityInput.addEventListener('input', () => {
    // Live-update the canvas while dragging, but don't rebuild the panel
    // (that would destroy this slider mid-drag) or commit every tick.
    state.layerStack.setOpacity(index, Number(opacityInput.value) / 100);
    state.canvasView.render();
  });
  opacityInput.addEventListener('change', () => {
    commit();
  });

  const blendSelect = document.createElement('select');
  blendSelect.className = 'layer-blend-select';
  for (const mode of BLEND_MODES) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode[0].toUpperCase() + mode.slice(1);
    if (mode === layer.blendMode) option.selected = true;
    blendSelect.appendChild(option);
  }
  blendSelect.addEventListener('change', () => {
    state.layerStack.setBlendMode(index, blendSelect.value);
    state.canvasView.render();
    commit();
  });

  const upButton = document.createElement('button');
  upButton.type = 'button';
  upButton.className = 'layer-reorder-button';
  upButton.textContent = '↑'; // ↑
  upButton.title = 'Move layer up';
  upButton.disabled = index === layerCount - 1;
  upButton.addEventListener('click', () => {
    state.layerStack.moveLayerUp(index);
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  const downButton = document.createElement('button');
  downButton.type = 'button';
  downButton.className = 'layer-reorder-button';
  downButton.textContent = '↓'; // ↓
  downButton.title = 'Move layer down';
  downButton.disabled = index === 0;
  downButton.addEventListener('click', () => {
    state.layerStack.moveLayerDown(index);
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'layer-delete-button';
  deleteButton.textContent = '\u{1F5D1}'; // 🗑
  deleteButton.title = 'Delete layer';
  deleteButton.disabled = layerCount <= 1;
  deleteButton.addEventListener('click', () => {
    state.layerStack.deleteLayer(index);
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  row.append(visibilityButton, nameInput, opacityInput, blendSelect, upButton, downButton, deleteButton);
  return row;
}

function bindDomOnce() {
  const toolButtons = document.querySelectorAll('.tool-button[data-tool]');
  const pixelPerfectToggle = document.getElementById('pixel-perfect-toggle');
  const paletteRow = document.getElementById('palette-row');
  const newCanvasButton = document.getElementById('new-canvas-nav-button');

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.currentTool = button.dataset.tool;
      toolButtons.forEach((b) => b.classList.toggle('active', b === button));
    });
  });

  pixelPerfectToggle.addEventListener('click', () => {
    state.pixelPerfect = !state.pixelPerfect;
    pixelPerfectToggle.classList.toggle('active', state.pixelPerfect);
  });

  PALETTE.forEach((hex, index) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'palette-swatch';
    swatch.style.background = hex;
    if (index === 0) swatch.classList.add('active');
    swatch.addEventListener('click', () => {
      state.currentColor = hexToRgba(hex);
      paletteRow.querySelectorAll('.palette-swatch').forEach((s) => s.classList.toggle('active', s === swatch));
    });
    paletteRow.appendChild(swatch);
  });

  state.undoButton.addEventListener('click', () => {
    const snapshot = state.undoStack.undo();
    if (snapshot) {
      state.layerStack.restore(snapshot);
      state.canvasView.render();
      renderLayersPanel();
    }
    updateUndoRedoButtons();
  });

  state.redoButton.addEventListener('click', () => {
    const snapshot = state.undoStack.redo();
    if (snapshot) {
      state.layerStack.restore(snapshot);
      state.canvasView.render();
      renderLayersPanel();
    }
    updateUndoRedoButtons();
  });

  state.exportButton.addEventListener('click', async () => {
    const blob = await state.layerStack.toPNGBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixi-export.png';
    a.click();
    URL.revokeObjectURL(url);
  });

  newCanvasButton.addEventListener('click', () => {
    const proceed = window.confirm('Start a new canvas? The current drawing will be lost.');
    if (proceed) state.onRequestNewCanvas?.();
  });

  state.addLayerButton.addEventListener('click', () => {
    const added = state.layerStack.addLayer();
    if (!added) return;
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });
}

/**
 * Wires the Workspace tab bar, palette, and Layers panel to `layerStack` and
 * `canvasView`, and owns the undo/redo stack for the current canvas. Safe to
 * call repeatedly (once per canvas created in a session) — DOM listeners
 * bind only once; subsequent calls just reset the drawing state for the new
 * layer stack.
 */
export function initWorkspace({ layerStack, canvasView, onRequestNewCanvas }) {
  state = {
    layerStack,
    canvasView,
    onRequestNewCanvas,
    undoStack: new UndoStack(),
    currentTool: 'pencil',
    currentColor: hexToRgba(PALETTE[0]),
    pixelPerfect: false,
    strokeEngine: null,
    strokeBackup: null,
    strokePoints: [],
    undoButton: document.getElementById('undo-button'),
    redoButton: document.getElementById('redo-button'),
    exportButton: document.getElementById('export-button'),
    addLayerButton: document.getElementById('add-layer-button'),
    layersPanelList: document.getElementById('layers-panel-list'),
  };

  if (!domBound) {
    bindDomOnce();
    domBound = true;
  }

  // Baseline snapshot so the very first stroke can be undone back to the
  // freshly created (filled-background) starting layer.
  state.undoStack.push(layerStack.snapshot());
  updateUndoRedoButtons();
  renderLayersPanel();

  canvasView.setHandlers({
    onDrawStart(point) {
      const activeEngine = state.layerStack.getActiveLayer().engine;

      if (state.currentTool === 'bucket') {
        activeEngine.floodFill(point.x, point.y, state.currentColor);
        state.canvasView.render();
        commit();
        return;
      }

      // Captured once per stroke: if the active layer changes mid-stroke
      // (shouldn't normally happen mid-drag, but guards against it), the
      // stroke keeps targeting the layer it started on.
      state.strokeEngine = activeEngine;
      state.strokeBackup = activeEngine.data.slice();
      state.strokePoints = [point];
      activeEngine.strokeFreehand(state.strokePoints, colorForCurrentTool(), state.pixelPerfect);
      state.canvasView.render();
    },

    onDrawMove(point) {
      if (!state.strokeBackup) return;
      const last = state.strokePoints[state.strokePoints.length - 1];
      if (last && last.x === point.x && last.y === point.y) return;
      state.strokePoints.push(point);
      // Redraw the whole stroke from a clean backup each move so pixel-perfect
      // corner removal (which depends on later points) stays correct.
      state.strokeEngine.data.set(state.strokeBackup);
      state.strokeEngine.strokeFreehand(state.strokePoints, colorForCurrentTool(), state.pixelPerfect);
      state.canvasView.render();
    },

    onDrawEnd() {
      if (!state.strokeBackup) return;
      state.strokeEngine = null;
      state.strokeBackup = null;
      state.strokePoints = [];
      commit();
    },

    onDrawCancel() {
      if (!state.strokeBackup) return;
      state.strokeEngine.data.set(state.strokeBackup);
      state.canvasView.render();
      state.strokeEngine = null;
      state.strokeBackup = null;
      state.strokePoints = [];
    },
  });
}
