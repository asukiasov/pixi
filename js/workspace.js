import { UndoStack } from '../lib/pixel-engine/undo.js';
import { saveProject, renameProject, createCustomBrush, listCustomBrushes, deleteCustomBrush } from './persistence.js';
import { initExport } from './export.js';
import { BRUSHES, placeBrush, rainbowColor, pixelsFromGrid } from './brushes.js';
import { drawRectangle, clipToSelection } from './shape-tools.js';
import { bresenhamLine, strokeFreehandThick } from '../lib/pixel-engine/engine.js';
import { confirmDialog } from './confirm-dialog.js';

const BRUSH_EDITOR_SIZE = 9; // fixed grid size for the custom-brush editor, matches Heart's width

// Color Library image-import sample size and ramp-generator step bounds
// moved to pixi-pro's js/pro/color-library-ui.js (split-pixi-pro-repo)
// alongside their only callers.

const RAINBOW_HUE_STEP = 20; // degrees per brush placed, in Rainbow mode

const PALETTE = [
  '#000000', '#ffffff', '#9d9d9d', '#4a4a4a',
  '#be2633', '#e06f8b', '#ea4f36', '#f7a417',
  '#f2ca30', '#a2ce29', '#3f9337', '#39a6a3',
  '#2ce8f4', '#1a5fb4', '#5843c0', '#8b2fb0',
];

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay'];

