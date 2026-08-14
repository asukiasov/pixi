import { UndoStack } from './undo.js';
import { saveProject, renameProject, createCustomBrush, listCustomBrushes, deleteCustomBrush } from './persistence.js';
import { initCanvasSettings } from './canvas-settings.js';
import { BRUSHES, placeBrush, rainbowColor, pixelsFromGrid } from './brushes.js';
import { drawRectangle, clipToSelection } from './shape-tools.js';
import { bresenhamLine } from './engine.js';

const BRUSH_EDITOR_SIZE = 9; // fixed grid size for the custom-brush editor, matches Heart's width

const RAINBOW_HUE_STEP = 20; // degrees per brush placed, in Rainbow mode

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
 * tools (bucket, brush): unlike a drag, which clips per-pixel regardless of
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
let toolButtons = null;
let pixelPerfectToggle = null;
let paletteRow = null;
let brushesPanel = null;
let brushesPanelGrid = null;
let deleteBrushButton = null;

// All available brushes: the built-ins plus whatever's been loaded from
// IndexedDB. Module-level, not per-project — brushes are global, not
// scoped to one project (see the "Custom brushes persist across
// projects" requirement).
let allBrushes = [...BRUSHES];

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

/** Shared by the Undo button and the Cmd/Ctrl+Z keyboard shortcut. */
function performUndo() {
  const snapshot = state.undoStack.undo();
  if (snapshot) {
    state.layerStack.restore(snapshot);
    state.canvasView.render();
    renderLayersPanel();
    autoSave();
  }
  updateUndoRedoButtons();
}

/** Shared by the Redo button and the Cmd/Ctrl+Shift+Z (or Ctrl+Y) shortcut. */
function performRedo() {
  const snapshot = state.undoStack.redo();
  if (snapshot) {
    state.layerStack.restore(snapshot);
    state.canvasView.render();
    renderLayersPanel();
    autoSave();
  }
  updateUndoRedoButtons();
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

/**
 * Draws a black-on-white preview of `brush`'s pattern (not its name) into a
 * small canvas sized to the brush's own pixel dimensions, then scaled up by
 * CSS with `image-rendering: pixelated` so it stays crisp at any swatch size.
 */
function buildBrushPreviewCanvas(brush) {
  const canvas = document.createElement('canvas');
  canvas.className = 'brush-swatch-preview';
  canvas.width = brush.width;
  canvas.height = brush.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, brush.width, brush.height);
  ctx.fillStyle = '#000000';
  for (const [x, y] of brush.pixels) {
    ctx.fillRect(x, y, 1, 1);
  }
  return canvas;
}

/** Rebuilds the Brushes panel grid from `allBrushes`, marking the current one active. */
function renderBrushesPanel() {
  brushesPanelGrid.innerHTML = '';
  allBrushes.forEach((brush) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'brush-swatch' + (brush.id === state.currentBrush?.id ? ' active' : '');
    swatch.title = brush.name;
    swatch.appendChild(buildBrushPreviewCanvas(brush));
    swatch.addEventListener('click', () => {
      state.currentBrush = brush;
      brushesPanelGrid.querySelectorAll('.brush-swatch').forEach((s) => s.classList.toggle('active', s === swatch));
      deleteBrushButton.disabled = !brush.isCustom;
    });
    brushesPanelGrid.appendChild(swatch);
  });
  deleteBrushButton.disabled = !state.currentBrush?.isCustom;
}

/** Fetches custom brushes from IndexedDB, merges with the built-ins, re-renders the panel. */
async function loadCustomBrushes() {
  const custom = await listCustomBrushes();
  allBrushes = [...BRUSHES, ...custom.map((b) => ({ ...b, isCustom: true }))];
  renderBrushesPanel();
}

function makeEmptyBrushEditorGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(false));
}

/**
 * Largest cell size (px) that keeps the whole grid within a reasonable
 * panel width regardless of how big the brush is (up to canvas size) —
 * shrinks for bigger grids, caps out at 1.6rem-equivalent for small ones.
 */
function brushEditorCellSizePx(width, height) {
  const maxGridPx = 180; // fits inside the 13rem (~208px) Brushes sidebar
  const maxCellPx = 26; // ~1.6rem at the default 16px root font size
  return Math.max(4, Math.min(maxCellPx, Math.floor(maxGridPx / Math.max(width, height))));
}

