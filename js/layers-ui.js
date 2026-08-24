// The Layers panel - add/delete/reorder/rename, visibility, blend mode,
// layer opacity, background layer, reference image layer, merge layers.
// LayerStack itself (lib/pixel-engine/layers.js) is untouched here -
// add/delete/reorder/setVisibility/setOpacity/setBlendMode/mergeLayers/
// mergeDown/addReferenceImageLayer/etc. are all already-public methods,
// this module is purely the UI that calls them, via workspace.js's
// getLayerStack/renderCanvas/commit/onWorkspaceReset/
// bindPanelHeaderCollapse. workspace.js calls back into this module's
// renderLayersPanel/clearLayerMarksAndRefresh/mergeMarkedOrActiveDown
// directly (commit()/undo()/redo()/the Cmd+E shortcut) - Layers is a
// permanent part of the app, not an optional plugin, so there's no hook
// indirection between the two files, just ordinary (circular) ES module
// imports.

import { getLayerStack, renderCanvas, commit, onWorkspaceReset, bindPanelHeaderCollapse } from './workspace.js';
import { BLEND_MODES } from '../lib/pixel-engine/layers.js';
import { decodeImageFile, fitImageToCanvas } from './image-import.js';
import { confirmDialog } from './confirm-dialog.js';

/**
 * Pure state transition for Layers panel marking (multi-select) -
 * merge-layers's marked set is distinct from the single active layer.
 * `layers` is the current stack in bottom-to-top order (as from
 * LayerStack.getLayers()), each needing only `id`/`isBackground`/
 * `isReferenceImage`. `marked` is the current marked-id Set;
 * `lastClickedId` is the id most recently clicked (of any kind), used as
 * the Shift+click range anchor. A locked layer (Background or reference
 * image - see LayerStack's private `#isLocked`) can never be marked,
 * whichever click type targets it. Exported as a pure function so this
 * logic is unit-testable (see test/layers-marking.test.js) without a DOM
 * harness - the row click handler below calls this and applies the
 * result.
 *
 * - Cmd/Ctrl+click: toggles `clickedId` in the marked set, other marks
 *   untouched. A no-op on the marked set itself if `clickedId` is a locked
 *   layer (it can never be marked), but the anchor still updates.
 * - Shift+click (with a prior `lastClickedId`): marks every unlocked
 *   layer between `lastClickedId` and `clickedId` (inclusive), replacing
 *   any prior marks. With no prior `lastClickedId`, falls back to plain
 *   click behavior.
 * - Plain click (no modifier): clears all marks, same as it would for any
 *   other row - including a locked layer, which only can't itself become
 *   marked, same as the Background layer already can become the active
 *   layer today (a reference image layer cannot - see
 *   LayerStack.setActiveLayer). The active-layer change itself is handled
 *   by the caller.
 */
export function computeLayerMarkState({ marked, lastClickedId, clickedId, layers, metaOrCtrl, shift }) {
  const isLocked = (l) => !!l?.isBackground || !!l?.isReferenceImage;
  const clickedLayer = layers.find((l) => l.id === clickedId);
  const clickedIsLocked = isLocked(clickedLayer);

  if (metaOrCtrl) {
    if (clickedIsLocked) return { marked, lastClickedId: clickedId };
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
        if (!isLocked(layers[i])) next.add(layers[i].id);
      }
      return { marked: next, lastClickedId: clickedId };
    }
  }

  // Plain click, or Shift with no valid anchor: clears all marks and
  // updates the anchor to this row, whether or not it's a locked layer.
  return { marked: new Set(), lastClickedId: clickedId };
}

// Layers panel marking (multi-select), for merge-layers - transient UI
// state, not persisted and not part of the undo snapshot. markedLayerIds
// holds layer ids (not indices), so marks survive an unrelated
// renderLayersPanel() re-run between a mark and a merge (e.g. after a
// visibility toggle shifts nothing, but a reorder would shift indices).
// lastMarkClickedLayerId is the Shift+click range anchor - updated by
// every click (plain, Cmd/Ctrl, or Shift alike). Both reset on layer
// add/delete and undo/redo.
let markedLayerIds = new Set();
let lastMarkClickedLayerId = null;
function clearLayerMarks() {
  markedLayerIds = new Set();
  lastMarkClickedLayerId = null;
}