/** Pro extension point (split-pixi-pro-repo): exported for pixi-pro's Color Library module. */
export function hexToRgba(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** Inverse of hexToRgba - drops alpha (palette swatches and the native
 * <input type="color"> are always fully opaque 6-digit hex). Pro
 * extension point (split-pixi-pro-repo): exported for pixi-pro's Color
 * Library module. */
export function rgbaToHex(rgba) {
  return (
    '#' +
    [rgba[0], rgba[1], rgba[2]]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** #rgb or #rrggbb, with or without the leading #. */
const HEX_COLOR_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

function normalizeHex(value) {
  if (!HEX_COLOR_RE.test(value)) return null;
  let hex = value.startsWith('#') ? value.slice(1) : value;
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return `#${hex.toLowerCase()}`;
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

/**
 * Given a drag's start point and its current (unconstrained) point,
 * returns a current point clamped so the resulting rect is a square -
 * the larger of the two deltas wins, in whichever direction the drag is
 * already heading. Used for the Rectangle tool's Shift-to-constrain.
 */
function squareDragCurrent(start, current) {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = dx < 0 ? -1 : 1;
  const sy = dy < 0 ? -1 : 1;
  return { x: start.x + sx * side, y: start.y + sy * side };
}

/**
 * Whether a Rectangle/Selection drag should be constrained to a square -
 * either Shift is held (desktop), or the persistent "1:1 proportion"
 * toggle is on (touchscreens, which have no Shift key - see
 * #square-constraint-toggle). Either one is enough.
 */
function isSquareConstrained() {
  return shiftHeld || state.squareConstraint;
}

// computeLayerMarkState (Layers panel multi-select marking, for
// merge-layers) moved to pixi-pro (split-pixi-pro-repo) - see that
// repo's test suite for its coverage.

// Module-level state, not per-call: the Workspace screen is a singleton in
// this app (one workspace <canvas>), reused across every project the user
// opens or creates in a session. DOM listeners are bound once per `root`
// (not just once ever - found by code review while building the mount
// API, task 3.1: with a fixed one-shot flag, mounting with a different
// root after the standalone app - or a mount/destroy/re-mount cycle -
// left every one-shot-bound element wired to the FIRST root's now-
// detached DOM); repeat calls with the *same* root just rebind state to
// the new project/layer stack, as before.
let state = null;
let domBoundRoot = null;

// Embeddable-editor-api (Phase 3): whether bindDomOnce()'s `document`-level
// listeners (as opposed to its root-scoped element listeners, which
// legitimately need rebinding whenever `root` changes) have ever been
// registered. Found via lib/pixi.js's repeated mount()/destroy() Playwright
// smoke test: these listeners all read the shared module-level `root`/
// `state` (reassigned on every initWorkspace() call) rather than closing
// over a specific call's local root/state, so a single copy of each
// already tracks whichever instance is current - registering another copy
// per distinct `root` (bindDomOnce's normal per-root gate) only leaves
// stale duplicates permanently attached to `document`, since nothing ever
// unmounts a document listener when its owning root is destroyed. Two
// duplicates of the same idempotent handler firing on one real keypress
// isn't itself the corruption (both read the same live state and agree);
// the actual damage seen was a `document.querySelector`-vs-`root.
// querySelector('#screen-workspace')` crash (fixed separately) combined
// with this duplication multiplying every commit-triggering shortcut's
// effect. Gated separately from `domBoundRoot` so it stays true forever
// once bound, regardless of how many distinct roots come and go.
let globalListenersBound = false;
// Tracked so bindDomOnce() can swap these two out per-root (see their
// call site) rather than bind-once-ever like globalListenersBound's group.
let colorPickerOutsideClickHandler = null;
let colorPickerEscapeHandler = null;
// Tracked independently of any single event, since Shift can be pressed/
// released mid-drag - the Rectangle and Selection tools check this on
// every move.
let shiftHeld = false;
// Layers panel marking (markedLayerIds/lastMarkClickedLayerId/
// clearLayerMarks) moved to pixi-pro's js/pro/layers-ui.js
// (split-pixi-pro-repo) alongside the rest of the Layers panel.
let squareConstraintPanel = null;
let squareConstraintToggle = null;
let exportControls = null;
let toolButtons = null;
let paletteRow = null;
let brushesPanel = null;
let brushesPanelGrid = null;
let deleteBrushButton = null;
let rightSidebar = null;
let rightSidebarToggle = null;
let foregroundSwatchEl = null;
let backgroundSwatchEl = null;

let zoomReadout = null;
let pencilOptionsPanel = null;

// Embeddable-editor-api (Phase 3): the DOM root every workspace element
// lookup below resolves against, instead of the bare `document` this file
// used to assume. Defaults to `document` so the standalone app (its
// markup lives directly in index.html's <body>) is unaffected; a mounted
// instance passes its own host container's cloned Workspace markup here
// (see lib/pixi.js). Module-level, not per-instance - per design.md's
// scoping decision, this supports one active Workspace instance at a
// time (standalone app, or a single mounted instance), not multiple
// simultaneous instances; mounting a second instance while one is active
// is unsupported for now.
let root = document;

// All available brushes: the built-ins plus whatever's been loaded from
// IndexedDB. Module-level, not per-project — brushes are global, not
// scoped to one project (see the "Custom brushes persist across
// projects" requirement).
let allBrushes = [...BRUSHES];

/** Pro extension point (split-pixi-pro-repo): read access to the current project's LayerStack, so pixi-pro's Layers panel can call its (already-public) add/delete/reorder/etc. methods directly. */
export function getLayerStack() {
  return state.layerStack;
}

/** Pro extension point: re-renders the canvas (e.g. after a Layers panel operation), same as calling commit() but without an undo snapshot/autosave. */
export function renderCanvas() {
  state.canvasView.render();
}

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
 *
 * Also the `instance.on('change', ...)` choke point (embeddable-integration
 * -api task 3.5): every call site here (commit(), performUndo(),
 * performRedo()) is already "a committed drawing action changed the
 * image", the exact granularity the "Change notifications" spec
 * requirement asks for - so `state.onChange()` fires here instead of
 * duplicating that "what counts as a commit" decision at each call site.
 * Called synchronously, before the `await`s below, so a host's change
 * handler runs immediately rather than waiting on an IndexedDB write it
 * has no reason to depend on (matches autoSave()'s own fire-and-forget
 * framing above).
 */
async function autoSave() {
  state.onChange();
  const thumbnail = await state.layerStack.toPNGBlob();
  await saveProject(state.projectId, state.layerStack, thumbnail);
}

/**
 * Pro extension point (split-pixi-pro-repo): called at the end of commit
 * (below) - e.g. so pixi-pro's Layers panel can refresh a layer's
 * thumbnail, which only updates on a full re-render, unlike the live
 * canvas. No-op when no Pro module is present. A single chokepoint here
 * rather than a call at every commit() call site - every commit means
 * content changed, so a stale thumbnail is always possible.
 */
let afterCommitHook = null;
export function registerAfterCommit(fn) {
  afterCommitHook = fn;
}

export function commit() {
  state.undoStack.push(state.layerStack.snapshot());
  updateUndoRedoButtons();
  autoSave();
  if (afterCommitHook) afterCommitHook();
}

/**
 * Pro extension point: called at the end of performUndo/performRedo
 * (below) - e.g. so pixi-pro's Layers panel can clear its merge marks
 * (restored indices may no longer match what was marked) and refresh
 * itself. No-op when no Pro module is present.
 */
let afterUndoRedoHook = null;
export function registerAfterUndoRedo(fn) {
  afterUndoRedoHook = fn;
}

/** Shared by the Undo button and the Cmd/Ctrl+Z keyboard shortcut. */
function performUndo() {
  const snapshot = state.undoStack.undo();
  if (snapshot) {
    state.layerStack.restore(snapshot);
    state.canvasView.render();
    if (afterUndoRedoHook) afterUndoRedoHook();
    autoSave();
  }
  updateUndoRedoButtons();
}

/**
 * Pro extension point: registers the Cmd/Ctrl+E merge-layers shortcut's
 * handler (merge-layers is entirely Pro-only - see
 * js/pro/layers-ui.js's mergeMarkedOrActiveDown in pixi-pro). A no-op
 * keypress when no Pro module is present.
 */
let mergeShortcutHook = null;
export function registerMergeShortcut(fn) {
  mergeShortcutHook = fn;
}

/** Shared by the Redo button and the Cmd/Ctrl+Shift+Z (or Ctrl+Y) shortcut. */
function performRedo() {
  const snapshot = state.undoStack.redo();
  if (snapshot) {
    state.layerStack.restore(snapshot);
    state.canvasView.render();
    if (afterUndoRedoHook) afterUndoRedoHook();
    autoSave();
  }
  updateUndoRedoButtons();
}

function colorForCurrentTool() {
  return state.currentTool === 'eraser' ? [0, 0, 0, 0] : state.foregroundColor;
}

/**
 * Pro extension point (split-pixi-pro-repo): `pixi-pro` registers a color-
 * sequence provider here (e.g. Color Library sequence, which used to
 * live directly in this file, checking state.colorLibrarySequence
 * against module-scoped colorPalettes/activePaletteId - see that repo's
 * js/pro/color-library-ui.js). `fn(index)` returns an rgba for the
 * `index`-th placement, or a falsy value to fall through to the plain
 * foreground color. No-op passthrough when no Pro module is present.
 */
let colorSequenceProvider = null;
export function registerColorSequenceProvider(fn) {
  colorSequenceProvider = fn;
}

/**
 * Pro extension point: called whenever Rainbow is selected, so a
 * registered Color Library sequence toggle (mutually exclusive with
 * Rainbow) can turn itself off. No-op when no Pro module is present.
 */
let disableColorLibrarySequenceHook = null;
export function registerDisableColorLibrarySequence(fn) {
  disableColorLibrarySequenceHook = fn;
}

/** Pro extension point: lets a registered Color Library sequence toggle turn Rainbow back off, the same mutual-exclusivity relationship in reverse. */
export function disableRainbow() {
  state.brushRainbow = false;
}

/**
 * Resolves the color for the `index`-th pixel/placement of a cycling
 * stroke - Rainbow (hue-stepped), a registered Pro color-sequence
 * provider (e.g. Color Library sequence), or the plain foreground color,
 * whichever applies. Shared by Pencil/Eraser's `pencilOrEraserApplyPixel`
 * and the Brush tool's `redrawBrushPath` so every cycling mode behaves
 * identically everywhere it's offered, not parallel implementations that
 * could drift.
 */
function colorForSequenceIndex(index) {
  if (state.brushRainbow) return rainbowColor(index * RAINBOW_HUE_STEP);
  const provided = colorSequenceProvider ? colorSequenceProvider(index) : null;
  if (provided) return provided;
  return state.foregroundColor;
}

/**
 * Pro extension point (split-pixi-pro-repo): `pixi-pro` registers opacity-
 * aware paint/erase here (e.g. Pencil/Eraser's Opacity setting, which used
 * to live directly in this file as PixelEngine's setPixelBlended/
 * erasePixelBlended - see that repo's js/pro/pencil-opacity.js for the
 * blending math). No-op passthrough (plain overwrite / full erase, i.e.
 * always-100%-opacity) when no Pro module is present.
 */
let blendedPaint = null;
let blendedErase = null;
export function registerBlendedPaint(fn) {
  blendedPaint = fn;
}
export function registerBlendedErase(fn) {
  blendedErase = fn;
}
function paintPixel(engine, x, y, rgba) {
  return blendedPaint ? blendedPaint(engine, x, y, rgba) : engine.setPixel(x, y, rgba);
}
function erasePixel(engine, x, y) {
  return blendedErase ? blendedErase(engine, x, y) : engine.setPixel(x, y, [0, 0, 0, 0]);
}

/**
 * Returns the per-pixel operation strokeFreehandThick should call for the
 * current tool: Pencil paints the draw color, Eraser erases (both via
 * paintPixel/erasePixel above, Pro-overridable for opacity blending).
 * Shared by onDrawStart and onDrawMove so the two can't drift apart.
 *
 * Exception (2g-background-layer): erasing the Background layer reveals
 * state.backgroundColor instead of producing transparency - checked once
 * here, against the *active* layer at the point the stroke starts (the
 * same layer `engine` already targets, per this function's callers), not
 * re-checked per pixel - a layer's isBackground can't change mid-stroke.
 * Implemented as a paintPixel with the Background color, not a new
 * alpha-manipulation op - it's exactly Pencil-style compositing with a
 * different source color (see design.md).
 */
function pencilOrEraserApplyPixel(engine) {
  if (state.currentTool === 'eraser') {
    if (state.layerStack.getActiveLayer()?.isBackground) {
      return (x, y) => paintPixel(engine, x, y, state.backgroundColor);
    }
    return (x, y) => erasePixel(engine, x, y);
  }
  // Rainbow and any registered Pro color-sequence provider (e.g. Color
  // Library sequence) both cycle per unique pixel placed, same as Brush -
  // the index strokeFreehandThick now passes is the pixel's order among
  // unique placements (not raw path position), so Spacing-style skips
  // don't exist here but dedup-skipped pixels still don't throw off the
  // cycle. colorForSequenceIndex itself falls back to the plain
  // foreground color when neither applies, so this can call it
  // unconditionally rather than special-casing that fallback here too.
  return (x, y, index) => paintPixel(engine, x, y, colorForSequenceIndex(index));
}

/**
 * Pro extension point (split-pixi-pro-repo): `pixi-pro` registers a
 * transform here to wrap Pencil/Eraser/Brush's `applyPixel(x, y, index)`
 * callback before pixels are set - e.g. symmetry/mirror drawing, which
 * used to live directly in this file (see design.md's "Extraction before
 * addition" decision for why a hook lives here instead). No-op passthrough
 * when no Pro module is present. `registerApplyPixelTransform`'s `fn` gets
 * `(applyPixel, engine)` and must return a same-shaped `applyPixel`
 * (`index` is a placement-order counter for Rainbow/Color-Library-sequence
 * - see pencilOrEraserApplyPixel - and must be preserved, not incremented,
 * across e.g. mirrored copies of one placement).
 */
let applyPixelTransform = null;
export function registerApplyPixelTransform(fn) {
  applyPixelTransform = fn;
}
function withProPixelTransform(applyPixel, engine) {
  return applyPixelTransform ? applyPixelTransform(applyPixel, engine) : applyPixel;
}

function updateSelectionControls() {
  state.selectionControlsEl.classList.toggle('hidden', !state.selection);
}

/**
 * Clears the active selection, if any - shared by the "Clear selection"
 * button, Escape, and Cmd/Ctrl+D, so all three stay in sync by
 * construction rather than duplicating this three-line sequence.
 */
function clearSelection() {
  if (!state.selection) return;
  state.selection = null;
  state.canvasView.setSelectionRect(null);
  updateSelectionControls();
}

// buildLayerThumbnailCanvas/syncLayersPanelToolbar (Layers panel
// rendering) moved to pixi-pro's js/pro/layers-ui.js
// (split-pixi-pro-repo).

function setRightSidebarVisible(visible) {
  rightSidebar.classList.toggle('right-sidebar-collapsed', !visible);
  rightSidebar.inert = !visible;
  rightSidebarToggle.classList.toggle('active', visible);
}

// syncLayersCollapse/renderLayersPanel/buildLayerRow (the Layers
// panel itself) moved to pixi-pro's js/pro/layers-ui.js
// (split-pixi-pro-repo) - see that history for prior art.


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

// loadColorPalettes/syncColorLibraryCollapse/renderColorLibraryPanel
// (Color Library panel rendering) moved to pixi-pro's
// js/pro/color-library-ui.js (split-pixi-pro-repo) - see that history
// for prior art.

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

/** Pro extension point (split-pixi-pro-repo): the Brush editor's current grid size. */
export function getBrushEditorSize() {
  return { width: brushEditorWidth, height: brushEditorHeight };
}

// referenceImageSourceImage/referenceImageSmoothing (the reference image
// layer's own state) moved to pixi-pro's js/pro/layers-ui.js
// (split-pixi-pro-repo) alongside the rest of the Layers panel.

/**
 * Pro extension point (split-pixi-pro-repo): overwrites brushEditorGridState
 * and the grid's DOM 'on' classes with `grid` (same grid[y][x] boolean
 * shape as makeEmptyBrushEditorGrid). Used by `pixi-pro`'s Brush editor
 * "Import from image" (used to live directly in this file as
 * applyBrushEditorSourceImage, thresholding a decoded image via
 * js/brush-import.js's thresholdToGrid - see that repo's
 * js/pro/brush-import.js) to apply its result, including on every
 * subsequent width/height change - see bindBrushEditorOnce's width/
 * height 'change' listeners, which pixi-pro adds its own to re-derive
 * from its own remembered source image. Assumes rebuildBrushEditorGrid()
 * already built the DOM cells at the current dimensions.
 */
export function setBrushEditorGrid(grid) {
  brushEditorGridState = grid;
  const gridEl = root.querySelector('#brush-editor-grid');
  gridEl.querySelectorAll('.brush-editor-cell').forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    cell.classList.toggle('on', brushEditorGridState[y][x]);
  });
}

/** (Re)builds the editor grid's cells to match brushEditorWidth x brushEditorHeight, clearing any painted pixels. */
function rebuildBrushEditorGrid() {
  const grid = root.querySelector('#brush-editor-grid');
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
  const widthInput = root.querySelector('#brush-editor-width');
  const heightInput = root.querySelector('#brush-editor-height');
  const maxWidth = state.layerStack.width;
  const maxHeight = state.layerStack.height;
  widthInput.max = String(maxWidth);
  heightInput.max = String(maxHeight);
  brushEditorWidth = clampBrushEditorDimension(BRUSH_EDITOR_SIZE, maxWidth);
  brushEditorHeight = clampBrushEditorDimension(BRUSH_EDITOR_SIZE, maxHeight);
  widthInput.value = String(brushEditorWidth);
  heightInput.value = String(brushEditorHeight);
  root.querySelector('#brush-editor-name').value = '';
  rebuildBrushEditorGrid();
  root.querySelector('#brush-editor-panel').classList.remove('hidden');
}

function closeBrushEditor() {
  root.querySelector('#brush-editor-panel').classList.add('hidden');
}

/**
 * Wires the editor's width/height inputs and paint/erase-by-drag on the
 * grid. Listens on the grid container (not per-cell pointerenter) and
 * resolves the cell under the pointer via elementFromPoint on every move —
 * touch pointers implicitly capture to their initial target element, so
 * pointerenter would never fire on sibling cells during a touch drag.
 */
function bindBrushEditorOnce() {
  const grid = root.querySelector('#brush-editor-grid');
  const nameInput = root.querySelector('#brush-editor-name');
  const widthInput = root.querySelector('#brush-editor-width');
  const heightInput = root.querySelector('#brush-editor-height');
  const clearButton = root.querySelector('#brush-editor-clear');
  const cancelButton = root.querySelector('#brush-editor-cancel');
  const saveButton = root.querySelector('#brush-editor-save');

  // Changing size re-grids from scratch - a brand-new brush each time.
  // (Pro's "Import from image", if present, adds its own listener here
  // too - see setBrushEditorGrid - to re-pixelate from its remembered
  // source at the new size instead, after this one clears the grid.)
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
    // Clear is pure "blank the grid" (design.md's decision). Pro's own
    // Import module, if present, adds its own listener on this same
    // button to forget its remembered source image too, so a resize
    // after Clear doesn't keep re-pixelating from a stale import.
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

const CONFETTI_COLORS = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2'];

// MAGIC_PALETTES (Color Library's "magic palette" easter egg names/colors)
// moved to pixi-pro's js/pro/color-library-ui.js (split-pixi-pro-repo) -
// it still uses matrixRain/confettiBurst below (both exported), the same
// shared decorative helpers Standard's own Konami code
// (bindKonamiCode) and Export celebration (celebrateExport) use.

const MATRIX_RAIN_CHARS = '01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ'.split('');
const MATRIX_RAIN_COLUMNS = 14;

// Checked once, like js/app.js's platform detection - the OS-level
// reduced-motion preference isn't expected to change mid-session. Guarded
// for `window` being undefined: this runs at module-eval time (not inside
// a function), so it fires the instant anything imports this module -
// including test/workspace.test.js, which imports js/workspace.js
// directly under plain Node with no DOM/browser shim. (Unlike js/theme.js,
// which only touches `window` inside functions its tests can stub
// `globalThis.window` for before calling - not an option for a reference
// that runs before any test code gets to execute.)
// CFIX-4 (code-standards red-team): existence-checked but not
// try/caught - matchMedia() itself can throw in some restrictive/
// sandboxed environments even when it exists, same risk this file's own
// comment already called out for `window` being undefined.
let prefersReducedMotion = false;
try {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
} catch {
  // matchMedia present but throwing - default to false (motion allowed).
}

/**
 * The "matrix" magic palette's own effect (see MAGIC_PALETTES) - a brief
 * cascade of falling green characters instead of the shared confetti
 * burst every other magic palette uses. Self-removing, no state. Skipped
 * entirely under prefers-reduced-motion, since it's purely decorative.
 */
export function matrixRain() {
  if (prefersReducedMotion) return;
  const container = document.createElement('div');
  container.className = 'matrix-rain';
  document.body.appendChild(container);
  for (let i = 0; i < MATRIX_RAIN_COLUMNS; i++) {
    const column = document.createElement('div');
    column.className = 'matrix-rain-column';
    column.style.left = `${(i / (MATRIX_RAIN_COLUMNS - 1)) * 100}%`;
    column.style.animationDelay = `${Math.random() * 0.6}s`;
    column.style.animationDuration = `${1.4 + Math.random() * 0.8}s`;
    let text = '';
    for (let j = 0; j < 18; j++) {
      text += MATRIX_RAIN_CHARS[Math.floor(Math.random() * MATRIX_RAIN_CHARS.length)] + '\n';
    }
    column.textContent = text;
    container.appendChild(column);
  }
  // Longest column's animation-duration (2.2s) plus its animation-delay
  // (up to 0.6s) - long enough for every column to finish before cleanup.
  setTimeout(() => container.remove(), 2800);
}

/** Shared confetti burst, from a given screen point, with a configurable piece count/spread. */
export function confettiBurst(originX, originY, count, maxDistance) {
  const container = document.createElement('div');
  container.className = 'confetti-burst';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const angle = Math.random() * Math.PI * 2;
    const distance = maxDistance * 0.4 + Math.random() * maxDistance * 0.6;
    piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    piece.style.setProperty('--dy', `${Math.sin(angle) * distance - 40}px`);
    piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    piece.style.animationDelay = `${Math.random() * 0.15}s`;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 1600);
}

/**
 * A little celebration for finishing a piece - bursts from the Export
 * button, cleans up after itself. Skipped under prefers-reduced-motion,
 * since it's purely decorative.
 */
function celebrateExport(originEl) {
  if (prefersReducedMotion) return;
  const origin = originEl.getBoundingClientRect();
  confettiBurst(origin.left + origin.width / 2, origin.top + origin.height / 2, 28, 220);
}

const KONAMI_SEQUENCE = [
  'arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a',
];
let konamiProgress = 0;

/** You know what this is if you know what this is. */
function bindKonamiCode() {
  document.addEventListener('keydown', (e) => {
    if (root.querySelector('#screen-workspace').classList.contains('hidden')) return;
    const key = e.key.toLowerCase();
    if (key === KONAMI_SEQUENCE[konamiProgress]) {
      konamiProgress++;
      if (konamiProgress === KONAMI_SEQUENCE.length) {
        konamiProgress = 0;
        for (let burst = 0; burst < 3; burst++) {
          setTimeout(() => {
            confettiBurst(window.innerWidth * (0.25 + burst * 0.25), window.innerHeight * 0.4, 40, 320);
          }, burst * 200);
        }
      }
    } else {
      konamiProgress = key === KONAMI_SEQUENCE[0] ? 1 : 0;
    }
  });
}

/**
 * Wires a single shared tooltip element (positioned via JS, not CSS
 * ::after — see style.css's .tool-tooltip comment for why) to every
 * [data-tooltip] element in the tools sidebar. Shows after a short delay
 * on hover/focus, to the right of the button; hides immediately on
 * leave/blur.
 *
 * Delegated on document (mouseover/mouseout, not a per-element
 * querySelectorAll+addEventListener pass) so it also covers elements
 * that don't exist yet at call time - e.g. pixi-pro's Layers panel
 * (split-pixi-pro-repo) tears down and rebuilds its per-row buttons on
 * every render, so a one-time binding would miss them entirely after
 * the first render. mouseenter/mouseleave don't
 * bubble, hence mouseover/mouseout + relatedTarget's closest() check
 * below to still fire only on true enter/leave of a [data-tooltip]
 * element, not every pointer move across its children.
 */
function bindTooltips() {
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'tool-tooltip';
  document.body.appendChild(tooltipEl);

  let showTimer = null;

  function show(target) {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      const text = target.dataset.tooltip;
      if (!text) return;
      // Figma-style: bold name plus the keyboard shortcut (if any) in a
      // dimmer gray, not folded into the name text itself.
      tooltipEl.innerHTML = '';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = text;
      tooltipEl.appendChild(nameSpan);
      if (target.dataset.shortcut) {
        const shortcutSpan = document.createElement('span');
        shortcutSpan.className = 'tool-tooltip-shortcut';
        shortcutSpan.textContent = target.dataset.shortcut;
        tooltipEl.appendChild(shortcutSpan);
      }
      const rect = target.getBoundingClientRect();
      // Top-bar buttons sit close together horizontally - a tooltip to
      // the right would cover the next button - so those show below
      // instead. The vertical tools sidebar keeps showing to the right.
      // .right-sidebar buttons sit near the viewport's right edge, so a
      // tooltip to the right would render partly or fully off-screen -
      // those show to the left instead (see .tool-tooltip.left-side).
      const isTopbar = target.closest('.workspace-topbar') !== null;
      const isRightSidebar = !isTopbar && target.closest('.right-sidebar') !== null;
      tooltipEl.classList.toggle('below', isTopbar);
      tooltipEl.classList.toggle('left-side', isRightSidebar);
      if (isTopbar) {
        tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
        tooltipEl.style.top = `${rect.bottom + 10}px`;
        tooltipEl.style.transform = 'translateX(-50%)';
      } else if (isRightSidebar) {
        // Measured after the content above is set (width depends on the
        // text), so the tooltip's own width is known before positioning.
        const tooltipRect = tooltipEl.getBoundingClientRect();
        tooltipEl.style.left = `${rect.left - tooltipRect.width - 12}px`;
        tooltipEl.style.top = `${rect.top + rect.height / 2}px`;
        tooltipEl.style.transform = 'translateY(-50%)';
      } else {
        tooltipEl.style.left = `${rect.right + 12}px`;
        tooltipEl.style.top = `${rect.top + rect.height / 2}px`;
        tooltipEl.style.transform = 'translateY(-50%)';
      }
      tooltipEl.classList.add('visible');
    }, 300);
  }

  function hide() {
    clearTimeout(showTimer);
    tooltipEl.classList.remove('visible');
  }

  // mouseover/mouseout bubble (mouseenter/mouseleave don't), so one
  // listener on document covers every current and future [data-tooltip]
  // element. relatedTarget is where the pointer came from/is going -
  // only firing show/hide when it's outside the matched element (not a
  // move between its own children) reproduces mouseenter/mouseleave's
  // "true boundary crossing" semantics under delegation.
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target || target.contains(e.relatedTarget)) return;
    show(target);
  });
  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target || target.contains(e.relatedTarget)) return;
    hide();
  });
  // focusin/focusout bubble (focus/blur don't) - same delegation need
  // for keyboard nav onto a [data-tooltip] element.
  document.addEventListener('focusin', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) show(target);
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.closest('[data-tooltip]')) hide();
  });
  // A click (tool switch) shouldn't leave a stale tooltip lingering.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tooltip]')) hide();
  });
}

