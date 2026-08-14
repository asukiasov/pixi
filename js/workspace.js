import { UndoStack } from './undo.js';
import { saveProject, renameProject } from './persistence.js';
import { initCanvasSettings } from './canvas-settings.js';
import { STAMPS, placeStamp } from './stamps.js';
import { drawRectangle, clipToSelection } from './shape-tools.js';

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

/**
 * Whether a point is inside `selection` (or there's no active selection,
 * in which case everywhere counts as "inside"). Used to guard point-origin
 * tools (bucket, stamp): unlike a drag, which clips per-pixel regardless of
 * where it starts, a single-tap tool must have literally no effect when
 * the tap itself lands outside the selection — bucket fill in particular
 * would otherwise spread through the whole connected region and only get
 * clipped back afterward, changing pixels inside the selection even though
 * the click was outside it.
 */
function isPointInSelection(point, selection) {
  if (!selection) return true;
  return (
    point.x >= selection.x &&
    point.x < selection.x + selection.width &&
    point.y >= selection.y &&
    point.y < selection.y + selection.height
  );
}

/** Normalizes a two-point drag into a rect, in either drag direction. */
function pointsToRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x) + 1,
    height: Math.abs(a.y - b.y) + 1,
  };
}

// Module-level state, not per-call: the Workspace screen is a singleton in
// this app (one workspace <canvas>), reused across every project the user
// opens or creates in a session. DOM listeners are bound exactly once, the
// first time initWorkspace runs; later calls just rebind state to the new
// project/layer stack.
let state = null;
let domBound = false;
let canvasSettingsControls = null;

function updateUndoRedoButtons() {
  state.undoButton.disabled = !state.undoStack.canUndo();
  state.redoButton.disabled = !state.undoStack.canRedo();
}

/**
 * Auto-save: writes the current layer stack (and a fresh thumbnail) to
 * IndexedDB. Fire-and-forget from callers' perspective — drawing shouldn't
 * block on a write completing. Not queued/serialized: rapid successive
 * commits could in principle finish out of order and leave a slightly stale
 * save; acceptable at this interaction rate, not solved in this slice.
 */
async function autoSave() {
  const thumbnail = await state.layerStack.toPNGBlob();
  await saveProject(state.projectId, state.layerStack, thumbnail);
}

function commit() {
  state.undoStack.push(state.layerStack.snapshot());
  updateUndoRedoButtons();
  autoSave();
}

function colorForCurrentTool() {
  return state.currentTool === 'eraser' ? [0, 0, 0, 0] : state.currentColor;
}