// The decoded source image behind the reference image layer's last
// upload (js/image-import.js's decodeImageFile result), and whether that
// upload's downscale was smoothed - "keep the source around so a later
// setting change can re-derive from it" (same pattern the Brush editor's
// Import uses). Reset on every project open/switch (onWorkspaceReset
// below) and whenever the reference layer itself is deleted.
let referenceImageSourceImage = null;
let referenceImageSmoothing = true;

let layersPanelVisible = true;

// DOM refs, assigned once in initLayers() - single active instance, same
// module-level-state pattern workspace.js itself uses (see that file's
// own `root`/`state` comment).
let layersPanel = null;
let layersPanelHeader = null;
let layersPanelToggle = null;
let layersPanelList = null;
let layersPanelBlendSelect = null;
let layersPanelOpacityToggle = null;
let layersPanelOpacityReadout = null;
let layersPanelOpacitySlider = null;
let layersPanelOpacityNumber = null;
let layersPanelOpacityPopover = null;
let addLayerButton = null;
let addReferenceImageButton = null;
let addReferenceImageInput = null;

function syncLayersCollapse() {
  const collapsed = !layersPanelVisible;
  layersPanel.classList.toggle('collapsed', collapsed);
  layersPanelHeader.setAttribute('aria-expanded', String(!collapsed));
  layersPanelToggle.classList.toggle('active', !collapsed);
}

/**
 * Renders `layer`'s actual pixel content into a small canvas - a real
 * thumbnail preview, Photoshop-style, not a generic placeholder.
 */
function buildLayerThumbnailCanvas(layer) {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer-thumbnail';
  canvas.width = layer.engine.width;
  canvas.height = layer.engine.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(layer.engine.data), layer.engine.width, layer.engine.height),
    0,
    0
  );
  return canvas;
}

/**
 * Syncs the panel-level Blend mode/Opacity toolbar to the currently
 * active layer - Photoshop-style, these controls edit whichever layer
 * is selected rather than living inline in every row.
 */
function syncLayersPanelToolbar() {
  const layer = getLayerStack().getActiveLayer();
  if (!layer) return;
  layersPanelBlendSelect.value = layer.blendMode;
  const opacityPercent = Math.round(layer.opacity * 100);
  layersPanelOpacitySlider.value = String(opacityPercent);
  layersPanelOpacityNumber.value = String(opacityPercent);
  layersPanelOpacityReadout.textContent = `${opacityPercent}%`;
}

/**
 * Re-renders the whole panel from the current LayerStack. Called
 * directly by workspace.js's commit() (every drawing tool included) - a
 * layer's thumbnail only updates on a full re-render, unlike the live
 * canvas, so this is the single chokepoint that keeps it from going
 * stale, instead of a call at every mutating handler below.
 */
export function renderLayersPanel() {
  const layerStack = getLayerStack();
  const layers = layerStack.getLayers();
  const activeIndex = layerStack.getActiveIndex();
  layersPanelList.innerHTML = '';

  // Topmost layer (end of the bottom-to-top array) listed first.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const isMarked = markedLayerIds.has(layer.id);
    layersPanelList.appendChild(buildLayerRow(layer, i, i === activeIndex, isMarked, layers));
  }

  addLayerButton.disabled = layers.length >= 8;
  // At most one reference image layer per canvas (also refused past the
  // 8-layer cap, same as addLayerButton above) - LayerStack.
  // addReferenceImageLayer enforces this too, this is just the
  // matching disabled UI state.
  addReferenceImageButton.disabled = layers.length >= 8 || layers.some((l) => l.isReferenceImage);
  syncLayersPanelToolbar();
}

