import { UndoStack } from './undo.js';

const PALETTE = [
  '#000000', '#ffffff', '#9d9d9d', '#4a4a4a',
  '#be2633', '#e06f8b', '#ea4f36', '#f7a417',
  '#f2ca30', '#a2ce29', '#3f9337', '#39a6a3',
  '#2ce8f4', '#1a5fb4', '#5843c0', '#8b2fb0',
];

function hexToRgba(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

// Module-level state, not per-call: the Workspace screen is a singleton in
// this app (one workspace <canvas>), reused across every canvas the user
// creates in a session. DOM listeners are bound exactly once, the first time
// initWorkspace runs; later calls just rebind state to the new engine.
let state = null;
let domBound = false;

function updateUndoRedoButtons() {
  state.undoButton.disabled = !state.undoStack.canUndo();
  state.redoButton.disabled = !state.undoStack.canRedo();
}

function commit() {
  state.undoStack.push(state.engine.data.slice());
  updateUndoRedoButtons();
}

function colorForCurrentTool() {
  return state.currentTool === 'eraser' ? [0, 0, 0, 0] : state.currentColor;
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
      state.engine.data.set(snapshot);
      state.canvasView.render();
    }
    updateUndoRedoButtons();
  });

  state.redoButton.addEventListener('click', () => {
    const snapshot = state.undoStack.redo();
    if (snapshot) {
      state.engine.data.set(snapshot);
      state.canvasView.render();
    }
    updateUndoRedoButtons();
  });

  state.exportButton.addEventListener('click', async () => {
    const blob = await state.engine.toPNGBlob();
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
}

/**
 * Wires the Workspace tab bar and palette to `engine` and `canvasView`, and
 * owns the undo/redo stack for the current canvas. Safe to call repeatedly
 * (once per canvas created in a session) — DOM listeners bind only once;
 * subsequent calls just reset the drawing state for the new engine.
 */
export function initWorkspace({ engine, canvasView, onRequestNewCanvas }) {
  state = {
    engine,
    canvasView,
    onRequestNewCanvas,
    undoStack: new UndoStack(),
    currentTool: 'pencil',
    currentColor: hexToRgba(PALETTE[0]),
    pixelPerfect: false,
    strokeBackup: null,
    strokePoints: [],
    undoButton: document.getElementById('undo-button'),
    redoButton: document.getElementById('redo-button'),
    exportButton: document.getElementById('export-button'),
  };

  if (!domBound) {
    bindDomOnce();
    domBound = true;
  }

  // Baseline snapshot so the very first stroke can be undone back to the
  // freshly created (filled-background) canvas.
  state.undoStack.push(engine.data.slice());
  updateUndoRedoButtons();

  canvasView.setHandlers({
    onDrawStart(point) {
      if (state.currentTool === 'bucket') {
        state.engine.floodFill(point.x, point.y, state.currentColor);
        state.canvasView.render();
        commit();
        return;
      }
      state.strokeBackup = state.engine.data.slice();
      state.strokePoints = [point];
      state.engine.strokeFreehand(state.strokePoints, colorForCurrentTool(), state.pixelPerfect);
      state.canvasView.render();
    },

    onDrawMove(point) {
      if (!state.strokeBackup) return;
      const last = state.strokePoints[state.strokePoints.length - 1];
      if (last && last.x === point.x && last.y === point.y) return;
      state.strokePoints.push(point);
      // Redraw the whole stroke from a clean backup each move so pixel-perfect
      // corner removal (which depends on later points) stays correct.
      state.engine.data.set(state.strokeBackup);
      state.engine.strokeFreehand(state.strokePoints, colorForCurrentTool(), state.pixelPerfect);
      state.canvasView.render();
    },

    onDrawEnd() {
      if (!state.strokeBackup) return;
      state.strokeBackup = null;
      state.strokePoints = [];
      commit();
    },

    onDrawCancel() {
      if (!state.strokeBackup) return;
      state.engine.data.set(state.strokeBackup);
      state.canvasView.render();
      state.strokeBackup = null;
      state.strokePoints = [];
    },
  });
}