/**
 * Rebuilds the palette row's swatches from the fixed PALETTE presets
 * plus the Rainbow swatch last. User-added colors now live in the
 * Pro-only Color Library panel (split-pixi-pro-repo), not here.
 */
function renderPaletteRow() {
  paletteRow.innerHTML = '';
  PALETTE.forEach((hex) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'palette-swatch';
    swatch.style.background = hex;
    swatch.dataset.hex = hex.toLowerCase();
    swatch.title = hex;
    swatch.addEventListener('click', () => setForegroundColor(hexToRgba(hex)));
    paletteRow.appendChild(swatch);
  });

  // "Rainbow" lives in the same palette row as a selectable color, mutually
  // exclusive with picking a regular one — not a separate toggle button.
  // Only the Brush tool reads state.brushRainbow; every other tool just
  // keeps using state.foregroundColor, which selecting Rainbow never touches.
  const rainbowSwatch = document.createElement('button');
  rainbowSwatch.type = 'button';
  rainbowSwatch.className = 'palette-swatch rainbow-swatch';
  rainbowSwatch.title = 'Rainbow (Brush tool only)';
  rainbowSwatch.addEventListener('click', () => {
    state.brushRainbow = true;
    if (disableColorLibrarySequenceHook) disableColorLibrarySequenceHook();
    syncActiveSwatch();
  });
  paletteRow.appendChild(rainbowSwatch);

  syncActiveSwatch();
}

