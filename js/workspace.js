import { UndoStack } from './undo.js';
import {
  saveProject,
  renameProject,
  createCustomBrush,
  listCustomBrushes,
  deleteCustomBrush,
  createColorPalette,
  listColorPalettes,
  addColorToPalette,
  deleteColorPalette,
} from './persistence.js';
import { initCanvasSettings } from './canvas-settings.js';
import { initExport } from './export.js';
import { BRUSHES, placeBrush, rainbowColor, pixelsFromGrid } from './brushes.js';
import { decodeImageFile, hasTransparency, downsampleToImageData } from './image-import.js';
import { thresholdToGrid } from './brush-import.js';
import { extractPalette } from './color-extraction.js';
import { generateColorRamp } from './color-ramp.js';
import { drawRectangle, clipToSelection } from './shape-tools.js';
import { DEFAULT_MATERIAL_COLORS, PREDEFINED_PALETTES } from './default-color-library.js';
import { bresenhamLine, strokeFreehandThick } from './engine.js';
import { confirmDialog } from './confirm-dialog.js';
import { mirrorApplyPixel } from './symmetry.js';

const BRUSH_EDITOR_SIZE = 9; // fixed grid size for the custom-brush editor, matches Heart's width

// Fixed internal sample grid for Color Library image import
// (2n-color-library-image-import) - purely a color-reduction step before
// median-cut clustering, never shown to the user (see design.md's
// "downsample before clustering" decision). 64x64 = 4096 sample pixels,
// plenty to represent an image's color distribution regardless of the
// source image's actual resolution.
const COLOR_IMPORT_SAMPLE_SIZE = 64;
const COLOR_IMPORT_MIN_COUNT = 2;
const COLOR_IMPORT_MAX_COUNT = 32;
const COLOR_IMPORT_DEFAULT_COUNT = 8;

// Color ramp generator (7-add-palette-color-ramp-generator) - step-count
// bounds and default, per spec.
const RAMP_MIN_STEPS = 3;
const RAMP_MAX_STEPS = 9;
const RAMP_DEFAULT_STEPS = 5;

const RAINBOW_HUE_STEP = 20; // degrees per brush placed, in Rainbow mode

// Symmetry/mirror drawing mode (5-add-symmetry-drawing-mode): #symmetry-toggle
// cycles through these in order on each click. Labels double as the
// tooltip/aria-label text (see updateSymmetryToggle) and as
// #symmetry-toggle's data-symmetry-mode value, which style.css keys its
// H/V/4 state badge off of.
const SYMMETRY_MODES = ['off', 'horizontal', 'vertical', 'both'];
const SYMMETRY_LABELS = {
  off: 'Symmetry: off',
  horizontal: 'Symmetry: horizontal',
  vertical: 'Symmetry: vertical',
  both: 'Symmetry: both',
};

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

/** Inverse of hexToRgba - drops alpha (palette swatches and the native
 * <input type="color"> are always fully opaque 6-digit hex). */
function rgbaToHex(rgba) {
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

/**
 * Whether the Color Library sequence toggle (#library-sequence-toggle,
 * shared by Pencil and Brush - see #library-sequence-options in
 * index.html) should be visible for the given tool. Not Eraser: nothing
 * to cycle through when Eraser doesn't paint a color at all. Exported as
 * a pure predicate so the show/hide rule is unit-testable (see
 * test/workspace.test.js) without needing a DOM harness for the rest of
 * bindDomOnce - the actual wiring calls this from the tool-switch handler
 * and initWorkspace's default-state reset.
 */
export function librarySequenceToggleVisibleForTool(tool) {
  return tool === 'pencil' || tool === 'brush';
}

/**
 * Pure state transition for Layers panel marking (multi-select) -
 * merge-layers's marked set is distinct from the single active layer.
 * `layers` is the current stack in bottom-to-top order (as from
 * LayerStack.getLayers()), each needing only `id`/`isBackground`.
 * `marked` is the current marked-id Set; `lastClickedId` is the id most
 * recently clicked (of any kind), used as the Shift+click range anchor.
 * The Background layer can never be marked, whichever click type targets
 * it. Exported as a pure function so this logic is unit-testable (see
 * test/workspace.test.js) without a DOM harness - the row click handler
 * in buildLayerRow calls this and applies the result.
 *
 * - Cmd/Ctrl+click: toggles `clickedId` in the marked set, other marks
 *   untouched. A no-op on the marked set itself if `clickedId` is the
 *   Background layer (it can never be marked), but the anchor still
 *   updates.
 * - Shift+click (with a prior `lastClickedId`): marks every non-Background
 *   layer between `lastClickedId` and `clickedId` (inclusive), replacing
 *   any prior marks. With no prior `lastClickedId`, falls back to plain
 *   click behavior.
 * - Plain click (no modifier): clears all marks, same as it would for any
 *   other row - including the Background layer, which only can't itself
 *   become marked, same as it already can become the active layer today.
 *   The active-layer change itself is handled by the caller.
 */
export function computeLayerMarkState({ marked, lastClickedId, clickedId, layers, metaOrCtrl, shift }) {
  const clickedLayer = layers.find((l) => l.id === clickedId);
  const clickedIsBackground = !!clickedLayer?.isBackground;

  if (metaOrCtrl) {
    if (clickedIsBackground) return { marked, lastClickedId: clickedId };
    const next = new Set(marked);
    if (next.has(clickedId)) next.delete(clickedId);
    else next.add(clickedId);
    return { marked: next, lastClickedId: clickedId };
  }

  if (shift && lastClickedId != null) {
    const lastIndex = layers.findIndex((l) => l.id === lastClickedId);
    const clickedIndex = layers.findIndex((l) => l.id === clickedId);
    if (lastIndex !== -1 && clickedIndex !== -1) {
      const lo = Math.min(lastIndex, clickedIndex);
      const hi = Math.max(lastIndex, clickedIndex);
      const next = new Set();
      for (let i = lo; i <= hi; i++) {
        if (!layers[i].isBackground) next.add(layers[i].id);
      }
      return { marked: next, lastClickedId: clickedId };
    }
  }

  // Plain click, or Shift with no valid anchor: clears all marks and
  // updates the anchor to this row, whether or not it's the Background
  // layer.
  return { marked: new Set(), lastClickedId: clickedId };
}

// Module-level state, not per-call: the Workspace screen is a singleton in
// this app (one workspace <canvas>), reused across every project the user
// opens or creates in a session. DOM listeners are bound exactly once, the
// first time initWorkspace runs; later calls just rebind state to the new
// project/layer stack.
let state = null;
let domBound = false;
// Tracked independently of any single event, since Shift can be pressed/
// released mid-drag - the Rectangle and Selection tools check this on
// every move.
let shiftHeld = false;
// Layers panel marking (multi-select), for merge-layers - transient UI
// state, not persisted and not part of the undo snapshot (see design.md's
// "Marking state lives in js/workspace.js, not LayerStack" decision).
// markedLayerIds holds layer ids (not indices), so marks survive an
// unrelated renderLayersPanel() re-run between a mark and a merge (e.g.
// after a visibility toggle shifts nothing, but a reorder would shift
// indices). lastMarkClickedLayerId is the Shift+click range anchor -
// updated by every click (plain, Cmd/Ctrl, or Shift alike). Both reset on
// layer add/delete and undo/redo (see clearLayerMarks below).
let markedLayerIds = new Set();
let lastMarkClickedLayerId = null;
function clearLayerMarks() {
  markedLayerIds = new Set();
  lastMarkClickedLayerId = null;
}
let squareConstraintPanel = null;
let squareConstraintToggle = null;
let canvasSettingsControls = null;
let exportControls = null;
let toolButtons = null;
let pixelPerfectToggle = null;
let symmetryToggle = null;
let paletteRow = null;
let brushesPanel = null;
let brushesPanelGrid = null;
let deleteBrushButton = null;
let layersPanel = null;
let layersPanelToggle = null;
let layersPanelHeader = null;
let layersPanelBlendSelect = null;
let layersPanelOpacitySlider = null;
let layersPanelOpacityReadout = null;
let layersPanelOpacityToggle = null;
let layersPanelOpacityNumber = null;
let layersPanelOpacityPopover = null;
let colorLibraryPanel = null;
let colorLibraryHeader = null;
let rightSidebar = null;
let rightSidebarToggle = null;
let foregroundSwatchEl = null;
let backgroundSwatchEl = null;

let zoomReadout = null;
let pencilOptionsPanel = null;
let librarySequencePanel = null;
let librarySequenceToggle = null;
let rectangleOptionsPanel = null;

// Named, persisted palettes of user-added colors (superseded the old
// flat, unpersisted customSwatches list - see 2f-color-library-panel).
// Module-level, not per-project — like allBrushes, a session/global
// resource, loaded once from IndexedDB and refreshed after every mutation.
let colorPalettes = [];
let activePaletteId = null;
let colorLibraryGrid = null;
let colorLibrarySelect = null;
let deletePaletteButton = null;

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
    clearLayerMarks(); // restored indices may no longer match what was marked
    state.canvasView.render();
    renderLayersPanel();
    autoSave();
  }
  updateUndoRedoButtons();
}