let brushEditorGridState = null;
let brushEditorPainting = false;
let brushEditorPaintValue = true;
let brushEditorWidth = BRUSH_EDITOR_SIZE;
let brushEditorHeight = BRUSH_EDITOR_SIZE;

/** (Re)builds the editor grid's cells to match brushEditorWidth x brushEditorHeight, clearing any painted pixels. */
function rebuildBrushEditorGrid() {
  const grid = document.getElementById('brush-editor-grid');
  brushEditorGridState = makeEmptyBrushEditorGrid(brushEditorWidth, brushEditorHeight);
  grid.innerHTML = '';
  const cellPx = brushEditorCellSizePx(brushEditorWidth, brushEditorHeight);
  grid.style.setProperty('--brush-editor-cols', String(brushEditorWidth));
  grid.style.setProperty('--brush-editor-rows', String(brushEditorHeight));
  grid.style.setProperty('--brush-editor-cell-size', `${cellPx}px`);
  for (let y = 0; y < brushEditorHeight; y++) {
    for (let x = 0; x < brushEditorWidth; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'brush-editor-cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      grid.appendChild(cell);
    }
  }
}

/**
 * Clamps a requested editor dimension to [3, the canvas's matching
 * dimension] — a brush wider or taller than the canvas itself isn't
 * meaningful, and anything under 3x3 isn't really a shape.
 */
function clampBrushEditorDimension(value, max) {
  return Math.max(3, Math.min(max, Math.round(value) || 3));
}

function openBrushEditor() {
  const widthInput = document.getElementById('brush-editor-width');
  const heightInput = document.getElementById('brush-editor-height');
  const maxWidth = state.layerStack.width;
  const maxHeight = state.layerStack.height;
  widthInput.max = String(maxWidth);
  heightInput.max = String(maxHeight);
  brushEditorWidth = clampBrushEditorDimension(BRUSH_EDITOR_SIZE, maxWidth);
  brushEditorHeight = clampBrushEditorDimension(BRUSH_EDITOR_SIZE, maxHeight);
  widthInput.value = String(brushEditorWidth);
  heightInput.value = String(brushEditorHeight);
  document.getElementById('brush-editor-name').value = '';
  rebuildBrushEditorGrid();
  document.getElementById('brush-editor-panel').classList.remove('hidden');
}

function closeBrushEditor() {
  document.getElementById('brush-editor-panel').classList.add('hidden');
}

/**
 * Wires the editor's width/height inputs and paint/erase-by-drag on the
 * grid. Listens on the grid container (not per-cell pointerenter) and
 * resolves the cell under the pointer via elementFromPoint on every move —
 * touch pointers implicitly capture to their initial target element, so
 * pointerenter would never fire on sibling cells during a touch drag.
 */
function bindBrushEditorOnce() {
  const grid = document.getElementById('brush-editor-grid');
  const nameInput = document.getElementById('brush-editor-name');
  const widthInput = document.getElementById('brush-editor-width');
  const heightInput = document.getElementById('brush-editor-height');
  const clearButton = document.getElementById('brush-editor-clear');
  const cancelButton = document.getElementById('brush-editor-cancel');
  const saveButton = document.getElementById('brush-editor-save');

  // Changing size re-grids from scratch (painting so far doesn't carry
  // over) — simplest behavior, and this is a brand-new brush each time.
  widthInput.addEventListener('change', () => {
    brushEditorWidth = clampBrushEditorDimension(Number(widthInput.value), state.layerStack.width);
    widthInput.value = String(brushEditorWidth);
    rebuildBrushEditorGrid();
  });
  heightInput.addEventListener('change', () => {
    brushEditorHeight = clampBrushEditorDimension(Number(heightInput.value), state.layerStack.height);
    heightInput.value = String(brushEditorHeight);
    rebuildBrushEditorGrid();
  });

  function setCellFromEvent(clientX, clientY, isFirst) {
    const el = document.elementFromPoint(clientX, clientY);
    const cell = el?.closest?.('.brush-editor-cell');
    if (!cell) return;
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    if (isFirst) brushEditorPaintValue = !brushEditorGridState[y][x];
    brushEditorGridState[y][x] = brushEditorPaintValue;
    cell.classList.toggle('on', brushEditorPaintValue);
  }

  grid.addEventListener('pointerdown', (e) => {
    brushEditorPainting = true;
    setCellFromEvent(e.clientX, e.clientY, true);
    e.preventDefault();
  });
  grid.addEventListener('pointermove', (e) => {
    if (!brushEditorPainting) return;
    setCellFromEvent(e.clientX, e.clientY, false);
  });
  document.addEventListener('pointerup', () => {
    brushEditorPainting = false;
  });

  clearButton.addEventListener('click', () => {
    brushEditorGridState = makeEmptyBrushEditorGrid(brushEditorWidth, brushEditorHeight);
    grid.querySelectorAll('.brush-editor-cell').forEach((c) => c.classList.remove('on'));
  });

  cancelButton.addEventListener('click', () => closeBrushEditor());

  saveButton.addEventListener('click', async () => {
    const name = nameInput.value.trim() || 'Custom Brush';
    const pixels = pixelsFromGrid(brushEditorGridState);
    if (pixels.length === 0) return; // nothing drawn - no-op, stay open
    await createCustomBrush(name, brushEditorWidth, brushEditorHeight, pixels);
    await loadCustomBrushes();
    closeBrushEditor();
  });
}