/**
 * Pro extension point (split-pixi-pro-repo): called at the end of
 * syncActiveSwatch (below) with the same `(fgHex, isRainbow)` Standard's
 * own palette row uses, so pixi-pro's Color Library grid can highlight
 * its own active swatch too - this used to be a direct colorLibraryGrid
 * reference inline in syncActiveSwatch. No-op when no Pro module is
 * present.
 */
let activeSwatchSyncHook = null;
export function registerActiveSwatchSync(fn) {
  activeSwatchSyncHook = fn;
}

/**
 * Toggles .active on whichever palette swatch (or Rainbow) matches
 * current state. Pro extension point: exported so pixi-pro's Color
 * Library module can re-trigger this (and so its registerActiveSwatchSync
 * hook) after rebuilding its own swatch grid - e.g. after loading
 * palettes or switching the active one - without needing to go through
 * setForegroundColor (which has side effects, like clearing Rainbow,
 * that aren't appropriate for "just re-render the highlight").
 */
export function syncActiveSwatch() {
  const fgHex = rgbaToHex(state.foregroundColor);
  paletteRow.querySelectorAll('.palette-swatch:not(.rainbow-swatch)').forEach((s) => {
    s.classList.toggle('active', !state.brushRainbow && s.dataset.hex === fgHex);
  });
  const rainbowEl = paletteRow.querySelector('.rainbow-swatch');
  if (rainbowEl) rainbowEl.classList.toggle('active', state.brushRainbow);
  if (activeSwatchSyncHook) activeSwatchSyncHook(fgHex, state.brushRainbow);
}

/** Keeps the native color input, hex field, and RGB fields all showing the same color. */
function updateColorPickerInputs(rgba) {
  const hex = rgbaToHex(rgba);
  root.querySelector('#color-picker-native').value = hex;
  root.querySelector('#color-picker-hex').value = hex;
  root.querySelector('#color-picker-r').value = String(rgba[0]);
  root.querySelector('#color-picker-g').value = String(rgba[1]);
  root.querySelector('#color-picker-b').value = String(rgba[2]);
}

function updateFgBgSwatches() {
  foregroundSwatchEl.style.background = rgbaToHex(state.foregroundColor);
  backgroundSwatchEl.style.background = rgbaToHex(state.backgroundColor);
}

/**
 * Sets the foreground color from any source (palette swatch, custom
 * picker, Eyedropper) - the single path every color-pick action goes
 * through, so the picker fields, palette active-state, and FG/BG swatch
 * all stay in sync by construction. Deselects Rainbow, the same way
 * picking a regular color always has. Pro extension point
 * (split-pixi-pro-repo): exported for pixi-pro's Color Library module
 * (its swatch clicks route through this too).
 */
export function setForegroundColor(rgba) {
  state.foregroundColor = rgba;
  state.brushRainbow = false;
  updateColorPickerInputs(rgba);
  updateFgBgSwatches();
  syncActiveSwatch();
}

/** Same idea as setForegroundColor, for the color-picker-popover's Background target. */
function setBackgroundColor(rgba) {
  state.backgroundColor = rgba;
  updateColorPickerInputs(rgba);
  updateFgBgSwatches();
}

// Which swatch the color-picker-popover is currently editing - set when
// it's opened by clicking the Foreground or Background swatch.
let colorPickerTarget = 'foreground';

/**
 * Pro extension point (split-pixi-pro-repo): whichever color the
 * color-picker-popover is currently editing - used by pixi-pro's Color
 * Library module for its "Add to palette"/"Generate ramp" buttons
 * embedded in that (otherwise Standard) popover. addCurrentColorToActivePalette
 * (the function that used to route both those buttons here) moved to
 * pixi-pro's js/pro/color-library-ui.js.
 */
export function getColorPickerCurrentColor() {
  return colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor;
}

/** Routes a picked color (from the native input, hex field, or RGB fields) to whichever swatch opened the popover. */
function applyPickedColor(rgba) {
  if (colorPickerTarget === 'background') {
    setBackgroundColor(rgba);
  } else {
    setForegroundColor(rgba);
  }
}

function openColorPicker(target, anchorEl) {
  colorPickerTarget = target;
  const current = target === 'background' ? state.backgroundColor : state.foregroundColor;

  // Reverted: an earlier version tried to skip this popover on iOS
  // entirely and jump straight to the OS color picker via a scripted
  // .click() on a hidden native <input type="color">. Two attempts at
  // hiding that input (opacity-based, then off-screen-positioned) both
  // failed on real hardware - the picker didn't open at all, worse than
  // the popover it was meant to replace. Reverted to showing the same
  // popover on every platform, including iOS: its own visible native
  // <input type="color"> (#color-picker-native) is a real element a
  // real tap lands on, which reliably opens iOS's native picker with no
  // synthetic-click trickery involved - one extra tap versus the ideal
  // "skip straight to native," but actually works.
  root.querySelector('#color-picker-popover-title').textContent =
    target === 'background' ? 'Background Color' : 'Foreground Color';
  updateColorPickerInputs(current);
  const popover = root.querySelector('#color-picker-popover');
  // Unhide before measuring - .hidden is display:none, which has no box
  // to read a size from.
  popover.classList.remove('hidden');
  const rect = anchorEl.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  const margin = 8;

  // Prefer opening to the right of the anchor; flip to the left if that
  // would run off the right edge (previously it never did this - the
  // popover could render partly or fully off-screen on a narrow window).
  let left = rect.right + 12;
  if (left + popRect.width > window.innerWidth - margin) {
    left = rect.left - popRect.width - 12;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));

  let top = rect.top;
  top = Math.max(margin, Math.min(top, window.innerHeight - popRect.height - margin));

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function closeColorPicker() {
  root.querySelector('#color-picker-popover').classList.add('hidden');
}