/**
 * Cmd/Ctrl+E: merges the marked set (2+ layers) if one exists, otherwise
 * merges the active layer down into the layer directly below it - see
 * specs/layers/spec.md's "Merge marked layers"/"Merge active layer down"
 * requirements (merge-layers). Marks are always cleared afterward,
 * win or no-op, so a merge attempt never leaves stale marks referring to
 * layers that no longer exist in their marked positions. Only a
 * successful merge re-renders/commits - the no-op paths (bottom-most
 * active layer, single-layer stack, Background layer involved) leave the
 * stack and undo history untouched.
 */
function mergeMarkedOrActiveDown() {
  const layers = state.layerStack.getLayers();
  const markedIndices = layers
    .map((layer, i) => (markedLayerIds.has(layer.id) ? i : -1))
    .filter((i) => i !== -1);

  const merged =
    markedIndices.length >= 2
      ? state.layerStack.mergeLayers(markedIndices)
      : state.layerStack.mergeDown(state.layerStack.getActiveIndex());

  clearLayerMarks();
  if (!merged) return;

  state.canvasView.render();
  commit();
  renderLayersPanel();
}

/** Shared by the Redo button and the Cmd/Ctrl+Shift+Z (or Ctrl+Y) shortcut. */
function performRedo() {
  const snapshot = state.undoStack.redo();
  if (snapshot) {
    state.layerStack.restore(snapshot);
    clearLayerMarks(); // restored indices may no longer match what was marked
    state.canvasView.render();
    renderLayersPanel();
    autoSave();
  }
  updateUndoRedoButtons();
}

function colorForCurrentTool() {
  return state.currentTool === 'eraser' ? [0, 0, 0, 0] : state.foregroundColor;
}

/**
 * Resolves the color for the `index`-th pixel/placement of a cycling
 * stroke - Rainbow (hue-stepped) or Color Library sequence (steps through
 * the active palette's colors, wrapping), whichever is active, falling
 * back to the plain foreground color. Shared by Pencil/Eraser's
 * `pencilOrEraserApplyPixel` and the Brush tool's `redrawBrushPath` so the
 * two cycling modes behave identically everywhere they're offered, not
 * two parallel implementations that could drift.
 */
function colorForSequenceIndex(index) {
  if (state.brushRainbow) return rainbowColor(index * RAINBOW_HUE_STEP);
  if (state.colorLibrarySequence) {
    const active = colorPalettes.find((p) => p.id === activePaletteId);
    const colors = active?.colors ?? [];
    if (colors.length > 0) return hexToRgba(colors[index % colors.length]);
  }
  return state.foregroundColor;
}

/**
 * Turns Color Library sequence on/off and reflects the result on its
 * toggle button (#library-sequence-toggle, shared by Pencil and Brush -
 * see #library-sequence-options in index.html). Mutually exclusive with
 * Rainbow: enabling this clears `state.brushRainbow`, the same way
 * selecting Rainbow clears this.
 */
function setColorLibrarySequence(enabled) {
  state.colorLibrarySequence = enabled;
  if (enabled) state.brushRainbow = false;
  librarySequenceToggle.classList.toggle('active', enabled);
}

/**
 * Returns the per-pixel operation strokeFreehandThick should call for the
 * current tool: Pencil blends the draw color at pencilOpacity
 * (setPixelBlended), Eraser fades existing alpha at pencilOpacity
 * (erasePixelBlended) instead - two different operations, not "blend
 * toward a color" reused for both (see design.md's rationale). Shared by
 * onDrawStart and onDrawMove so the two can't drift apart.
 *
 * Exception (2g-background-layer): erasing the Background layer reveals
 * state.backgroundColor instead of producing transparency - checked once
 * here, against the *active* layer at the point the stroke starts (the
 * same layer `engine` already targets, per this function's callers), not
 * re-checked per pixel - a layer's isBackground can't change mid-stroke.
 * Implemented as a setPixelBlended paint with the Background color, not a
 * new alpha-manipulation op - it's exactly Pencil-style compositing with
 * a different source color (see design.md).
 */
function pencilOrEraserApplyPixel(engine) {
  if (state.currentTool === 'eraser') {
    if (state.layerStack.getActiveLayer()?.isBackground) {
      return (x, y) => engine.setPixelBlended(x, y, state.backgroundColor, state.pencilOpacity);
    }
    return (x, y) => engine.erasePixelBlended(x, y, state.pencilOpacity);
  }
  // Rainbow and Color Library sequence both cycle per unique pixel placed,
  // same as Brush - the index strokeFreehandThick now passes is the
  // pixel's order among unique placements (not raw path position), so
  // Spacing-style skips don't exist here but dedup-skipped pixels still
  // don't throw off the cycle.
  if (state.brushRainbow || state.colorLibrarySequence) {
    return (x, y, index) => engine.setPixelBlended(x, y, colorForSequenceIndex(index), state.pencilOpacity);
  }
  return (x, y) => engine.setPixelBlended(x, y, state.foregroundColor, state.pencilOpacity);
}

/**
 * Wraps an `applyPixel(x, y, index)` callback (as returned by
 * pencilOrEraserApplyPixel) with mirroring when `state.symmetryMode !==
 * 'off'` (5-add-symmetry-drawing-mode), a no-op passthrough otherwise.
 * `index` is preserved across every mirrored copy of a given pixel rather
 * than incrementing per copy - it's Rainbow/Color-Library-sequence's
 * placement-order counter (see pencilOrEraserApplyPixel), and a mirrored
 * pixel is the same placement as its source, not a new one.
 */
function withSymmetry(applyPixel, engine) {
  if (state.symmetryMode === 'off') return applyPixel;
  return (x, y, index) =>
    mirrorApplyPixel(x, y, (mx, my) => applyPixel(mx, my, index), state.symmetryMode, engine.width, engine.height);
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

/**
 * Renders `layer`'s actual pixel content into a small canvas - a real
 * thumbnail preview, Photoshop-style, not a generic placeholder. Full
 * layer resolution is drawn (browsers downscale via CSS sizing on the
 * <canvas> element itself, same object-fit:contain-over-a-flat-
 * background approach the Gallery's project thumbnails already use), so
 * this stays correct after any resize without regenerating anything.
 */
function buildLayerThumbnailCanvas(layer) {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer-thumbnail';
  canvas.width = layer.engine.width;
  canvas.height = layer.engine.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(layer.engine.data), layer.engine.width, layer.engine.height), 0, 0);
  return canvas;
}

/**
 * Syncs the panel-level Blend mode/Opacity toolbar (see index.html) to
 * the currently active layer - Photoshop-style, these controls edit
 * whichever layer is selected rather than living inline in every row.
 * Called after every render (a fresh active layer may now be selected)
 * and once right after wiring in bindDomOnce.
 */
function syncLayersPanelToolbar() {
  const layer = state.layerStack.getActiveLayer();
  if (!layer) return;
  layersPanelBlendSelect.value = layer.blendMode;
  const opacityPercent = Math.round(layer.opacity * 100);
  layersPanelOpacitySlider.value = String(opacityPercent);
  layersPanelOpacityNumber.value = String(opacityPercent);
  layersPanelOpacityReadout.textContent = `${opacityPercent}%`;
}

/**
 * Syncs the whole right-sidebar's (Color Library + Brushes + Layers)
 * collapsed/expanded DOM state to state.rightSidebarVisible - AUD-11.
 * Collapsing animates the sidebar's width to 0 (see
 * .right-sidebar-collapsed in style.css, which also handles
 * prefers-reduced-motion) rather than snapping via display:none, so the
 * canvas area beside it (a flex sibling) reflows smoothly too. `inert`
 * is set while collapsed so its now width:0 content can't be tabbed
 * into or interacted with, mirroring how .hidden elements are already
 * unreachable.
 */
function setRightSidebarVisible(visible) {
  rightSidebar.classList.toggle('right-sidebar-collapsed', !visible);
  rightSidebar.inert = !visible;
  rightSidebarToggle.classList.toggle('active', visible);
}