function bindDomOnce() {
  toolButtons = document.querySelectorAll('.tool-button[data-tool]');
  pixelPerfectToggle = document.getElementById('pixel-perfect-toggle');
  paletteRow = document.getElementById('palette-row');
  brushesPanel = document.getElementById('brushes-panel');
  const backToGalleryButton = document.getElementById('back-to-gallery-button');

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.currentTool = button.dataset.tool;
      toolButtons.forEach((b) => b.classList.toggle('active', b === button));
      brushesPanel.classList.toggle('hidden', state.currentTool !== 'brush');
      // Leaving the Brush tool mid-edit closes the editor rather than
      // leaving it open behind a now-hidden panel.
      if (state.currentTool !== 'brush') closeBrushEditor();
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
      // Picking a regular color deselects Rainbow, the same way it
      // deselects any other previously-picked color.
      state.brushRainbow = false;
      paletteRow.querySelectorAll('.palette-swatch').forEach((s) => s.classList.toggle('active', s === swatch));
    });
    paletteRow.appendChild(swatch);
  });

  // "Rainbow" lives in the same palette row as a selectable color, mutually
  // exclusive with picking a regular one — not a separate toggle button.
  // Only the Brush tool reads state.brushRainbow; every other tool just
  // keeps using state.currentColor, which selecting Rainbow never touches.
  const rainbowSwatch = document.createElement('button');
  rainbowSwatch.type = 'button';
  rainbowSwatch.className = 'palette-swatch rainbow-swatch';
  rainbowSwatch.title = 'Rainbow (Brush tool only)';
  rainbowSwatch.addEventListener('click', () => {
    state.brushRainbow = true;
    paletteRow.querySelectorAll('.palette-swatch').forEach((s) => s.classList.toggle('active', s === rainbowSwatch));
  });
  paletteRow.appendChild(rainbowSwatch);

  brushesPanelGrid = document.getElementById('brushes-panel-grid');
  deleteBrushButton = document.getElementById('delete-brush-button');
  const addBrushButton = document.getElementById('add-brush-button');
  const brushSpacingInput = document.getElementById('brush-spacing');
  const brushRotationInput = document.getElementById('brush-rotation');

  renderBrushesPanel();
  loadCustomBrushes(); // async; re-renders the panel once custom brushes arrive

  brushSpacingInput.addEventListener('change', () => {
    const value = Math.max(1, Math.min(20, Number(brushSpacingInput.value) || 1));
    brushSpacingInput.value = String(value);
    state.brushSpacing = value;
  });

  // Degrees the brush rotates per placement along a drag (0 = no
  // rotation, matching prior behavior). Wraps naturally since placeBrush's
  // rotation math takes any angle, but there's no reason to let the input
  // itself hold a value outside one full turn.
  brushRotationInput.addEventListener('change', () => {
    const value = Math.max(0, Math.min(359, Number(brushRotationInput.value) || 0));
    brushRotationInput.value = String(value);
    state.brushRotationStep = value;
  });

  deleteBrushButton.addEventListener('click', async () => {
    const custom = allBrushes.find((b) => b.id === state.currentBrush.id && b.isCustom);
    if (!custom) return;
    await deleteCustomBrush(custom.id);
    await loadCustomBrushes();
    state.currentBrush = allBrushes[0];
    renderBrushesPanel();
  });

  addBrushButton.addEventListener('click', () => openBrushEditor());
  bindBrushEditorOnce();

  state.undoButton.addEventListener('click', performUndo);
  state.redoButton.addEventListener('click', performRedo);

  // Cmd+Z / Ctrl+Z to undo, Cmd+Shift+Z / Ctrl+Shift+Z (and Ctrl+Y, the
  // common Windows alternative) to redo. Only while the Workspace screen is
  // actually visible, so it doesn't fire from the Gallery or New Canvas.
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    if (document.getElementById('screen-workspace').classList.contains('hidden')) return;

    if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      performRedo();
    } else if (key === 'z') {
      e.preventDefault();
      performUndo();
    }
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
 * Redraws the entire accumulated Brush drag path from the pre-drag backup.
 * Only places at path indices where `index % state.brushSpacing === 0` —
 * the path is already a dense pixel-by-pixel interpolation, so
 * index-stepping approximates "every N pixels" well without tracking
 * cumulative distance. Index 0 always satisfies the check, so a stationary
 * tap always places exactly one brush regardless of Spacing. Rainbow's hue
 * counter and Rotation's angle counter only advance for placements that
 * actually happen (not skipped ones), so Spacing doesn't change their
 * cycle rate.
 */