// openLayersOpacityPopover/closeLayersOpacityPopover moved to pixi-pro's
// js/pro/layers-ui.js (split-pixi-pro-repo).

/**
 * Wires a panel header (e.g. #layers-panel-header,
 * #color-library-header) for Photoshop-accordion-style collapse: click
 * anywhere on the header row, not just a dedicated icon, to
 * collapse/expand. Ignores clicks landing on an interactive control
 * inside the header (e.g. Color Library's add/delete-palette buttons,
 * Layers' "+ Layer" button) so those keep working normally instead of
 * also toggling collapse. `onToggle` owns updating the underlying state
 * and syncing the DOM (see pixi-pro's Layers/Color Library modules' own
 * syncLayersCollapse/syncColorLibraryCollapse). Pro extension point
 * (split-pixi-pro-repo): exported for reuse there - both panels this
 * doc comment describes are Pro-only, this file has no caller of its
 * own anymore.
 */
export function bindPanelHeaderCollapse(headerEl, onToggle) {
  headerEl.addEventListener('click', (e) => {
    if (e.target.closest('button, select, input')) return;
    onToggle();
  });
  headerEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target !== headerEl) return;
    e.preventDefault();
    onToggle();
  });
}

/**
 * Mouse-wheel adjusts a range slider's value by one step per notch while
 * hovering it, without needing to grab the thumb - common desktop-app
 * slider convention (Photoshop, Figma). Scrolling up increases, down
 * decreases; dispatches a real "input" event so it flows through the
 * slider's existing listener the same as a drag would. preventDefault
 * suppresses the page scroll the wheel would otherwise trigger.
 */
export function bindSliderWheel(slider) {
  slider.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = Number(slider.step) || 1;
    const min = Number(slider.min);
    const max = Number(slider.max);
    const direction = e.deltaY < 0 ? 1 : -1;
    const next = Math.max(min, Math.min(max, Number(slider.value) + direction * step));
    if (next === Number(slider.value)) return;
    slider.value = String(next);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: false });
}

// positionPanelBelow (popover positioning for the Color Library import/
// ramp preview popovers) moved to pixi-pro's js/pro/color-library-ui.js
// (split-pixi-pro-repo) alongside its only two callers.

/**
 * Applies every tool-scoped UI toggle that follows from `state.currentTool`
 * alone (Brushes/pencil-options/square-constraint panel visibility, pan/
 * move cursor mode) - shared by the tool-button click handler (a user
 * switching tools) and `initWorkspace()` (a fresh project's starting
 * tool, task 3.7's `initialTool`), which previously each carried their own
 * copy. Kept in sync as one function after a code-review finding on task
 * 3.7: `initWorkspace()`'s copy had hardcoded a Pencil-is-always-the-
 * starting-tool assumption that silently drifted out of sync with this
 * logic once `initialTool` could be something else - a duplicated copy is
 * exactly the shape that bug already came from, so consolidating it here
 * removes the chance of it recurring for a future tool-scoped panel.
 */
function applyToolScopedUI() {
  brushesPanel.classList.toggle('hidden', state.currentTool !== 'brush');
  // Leaving the Brush tool mid-edit closes the editor rather than
  // leaving it open behind a now-hidden panel.
  if (state.currentTool !== 'brush') closeBrushEditor();
  // Hand tool: single-pointer drag pans the canvas instead of drawing
  // (see CanvasView#setPanMode). Every other tool leaves pan mode off.
  state.canvasView.setPanMode(state.currentTool === 'hand');
  // Move tool: swaps in the CSS `move` cursor while active (see
  // CanvasView#setMoveMode) - purely cosmetic, drag handling itself
  // lives in onDrawStart/onDrawMove/onDrawEnd below.
  state.canvasView.setMoveMode(state.currentTool === 'move');
  // Size/Opacity sliders: shared by Pencil and Eraser, hidden for
  // every other tool - same tool-scoped-visibility pattern as Brushes.
  pencilOptionsPanel.classList.toggle('hidden', state.currentTool !== 'pencil' && state.currentTool !== 'eraser');
  // 1:1 proportion toggle: Rectangle and Selection.
  squareConstraintPanel.classList.toggle(
    'hidden',
    state.currentTool !== 'rectangle' && state.currentTool !== 'selection'
  );
}