/**
 * Syncs the Layers panel's collapsed/expanded DOM state to
 * state.layersPanelVisible - collapsing hides everything but the header
 * (see .layers-panel.collapsed in style.css), letting the Color Library
 * panel above grow into the freed space. Called by both the panel
 * header click and the pre-existing bottom-bar toggle
 * (#layers-panel-toggle), which share this one flag.
 */
function syncLayersCollapse() {
  const collapsed = !state.layersPanelVisible;
  layersPanel.classList.toggle('collapsed', collapsed);
  layersPanelHeader.setAttribute('aria-expanded', String(!collapsed));
  layersPanelToggle.classList.toggle('active', !collapsed);
}

function renderLayersPanel() {
  const layers = state.layerStack.getLayers();
  const activeIndex = state.layerStack.getActiveIndex();
  state.layersPanelList.innerHTML = '';

  // Topmost layer (end of the bottom-to-top array) listed first.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const isMarked = markedLayerIds.has(layer.id);
    state.layersPanelList.appendChild(buildLayerRow(layer, i, i === activeIndex, isMarked, layers));
  }

  state.addLayerButton.disabled = layers.length >= 8;
  syncLayersPanelToolbar();
}

/**
 * A single compact row - thumbnail, visibility, name, and small
 * reorder/delete icons - Photoshop's own Layers panel row, adapted to
 * this app's tap-to-reorder (Photoshop uses drag-and-drop, which this
 * app doesn't implement) and per-row delete icon (Photoshop's trash
 * target lives once at the panel's bottom, but a per-row icon is a
 * closer fit for a touch-first app anyway). Blend mode/Opacity are NOT
 * here - see the panel-level toolbar/syncLayersPanelToolbar.
 */