function updateSelectionControls() {
  state.selectionControlsEl.classList.toggle('hidden', !state.selection);
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
  const rectangleFillToggle = document.getElementById('rectangle-fill-toggle');
  const paletteRow = document.getElementById('palette-row');
  const stampsRow = document.getElementById('stamps-row');
  const backToGalleryButton = document.getElementById('back-to-gallery-button');

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

  rectangleFillToggle.addEventListener('click', () => {
    state.rectangleFilled = !state.rectangleFilled;
    rectangleFillToggle.classList.toggle('active', state.rectangleFilled);
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

  STAMPS.forEach((stamp, index) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'stamp-swatch';
    swatch.textContent = stamp.name;
    swatch.title = stamp.name;
    if (index === 0) swatch.classList.add('active');
    swatch.addEventListener('click', () => {
      state.currentStamp = stamp;
      stampsRow.querySelectorAll('.stamp-swatch').forEach((s) => s.classList.toggle('active', s === swatch));
    });
    stampsRow.appendChild(swatch);
  });

  state.undoButton.addEventListener('click', () => {
    const snapshot = state.undoStack.undo();
    if (snapshot) {
      state.layerStack.restore(snapshot);
      state.canvasView.render();
      renderLayersPanel();
      autoSave();
    }
    updateUndoRedoButtons();
  });

  state.redoButton.addEventListener('click', () => {
    const snapshot = state.undoStack.redo();
    if (snapshot) {
      state.layerStack.restore(snapshot);
      state.canvasView.render();
      renderLayersPanel();
      autoSave();
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

  // Every action auto-saves, so there's nothing to lose by leaving — no
  // confirmation prompt here (unlike Phase 1/2a's "New" control).
  backToGalleryButton.addEventListener('click', () => {
    state.onRequestGallery?.();
  });

  state.addLayerButton.addEventListener('click', () => {
    const added = state.layerStack.addLayer();
    if (!added) return;
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  state.selectionClearButton.addEventListener('click', () => {
    state.selection = null;
    state.canvasView.setSelectionRect(null);
    updateSelectionControls();
  });

  state.selectionDeleteButton.addEventListener('click', () => {
    if (!state.selection) return;
    const activeEngine = state.layerStack.getActiveLayer().engine;
    const { x, y, width, height } = state.selection;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        activeEngine.setPixel(x + dx, y + dy, [0, 0, 0, 0]);
      }
    }
    state.canvasView.render();
    commit();
  });

  canvasSettingsControls = initCanvasSettings({
    onResize(width, height) {
      state.layerStack.resize(width, height);
      state.canvasView.resetView();
      state.canvasView.render();
      canvasSettingsControls.setCurrentSize(state.layerStack.width, state.layerStack.height);
      // A resize invalidates any prior selection's coordinates.
      state.selection = null;
      state.canvasView.setSelectionRect(null);
      updateSelectionControls();
      commit();
    },
    onRotate(direction) {
      state.layerStack.rotate90(direction);
      state.canvasView.resetView();
      state.canvasView.render();
      canvasSettingsControls.setCurrentSize(state.layerStack.width, state.layerStack.height);
      state.selection = null;
      state.canvasView.setSelectionRect(null);
      updateSelectionControls();
      commit();
    },
    onRename(name) {
      state.projectName = name;
      renameProject(state.projectId, name);
    },
  });
}

/**
 * Redraws the current line/rectangle preview (or committed shape) from the
 * pre-drag backup, applying the selection clip if one is active. Shared by
 * onDrawMove (live preview) and onDrawEnd (final commit) so both look and
 * behave identically.
 */
function drawShapePreview() {
  state.strokeEngine.data.set(state.strokeBackup);
  const rgba = colorForCurrentTool();
  if (state.currentTool === 'line') {
    state.strokeEngine.strokeFreehand([state.dragStart, state.dragCurrent], rgba, state.pixelPerfect);
  } else if (state.currentTool === 'rectangle') {
    drawRectangle(
      state.strokeEngine,
      state.dragStart.x,
      state.dragStart.y,
      state.dragCurrent.x,
      state.dragCurrent.y,
      rgba,
      state.rectangleFilled
    );
  }
  clipToSelection(state.strokeEngine, state.strokeBackup, state.selection);
}

/**
 * Wires the Workspace tab bar, palette, stamps row, Layers panel, Canvas
 * Settings panel, and selection controls to `layerStack` and `canvasView`,
 * and owns the undo/redo stack and auto-save for the current project. Safe
 * to call repeatedly (once per project opened or created in a session) —
 * DOM listeners bind only once; subsequent calls just reset the drawing
 * state for the new project.
 */
export function initWorkspace({ projectId, projectName, layerStack, canvasView, onRequestGallery }) {
  state = {
    projectId,
    projectName,
    layerStack,
    canvasView,
    onRequestGallery,
    undoStack: new UndoStack(),
    currentTool: 'pencil',
    currentColor: hexToRgba(PALETTE[0]),
    currentStamp: STAMPS[0],
    pixelPerfect: false,
    rectangleFilled: false,
    selection: null,
    dragStart: null,
    dragCurrent: null,
    strokeEngine: null,
    strokeBackup: null,
    strokePoints: [],
    undoButton: document.getElementById('undo-button'),
    redoButton: document.getElementById('redo-button'),
    exportButton: document.getElementById('export-button'),
    addLayerButton: document.getElementById('add-layer-button'),
    layersPanelList: document.getElementById('layers-panel-list'),
    selectionControlsEl: document.getElementById('selection-controls'),
    selectionClearButton: document.getElementById('selection-clear-button'),
    selectionDeleteButton: document.getElementById('selection-delete-button'),
  };

  if (!domBound) {
    bindDomOnce();
    domBound = true;
  }

  canvasSettingsControls.setCurrentSize(layerStack.width, layerStack.height);
  canvasSettingsControls.setCurrentName(projectName);

  // Selections don't persist with the project (see shape-tools spec) — a
  // freshly opened project always starts with none.
  canvasView.setSelectionRect(null);
  updateSelectionControls();

  // Baseline snapshot so the very first stroke can be undone back to
  // whatever state the project was in when opened.
  state.undoStack.push(layerStack.snapshot());
  updateUndoRedoButtons();
  renderLayersPanel();

  canvasView.setHandlers({
    onDrawStart(point) {
      const tool = state.currentTool;

      if (tool === 'selection') {
        state.dragStart = point;
        state.dragCurrent = point;
        state.canvasView.setSelectionRect(pointsToRect(point, point));
        return;
      }

      const activeEngine = state.layerStack.getActiveLayer().engine;

      if (tool === 'bucket') {
        if (!isPointInSelection(point, state.selection)) return;
        const backup = activeEngine.data.slice();
        activeEngine.floodFill(point.x, point.y, state.currentColor);
        clipToSelection(activeEngine, backup, state.selection);
        state.canvasView.render();
        commit();
        return;
      }

      if (tool === 'stamp') {
        if (!isPointInSelection(point, state.selection)) return;
        const backup = activeEngine.data.slice();
        placeStamp(activeEngine, point.x, point.y, state.currentStamp, state.currentColor);
        clipToSelection(activeEngine, backup, state.selection);
        state.canvasView.render();
        commit();
        return;
      }

      // Captured once per stroke/drag: if the active layer changes mid-
      // gesture (shouldn't normally happen, but guards against it), it
      // keeps targeting the layer it started on.
      state.strokeEngine = activeEngine;
      state.strokeBackup = activeEngine.data.slice();

      if (tool === 'line' || tool === 'rectangle') {
        state.dragStart = point;
        state.dragCurrent = point;
        drawShapePreview();
        state.canvasView.render();
        return;
      }

      // pencil / eraser
      state.strokePoints = [point];
      activeEngine.strokeFreehand(state.strokePoints, colorForCurrentTool(), state.pixelPerfect);
      clipToSelection(activeEngine, state.strokeBackup, state.selection);
      state.canvasView.render();
    },

    onDrawMove(point) {
      const tool = state.currentTool;

      if (tool === 'selection') {
        if (!state.dragStart) return;
        state.dragCurrent = point;
        state.canvasView.setSelectionRect(pointsToRect(state.dragStart, point));
        return;
      }

      if (!state.strokeBackup) return;

      if (tool === 'line' || tool === 'rectangle') {
        state.dragCurrent = point;
        drawShapePreview();
        state.canvasView.render();
        return;
      }

      // pencil / eraser: redraw the whole stroke from a clean backup each
      // move so pixel-perfect corner removal (which depends on later
      // points) stays correct. In-progress drawing, not a committed
      // action, so it does NOT auto-save.
      const last = state.strokePoints[state.strokePoints.length - 1];
      if (last && last.x === point.x && last.y === point.y) return;
      state.strokePoints.push(point);
      state.strokeEngine.data.set(state.strokeBackup);
      state.strokeEngine.strokeFreehand(state.strokePoints, colorForCurrentTool(), state.pixelPerfect);
      clipToSelection(state.strokeEngine, state.strokeBackup, state.selection);
      state.canvasView.render();
    },

    onDrawEnd() {
      const tool = state.currentTool;

      if (tool === 'selection') {
        if (!state.dragStart) return;
        state.selection = pointsToRect(state.dragStart, state.dragCurrent ?? state.dragStart);
        state.dragStart = null;
        state.dragCurrent = null;
        updateSelectionControls();
        return;
      }

      if (!state.strokeBackup) return;
      state.strokeEngine = null;
      state.strokeBackup = null;
      state.strokePoints = [];
      state.dragStart = null;
      state.dragCurrent = null;
      commit();
    },

    onDrawCancel() {
      const tool = state.currentTool;

      if (tool === 'selection') {
        state.dragStart = null;
        state.dragCurrent = null;
        // Revert the overlay to whatever selection was last committed (if any).
        state.canvasView.setSelectionRect(state.selection);
        return;
      }

      if (!state.strokeBackup) return;
      state.strokeEngine.data.set(state.strokeBackup);
      state.canvasView.render();
      state.strokeEngine = null;
      state.strokeBackup = null;
      state.strokePoints = [];
      state.dragStart = null;
      state.dragCurrent = null;
    },
  });
}