function bindDomOnce() {
  toolButtons = root.querySelectorAll('.tool-button[data-tool]');
  paletteRow = root.querySelector('#palette-row');
  brushesPanel = root.querySelector('#brushes-panel');
  const backToGalleryButton = root.querySelector('#back-to-gallery-button');

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.currentTool = button.dataset.tool;
      toolButtons.forEach((b) => b.classList.toggle('active', b === button));
      applyToolScopedUI();
    });
  });

  // bindTooltips()/bindKonamiCode() and every document.addEventListener
  // call below (guarded the same way) are global, not root-scoped - see
  // globalListenersBound's doc comment.
  if (!globalListenersBound) {
    bindTooltips();
    bindKonamiCode();
  }

  // Pencil/Eraser Size - shared slider with live readout (Opacity is
  // Pro-only, see js/pro/pencil-opacity-ui.js in pixi-pro).
  pencilOptionsPanel = root.querySelector('#pencil-options');
  const pencilSizeSlider = root.querySelector('#pencil-size-slider');
  const pencilSizeReadout = root.querySelector('#pencil-size-readout');

  pencilSizeSlider.addEventListener('input', () => {
    const value = Number(pencilSizeSlider.value);
    state.pencilSize = value;
    pencilSizeReadout.textContent = `${value}px`;
  });

  // Mouse wheel adjusts Size by one step per notch while hovering the
  // slider, without needing to grab the thumb - common desktop-app
  // slider convention (Photoshop, Figma).
  bindSliderWheel(pencilSizeSlider);

  // 1:1 proportion toggle - Rectangle and Selection, a persistent
  // touchscreen-friendly equivalent of holding Shift (see
  // isSquareConstrained).
  squareConstraintPanel = root.querySelector('#square-constraint-options');
  squareConstraintToggle = root.querySelector('#square-constraint-toggle');
  squareConstraintToggle.addEventListener('click', () => {
    state.squareConstraint = !state.squareConstraint;
    squareConstraintToggle.classList.toggle('active', state.squareConstraint);
  });

  renderPaletteRow();

  // Custom color picker: native <input type="color"> + hex + RGB fields,
  // in a popover opened by clicking the Foreground or Background swatch
  // (colorPickerTarget tracks which one), all cross-synced through
  // applyPickedColor/updateColorPickerInputs.
  const colorPickerNative = root.querySelector('#color-picker-native');
  const colorPickerHex = root.querySelector('#color-picker-hex');
  const colorPickerCopied = root.querySelector('#color-picker-copied');
  const colorPickerR = root.querySelector('#color-picker-r');
  const colorPickerG = root.querySelector('#color-picker-g');
  const colorPickerB = root.querySelector('#color-picker-b');
  const colorPickerPopover = root.querySelector('#color-picker-popover');

  colorPickerNative.addEventListener('input', () => {
    applyPickedColor(hexToRgba(colorPickerNative.value));
  });

  colorPickerHex.addEventListener('change', () => {
    const normalized = normalizeHex(colorPickerHex.value);
    // Malformed input is ignored (leaves prior state intact) rather than
    // crashing - just resync the field to the last valid color.
    const current = colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor;
    if (!normalized) {
      colorPickerHex.value = rgbaToHex(current);
      return;
    }
    applyPickedColor(hexToRgba(normalized));
  });

  // Double-click the hex field to copy it to the clipboard, with a brief
  // "Copied!" confirmation - doesn't interfere with normal editing
  // (single click/typing still works as usual).
  let copiedTimer = null;
  colorPickerHex.addEventListener('dblclick', () => {
    navigator.clipboard?.writeText(colorPickerHex.value).then(() => {
      colorPickerCopied.classList.remove('hidden');
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => colorPickerCopied.classList.add('hidden'), 1200);
    });
  });

  function applyRgbFields() {
    const clamp = (v) => Math.max(0, Math.min(255, Number(v) || 0));
    applyPickedColor([clamp(colorPickerR.value), clamp(colorPickerG.value), clamp(colorPickerB.value), 255]);
  }
  colorPickerR.addEventListener('change', applyRgbFields);
  colorPickerG.addEventListener('change', applyRgbFields);
  colorPickerB.addEventListener('change', applyRgbFields);

  root.querySelector('#color-picker-close').addEventListener('click', closeColorPicker);

  // Close on outside click/Escape, not just the explicit close button -
  // standard popover behavior. Clicks inside #ramp-preview-row (Pro-only,
  // split-pixi-pro-repo - absent in pixi, hence the `?.`) don't count as
  // "outside" here even though it's a sibling, not a descendant, of
  // #color-picker-popover - it's opened from this popover's own
  // "Generate ramp" button (present only when pixi-pro's Color Library
  // module registers it), so closing the color picker out from under an
  // in-progress ramp preview would be surprising.
  // Unlike the document-level listeners guarded by globalListenersBound
  // above/below, these two close over `colorPickerPopover` - a local,
  // freshly looked-up from `root` on every bindDomOnce() call, not a
  // shared module var - so binding only once-ever would leave them
  // permanently wired to the *first* root's popover. Old copies are
  // removed before adding new ones instead, tracked module-level (see
  // colorPickerOutsideClickHandler/colorPickerEscapeHandler).
  if (colorPickerOutsideClickHandler) document.removeEventListener('pointerdown', colorPickerOutsideClickHandler);
  colorPickerOutsideClickHandler = (e) => {
    if (colorPickerPopover.classList.contains('hidden')) return;
    if (colorPickerPopover.contains(e.target)) return;
    if (e.target.closest('#foreground-swatch, #background-swatch')) return;
    if (root.querySelector('#ramp-preview-row')?.contains(e.target)) return;
    closeColorPicker();
  };
  document.addEventListener('pointerdown', colorPickerOutsideClickHandler);

  if (colorPickerEscapeHandler) document.removeEventListener('keydown', colorPickerEscapeHandler);
  colorPickerEscapeHandler = (e) => {
    if (e.key === 'Escape' && !colorPickerPopover.classList.contains('hidden')) closeColorPicker();
  };
  document.addEventListener('keydown', colorPickerEscapeHandler);

  // Foreground/Background: click either swatch to open the popover
  // targeting it; swap and reset-to-black/white.
  foregroundSwatchEl = root.querySelector('#foreground-swatch');
  backgroundSwatchEl = root.querySelector('#background-swatch');

  foregroundSwatchEl.addEventListener('click', () => openColorPicker('foreground', foregroundSwatchEl));
  backgroundSwatchEl.addEventListener('click', () => openColorPicker('background', backgroundSwatchEl));

  root.querySelector('#fg-bg-swap').addEventListener('click', () => {
    const swapped = state.backgroundColor;
    state.backgroundColor = state.foregroundColor;
    state.foregroundColor = swapped;
    updateColorPickerInputs(colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor);
    updateFgBgSwatches();
    syncActiveSwatch();
  });

  root.querySelector('#fg-bg-reset').addEventListener('click', () => {
    state.foregroundColor = hexToRgba('#000000');
    state.backgroundColor = hexToRgba('#ffffff');
    updateColorPickerInputs(colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor);
    updateFgBgSwatches();
    syncActiveSwatch();
  });

  brushesPanelGrid = root.querySelector('#brushes-panel-grid');
  deleteBrushButton = root.querySelector('#delete-brush-button');
  const addBrushButton = root.querySelector('#add-brush-button');
  const brushSpacingInput = root.querySelector('#brush-spacing');
  const brushRotationInput = root.querySelector('#brush-rotation');

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
    const proceed = await confirmDialog({
      title: 'Delete brush?',
      message: `Delete "${custom.name}"? This can't be undone.`,
    });
    if (!proceed) return;
    await deleteCustomBrush(custom.id);
    await loadCustomBrushes();
    state.currentBrush = allBrushes[0];
    renderBrushesPanel();
  });

  addBrushButton.addEventListener('click', () => openBrushEditor());
  bindBrushEditorOnce();

  // Color Library panel (add-current-color/add-palette/import/ramp-
  // generator/delete, and the import-preview/ramp-preview popovers) moved
  // to pixi-pro's js/pro/color-library-ui.js (split-pixi-pro-repo) -
  // see that history for prior art.

  // Pro-only (split-pixi-pro-repo): Layers panel (collapse-to-header,
  // toolbar, opacity popover) wiring moved to pixi-pro's
  // js/pro/layers-ui.js.

  // Whole right-sidebar visibility toggle (Color Library + Brushes +
  // Layers together), independent of each panel's own collapsed state
  // above - VSCode "toggle sidebar" style.
  rightSidebar = root.querySelector('#right-sidebar');
  rightSidebarToggle = root.querySelector('#right-sidebar-toggle');
  rightSidebarToggle.addEventListener('click', () => {
    state.rightSidebarVisible = !state.rightSidebarVisible;
    setRightSidebarVisible(state.rightSidebarVisible);
  });

  // Zoom: +/- buttons and the three presets all just call the CanvasView
  // API directly - it owns all the actual zoom/pan math (see design.md).
  zoomReadout = root.querySelector('#zoom-readout');
  root.querySelector('#zoom-out-button').addEventListener('click', () => state.canvasView.zoomStep(-1));
  root.querySelector('#zoom-in-button').addEventListener('click', () => state.canvasView.zoomStep(1));
  root.querySelector('#zoom-preset-100').addEventListener('click', () => state.canvasView.setZoomPreset('100'));
  root.querySelector('#zoom-preset-fit').addEventListener('click', () => state.canvasView.setZoomPreset('fit'));
  root.querySelector('#zoom-preset-fill').addEventListener('click', () => state.canvasView.setZoomPreset('fill'));

  state.undoButton.addEventListener('click', performUndo);
  state.redoButton.addEventListener('click', performRedo);

  // Cmd+Z / Ctrl+Z to undo, Cmd+Shift+Z / Ctrl+Shift+Z (and Ctrl+Y, the
  // common Windows alternative) to redo; Cmd/Ctrl +/- (and the unshifted
  // "=" key "+" lives on) to zoom in/out. Only while the Workspace screen
  // is actually visible, so none of this fires from the Gallery or New
  // Canvas screens.
  // Every document.addEventListener below reads only module-level `root`/
  // `state`/`toolButtons`/`mergeShortcutHook`/`shiftHeld` (all reassigned
  // fresh on the calls above/in initWorkspace), never a value local to
  // this specific bindDomOnce() call - so one persistent copy of each
  // always acts on whichever root/state is current, and binding only
  // once-ever (globalListenersBound) is correct here, unlike the
  // colorPickerPopover pair above. See globalListenersBound's doc comment.
  if (!globalListenersBound) {
    document.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (root.querySelector('#screen-workspace').classList.contains('hidden')) return;
      const key = e.key.toLowerCase();

      if (key === 'z' || key === 'y') {
        e.preventDefault();
        if (key === 'y' || (key === 'z' && e.shiftKey)) {
          performRedo();
        } else {
          performUndo();
        }
        return;
      }

      if (key === '=' || key === '+') {
        e.preventDefault();
        state.canvasView.zoomStep(1);
        return;
      }
      if (key === '-' || key === '_') {
        e.preventDefault();
        state.canvasView.zoomStep(-1);
        return;
      }

      // Cmd/Ctrl+D: deselect, same as Escape below - the common shortcut
      // for this in Photoshop and similar tools. preventDefault matters
      // here specifically: Ctrl/Cmd+D is the browser's "bookmark this
      // page" shortcut otherwise.
      if (key === 'd') {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Cmd/Ctrl+E: merge layers - Pro-only (registerMergeShortcut above),
      // a no-op keypress in Standard.
      if (key === 'e') {
        e.preventDefault();
        if (mergeShortcutHook) mergeShortcutHook();
      }
    });

    // Escape clears the active selection, regardless of which tool is
    // current — unlike the shortcuts above, this one takes no modifier key.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (root.querySelector('#screen-workspace').classList.contains('hidden')) return;
      clearSelection();
    });

    // Shift constrains the Rectangle tool to a square while held - tracked
    // independently since it can toggle mid-drag, read from onDrawMove.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') shiftHeld = true;
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') shiftHeld = false;
    });

    // Bare-letter tool shortcuts (P/E/G/B/L/R/M/H — see each button's
    // data-shortcut), Figma/Photoshop-style: no modifier key, so they must
    // NOT fire while the user is typing into a text field (layer name,
    // brush name, hex input, etc.) or they'd hijack every keystroke.
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (root.querySelector('#screen-workspace').classList.contains('hidden')) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      const button = [...toolButtons].find((b) => b.dataset.shortcut?.toLowerCase() === key);
      if (!button) return;
      e.preventDefault();
      button.click();
    });
  }

  exportControls = initExport({
    root,
    getProjectName: () => state.projectName,
    async onExport({ scale, format, skipBackground, filename }) {
      const blob = await state.layerStack.toPNGBlob({ scale, format, skipBackground });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      celebrateExport(state.exportButton);
    },
  });

  // Every action auto-saves, so there's nothing to lose by leaving — no
  // confirmation prompt here (unlike Phase 1/2a's "New" control).
  backToGalleryButton.addEventListener('click', () => {
    state.onRequestGallery?.();
  });

  // Pro-only (split-pixi-pro-repo): "Add layer" and "Add reference image"
  // wiring moved to pixi-pro's js/pro/layers-ui.js.

  state.selectionClearButton.addEventListener('click', clearSelection);

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
    commit(); // registerAfterCommit's hook (if any) handles a stale Layers thumbnail
  });

  globalListenersBound = true;
}

/**
 * Pro extension points (split-pixi-pro-repo): Canvas Settings (rename/
 * resize/rotate) moved to `pixi-pro` wholesale - `js/canvas-settings.js`'s
 * UI, and its onResize/onRotate/onRename callback bodies, used to live
 * directly in this file. These four exports are what `pixi-pro`'s own
 * canvas-settings-ui.js calls instead: the resize/rotate/rename logic
 * itself (which needs `state`, `commit()`, `updateSelectionControls()` -
 * all workspace-internal) stays here unchanged, only its UI trigger moved.
 */