function buildLayerRow(layer, index, isActive, isMarked, layers) {
  const layerCount = layers.length;
  const row = document.createElement('div');
  row.className = 'layer-row' + (isActive ? ' active' : '') + (isMarked ? ' marked' : '');
  row.addEventListener('click', (e) => {
    if (e.target.closest('button, input')) return;
    // Cmd/Ctrl+click toggles this layer's mark; Shift+click marks the
    // contiguous range from the last-clicked row; a plain click keeps
    // today's behavior (set active layer) and clears marks - see
    // computeLayerMarkState's doc comment for the full rule set. Marking
    // is independent of which layer is active except that a plain click
    // still drives both.
    const { marked, lastClickedId } = computeLayerMarkState({
      marked: markedLayerIds,
      lastClickedId: lastMarkClickedLayerId,
      clickedId: layer.id,
      layers,
      metaOrCtrl: e.metaKey || e.ctrlKey,
      shift: e.shiftKey,
    });
    markedLayerIds = marked;
    lastMarkClickedLayerId = lastClickedId;
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) {
      state.layerStack.setActiveLayer(index);
    }
    renderLayersPanel();
  });

  const visibilityButton = document.createElement('button');
  visibilityButton.type = 'button';
  visibilityButton.className = 'layer-visibility-toggle icon-button';
  visibilityButton.innerHTML = `<span class="material-symbols-outlined">${layer.visible ? 'visibility' : 'visibility_off'}</span>`;
  visibilityButton.title = layer.visible ? 'Hide layer' : 'Show layer';
  visibilityButton.setAttribute('aria-label', layer.visible ? 'Hide layer' : 'Show layer');
  visibilityButton.addEventListener('click', () => {
    state.layerStack.setVisibility(index, !layer.visible);
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  const thumbnail = buildLayerThumbnailCanvas(layer);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'layer-name-input';
  nameInput.value = layer.name;
  nameInput.addEventListener('change', () => {
    state.layerStack.renameLayer(index, nameInput.value.trim() || layer.name);
    commit();
    renderLayersPanel();
  });

  // Background layer (2g-background-layer): locked in stacking position -
  // a small lock icon next to its name, reorder buttons disabled
  // regardless of where it sits (LayerStack.moveLayerUp/moveLayerDown
  // already refuse the move too - this is the matching UI state, not the
  // only enforcement).
  let lockIcon = null;
  if (layer.isBackground) {
    lockIcon = document.createElement('span');
    lockIcon.className = 'material-symbols-outlined layer-lock-icon';
    lockIcon.textContent = 'lock';
    lockIcon.title = 'Background layer - locked in position';
  }

  // A swap moves both layers involved (see LayerStack.moveLayerUp/
  // moveLayerDown's matching comment), so a button is disabled not just
  // when its own layer is the Background layer, but also when the
  // neighbor it would swap into is - either way the move is refused.
  const upButton = document.createElement('button');
  upButton.type = 'button';
  upButton.className = 'layer-reorder-button';
  upButton.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
  upButton.title = 'Move layer up';
  upButton.setAttribute('aria-label', 'Move layer up');
  upButton.disabled = index === layerCount - 1 || layer.isBackground || !!layers[index + 1]?.isBackground;
  upButton.addEventListener('click', () => {
    state.layerStack.moveLayerUp(index);
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  const downButton = document.createElement('button');
  downButton.type = 'button';
  downButton.className = 'layer-reorder-button';
  downButton.innerHTML = '<span class="material-symbols-outlined">arrow_downward</span>';
  downButton.title = 'Move layer down';
  downButton.setAttribute('aria-label', 'Move layer down');
  downButton.disabled = index === 0 || layer.isBackground || !!layers[index - 1]?.isBackground;
  downButton.addEventListener('click', () => {
    state.layerStack.moveLayerDown(index);
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'layer-delete-button icon-button no-buzz';
  deleteButton.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  deleteButton.title = 'Delete layer';
  deleteButton.setAttribute('aria-label', 'Delete layer');
  deleteButton.disabled = layerCount <= 1;
  deleteButton.addEventListener('click', async () => {
    const proceed = await confirmDialog({
      title: 'Delete layer?',
      message: `Delete "${layer.name}"? This can't be undone.`,
    });
    if (!proceed) return;
    state.layerStack.deleteLayer(index);
    clearLayerMarks(); // remaining indices shifted; stale marks would misalign
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

  const actions = document.createElement('div');
  actions.className = 'layer-row-actions';
  actions.append(upButton, downButton, deleteButton);

  row.append(visibilityButton, thumbnail, nameInput);
  if (lockIcon) row.append(lockIcon);
  row.append(actions);
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

/**
 * Fetches every palette from IndexedDB. Auto-creates one "Material"
 * palette, seeded with the full Material Design color system (see
 * js/default-color-library.js), whenever none of the existing palettes
 * is flagged `isDefault` - covers both first-ever load (no palettes at
 * all yet) and recovery for anyone who deleted the default palette
 * before deletion protection existed (a plain `length === 0` check
 * would miss that case if any other palette still exists). The panel
 * should never end up with no populated, undeletable palette to fall
 * back to.
 *
 * First-ever load only (judged before Material's own recovery-create
 * above, on the true starting `palettes.length === 0`) also seeds every
 * PREDEFINED_PALETTES entry as an ordinary, deletable palette - unlike
 * Material, these never come back if deleted; they're starter content,
 * not a required fallback.
 */
async function loadColorPalettes() {
  let palettes = await listColorPalettes();
  const isFirstEverLoad = palettes.length === 0;
  if (!palettes.some((p) => p.isDefault)) {
    const defaultPalette = await createColorPalette('Material', [...DEFAULT_MATERIAL_COLORS], true);
    palettes = [...palettes, defaultPalette];
  }
  if (isFirstEverLoad) {
    for (const [name, colors] of Object.entries(PREDEFINED_PALETTES)) {
      const created = await createColorPalette(name, [...colors]);
      palettes = [...palettes, created];
    }
  }
  colorPalettes = palettes;
  // Keep the previously active palette selected if it still exists
  // (e.g. after adding a color to it); otherwise fall back to the first.
  if (!colorPalettes.some((p) => p.id === activePaletteId)) {
    activePaletteId = colorPalettes[0].id;
  }
  renderColorLibraryPanel();
}

/**
 * Syncs the Color Library panel's collapsed/expanded DOM state to
 * state.colorLibraryCollapsed - collapsing hides everything but the
 * header (see .color-library-panel.collapsed in style.css), letting the
 * Layers panel below grow into the freed space.
 */
function syncColorLibraryCollapse() {
  const collapsed = state.colorLibraryCollapsed;
  colorLibraryPanel.classList.toggle('collapsed', collapsed);
  colorLibraryHeader.setAttribute('aria-expanded', String(!collapsed));
}

/**
 * Rebuilds the palette-name dropdown (shown only once more than one
 * palette exists, sorted alphabetically) and the active palette's
 * swatch grid.
 */
function renderColorLibraryPanel() {
  const sorted = [...colorPalettes].sort((a, b) => a.name.localeCompare(b.name));

  colorLibrarySelect.innerHTML = '';
  sorted.forEach((palette) => {
    const option = document.createElement('option');
    option.value = palette.id;
    option.textContent = palette.name;
    if (palette.id === activePaletteId) option.selected = true;
    colorLibrarySelect.appendChild(option);
  });
  colorLibrarySelect.classList.toggle('hidden', sorted.length <= 1);

  const active = colorPalettes.find((p) => p.id === activePaletteId);
  colorLibraryGrid.innerHTML = '';
  if (active && active.colors.length > 0) {
    active.colors.forEach((hex) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-library-swatch';
      swatch.style.background = hex;
      swatch.dataset.hex = hex.toLowerCase();
      swatch.title = hex;
      swatch.addEventListener('click', () => setForegroundColor(hexToRgba(hex)));
      colorLibraryGrid.appendChild(swatch);
    });
  } else if (active) {
    const empty = document.createElement('p');
    empty.className = 'color-library-empty';
    empty.textContent = 'No colors yet - add one from the color picker.';
    colorLibraryGrid.appendChild(empty);
  }

  // Can't delete the only remaining palette (same "can't delete the only
  // layer" pattern the Layers panel already uses), and can't delete the
  // built-in default palette even when other palettes exist - there
  // should always be at least one populated, undeletable palette to fall
  // back to.
  deletePaletteButton.disabled = colorPalettes.length <= 1 || Boolean(active?.isDefault);

  syncActiveSwatch();
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

// The decoded source image behind an "Import", if any (js/image-import.js's
// decodeImageFile result - an ImageBitmap). Kept at module scope alongside
// the grid state so a later W/H change can re-pixelate from the same
// source instead of re-prompting for a file. Cleared whenever the editor
// opens fresh, Cancel is pressed, or Clear is pressed (see
// applyBrushEditorSourceImage's and bindBrushEditorOnce's callers) -
// design.md's decision to keep Clear as pure "blank the grid", not a
// separate "discard the import" control.
let brushEditorSourceImage = null;

/**
 * Re-pixelates brushEditorSourceImage at the editor's current
 * brushEditorWidth x brushEditorHeight, overwriting brushEditorGridState
 * and the grid's DOM 'on' classes with the result. No-op if no image has
 * been imported. Assumes rebuildBrushEditorGrid() already built the DOM
 * cells at the current dimensions (called right after it, both on import
 * and on every subsequent resize).
 */
function applyBrushEditorSourceImage() {
  if (!brushEditorSourceImage) return;
  const useAlpha = hasTransparency(brushEditorSourceImage);
  const imageData = downsampleToImageData(brushEditorSourceImage, brushEditorWidth, brushEditorHeight);
  brushEditorGridState = thresholdToGrid(imageData, brushEditorWidth, brushEditorHeight, useAlpha);
  const grid = document.getElementById('brush-editor-grid');
  grid.querySelectorAll('.brush-editor-cell').forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    cell.classList.toggle('on', brushEditorGridState[y][x]);
  });
}

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
  brushEditorSourceImage = null; // fresh editor open forgets any prior import
  rebuildBrushEditorGrid();
  document.getElementById('brush-editor-panel').classList.remove('hidden');
}

function closeBrushEditor() {
  brushEditorSourceImage = null; // Cancel (or Save closing the panel) forgets the import too
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
  const importButton = document.getElementById('brush-editor-import');
  const importInput = document.getElementById('brush-editor-import-input');
  const clearButton = document.getElementById('brush-editor-clear');
  const cancelButton = document.getElementById('brush-editor-cancel');
  const saveButton = document.getElementById('brush-editor-save');

  // Changing size re-grids from scratch when nothing's been imported
  // (painting so far doesn't carry over) — simplest behavior, and this is
  // a brand-new brush each time. When an image *has* been imported,
  // re-pixelate from that same source at the new size instead of
  // clearing, so the user can dial in resolution before hand-tweaking.
  widthInput.addEventListener('change', () => {
    brushEditorWidth = clampBrushEditorDimension(Number(widthInput.value), state.layerStack.width);
    widthInput.value = String(brushEditorWidth);
    rebuildBrushEditorGrid();
    applyBrushEditorSourceImage();
  });
  heightInput.addEventListener('change', () => {
    brushEditorHeight = clampBrushEditorDimension(Number(heightInput.value), state.layerStack.height);
    heightInput.value = String(brushEditorHeight);
    rebuildBrushEditorGrid();
    applyBrushEditorSourceImage();
  });

  importButton.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    // Reset now (not after decoding) so picking the same file twice in a
    // row still fires 'change' the second time - a file input only fires
    // on a value change, and re-selecting the same path wouldn't count as
    // one unless the value is cleared first.
    importInput.value = '';
    if (!file) return;
    const image = await decodeImageFile(file);
    if (!image) return; // unsupported/corrupt file - fail silently, no crash
    brushEditorSourceImage = image;
    applyBrushEditorSourceImage();
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
    // Clear is pure "blank the grid", including forgetting any import -
    // it doesn't distinguish "just resized" from "was imported" (see
    // design.md's decision), so a resize after Clear no longer
    // re-pixelates until another Import.
    brushEditorSourceImage = null;
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

/**
 * Named "magic palette" easter eggs: naming a new Color Library palette
 * one of these three words (case-insensitive, matched against the
 * trimmed "New palette" input) seeds it with a themed color set instead
 * of starting empty, plus a little flourish - a confetti burst in the
 * seeded palette's own colors for rainbow/gameboy, or matrixRain's own
 * effect for matrix (see newPaletteSave's listener) - alongside the
 * Konami code (bindKonamiCode) and the Gallery's paw parade (see
 * gallery.js) as this app's other hidden delighters. Kept small and
 * genuinely gimmicky on purpose - everything else themed lives in
 * PREDEFINED_PALETTES instead, as ordinary always-visible palettes
 * rather than a typed-name trick.
 */
const MAGIC_PALETTES = {
  rainbow: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8b00ff'],
  gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  // Its own effect (matrixRain) instead of confetti - a green-on-black
  // palette calls for something more thematic.
  matrix: ['#003b00', '#008f11', '#00ff41', '#00ff41', '#0d1a0d'],
};

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
const prefersReducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/**
 * The "matrix" magic palette's own effect (see MAGIC_PALETTES) - a brief
 * cascade of falling green characters instead of the shared confetti
 * burst every other magic palette uses. Self-removing, no state. Skipped
 * entirely under prefers-reduced-motion, since it's purely decorative.
 */
function matrixRain() {
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
function confettiBurst(originX, originY, count, maxDistance) {
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
    if (document.getElementById('screen-workspace').classList.contains('hidden')) return;
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
 * Reflects `state.symmetryMode` on #symmetry-toggle: `.active` (shared
 * accent styling with every other topbar toggle) whenever it's not 'off',
 * `data-symmetry-mode` for style.css's per-state H/V/4 badge, and the
 * aria-label/tooltip text - shared by the click handler and by
 * initWorkspace's per-project reset (see SYMMETRY_MODES/SYMMETRY_LABELS).
 */
function updateSymmetryToggle() {
  const mode = state.symmetryMode;
  symmetryToggle.classList.toggle('active', mode !== 'off');
  symmetryToggle.dataset.symmetryMode = mode;
  symmetryToggle.setAttribute('aria-label', SYMMETRY_LABELS[mode]);
  symmetryToggle.dataset.tooltip = SYMMETRY_LABELS[mode];
}

/**
 * Wires a single shared tooltip element (positioned via JS, not CSS
 * ::after — see style.css's .tool-tooltip comment for why) to every
 * [data-tooltip] element in the tools sidebar. Shows after a short delay
 * on hover/focus, to the right of the button; hides immediately on
 * leave/blur.
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

  document.querySelectorAll('[data-tooltip]').forEach((el) => {
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', hide);
    // A click (tool switch) shouldn't leave a stale tooltip lingering.
    el.addEventListener('click', hide);
  });
}

/**
 * Rebuilds the palette row's swatches from the fixed PALETTE presets
 * plus the Rainbow swatch last. User-added colors now live in the Color
 * Library panel (see renderColorLibraryPanel), not here.
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
    setColorLibrarySequence(false);
    syncActiveSwatch();
  });
  paletteRow.appendChild(rainbowSwatch);

  syncActiveSwatch();
}

/** Toggles .active on whichever palette swatch (or Rainbow) matches current state. */
function syncActiveSwatch() {
  const fgHex = rgbaToHex(state.foregroundColor);
  paletteRow.querySelectorAll('.palette-swatch:not(.rainbow-swatch)').forEach((s) => {
    s.classList.toggle('active', !state.brushRainbow && s.dataset.hex === fgHex);
  });
  const rainbowEl = paletteRow.querySelector('.rainbow-swatch');
  if (rainbowEl) rainbowEl.classList.toggle('active', state.brushRainbow);
  if (colorLibraryGrid) {
    colorLibraryGrid.querySelectorAll('.color-library-swatch').forEach((s) => {
      s.classList.toggle('active', !state.brushRainbow && s.dataset.hex === fgHex);
    });
  }
}

/** Keeps the native color input, hex field, and RGB fields all showing the same color. */
function updateColorPickerInputs(rgba) {
  const hex = rgbaToHex(rgba);
  document.getElementById('color-picker-native').value = hex;
  document.getElementById('color-picker-hex').value = hex;
  document.getElementById('color-picker-r').value = String(rgba[0]);
  document.getElementById('color-picker-g').value = String(rgba[1]);
  document.getElementById('color-picker-b').value = String(rgba[2]);
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
 * picking a regular color always has.
 */
function setForegroundColor(rgba) {
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
 * Adds `rgba` to the active Color Library palette and refreshes the
 * panel - the one path every "add to palette" control routes through,
 * whether that's the color-picker popover's own button (non-iOS only,
 * see openColorPicker) or the always-available button in the Color
 * Library panel's header (every platform, and the only "add to palette"
 * path on iOS, where the popover doesn't exist).
 */
async function addCurrentColorToActivePalette(rgba) {
  await addColorToPalette(activePaletteId, rgbaToHex(rgba));
  await loadColorPalettes();
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
  document.getElementById('color-picker-popover-title').textContent =
    target === 'background' ? 'Background Color' : 'Foreground Color';
  updateColorPickerInputs(current);
  const popover = document.getElementById('color-picker-popover');
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
  document.getElementById('color-picker-popover').classList.add('hidden');
}

/**
 * Positions and shows #layers-panel-opacity-popover anchored below the
 * Layers toolbar row (#layers-panel-opacity-toggle) - same
 * clamp-to-viewport approach as openColorPicker above, adapted to open
 * below rather than to the side since the toggle sits inside the right
 * sidebar's narrow column.
 */
function openLayersOpacityPopover() {
  layersPanelOpacityPopover.classList.remove('hidden'); // unhide before measuring (see openColorPicker)
  const rect = layersPanelOpacityToggle.getBoundingClientRect();
  const popRect = layersPanelOpacityPopover.getBoundingClientRect();
  const margin = 8;

  let left = rect.right - popRect.width;
  left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));

  let top = rect.bottom + 6;
  top = Math.max(margin, Math.min(top, window.innerHeight - popRect.height - margin));

  layersPanelOpacityPopover.style.left = `${left}px`;
  layersPanelOpacityPopover.style.top = `${top}px`;
  layersPanelOpacityNumber.focus();
}

function closeLayersOpacityPopover() {
  layersPanelOpacityPopover.classList.add('hidden');
}

/**
 * Wires a panel header (e.g. #layers-panel-header,
 * #color-library-header) for Photoshop-accordion-style collapse: click
 * anywhere on the header row, not just a dedicated icon, to
 * collapse/expand. Ignores clicks landing on an interactive control
 * inside the header (e.g. Color Library's add/delete-palette buttons,
 * Layers' "+ Layer" button) so those keep working normally instead of
 * also toggling collapse. `onToggle` owns updating the underlying state
 * and syncing the DOM (see syncLayersCollapse/syncColorLibraryCollapse).
 */
function bindPanelHeaderCollapse(headerEl, onToggle) {
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
function bindSliderWheel(slider) {
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

/**
 * Positions `panel` as a popover below `anchorEl`, clamped to the
 * viewport - flips above if it would overflow the bottom, clamped
 * horizontally too. Same unhide-to-measure-then-clamp pattern as
 * js/canvas-settings.js's/js/export.js's own positionPanel (duplicated
 * rather than shared, matching this codebase's existing per-popover
 * convention). Used for the Color Library import-palette popover
 * (2o-image-import-refinements).
 */
function positionPanelBelow(panel, anchorEl) {
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

function bindDomOnce() {
  toolButtons = document.querySelectorAll('.tool-button[data-tool]');
  pixelPerfectToggle = document.getElementById('pixel-perfect-toggle');
  symmetryToggle = document.getElementById('symmetry-toggle');
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
      // Filled toggle: Rectangle only.
      rectangleOptionsPanel.classList.toggle('hidden', state.currentTool !== 'rectangle');
      // 1:1 proportion toggle: Rectangle and Selection.
      squareConstraintPanel.classList.toggle(
        'hidden',
        state.currentTool !== 'rectangle' && state.currentTool !== 'selection'
      );
      // Color Library sequence toggle: Pencil and Brush, not Eraser
      // (nothing to cycle through when Eraser doesn't paint a color at
      // all) - one shared control, same tool-scoped-visibility pattern as
      // squareConstraintPanel above.
      librarySequencePanel.classList.toggle(
        'hidden',
        !librarySequenceToggleVisibleForTool(state.currentTool)
      );
    });
  });

  bindTooltips();
  bindKonamiCode();

  pixelPerfectToggle.addEventListener('click', () => {
    state.pixelPerfect = !state.pixelPerfect;
    pixelPerfectToggle.classList.toggle('active', state.pixelPerfect);
  });

  symmetryToggle.addEventListener('click', () => {
    const nextIndex = (SYMMETRY_MODES.indexOf(state.symmetryMode) + 1) % SYMMETRY_MODES.length;
    state.symmetryMode = SYMMETRY_MODES[nextIndex];
    updateSymmetryToggle();
  });

  // Pencil/Eraser Size + Opacity - shared sliders with live readouts.
  pencilOptionsPanel = document.getElementById('pencil-options');
  const pencilSizeSlider = document.getElementById('pencil-size-slider');
  const pencilSizeReadout = document.getElementById('pencil-size-readout');
  const pencilOpacitySlider = document.getElementById('pencil-opacity-slider');
  const pencilOpacityReadout = document.getElementById('pencil-opacity-readout');

  pencilSizeSlider.addEventListener('input', () => {
    const value = Number(pencilSizeSlider.value);
    state.pencilSize = value;
    pencilSizeReadout.textContent = `${value}px`;
  });

  pencilOpacitySlider.addEventListener('input', () => {
    const value = Number(pencilOpacitySlider.value);
    state.pencilOpacity = value / 100;
    pencilOpacityReadout.textContent = `${value}%`;
  });

  // Mouse wheel adjusts Size/Opacity by one step per notch while
  // hovering the slider, without needing to grab the thumb - common
  // desktop-app slider convention (Photoshop, Figma).
  bindSliderWheel(pencilSizeSlider);
  bindSliderWheel(pencilOpacitySlider);

  // Rectangle's Filled toggle - tool-scoped, same pattern as Pencil options.
  rectangleOptionsPanel = document.getElementById('rectangle-options');
  const rectangleFillToggle = document.getElementById('rectangle-fill-toggle');
  const rectangleFillIconOutline = document.getElementById('rectangle-fill-icon-outline');
  const rectangleFillIconFilled = document.getElementById('rectangle-fill-icon-filled');
  rectangleFillToggle.addEventListener('click', () => {
    state.rectangleFilled = !state.rectangleFilled;
    rectangleFillToggle.classList.toggle('active', state.rectangleFilled);
    rectangleFillIconOutline.classList.toggle('hidden', state.rectangleFilled);
    rectangleFillIconFilled.classList.toggle('hidden', !state.rectangleFilled);
  });

  // 1:1 proportion toggle - Rectangle and Selection, a persistent
  // touchscreen-friendly equivalent of holding Shift (see
  // isSquareConstrained).
  squareConstraintPanel = document.getElementById('square-constraint-options');
  squareConstraintToggle = document.getElementById('square-constraint-toggle');
  squareConstraintToggle.addEventListener('click', () => {
    state.squareConstraint = !state.squareConstraint;
    squareConstraintToggle.classList.toggle('active', state.squareConstraint);
  });

  // Color Library sequence toggle - one shared control for Pencil and
  // Brush (see #library-sequence-options above and setColorLibrarySequence),
  // same tool-scoped-visibility pattern as squareConstraintPanel/-Toggle.
  // Mutually exclusive with Rainbow (both are per-pixel color-cycling modes
  // for the same applyPixel slot).
  librarySequencePanel = document.getElementById('library-sequence-options');
  librarySequenceToggle = document.getElementById('library-sequence-toggle');
  librarySequenceToggle.addEventListener('click', () => {
    setColorLibrarySequence(!state.colorLibrarySequence);
    syncActiveSwatch();
  });

  renderPaletteRow();

  // Custom color picker: native <input type="color"> + hex + RGB fields,
  // in a popover opened by clicking the Foreground or Background swatch
  // (colorPickerTarget tracks which one), all cross-synced through
  // applyPickedColor/updateColorPickerInputs.
  const colorPickerNative = document.getElementById('color-picker-native');
  const colorPickerHex = document.getElementById('color-picker-hex');
  const colorPickerCopied = document.getElementById('color-picker-copied');
  const colorPickerR = document.getElementById('color-picker-r');
  const colorPickerG = document.getElementById('color-picker-g');
  const colorPickerB = document.getElementById('color-picker-b');
  const colorPickerAdd = document.getElementById('color-picker-add');
  const colorPickerPopover = document.getElementById('color-picker-popover');

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

  colorPickerAdd.addEventListener('click', async () => {
    const current = colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor;
    await addCurrentColorToActivePalette(current);
  });

  document.getElementById('color-picker-close').addEventListener('click', closeColorPicker);

  // Close on outside click/Escape, not just the explicit close button -
  // standard popover behavior. Clicks inside #ramp-preview-row don't
  // count as "outside" here even though it's a sibling, not a descendant,
  // of #color-picker-popover - it's opened from this popover's own
  // "Generate ramp" button, so closing the color picker out from under an
  // in-progress ramp preview would be surprising.
  document.addEventListener('pointerdown', (e) => {
    if (colorPickerPopover.classList.contains('hidden')) return;
    if (colorPickerPopover.contains(e.target)) return;
    if (e.target.closest('#foreground-swatch, #background-swatch')) return;
    if (document.getElementById('ramp-preview-row').contains(e.target)) return;
    closeColorPicker();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !colorPickerPopover.classList.contains('hidden')) closeColorPicker();
  });

  // Foreground/Background: click either swatch to open the popover
  // targeting it; swap and reset-to-black/white.
  foregroundSwatchEl = document.getElementById('foreground-swatch');
  backgroundSwatchEl = document.getElementById('background-swatch');

  foregroundSwatchEl.addEventListener('click', () => openColorPicker('foreground', foregroundSwatchEl));
  backgroundSwatchEl.addEventListener('click', () => openColorPicker('background', backgroundSwatchEl));

  document.getElementById('fg-bg-swap').addEventListener('click', () => {
    const swapped = state.backgroundColor;
    state.backgroundColor = state.foregroundColor;
    state.foregroundColor = swapped;
    updateColorPickerInputs(colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor);
    updateFgBgSwatches();
    syncActiveSwatch();
  });

  document.getElementById('fg-bg-reset').addEventListener('click', () => {
    state.foregroundColor = hexToRgba('#000000');
    state.backgroundColor = hexToRgba('#ffffff');
    updateColorPickerInputs(colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor);
    updateFgBgSwatches();
    syncActiveSwatch();
  });

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

  // Color Library panel: named, persisted palettes (see design.md's
  // "one Dexie record per palette" decision).
  colorLibraryPanel = document.getElementById('color-library-panel');
  colorLibraryHeader = document.getElementById('color-library-header');
  colorLibraryGrid = document.getElementById('color-library-grid');
  colorLibrarySelect = document.getElementById('color-library-select');
  deletePaletteButton = document.getElementById('delete-palette-button');
  const addCurrentColorButton = document.getElementById('add-current-color-button');
  const addPaletteButton = document.getElementById('add-palette-button');
  const newPaletteRow = document.getElementById('new-palette-row');
  const newPaletteName = document.getElementById('new-palette-name');
  const newPaletteSave = document.getElementById('new-palette-save');
  const newPaletteCancel = document.getElementById('new-palette-cancel');

  // Import palette from image (2n-color-library-image-import): file
  // picker -> decode -> downsample once (cached) -> extractPalette on
  // demand, re-run live as the color-count control changes. The preview
  // itself is a popover (2o-image-import-refinements), not an in-flow
  // row - same clamped-to-viewport anchor pattern as Canvas Settings/
  // Export, so the color-count control never shifts as the swatch grid
  // above it gains/loses rows.
  const importPaletteButton = document.getElementById('import-palette-button');
  const importInput = document.getElementById('color-library-import-input');
  const importPreviewRow = document.getElementById('import-preview-row');
  const importPreviewClose = document.getElementById('import-preview-close');
  const importPreviewGrid = document.getElementById('import-preview-grid');
  const importPreviewCount = document.getElementById('import-preview-count');
  const importPreviewName = document.getElementById('import-preview-name');
  const importPreviewSave = document.getElementById('import-preview-save');
  const importPreviewCancel = document.getElementById('import-preview-cancel');
  // Cached downsampled ImageData from the current import, so re-extracting
  // on a color-count change never re-decodes/re-downsamples the source
  // image (see design.md's live-preview decision). null when no import
  // preview is open.
  let importSampleImageData = null;
  let importPreviewColors = [];

  function renderImportPreview() {
    importPreviewGrid.innerHTML = '';
    for (const hex of importPreviewColors) {
      const swatch = document.createElement('div');
      swatch.className = 'color-library-swatch';
      swatch.style.background = hex;
      importPreviewGrid.appendChild(swatch);
    }
  }

  function reExtractImportPreview() {
    if (!importSampleImageData) return;
    const count = Math.min(
      COLOR_IMPORT_MAX_COUNT,
      Math.max(COLOR_IMPORT_MIN_COUNT, Math.round(Number(importPreviewCount.value)) || COLOR_IMPORT_DEFAULT_COUNT)
    );
    importPreviewCount.value = String(count);
    importPreviewColors = extractPalette(importSampleImageData, count);
    renderImportPreview();
  }

  function closeImportPreview() {
    importPreviewRow.classList.add('hidden');
    importSampleImageData = null;
    importPreviewColors = [];
    importInput.value = ''; // allow re-picking the same file
  }

  importPaletteButton.addEventListener('click', () => {
    importInput.click();
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const image = await decodeImageFile(file);
    if (!image) {
      importInput.value = ''; // unsupported/corrupt file - no-op, let the user retry
      return;
    }
    importSampleImageData = downsampleToImageData(image, COLOR_IMPORT_SAMPLE_SIZE, COLOR_IMPORT_SAMPLE_SIZE);
    importPreviewCount.value = String(COLOR_IMPORT_DEFAULT_COUNT);
    importPreviewName.value = '';
    newPaletteRow.classList.add('hidden'); // mutually exclusive with the plain "+ New Palette" row
    // Unhide before measuring - .hidden is display:none, which has no box
    // to read a size from (see js/canvas-settings.js's positionPanel).
    importPreviewRow.classList.remove('hidden');
    positionPanelBelow(importPreviewRow, importPaletteButton);
    reExtractImportPreview();
  });

  importPreviewCount.addEventListener('change', reExtractImportPreview);
  importPreviewCount.addEventListener('input', reExtractImportPreview);

  importPreviewClose.addEventListener('click', closeImportPreview);

  // Close on outside click/Escape too, not just the explicit close button
  // - standard popover behavior, same as Canvas Settings/Export.
  document.addEventListener('pointerdown', (e) => {
    if (importPreviewRow.classList.contains('hidden')) return;
    if (importPreviewRow.contains(e.target)) return;
    if (e.target === importPaletteButton || importPaletteButton.contains(e.target)) return;
    closeImportPreview();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !importPreviewRow.classList.contains('hidden')) closeImportPreview();
  });

  importPreviewCancel.addEventListener('click', () => {
    closeImportPreview();
  });

  importPreviewSave.addEventListener('click', async () => {
    const name = importPreviewName.value.trim();
    if (!name) return; // nothing entered - no-op, stay open
    const created = await createColorPalette(name, [...importPreviewColors]);
    activePaletteId = created.id;
    closeImportPreview();
    await loadColorPalettes();
  });

  // Generate ramp (7-add-palette-color-ramp-generator): a source color
  // (whichever swatch the color-picker popover is editing, or the current
  // Foreground color from the Color Library header) + step count ->
  // generateColorRamp -> live preview -> Confirm adds every generated
  // color to the active palette via addColorToPalette, same "extract,
  // preview, then save" shape as the import-palette flow above.
  const rampPreviewRow = document.getElementById('ramp-preview-row');
  const rampPreviewClose = document.getElementById('ramp-preview-close');
  const rampPreviewGrid = document.getElementById('ramp-preview-grid');
  const rampPreviewSteps = document.getElementById('ramp-preview-steps');
  const rampPreviewConfirm = document.getElementById('ramp-preview-confirm');
  const rampPreviewCancel = document.getElementById('ramp-preview-cancel');
  const colorPickerGenerateRamp = document.getElementById('color-picker-generate-ramp');
  const libraryGenerateRampButton = document.getElementById('library-generate-ramp-button');
  // Source color (hex) and preview colors for the ramp currently open;
  // null/empty when no ramp preview is open.
  let rampSourceHex = null;
  let rampPreviewColors = [];
  let rampAnchorEl = null;

  function renderRampPreview() {
    rampPreviewGrid.innerHTML = '';
    for (const hex of rampPreviewColors) {
      const swatch = document.createElement('div');
      swatch.className = 'color-library-swatch';
      swatch.style.background = hex;
      rampPreviewGrid.appendChild(swatch);
    }
  }

  function regenerateRampPreview() {
    if (!rampSourceHex) return;
    const steps = Math.min(
      RAMP_MAX_STEPS,
      Math.max(RAMP_MIN_STEPS, Math.round(Number(rampPreviewSteps.value)) || RAMP_DEFAULT_STEPS)
    );
    rampPreviewSteps.value = String(steps);
    rampPreviewColors = generateColorRamp(rampSourceHex, steps);
    renderRampPreview();
  }

  function closeRampPreview() {
    rampPreviewRow.classList.add('hidden');
    rampSourceHex = null;
    rampPreviewColors = [];
    rampAnchorEl = null;
  }

  function openRampPreview(rgba, anchorEl) {
    closeImportPreview(); // mutually exclusive with the other Color Library popovers
    rampSourceHex = rgbaToHex(rgba);
    rampAnchorEl = anchorEl;
    rampPreviewSteps.value = String(RAMP_DEFAULT_STEPS);
    // Unhide before measuring - .hidden is display:none, which has no box
    // to read a size from (see positionPanelBelow's callers).
    rampPreviewRow.classList.remove('hidden');
    positionPanelBelow(rampPreviewRow, anchorEl);
    regenerateRampPreview();
  }

  colorPickerGenerateRamp.addEventListener('click', () => {
    const current = colorPickerTarget === 'background' ? state.backgroundColor : state.foregroundColor;
    openRampPreview(current, colorPickerGenerateRamp);
  });

  libraryGenerateRampButton.addEventListener('click', () => {
    openRampPreview(state.foregroundColor, libraryGenerateRampButton);
  });

  rampPreviewSteps.addEventListener('change', regenerateRampPreview);
  rampPreviewSteps.addEventListener('input', regenerateRampPreview);

  rampPreviewClose.addEventListener('click', closeRampPreview);
  rampPreviewCancel.addEventListener('click', closeRampPreview);

  rampPreviewConfirm.addEventListener('click', async () => {
    for (const hex of rampPreviewColors) {
      await addColorToPalette(activePaletteId, hex);
    }
    closeRampPreview();
    await loadColorPalettes();
  });

  // Close on outside click/Escape too, not just the explicit close button
  // - standard popover behavior, same as the import-preview popover above.
  document.addEventListener('pointerdown', (e) => {
    if (rampPreviewRow.classList.contains('hidden')) return;
    if (rampPreviewRow.contains(e.target)) return;
    if (rampAnchorEl && (e.target === rampAnchorEl || rampAnchorEl.contains(e.target))) return;
    closeRampPreview();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !rampPreviewRow.classList.contains('hidden')) closeRampPreview();
  });

  // Collapse-to-header (Photoshop-accordion style) for Color Library and
  // Layers - see syncColorLibraryCollapse/syncLayersCollapse below and
  // bindPanelHeaderCollapse's doc comment for the click/keyboard handling
  // shared between them.
  syncColorLibraryCollapse();
  bindPanelHeaderCollapse(colorLibraryHeader, () => {
    state.colorLibraryCollapsed = !state.colorLibraryCollapsed;
    syncColorLibraryCollapse();
  });

  loadColorPalettes(); // async; renders the panel once palettes arrive

  colorLibrarySelect.addEventListener('change', () => {
    activePaletteId = colorLibrarySelect.value;
    renderColorLibraryPanel();
  });

  addCurrentColorButton.addEventListener('click', () => {
    addCurrentColorToActivePalette(state.foregroundColor);
  });

  addPaletteButton.addEventListener('click', () => {
    closeImportPreview(); // mutually exclusive with the import preview row
    newPaletteName.value = '';
    newPaletteRow.classList.remove('hidden');
    newPaletteName.focus();
  });

  newPaletteCancel.addEventListener('click', () => {
    newPaletteRow.classList.add('hidden');
  });

  newPaletteSave.addEventListener('click', async () => {
    const name = newPaletteName.value.trim();
    if (!name) return; // nothing entered - no-op, stay open
    // Magic palette easter eggs - see MAGIC_PALETTES.
    const magicName = name.toLowerCase();
    const magicColors = MAGIC_PALETTES[magicName];
    const created = await createColorPalette(name, magicColors ? [...magicColors] : []);
    activePaletteId = created.id;
    newPaletteRow.classList.add('hidden');
    await loadColorPalettes();
    if (magicColors) {
      if (magicName === 'matrix') {
        matrixRain();
      } else {
        const gridRect = colorLibraryGrid.getBoundingClientRect();
        confettiBurst(gridRect.left + gridRect.width / 2, gridRect.top, 24, 160);
      }
    }
  });

  deletePaletteButton.addEventListener('click', async () => {
    if (colorPalettes.length <= 1) return; // can't delete the only palette
    const active = colorPalettes.find((p) => p.id === activePaletteId);
    if (active?.isDefault) return; // can't delete the built-in default palette
    const proceed = await confirmDialog({
      title: 'Delete palette?',
      message: `Delete "${active?.name ?? 'this palette'}" and all its colors? This can't be undone.`,
    });
    if (!proceed) return;
    await deleteColorPalette(activePaletteId);
    activePaletteId = null; // loadColorPalettes falls back to the first remaining
    await loadColorPalettes();
  });

  // Layers panel: collapse-to-header via its own header click, plus the
  // pre-existing bottom-bar toggle (#layers-panel-toggle) - both drive
  // and reflect the same state.layersPanelVisible flag (see
  // syncLayersCollapse), so either control collapses/expands the panel
  // identically. Independent of the Brushes panel's tool-scoped
  // visibility (toggling one never touches the other).
  layersPanel = document.getElementById('layers-panel');
  layersPanelHeader = document.getElementById('layers-panel-header');
  layersPanelToggle = document.getElementById('layers-panel-toggle');
  syncLayersCollapse();
  layersPanelToggle.addEventListener('click', () => {
    state.layersPanelVisible = !state.layersPanelVisible;
    syncLayersCollapse();
  });
  bindPanelHeaderCollapse(layersPanelHeader, () => {
    state.layersPanelVisible = !state.layersPanelVisible;
    syncLayersCollapse();
  });

  // Layers panel toolbar (Blend mode + Opacity) - edits whichever layer
  // is active, Photoshop-style, rather than living inline in every row
  // (see buildLayerRow/syncLayersPanelToolbar). One line: Blend mode
  // sized to its own text, Opacity as a button that opens a small
  // popover (slider + number field) instead of an always-visible
  // slider - see openLayersOpacityPopover/closeLayersOpacityPopover.
  layersPanelBlendSelect = document.getElementById('layers-panel-blend-select');
  for (const mode of BLEND_MODES) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode[0].toUpperCase() + mode.slice(1);
    layersPanelBlendSelect.appendChild(option);
  }
  layersPanelBlendSelect.addEventListener('change', () => {
    state.layerStack.setBlendMode(state.layerStack.getActiveIndex(), layersPanelBlendSelect.value);
    state.canvasView.render();
    commit();
  });

  layersPanelOpacityToggle = document.getElementById('layers-panel-opacity-toggle');
  layersPanelOpacityReadout = document.getElementById('layers-panel-opacity-readout');
  layersPanelOpacitySlider = document.getElementById('layers-panel-opacity-slider');
  layersPanelOpacityNumber = document.getElementById('layers-panel-opacity-number');
  layersPanelOpacityPopover = document.getElementById('layers-panel-opacity-popover');

  function applyLayerOpacity(value, { commitChange } = {}) {
    const clamped = Math.max(0, Math.min(100, value));
    // Live-update the canvas while dragging/typing, but don't rebuild
    // the panel (that would fight an in-progress edit) or commit every
    // tick - only on the final value (slider "change", number "change").
    state.layerStack.setOpacity(state.layerStack.getActiveIndex(), clamped / 100);
    layersPanelOpacityReadout.textContent = `${clamped}%`;
    layersPanelOpacitySlider.value = String(clamped);
    layersPanelOpacityNumber.value = String(clamped);
    state.canvasView.render();
    if (commitChange) commit();
  }

  layersPanelOpacitySlider.addEventListener('input', () => {
    applyLayerOpacity(Number(layersPanelOpacitySlider.value));
  });
  layersPanelOpacitySlider.addEventListener('change', () => {
    applyLayerOpacity(Number(layersPanelOpacitySlider.value), { commitChange: true });
  });
  layersPanelOpacityNumber.addEventListener('change', () => {
    applyLayerOpacity(Number(layersPanelOpacityNumber.value) || 0, { commitChange: true });
  });

  layersPanelOpacityToggle.addEventListener('click', () => {
    if (layersPanelOpacityPopover.classList.contains('hidden')) {
      openLayersOpacityPopover();
    } else {
      closeLayersOpacityPopover();
    }
  });
  // Close on outside click/Escape, same pattern as #color-picker-popover.
  document.addEventListener('pointerdown', (e) => {
    if (layersPanelOpacityPopover.classList.contains('hidden')) return;
    if (layersPanelOpacityPopover.contains(e.target)) return;
    if (e.target === layersPanelOpacityToggle || layersPanelOpacityToggle.contains(e.target)) return;
    closeLayersOpacityPopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !layersPanelOpacityPopover.classList.contains('hidden')) closeLayersOpacityPopover();
  });

  // Whole right-sidebar visibility toggle (Color Library + Brushes +
  // Layers together), independent of each panel's own collapsed state
  // above - VSCode "toggle sidebar" style.
  rightSidebar = document.getElementById('right-sidebar');
  rightSidebarToggle = document.getElementById('right-sidebar-toggle');
  rightSidebarToggle.addEventListener('click', () => {
    state.rightSidebarVisible = !state.rightSidebarVisible;
    setRightSidebarVisible(state.rightSidebarVisible);
  });

  // Zoom: +/- buttons and the three presets all just call the CanvasView
  // API directly - it owns all the actual zoom/pan math (see design.md).
  zoomReadout = document.getElementById('zoom-readout');
  document.getElementById('zoom-out-button').addEventListener('click', () => state.canvasView.zoomStep(-1));
  document.getElementById('zoom-in-button').addEventListener('click', () => state.canvasView.zoomStep(1));
  document.getElementById('zoom-preset-100').addEventListener('click', () => state.canvasView.setZoomPreset('100'));
  document.getElementById('zoom-preset-fit').addEventListener('click', () => state.canvasView.setZoomPreset('fit'));
  document.getElementById('zoom-preset-fill').addEventListener('click', () => state.canvasView.setZoomPreset('fill'));

  state.undoButton.addEventListener('click', performUndo);
  state.redoButton.addEventListener('click', performRedo);

  // Cmd+Z / Ctrl+Z to undo, Cmd+Shift+Z / Ctrl+Shift+Z (and Ctrl+Y, the
  // common Windows alternative) to redo; Cmd/Ctrl +/- (and the unshifted
  // "=" key "+" lives on) to zoom in/out. Only while the Workspace screen
  // is actually visible, so none of this fires from the Gallery or New
  // Canvas screens.
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (document.getElementById('screen-workspace').classList.contains('hidden')) return;
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

    // Cmd/Ctrl+E: merge layers (merge-layers) - Photoshop's own shortcut
    // for this. Merges the marked set if 2+ layers are marked, otherwise
    // merges the active layer down into the one below it.
    if (key === 'e') {
      e.preventDefault();
      mergeMarkedOrActiveDown();
    }
  });

  // Escape clears the active selection, regardless of which tool is
  // current — unlike the shortcuts above, this one takes no modifier key.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('screen-workspace').classList.contains('hidden')) return;
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
    if (document.getElementById('screen-workspace').classList.contains('hidden')) return;
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

  exportControls = initExport({
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

  state.addLayerButton.addEventListener('click', () => {
    const added = state.layerStack.addLayer();
    if (!added) return;
    clearLayerMarks(); // remaining indices shifted; stale marks would misalign
    state.canvasView.render();
    commit();
    renderLayersPanel();
  });

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
    commit();
    renderLayersPanel(); // same stale-thumbnail issue as drawing commits
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
      state.strokeEngine.strokeFreehand([state.dragStart, state.dragCurrent], rgba, state.pixelPerfect);
    }
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
    const rgba = colorForSequenceIndex(placementIndex);
    const angle = placementIndex * state.brushRotationStep;
    placeBrush(state.strokeEngine, point.x, point.y, state.currentBrush, rgba, angle, state.symmetryMode);
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
    foregroundColor: hexToRgba(PALETTE[0]),
    backgroundColor: hexToRgba('#ffffff'),
    currentBrush: allBrushes[0],
    brushRainbow: false,
    brushSpacing: 1,
    brushRotationStep: 0,
    brushPath: [],
    pixelPerfect: false,
    symmetryMode: 'off',
    pencilSize: 1,
    pencilOpacity: 1,
    colorLibrarySequence: false,
    rectangleFilled: false,
    squareConstraint: false,
    // Despite the name, this now means "expanded" rather than "shown" -
    // collapsing the Layers panel (via its header or #layers-panel-toggle)
    // no longer removes it, just shrinks it to its header row (see
    // syncLayersCollapse). Kept as one boolean/name rather than renamed,
    // since every call site already reads naturally either way.
    layersPanelVisible: true,
    colorLibraryCollapsed: false,
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
  // Color palettes (colorPalettes) are global and NOT reset here - only
  // which color is currently selected resets, back to the first preset
  // (matching state.foregroundColor's default above).
  colorPickerTarget = 'foreground';
  closeColorPicker();
  updateColorPickerInputs(state.foregroundColor);
  updateFgBgSwatches();
  syncActiveSwatch();
  renderBrushesPanel();
  brushesPanel.classList.toggle('hidden', state.currentTool !== 'brush');
  closeBrushEditor();
  document.getElementById('brush-spacing').value = '1';
  document.getElementById('brush-rotation').value = '0';
  pixelPerfectToggle.classList.remove('active');
  updateSymmetryToggle();
  syncLayersCollapse();
  syncColorLibraryCollapse();
  closeLayersOpacityPopover();
  setRightSidebarVisible(true);
  // Default tool is Pencil, so the panel starts visible; sliders/readouts
  // reset to match state.pencilSize/pencilOpacity's defaults (1, 1).
  pencilOptionsPanel.classList.remove('hidden');
  document.getElementById('pencil-size-slider').value = '1';
  document.getElementById('pencil-size-readout').textContent = '1px';
  document.getElementById('pencil-opacity-slider').value = '100';
  document.getElementById('pencil-opacity-readout').textContent = '100%';
  librarySequenceToggle.classList.remove('active');
  librarySequencePanel.classList.remove('hidden'); // Pencil is the default tool
  // Rectangle isn't the default tool, so its options start hidden.
  rectangleOptionsPanel.classList.add('hidden');
  document.getElementById('rectangle-fill-toggle').classList.remove('active');
  document.getElementById('rectangle-fill-icon-outline').classList.remove('hidden');
  document.getElementById('rectangle-fill-icon-filled').classList.add('hidden');
  // Neither Rectangle nor Selection is the default tool, so this starts
  // hidden too.
  squareConstraintPanel.classList.add('hidden');
  squareConstraintToggle.classList.remove('active');
  // Hand tool is never the default (Pencil is) - every freshly opened
  // project starts with single-pointer drag drawing, not panning.
  canvasView.setPanMode(false);
  canvasView.setMoveMode(false);

  canvasSettingsControls.setCurrentSize(layerStack.width, layerStack.height);
  canvasSettingsControls.setCurrentName(projectName);
  canvasSettingsControls.close();
  exportControls.close();

  // Selections don't persist with the project (see shape-tools spec) — a
  // freshly opened project always starts with none.
  canvasView.setSelectionRect(null);
  updateSelectionControls();

  // Baseline snapshot so the very first stroke can be undone back to
  // whatever state the project was in when opened.
  state.undoStack.push(layerStack.snapshot());
  updateUndoRedoButtons();
  renderLayersPanel();

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
        commit();
        // Bucket fill changes the active layer's pixel content - the
        // Layers panel's per-row thumbnail (buildLayerThumbnailCanvas)
        // only updates on a full re-render, unlike the live canvas.
        renderLayersPanel();
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
        state.pixelPerfect,
        withSymmetry(pencilOrEraserApplyPixel(activeEngine), activeEngine)
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
        state.pixelPerfect,
        withSymmetry(pencilOrEraserApplyPixel(state.strokeEngine), state.strokeEngine)
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
      commit();
      // Every drawing tool (pencil, eraser, brush, line, rectangle,
      // selection move) funnels through here - the Layers panel's
      // per-row thumbnail only updates on a full re-render, unlike the
      // live canvas, so without this it goes stale until some other
      // action (add layer, hide/show layer) happens to trigger one.
      renderLayersPanel();
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