/**
 * Clears merge marks and re-renders the panel - called directly by
 * workspace.js's performUndo/performRedo, which don't call commit() (they
 * restore a snapshot via autoSave directly): restored indices may no
 * longer match what was marked, so marks are cleared either way and the
 * panel refreshes.
 */
export function clearLayerMarksAndRefresh() {
  clearLayerMarks();
  renderLayersPanel();
}

/**
 * A single compact row - thumbnail, visibility, name, and small
 * reorder/delete icons - Photoshop's own Layers panel row, adapted to
 * this app's tap-to-reorder and per-row delete icon. Blend mode/
 * Opacity are NOT here - see the panel-level toolbar/
 * syncLayersPanelToolbar. Every mutating handler here calls commit(),
 * which calls renderLayersPanel() directly - no separate
 * renderLayersPanel() call needed in most of them.
 */
function buildLayerRow(layer, index, isActive, isMarked, layers) {
  const layerStack = getLayerStack();
  const layerCount = layers.length;
  const row = document.createElement('div');
  row.className = 'layer-row' + (isActive ? ' active' : '') + (isMarked ? ' marked' : '');
  row.addEventListener('click', (e) => {
    if (e.target.closest('button, input')) return;
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
      layerStack.setActiveLayer(index);
    }
    renderLayersPanel(); // no commit - just a selection/mark change
  });

  const visibilityButton = document.createElement('button');
  visibilityButton.type = 'button';
  visibilityButton.className = 'layer-visibility-toggle icon-button';
  visibilityButton.innerHTML = `<span class="material-symbols-outlined">${layer.visible ? 'visibility' : 'visibility_off'}</span>`;
  visibilityButton.dataset.tooltip = layer.visible ? 'Hide layer' : 'Show layer';
  visibilityButton.setAttribute('aria-label', layer.visible ? 'Hide layer' : 'Show layer');
  visibilityButton.addEventListener('click', () => {
    layerStack.setVisibility(index, !layer.visible);
    renderCanvas();
    commit();
  });

  const thumbnail = buildLayerThumbnailCanvas(layer);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'layer-name-input';
  nameInput.value = layer.name;
  nameInput.addEventListener('change', () => {
    layerStack.renameLayer(index, nameInput.value.trim() || layer.name);
    commit();
  });

  // Background layer is locked in stacking position; reference image
  // layer is locked against becoming the active/drawing layer, being
  // merged, and being marked for merge, but - unlike Background - is
  // freely reorderable, so the user can move it below their drawing
  // layers instead of it permanently sitting on top blocking the view.
  // The lock icon reflects both kinds of restriction; only the reorder
  // buttons below care about which kind.
  let lockIcon = null;
  if (layer.isBackground || layer.isReferenceImage) {
    lockIcon = document.createElement('span');
    lockIcon.className = 'material-symbols-outlined layer-lock-icon';
    lockIcon.textContent = 'lock';
    lockIcon.title = layer.isReferenceImage
      ? 'Reference image layer - non-drawable, excluded from export, but can be reordered'
      : 'Background layer - locked in position';
  }

  // A swap moves both layers involved (see LayerStack.moveLayerUp/
  // moveLayerDown's matching comment), so a button is disabled not
  // just when its own layer is position-locked (Background only -
  // reference image layers ARE reorderable), but also when the
  // neighbor it would swap into is - either way the move is refused.
  const isPositionLocked = (l) => l?.isBackground;
  const upButton = document.createElement('button');
  upButton.type = 'button';
  upButton.className = 'layer-reorder-button';
  upButton.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
  upButton.dataset.tooltip = 'Move layer up';
  upButton.setAttribute('aria-label', 'Move layer up');
  upButton.disabled = index === layerCount - 1 || isPositionLocked(layer) || isPositionLocked(layers[index + 1]);
  upButton.addEventListener('click', () => {
    layerStack.moveLayerUp(index);
    renderCanvas();
    commit();
  });

  const downButton = document.createElement('button');
  downButton.type = 'button';
  downButton.className = 'layer-reorder-button';
  downButton.innerHTML = '<span class="material-symbols-outlined">arrow_downward</span>';
  downButton.dataset.tooltip = 'Move layer down';
  downButton.setAttribute('aria-label', 'Move layer down');
  downButton.disabled = index === 0 || isPositionLocked(layer) || isPositionLocked(layers[index - 1]);
  downButton.addEventListener('click', () => {
    layerStack.moveLayerDown(index);
    renderCanvas();
    commit();
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'layer-delete-button icon-button no-buzz';
  deleteButton.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  deleteButton.dataset.tooltip = 'Delete layer';
  deleteButton.setAttribute('aria-label', 'Delete layer');
  deleteButton.disabled = layerCount <= 1;
  deleteButton.addEventListener('click', async () => {
    const proceed = await confirmDialog({
      title: 'Delete layer?',
      message: `Delete "${layer.name}"? This can't be undone.`,
    });
    if (!proceed) return;
    layerStack.deleteLayer(index);
    clearLayerMarks(); // remaining indices shifted; stale marks would misalign
    if (layer.isReferenceImage) {
      // Forget the stored source - a future upload adds a new reference
      // layer from scratch and should default back to smoothed, not
      // silently reuse a deleted layer's source/setting.
      referenceImageSourceImage = null;
      referenceImageSmoothing = true;
    }
    renderCanvas();
    commit();
  });

  // Reference image layer only: toggles between 'pixelated' (fit/
  // downscaled to this canvas's fixed pixel grid) and 'original'
  // (rendered on-screen at the source image's own native resolution).
  // The icon shows the CURRENT mode. Switching TO 'pixelated' always
  // works; switching TO 'original' needs the layer's
  // originalSourceBlob, so the button is disabled when that's
  // unavailable.
  let modeToggleButton = null;
  if (layer.isReferenceImage) {
    const canGoOriginal = layer.referenceMode === 'original' || !!layer.originalSourceBlob;
    modeToggleButton = document.createElement('button');
    modeToggleButton.type = 'button';
    modeToggleButton.className = 'layer-reference-mode-toggle icon-button no-buzz';
    modeToggleButton.innerHTML = `<span class="material-symbols-outlined">${layer.referenceMode === 'original' ? 'image' : 'grid_on'}</span>`;
    modeToggleButton.disabled = !canGoOriginal;
    modeToggleButton.dataset.tooltip = modeToggleButton.disabled
      ? 'Upload a new reference image to enable Original resolution mode'
      : layer.referenceMode === 'original'
        ? 'Original resolution (un-pixelated) - click to switch to Pixelated (fit to canvas grid)'
        : 'Pixelated (fit to canvas grid) - click to switch to Original resolution';
    modeToggleButton.setAttribute('aria-label', 'Toggle reference image resolution mode');
    modeToggleButton.addEventListener('click', () => {
      layerStack.setReferenceMode(layer.referenceMode === 'original' ? 'pixelated' : 'original');
      renderCanvas();
      commit();
    });
  }

  // Reference image layer, Pixelated mode only: toggles whether the
  // last upload's downscale was smoothed (blended average, can look
  // flat/"vectorized" on a canvas this small) or nearest-neighbor
  // (blockier, no blending). Hidden entirely (not just disabled) in
  // Original mode. Disabled if the source image isn't held in memory
  // (e.g. after a page reload) since there's nothing to re-fit from
  // without re-uploading.
  let smoothingToggleButton = null;
  if (layer.isReferenceImage && layer.referenceMode === 'pixelated') {
    smoothingToggleButton = document.createElement('button');
    smoothingToggleButton.type = 'button';
    smoothingToggleButton.className = 'layer-reference-smoothing-toggle icon-button no-buzz';
    smoothingToggleButton.innerHTML = `<span class="material-symbols-outlined">${referenceImageSmoothing ? 'blur_on' : 'blur_off'}</span>`;
    smoothingToggleButton.disabled = !referenceImageSourceImage;
    smoothingToggleButton.dataset.tooltip = smoothingToggleButton.disabled
      ? 'Re-upload the reference image to change smoothing (not available after a page reload)'
      : referenceImageSmoothing
        ? 'Smoothed downscale (may look flat/"vectorized") - click for a blockier, unsmoothed one'
        : 'Blocky, unsmoothed downscale - click for a smoothed one';
    smoothingToggleButton.setAttribute('aria-label', 'Toggle reference image smoothing');
    smoothingToggleButton.addEventListener('click', () => {
      referenceImageSmoothing = !referenceImageSmoothing;
      const imageData = fitImageToCanvas(referenceImageSourceImage, layerStack.width, layerStack.height, referenceImageSmoothing);
      layerStack.updateReferenceImageData(imageData.data);
      renderCanvas();
      commit();
    });
  }

  const actions = document.createElement('div');
  actions.className = 'layer-row-actions';
  actions.append(upButton, downButton, deleteButton);

  row.append(visibilityButton, thumbnail, nameInput);
  if (lockIcon) row.append(lockIcon);
  if (modeToggleButton) row.append(modeToggleButton);
  if (smoothingToggleButton) row.append(smoothingToggleButton);
  row.append(actions);
  return row;
}

/**
 * Positions and shows #layers-panel-opacity-popover anchored below the
 * Layers toolbar row (#layers-panel-opacity-toggle) - clamp-to-viewport
 * approach, opening below rather than to the side since the toggle
 * sits inside the right sidebar's narrow column.
 */
function openLayersOpacityPopover() {
  layersPanelOpacityPopover.classList.remove('hidden'); // unhide before measuring
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
 * Cmd/Ctrl+E: merges the marked set (2+ layers) if one exists,
 * otherwise merges the active layer down into the layer directly
 * below it. Marks are always cleared afterward, win or no-op, so a
 * merge attempt never leaves stale marks referring to layers that no
 * longer exist in their marked positions. Only a successful merge
 * re-renders/commits - the no-op paths (bottom-most active layer,
 * single-layer stack, Background layer involved) leave the stack and
 * undo history untouched. Called directly by workspace.js's Cmd/Ctrl+E
 * keydown handler.
 */
export function mergeMarkedOrActiveDown() {
  const layerStack = getLayerStack();
  const layers = layerStack.getLayers();
  const markedIndices = layers
    .map((layer, i) => (markedLayerIds.has(layer.id) ? i : -1))
    .filter((i) => i !== -1);

  const merged =
    markedIndices.length >= 2
      ? layerStack.mergeLayers(markedIndices)
      : layerStack.mergeDown(layerStack.getActiveIndex());

  clearLayerMarks();
  if (!merged) return;

  renderCanvas();
  commit();
}

/** Wires the Layers panel's DOM once - see workspace.js's own bindDomOnce for the analogous pattern. */
export function initLayers(root = document) {
  layersPanel = root.querySelector('#layers-panel');
  layersPanelHeader = root.querySelector('#layers-panel-header');
  layersPanelToggle = root.querySelector('#layers-panel-toggle');
  layersPanelList = root.querySelector('#layers-panel-list');
  layersPanelBlendSelect = root.querySelector('#layers-panel-blend-select');
  layersPanelOpacityToggle = root.querySelector('#layers-panel-opacity-toggle');
  layersPanelOpacityReadout = root.querySelector('#layers-panel-opacity-readout');
  layersPanelOpacitySlider = root.querySelector('#layers-panel-opacity-slider');
  layersPanelOpacityNumber = root.querySelector('#layers-panel-opacity-number');
  layersPanelOpacityPopover = root.querySelector('#layers-panel-opacity-popover');
  addLayerButton = root.querySelector('#add-layer-button');
  addReferenceImageButton = root.querySelector('#add-reference-image-button');
  addReferenceImageInput = root.querySelector('#add-reference-image-input');

  syncLayersCollapse();
  layersPanelToggle.addEventListener('click', () => {
    layersPanelVisible = !layersPanelVisible;
    syncLayersCollapse();
  });
  bindPanelHeaderCollapse(layersPanelHeader, () => {
    layersPanelVisible = !layersPanelVisible;
    syncLayersCollapse();
  });

  // Layers panel toolbar (Blend mode + Opacity) - edits whichever layer
  // is active, Photoshop-style, rather than living inline in every row.
  for (const mode of BLEND_MODES) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode[0].toUpperCase() + mode.slice(1);
    layersPanelBlendSelect.appendChild(option);
  }
  layersPanelBlendSelect.addEventListener('change', () => {
    const layerStack = getLayerStack();
    layerStack.setBlendMode(layerStack.getActiveIndex(), layersPanelBlendSelect.value);
    renderCanvas();
    commit();
  });

  function applyLayerOpacity(value, { commitChange } = {}) {
    const clamped = Math.max(0, Math.min(100, value));
    const layerStack = getLayerStack();
    // Live-update the canvas while dragging/typing, but don't rebuild
    // the panel (that would fight an in-progress edit) or commit every
    // tick - only on the final value (slider "change", number "change").
    layerStack.setOpacity(layerStack.getActiveIndex(), clamped / 100);
    layersPanelOpacityReadout.textContent = `${clamped}%`;
    layersPanelOpacitySlider.value = String(clamped);
    layersPanelOpacityNumber.value = String(clamped);
    renderCanvas();
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
  document.addEventListener('pointerdown', (e) => {
    if (layersPanelOpacityPopover.classList.contains('hidden')) return;
    if (layersPanelOpacityPopover.contains(e.target)) return;
    if (e.target === layersPanelOpacityToggle || layersPanelOpacityToggle.contains(e.target)) return;
    closeLayersOpacityPopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !layersPanelOpacityPopover.classList.contains('hidden')) closeLayersOpacityPopover();
  });

  addLayerButton.addEventListener('click', () => {
    const layerStack = getLayerStack();
    const added = layerStack.addLayer();
    if (!added) return;
    clearLayerMarks(); // remaining indices shifted; stale marks would misalign
    renderCanvas();
    commit();
  });

  // Decode via the shared image-import helper, but skip Color Library
  // import's downsample/pixelate/quantize step entirely -
  // fitImageToCanvas keeps full fidelity (no palette reduction, no
  // forced pixelation), only scaling down (never up, never stretched)
  // when the source is larger than the canvas. addReferenceImageButton
  // is disabled by renderLayersPanel once a reference layer already
  // exists, so this handler doesn't need its own guard beyond what
  // addReferenceImageLayer already refuses.
  addReferenceImageButton.addEventListener('click', () => addReferenceImageInput.click());
  addReferenceImageInput.addEventListener('change', async () => {
    const file = addReferenceImageInput.files?.[0];
    addReferenceImageInput.value = '';
    if (!file) return;
    const image = await decodeImageFile(file);
    if (!image) return; // unsupported/corrupt file - fail silently, no crash
    referenceImageSmoothing = true; // every new upload starts smoothed, in case Pixelated mode is chosen later
    const layerStack = getLayerStack();
    const imageData = fitImageToCanvas(image, layerStack.width, layerStack.height, referenceImageSmoothing);
    // A fresh upload defaults to 'original' mode - `file` (the raw
    // upload, a Blob) is kept on the Layer itself as originalSourceBlob,
    // both for on-screen Original-mode rendering and so it survives a
    // reload via toProjectRecord/fromProjectRecord.
    const added = layerStack.addReferenceImageLayer(imageData.data, 'Reference', {
      referenceMode: 'original',
      originalSourceBlob: file,
    });
    if (!added) return; // already has one, or at the 8-layer cap
    referenceImageSourceImage = image; // kept for the Pixelated-mode smoothing toggle to re-fit from
    renderCanvas();
    commit();
  });

  onWorkspaceReset(() => {
    layersPanelVisible = true;
    syncLayersCollapse();
    closeLayersOpacityPopover();
    clearLayerMarks();
    // A stale reference-image source from a previously open project
    // would be meaningless (and could get re-fitted onto a differently-
    // sized canvas).
    referenceImageSourceImage = null;
    referenceImageSmoothing = true;
    renderLayersPanel();
  });
}