export function resizeCanvas(width, height) {
  state.layerStack.resize(width, height);
  state.canvasView.resetView();
  state.canvasView.render();
  // A resize invalidates any prior selection's coordinates.
  state.selection = null;
  state.canvasView.setSelectionRect(null);
  updateSelectionControls();
  commit();
}

export function rotateCanvas(direction) {
  state.layerStack.rotate90(direction);
  state.canvasView.resetView();
  state.canvasView.render();
  state.selection = null;
  state.canvasView.setSelectionRect(null);
  updateSelectionControls();
  commit();
}

export function renameCurrentProject(name) {
  state.projectName = name;
  renameProject(state.projectId, name);
}

/** Pro extension point: the current canvas's size, e.g. to refresh a UI after rotateCanvas swaps width/height. */
export function getCanvasSize() {
  return { width: state.layerStack.width, height: state.layerStack.height };
}

/**
 * Pro extension point: subscribes `fn({ width, height, name })` to run
 * whenever a project opens/switches (workspace.js's per-project reset) -
 * e.g. so a Pro Canvas Settings panel can refresh its displayed name/size
 * and close itself, the same way it used to via
 * canvasSettingsControls.setCurrentSize/setCurrentName/close directly in
 * this file's per-project reset.
 */
const workspaceResetListeners = [];
export function onWorkspaceReset(fn) {
  workspaceResetListeners.push(fn);
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
    if (state.brushRainbow) {
      // Rainbow also applies to the Line tool: each pixel along the line
      // gets the next color in the same cycling sequence Brush uses,
      // stepping by index along the line's own rasterized path (a single
      // straight segment, so no pixel-perfect corner removal is needed -
      // that only matters for multi-segment freehand paths).
      const path = bresenhamLine(state.dragStart.x, state.dragStart.y, state.dragCurrent.x, state.dragCurrent.y);
      path.forEach((p, i) => {
        state.strokeEngine.setPixel(p.x, p.y, rainbowColor(i * RAINBOW_HUE_STEP));
      });
    } else {
      state.strokeEngine.strokeFreehand([state.dragStart, state.dragCurrent], rgba);
    }
  } else if (state.currentTool === 'rectangle') {
    drawRectangle(
      state.strokeEngine,
      state.dragStart.x,
      state.dragStart.y,
      state.dragCurrent.x,
      state.dragCurrent.y,
      rgba
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
    const rgba = colorForSequenceIndex(placementIndex);
    const angle = placementIndex * state.brushRotationStep;
    placeBrush(state.strokeEngine, point.x, point.y, state.currentBrush, rgba, angle, applyPixelTransform);
    placementIndex++;
  });
  clipToSelection(state.strokeEngine, state.strokeBackup, state.selection);
}

/** True if every pixel in an extractRegion()-shaped buffer is fully transparent (alpha 0). */
function isRegionFullyTransparent(buffer) {
  for (let i = 3; i < buffer.length; i += 4) {
    if (buffer[i] !== 0) return false;
  }
  return true;
}

/**
 * Redraws the Move tool's live preview from the pre-drag backup: resets
 * the active layer to `state.strokeBackup`, clears `state.moveRegion`'s
 * original footprint to transparent, and re-stamps `state.moveContent`
 * (extracted once at drag-start, see onDrawStart) at the region's
 * position offset by how far the drag has moved so far. Deliberately does
 * NOT call clipToSelection - when a selection is active, moveRegion IS
 * the selection rect, and clipping the result back to that rect's
 * *original* bounds would undo the move (every moved pixel ends up
 * outside the original rect once it's moved) - see design.md.
 *
 * If `state.moveContentEmpty` (nothing but transparency was extracted -
 * e.g. a selection already cleared with Delete), stops right after the
 * backup reset: no clear, no stamp. Otherwise dragging an empty region
 * over real content elsewhere would stamp transparency on top of it,
 * silently erasing it - a bug, not the intended "move nothing."
 */
function redrawMovePreview() {
  state.strokeEngine.data.set(state.strokeBackup);
  if (state.moveContentEmpty) return;
  const dx = state.dragCurrent.x - state.dragStart.x;
  const dy = state.dragCurrent.y - state.dragStart.y;
  const { x, y, width, height } = state.moveRegion;
  state.strokeEngine.clearRegion(x, y, width, height);
  state.strokeEngine.stampRegion(x + dx, y + dy, width, height, state.moveContent);
}

/**
 * Wires the Workspace tab bar, palette, brushes row, and selection
 * controls to `layerStack` and `canvasView`, and owns the undo/redo
 * stack and auto-save for the current project (Layers panel and Canvas
 * Settings are Pro-only, split-pixi-pro-repo - wired separately there).
 * Safe to call repeatedly (once per project opened or created in a
 * session) — DOM listeners bind only once; subsequent calls just reset
 * the drawing state for the new project.
 *
 * `root` (embeddable-editor-api, Phase 3): the DOM root to resolve every
 * `#id` lookup against - defaults to `document` (the standalone app's
 * behavior, unchanged). A mounted instance passes its own host
 * container's cloned Workspace markup instead; see this file's
 * module-level `root` comment for the single-active-instance scope note.
 *
 * `onChange` (embeddable-integration-api, task 3.5): called from
 * autoSave() on every committed drawing action - see that function's doc
 * comment. Defaults to a no-op so the standalone app (js/app.js, which
 * doesn't pass one) is unaffected; a mounted instance passes its own
 * emitter's dispatch function (lib/pixi.js).
 *
 * `enabledTools`/`initialTool` (embeddable-integration-api, task 3.7):
 * restricts which #tools-sidebar buttons are selectable. `enabledTools`
 * defaults to `null`, meaning "no restriction" - every tool button stays
 * visible and enabled, matching every pre-3.7 caller's behavior
 * unchanged; a mounted instance passes lib/pixi.js's already-resolved
 * `resolveEnabledTools(options)` array instead. `initialTool` (default
 * `'pencil'`, matching this function's own long-standing hardcoded
 * default) is the tool `state.currentTool` starts as - lib/pixi.js
 * resolves it via `resolveInitialTool(enabledTools, 'pencil')` so a
 * restricted set that excludes Pencil doesn't start on an unselectable
 * tool; this function itself does no fallback computation; it just
 * applies whatever it's given, keeping that decision logic in one place
 * (lib/pixi.js, unit-tested) rather than duplicated here.
 */