function redrawBrushPath() {
  state.strokeEngine.data.set(state.strokeBackup);
  let placementIndex = 0;
  state.brushPath.forEach((point, i) => {
    if (i % state.brushSpacing !== 0) return;
    const rgba = state.brushRainbow ? rainbowColor(placementIndex * RAINBOW_HUE_STEP) : state.currentColor;
    const angle = placementIndex * state.brushRotationStep;
    placeBrush(state.strokeEngine, point.x, point.y, state.currentBrush, rgba, angle);
    placementIndex++;
  });
  clipToSelection(state.strokeEngine, state.strokeBackup, state.selection);
}

/**
 * Wires the Workspace tab bar, palette, brushes row, Layers panel, Canvas
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
    currentBrush: allBrushes[0],
    brushRainbow: false,
    brushSpacing: 1,
    brushRotationStep: 0,
    brushPath: [],
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

  // The DOM (tool buttons, palette/brush swatches, pixel-perfect toggle) is
  // bound once and reused across every project, but each freshly-opened
  // project's `state` above resets to defaults — without this, opening a
  // different project left the *previous* project's tool/color highlighted
  // even though it no longer applied (e.g. the state was reset but a
  // stale-highlighted swatch/tool suggested otherwise).
  toolButtons.forEach((b) => b.classList.toggle('active', b.dataset.tool === state.currentTool));
  paletteRow.querySelectorAll('.palette-swatch').forEach((s, i) => s.classList.toggle('active', i === 0));
  renderBrushesPanel();
  brushesPanel.classList.toggle('hidden', state.currentTool !== 'brush');
  closeBrushEditor();
  document.getElementById('brush-spacing').value = '1';
  document.getElementById('brush-rotation').value = '0';
  pixelPerfectToggle.classList.remove('active');

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

      // Captured once per stroke/drag: if the active layer changes mid-
      // gesture (shouldn't normally happen, but guards against it), it
      // keeps targeting the layer it started on.
      state.strokeEngine = activeEngine;
      state.strokeBackup = activeEngine.data.slice();

      if (tool === 'brush') {
        if (!isPointInSelection(point, state.selection)) {
          // No pixels change if the drag doesn't even start inside an
          // active selection — same reasoning as Bucket's origin guard.
          state.strokeEngine = null;
          state.strokeBackup = null;
          return;
        }
        state.brushPath = [point];
        redrawBrushPath();
        state.canvasView.render();
        return;
      }

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

      if (tool === 'brush') {
        const last = state.brushPath[state.brushPath.length - 1];
        if (last.x === point.x && last.y === point.y) return;
        // Interpolate so a fast drag that jumps several pixels between
        // move events doesn't skip brush placements along the way.
        const segment = bresenhamLine(last.x, last.y, point.x, point.y);
        for (const p of segment.slice(1)) state.brushPath.push(p);
        redrawBrushPath();
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
      state.brushPath = [];
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
      state.brushPath = [];
      state.dragStart = null;
      state.dragCurrent = null;
    },
  });
}