export function initWorkspace({
  projectId,
  projectName,
  layerStack,
  canvasView,
  onRequestGallery,
  onChange = () => {},
  root: hostRoot = document,
  enabledTools = null,
  initialTool = 'pencil',
}) {
  root = hostRoot;
  state = {
    projectId,
    projectName,
    layerStack,
    canvasView,
    onRequestGallery,
    onChange,
    undoStack: new UndoStack(),
    currentTool: initialTool,
    foregroundColor: hexToRgba(PALETTE[0]),
    backgroundColor: hexToRgba('#ffffff'),
    currentBrush: allBrushes[0],
    brushRainbow: false,
    brushSpacing: 1,
    brushRotationStep: 0,
    brushPath: [],
    pencilSize: 1,
    squareConstraint: false,
    rightSidebarVisible: true,
    selection: null,
    dragStart: null,
    dragCurrent: null,
    strokeEngine: null,
    strokeBackup: null,
    strokePoints: [],
    moveRegion: null,
    moveContent: null,
    moveContentEmpty: false,
    undoButton: root.querySelector('#undo-button'),
    redoButton: root.querySelector('#redo-button'),
    exportButton: root.querySelector('#export-button'),
    selectionControlsEl: root.querySelector('#selection-controls'),
    selectionClearButton: root.querySelector('#selection-clear-button'),
    selectionDeleteButton: root.querySelector('#selection-delete-button'),
  };

  if (domBoundRoot !== root) {
    bindDomOnce();
    domBoundRoot = root;
  }

  // The DOM (tool buttons, palette/brush swatches) is bound once and
  // reused across every project, but each freshly-opened
  // project's `state` above resets to defaults — without this, opening a
  // different project left the *previous* project's tool/color highlighted
  // even though it no longer applied (e.g. the state was reset but a
  // stale-highlighted swatch/tool suggested otherwise).
  //
  // `enabledTools` (task 3.7): re-applied here, not just once in
  // bindDomOnce(), the same reasoning shouldShowGalleryChrome's toggle
  // (lib/pixi.js's startWorkspace()) already relies on - this runs on
  // every initWorkspace() call, including loadImage()'s re-init, while
  // bindDomOnce() only runs once per root. A restricted button is both
  // hidden (so a restricted sidebar visually "offers only the specified
  // tools", per the spec) and disabled - disabled, not just hidden,
  // because bindDomOnce()'s bare-letter keyboard shortcuts (P/E/G/B/L/R/M/
  // H) find a button by data-shortcut and call button.click() directly;
  // a disabled button's .click() does not dispatch a 'click' event (per
  // the HTML spec), so disabling is what actually keeps a restricted
  // tool unreachable via its keyboard shortcut, not merely invisible.
  toolButtons.forEach((b) => {
    const allowed = !enabledTools || enabledTools.includes(b.dataset.tool);
    b.classList.toggle('hidden', !allowed);
    b.disabled = !allowed;
    b.classList.toggle('active', b.dataset.tool === state.currentTool);
  });
  // Which color is currently selected resets, back to the first preset
  // (matching state.foregroundColor's default above).
  colorPickerTarget = 'foreground';
  closeColorPicker();
  updateColorPickerInputs(state.foregroundColor);
  updateFgBgSwatches();
  syncActiveSwatch();
  renderBrushesPanel();
  root.querySelector('#brush-spacing').value = '1';
  root.querySelector('#brush-rotation').value = '0';
  setRightSidebarVisible(true);
  // Every tool-scoped panel/mode toggle (Brushes, pencil-options,
  // square-constraint, pan/move mode) follows state.currentTool alone -
  // shared with the tool-button click handler via applyToolScopedUI()
  // (task 3.7 code review: this used to be its own hardcoded-Pencil copy,
  // which drifted out of sync once initialTool could start on a tool
  // other than Pencil).
  applyToolScopedUI();
  // Pencil/Eraser's Size slider/readout still reset to match
  // state.pencilSize's default (1) regardless of which tool starts active.
  root.querySelector('#pencil-size-slider').value = '1';
  root.querySelector('#pencil-size-readout').textContent = '1px';
  squareConstraintToggle.classList.remove('active');

  for (const fn of workspaceResetListeners) fn({ width: layerStack.width, height: layerStack.height, name: projectName });
  exportControls.close();

  // Selections don't persist with the project (see shape-tools spec) — a
  // freshly opened project always starts with none.
  canvasView.setSelectionRect(null);
  updateSelectionControls();

  // Baseline snapshot so the very first stroke can be undone back to
  // whatever state the project was in when opened.
  state.undoStack.push(layerStack.snapshot());
  updateUndoRedoButtons();

  // Sync immediately: on the very first project opened in a session,
  // CanvasView's constructor + resetView() already ran (see app.js)
  // before setHandlers below registers onZoomChange, so that first
  // Fit Screen's zoom-change event has nowhere to land yet.
  zoomReadout.textContent = `${canvasView.getZoomPercent()}%`;

  canvasView.setHandlers({
    // Fires on every zoom change (buttons, shortcuts, presets, touch
    // pinch, and the initial Fit Screen from resetView) — see design.md.
    onZoomChange(percent) {
      zoomReadout.textContent = `${percent}%`;
    },

    onDrawStart(point) {
      const tool = state.currentTool;

      if (tool === 'selection') {
        state.dragStart = point;
        state.dragCurrent = point;
        state.canvasView.setSelectionRect(pointsToRect(point, point));
        return;
      }

      if (tool === 'eyedropper') {
        // Reads layerStack.composite() - the same ImageData already used
        // to render the canvas, so sampling reflects blend modes/opacity/
        // visibility exactly as seen, not one layer's raw pixel. A pure
        // read: no pixels change, no isPointInSelection/clipToSelection
        // guard (sampling isn't bounded by the selection), no commit().
        const composite = state.layerStack.composite();
        if (point.x >= 0 && point.x < composite.width && point.y >= 0 && point.y < composite.height) {
          const i = (point.y * composite.width + point.x) * 4;
          const rgba = [composite.data[i], composite.data[i + 1], composite.data[i + 2], composite.data[i + 3]];
          setForegroundColor(rgba);
        }
        return;
      }

      const activeEngine = state.layerStack.getActiveLayer().engine;

      if (tool === 'bucket') {
        if (!isPointInSelection(point, state.selection)) return;
        const backup = activeEngine.data.slice();
        activeEngine.floodFill(point.x, point.y, state.foregroundColor);
        clipToSelection(activeEngine, backup, state.selection);
        state.canvasView.render();
        commit(); // registerAfterCommit's hook (if any) handles a stale Layers thumbnail
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

      if (tool === 'move') {
        state.dragStart = point;
        state.dragCurrent = point;
        // With an active selection, Move always operates on it regardless
        // of where inside the canvas the drag starts (see design.md);
        // with none, the whole active layer's content moves.
        state.moveRegion = state.selection
          ? { ...state.selection }
          : { x: 0, y: 0, width: state.layerStack.width, height: state.layerStack.height };
        // Extracted once, from the pristine pre-drag content - the
        // dragged content itself never changes during a drag, only its
        // on-canvas position does.
        state.moveContent = activeEngine.extractRegion(
          state.moveRegion.x,
          state.moveRegion.y,
          state.moveRegion.width,
          state.moveRegion.height
        );
        // Bug fix: dragging a region that's fully transparent (e.g. a
        // selection whose content was already cleared with Delete)
        // still stamped that transparency at the drop point, silently
        // erasing whatever real content was already there. If there's
        // nothing but transparency to carry, Move is a no-op - it
        // doesn't clear the source (already blank) or touch the
        // destination at all.
        state.moveContentEmpty = isRegionFullyTransparent(state.moveContent);
        redrawMovePreview();
        state.canvasView.render();
        return;
      }

      // pencil / eraser
      state.strokePoints = [point];
      strokeFreehandThick(
        state.strokePoints,
        state.pencilSize,
        withProPixelTransform(pencilOrEraserApplyPixel(activeEngine), activeEngine)
      );
      clipToSelection(activeEngine, state.strokeBackup, state.selection);
      state.canvasView.render();
    },

    onDrawMove(point) {
      const tool = state.currentTool;

      if (tool === 'selection') {
        if (!state.dragStart) return;
        state.dragCurrent = isSquareConstrained() ? squareDragCurrent(state.dragStart, point) : point;
        state.canvasView.setSelectionRect(pointsToRect(state.dragStart, state.dragCurrent));
        return;
      }

      if (!state.strokeBackup) return;

      if (tool === 'line' || tool === 'rectangle') {
        state.dragCurrent = tool === 'rectangle' && isSquareConstrained() ? squareDragCurrent(state.dragStart, point) : point;
        drawShapePreview();
        state.canvasView.render();
        return;
      }

      if (tool === 'move') {
        state.dragCurrent = point;
        redrawMovePreview();
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
      // points) stays correct, and so Opacity's per-stroke dedup (see
      // design.md) always recomputes against the pristine backup rather
      // than compounding onto an already-blended in-progress redraw. In-
      // progress drawing, not a committed action, so it does NOT auto-save.
      const last = state.strokePoints[state.strokePoints.length - 1];
      if (last && last.x === point.x && last.y === point.y) return;
      state.strokePoints.push(point);
      state.strokeEngine.data.set(state.strokeBackup);
      strokeFreehandThick(
        state.strokePoints,
        state.pencilSize,
        withProPixelTransform(pencilOrEraserApplyPixel(state.strokeEngine), state.strokeEngine)
      );
      clipToSelection(state.strokeEngine, state.strokeBackup, state.selection);
      state.canvasView.render();
    },

    onDrawEnd() {
      const tool = state.currentTool;

      if (tool === 'selection') {
        if (!state.dragStart) return;
        const end = state.dragCurrent ?? state.dragStart;
        const wasATap = end.x === state.dragStart.x && end.y === state.dragStart.y;
        // A plain click (no drag) outside the current selection clears it,
        // instead of replacing it with a degenerate 1x1 selection at the
        // click point — the same effect as "Clear selection", reachable
        // without hunting for that button. A drag always defines a new
        // selection regardless of where it starts (existing behavior,
        // unchanged), and a tap *inside* the current selection still just
        // makes the usual 1x1 selection there.
        if (wasATap && state.selection && !isPointInSelection(state.dragStart, state.selection)) {
          state.selection = null;
          state.canvasView.setSelectionRect(null);
        } else {
          state.selection = pointsToRect(state.dragStart, end);
        }
        state.dragStart = null;
        state.dragCurrent = null;
        updateSelectionControls();
        return;
      }

      if (!state.strokeBackup) return;

      // Move: if a selection was active, it translates with the content
      // it just moved - so a second Move drag continues moving the same
      // (now-relocated) content, per design.md. Applied once here, not
      // live during the drag (nothing reads state.selection mid-drag).
      if (tool === 'move' && state.selection) {
        const dx = state.dragCurrent.x - state.dragStart.x;
        const dy = state.dragCurrent.y - state.dragStart.y;
        state.selection = { ...state.selection, x: state.selection.x + dx, y: state.selection.y + dy };
        state.canvasView.setSelectionRect(state.selection);
      }

      state.strokeEngine = null;
      state.strokeBackup = null;
      state.strokePoints = [];
      state.brushPath = [];
      state.moveRegion = null;
      state.moveContent = null;
      state.moveContentEmpty = false;
      state.dragStart = null;
      state.dragCurrent = null;
      // Every drawing tool (pencil, eraser, brush, line, rectangle,
      // selection move) funnels through here - registerAfterCommit's
      // hook (if any) handles a stale Layers thumbnail, since without it
      // the thumbnail would go stale until some other action triggers a
      // re-render.
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
      state.moveRegion = null;
      state.moveContent = null;
      state.moveContentEmpty = false;
      state.dragStart = null;
      state.dragCurrent = null;
    },
  });
}
