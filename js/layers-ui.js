// The Layers panel, after Pixelmator Pro for iPad - rounded row cards
// (thumbnail, name, detail line, visibility checkbox, ⋯ actions on the
// active row), one level of groups with a disclosure chevron, drag to
// reorder by each row's grip, Select mode for touch multi-select, the
// active layer's blend and opacity in a header row, and a group Opacity
// popover. Also the reference image layer's controls.
// LayerStack (lib/pixel-engine/layers.js) does the work; this module is
// purely the UI that calls it, via workspace.js's
// getLayerStack/renderCanvas/commit/onWorkspaceReset/
// bindPanelHeaderCollapse. workspace.js calls back into this module's
// renderLayersPanel/clearLayerMarksAndRefresh/mergeMarkedOrActiveDown
// directly (commit()/undo()/redo()/the Cmd+E shortcut) - Layers is a
// permanent part of the app, not an optional plugin, so there's no hook
// indirection between the two files, just ordinary (circular) ES module
// imports.

import { getLayerStack, renderCanvas, commit, onWorkspaceReset, bindPanelHeaderCollapse, copyActive, cutActive, pasteFromClipboard, selectActiveContent, getSelection } from './workspace.js';
import { BLEND_MODES, REFERENCE_MODES, MAX_LAYERS } from '../lib/pixel-engine/layers.js';
import { contentBounds } from '../lib/pixel-engine/transform.js';
import { decodeImageFile, fitImageToCanvas, UNREADABLE_IMAGE_MESSAGE } from './image-import.js';
import { confirmDialog } from './confirm-dialog.js';
import { showToast } from './toast.js';
import { initMenuButton, menuKeyTarget } from './topbar-menu.js';

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

/**
 * Whether `next` completes a double-click/double-tap begun by `prev` -
 * both `{ layerId, time, x, y }` records of plain clicks on a layer's
 * name. Detected by hand rather than via the native `dblclick` event:
 * every row click re-renders the whole panel, so the two clicks land on
 * different DOM elements, and iOS Safari's tap-synthesized `dblclick` is
 * unreliable anyway. Keyed by layer id so it survives that re-render.
 * `click` fires for mouse, touch and Apple Pencil alike, so one path
 * covers all three (see docs/history/2026-10-02-4b-layer-rename-explicit).
 */
export function isDoubleTap(prev, next, { maxDelay = 400, maxDistance = 10 } = {}) {
  if (!prev || prev.layerId !== next.layerId) return false;
  if (next.time - prev.time > maxDelay) return false;
  return Math.hypot(next.x - prev.x, next.y - prev.y) <= maxDistance;
}

/**
 * The name a rename should commit, or null to keep `current` unchanged -
 * empty/whitespace-only and unchanged names both skip the commit, so
 * they never add an empty undo entry.
 */
export function resolveLayerRename(raw, current) {
  const name = raw.trim();
  return name && name !== current ? name : null;
}

/**
 * Where a dragged layer lands, for LayerStack.moveLayerTo: `items` are
 * the panel's rows top to bottom ({ kind: 'layer', id, groupId } or
 * { kind: 'group', id, memberIds }), `gap` the drop position among them
 * (0 = above the first), `stackIds` the layer ids bottom to top - all
 * without the dragged layer. It goes just above the row under the gap;
 * it joins a group when dropped under that group's header or between
 * two of its members, and stays outside it above the header or under its
 * last member. Null when there's nowhere to go (a group with no other
 * members).
 */
export function dropTarget(items, gap, stackIds) {
  const above = items[gap - 1];
  const below = items[gap];
  if (!below) return { toIndex: 0, groupId: null };
  if (below.kind === 'group') {
    const tops = below.memberIds.map((id) => stackIds.indexOf(id)).filter((i) => i !== -1);
    return tops.length ? { toIndex: Math.max(...tops) + 1, groupId: null } : null;
  }
  const joins = below.groupId && ((above?.kind === 'group' && above.id === below.groupId) || (above?.kind === 'layer' && above.groupId === below.groupId));
  return { toIndex: stackIds.indexOf(below.id) + 1, groupId: joins ? below.groupId : null };
}

// Last plain click on a layer name, for isDoubleTap - transient, and
// deliberately not reset on re-render (that's the point).
let lastNameTap = null;

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

// Select mode (header ⋯ > Select Layers): rows show checkboxes and a tap
// marks instead of activating - the touch way to multi-select, alongside
// Cmd/Ctrl- and Shift-click. Transient UI state.
let selectMode = false;

// What the group Opacity popover is editing: { kind: 'group', id }.
let propertiesTarget = null;

// The rows as shown, top to bottom, rebuilt by every render - for drag
// reorder (dropTarget) and focus restoring.
let displayItems = [];

// DOM refs, assigned once in initLayers() - single active instance, same
// module-level-state pattern workspace.js itself uses (see that file's
// own `root`/`state` comment).
let layersPanel = null;
let layersPanelHeader = null;
let layersPanelToggle = null;
let layersPanelList = null;
let headerBlend = null;
let headerOpacity = null;
let headerOpacityReadout = null;
let layersPanelOpacitySlider = null;
let layersPanelOpacityNumber = null;
let layersPanelOpacityPopover = null;
let addLayerButton = null;
let addReferenceImageButton = null;
let addReferenceImageInput = null;
let selectBar = null;
let selectCount = null;
let selectGroupButton = null;
let selectMergeButton = null;
let layerMenu = null;

function syncLayersCollapse() {
  const collapsed = !layersPanelVisible;
  layersPanel.classList.toggle('collapsed', collapsed);
  layersPanelHeader.setAttribute('aria-expanded', String(!collapsed));
  layersPanelToggle.classList.toggle('active', !collapsed);
}

/**
 * Renders `layer`'s actual pixel content into a small canvas - a real
 * thumbnail preview, not a generic placeholder.
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

const blendLabel = (mode) => mode[0].toUpperCase() + mode.slice(1);

/** The row's second line: what kind of layer, or its blend mode and opacity. */
function layerDetail(layer) {
  if (layer.isBackground) return 'Background';
  if (layer.isReferenceImage) return layer.referenceMode === REFERENCE_MODES.ORIGINAL ? 'Reference · Original' : 'Reference · Pixelated';
  return `${blendLabel(layer.blendMode)} · ${Math.round(layer.opacity * 100)}%`;
}

/** What the header's blend and opacity controls show for the active layer. */
export function headerPropertiesState(layer) {
  if (!layer) return { blendMode: 'normal', opacityPercent: 100, disabled: true };
  return { blendMode: layer.blendMode, opacityPercent: Math.round(layer.opacity * 100), disabled: !!layer.isReferenceImage };
}

function syncHeaderProperties() {
  const layerStack = getLayerStack();
  const state = headerPropertiesState(layerStack.getActiveLayer());
  headerBlend.value = state.blendMode;
  headerBlend.disabled = state.disabled;
  headerOpacity.value = String(state.opacityPercent);
  headerOpacity.disabled = state.disabled;
  headerOpacityReadout.textContent = `${state.opacityPercent}%`;
}

/** Visibility: a round checkbox in the accent colour, checked = shown. */
function buildVisibilitySwitch(name, visible, onChange) {
  const label = document.createElement('label');
  label.className = 'layer-visibility';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'layer-visibility-check';
  input.checked = visible;
  input.setAttribute('aria-label', `Show ${name}`);
  input.addEventListener('change', () => onChange(input.checked));
  label.append(input);
  return label;
}

function iconButton(className, icon, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${className} icon-button`;
  button.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>`;
  button.setAttribute('aria-label', label);
  button.dataset.tooltip = label;
  return button;
}

/**
 * Re-renders the whole panel from the current LayerStack. Called
 * directly by workspace.js's commit() (every drawing tool included) - a
 * layer's thumbnail only updates on a full re-render, unlike the live
 * canvas, so this is the single chokepoint that keeps it from going
 * stale, instead of a call at every mutating handler below.
 */
export function renderLayersPanel() {
  // initLayers() runs only from js/app.js - a Pixi.mount() embed has no
  // Layers panel, but commit() still calls this on every stroke.
  if (!layersPanelList) return;
  const layerStack = getLayerStack();
  const layers = layerStack.getLayers();
  const activeIndex = layerStack.getActiveIndex();
  layersPanelList.innerHTML = '';
  layersPanelList.classList.toggle('selecting', selectMode);
  displayItems = [];

  // Topmost layer (end of the bottom-to-top array) listed first; a group's
  // row goes right above its topmost member, and its members are hidden
  // while it's collapsed.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const group = layer.groupId ? layerStack.getGroup(layer.groupId) : null;
    if (group && layers[i + 1]?.groupId !== group.id) {
      const el = buildGroupRow(group, layerStack.groupMemberIndices(group.id));
      layersPanelList.appendChild(el);
      displayItems.push({ kind: 'group', id: group.id, memberIds: layerStack.groupMemberIndices(group.id).map((m) => layers[m].id), el });
    }
    if (group?.collapsed) continue;
    const el = buildLayerRow(layer, i, i === activeIndex, markedLayerIds.has(layer.id), layers);
    layersPanelList.appendChild(el);
    displayItems.push({ kind: 'layer', id: layer.id, groupId: layer.groupId, el });
  }

  addLayerButton.disabled = layers.length >= MAX_LAYERS;
  // At most one reference image layer per canvas (also refused past the
  // 8-layer cap) - LayerStack.addReferenceImageLayer enforces this too,
  // this is just the matching disabled UI state.
  addReferenceImageButton.disabled = layers.length >= MAX_LAYERS || layers.some((l) => l.isReferenceImage);
  syncSelectBar(layers);
  syncHeaderProperties();
  if (propertiesTarget && !layersPanelOpacityPopover.classList.contains('hidden')) syncPropertiesPopover();
}

function syncSelectBar(layers) {
  selectBar.classList.toggle('hidden', !selectMode);
  if (!selectMode) return;
  const marked = layers.filter((l) => markedLayerIds.has(l.id));
  selectCount.textContent = `${marked.length} selected`;
  selectGroupButton.disabled = !marked.length || marked.some((l) => l.groupId);
  selectMergeButton.disabled = marked.length < 2;
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

/** A rename or double-tap target on a row's name, shared by layers and groups. */
function bindNameTaps(label, key, onRename) {
  label.tabIndex = 0;
  label.title = 'Double-click to rename';
  label.setAttribute('aria-keyshortcuts', 'Enter F2');
  label.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'F2') return;
    e.preventDefault();
    onRename({ restoreFocus: true });
  });
  return (e) => {
    const tap = { layerId: key, time: e.timeStamp, x: e.clientX, y: e.clientY };
    if (isDoubleTap(lastNameTap, tap)) {
      lastNameTap = null;
      onRename({});
      return true;
    }
    lastNameTap = tap;
    return false;
  };
}

/**
 * One layer's row card: (Select mode's checkbox,) drag grip, thumbnail,
 * name over a detail line, the reference image's own toggles, ⋯ on the
 * active row, and the visibility checkbox. Every mutating handler calls
 * commit(), which re-renders the panel.
 */
function buildLayerRow(layer, index, isActive, isMarked, layers) {
  const layerStack = getLayerStack();
  const locked = layer.isBackground || layer.isReferenceImage;
  const row = document.createElement('div');
  row.className = 'layer-row' + (isActive ? ' active' : '') + (isMarked ? ' marked' : '') + (layer.groupId ? ' in-group' : '');
  row.setAttribute('role', 'listitem');
  row.dataset.layerId = layer.id;

  const nameLabel = document.createElement('span');
  nameLabel.className = 'layer-name';
  nameLabel.textContent = layer.name;
  const nameTap = bindNameTaps(nameLabel, layer.id, (opts) => startRename(row, layer.name, (name) => {
    const at = getLayerStack().getLayers().findIndex((l) => l.id === layer.id);
    if (at !== -1) getLayerStack().renameLayer(at, name);
  }, { ...opts, key: layer.id }));

  row.addEventListener('click', (e) => {
    if (e.target.closest('button, input, label')) return;
    const modified = e.metaKey || e.ctrlKey || e.shiftKey;
    if (!modified && !selectMode && e.target.closest('.layer-name')) {
      if (nameTap(e)) return;
    } else {
      lastNameTap = null;
    }
    const { marked, lastClickedId } = computeLayerMarkState({
      marked: markedLayerIds,
      lastClickedId: lastMarkClickedLayerId,
      clickedId: layer.id,
      layers,
      // In Select mode a plain tap toggles, like Cmd/Ctrl-click.
      metaOrCtrl: selectMode || e.metaKey || e.ctrlKey,
      shift: e.shiftKey,
    });
    markedLayerIds = marked;
    lastMarkClickedLayerId = lastClickedId;
    if (!selectMode && !modified) layerStack.setActiveLayer(index);
    renderLayersPanel(); // no commit - just a selection/mark change
  });

  if (selectMode) {
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'layer-select-check';
    check.checked = isMarked;
    check.disabled = locked;
    check.setAttribute('aria-label', `Select ${layer.name}`);
    check.addEventListener('change', () => {
      if (check.checked) markedLayerIds.add(layer.id);
      else markedLayerIds.delete(layer.id);
      renderLayersPanel();
      layersPanelList.querySelector(`.layer-row[data-layer-id="${CSS.escape(String(layer.id))}"] .layer-select-check`)?.focus();
    });
    row.appendChild(check);
  }

  // Bars drawn in CSS, not an icon glyph: the grip must stay pressable
  // even when the icon font fails to load (which hides glyphs).
  const grip = document.createElement('span');
  grip.className = 'layer-grip';
  grip.setAttribute('aria-hidden', 'true');
  if (layer.isBackground) grip.classList.add('disabled');
  else grip.addEventListener('pointerdown', (e) => startDrag(e, layer, row));
  row.appendChild(grip);

  row.appendChild(buildLayerThumbnailCanvas(layer));

  const text = document.createElement('div');
  text.className = 'layer-text';
  const detail = document.createElement('span');
  detail.className = 'layer-detail';
  detail.textContent = layerDetail(layer);
  if (layer.locked) {
    // User pixel lock (layer-context-menu): a glyph on the detail line,
    // clear of the name so renaming isn't in the way; read out as "Locked".
    detail.insertAdjacentHTML('afterbegin', '<span class="material-symbols-outlined layer-lock-icon" aria-hidden="true">lock</span><span class="visually-hidden">Locked, </span>');
  }
  text.append(nameLabel, detail);
  row.appendChild(text);

  if (layer.isReferenceImage) row.append(...buildReferenceToggles(layer));

  if (isActive && !selectMode) {
    const more = iconButton('layer-more-button', 'more_horiz', `Actions for ${layer.name}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', () => openContextMenu(more, layerMenuItems(layer, row)));
    row.appendChild(more);
  }

  row.appendChild(buildVisibilitySwitch(layer.name, layer.visible, (visible) => {
    const at = getLayerStack().getLayers().findIndex((l) => l.id === layer.id);
    getLayerStack().setVisibility(at, visible);
    renderCanvas();
    commit();
  }));
  return row;
}

/** A group's row: chevron (collapse), folder, name over "N layers", ⋯ and its visibility checkbox. */
function buildGroupRow(group, memberIndices) {
  const layerStack = getLayerStack();
  const row = document.createElement('div');
  row.className = 'layer-group-row' + (group.collapsed ? ' collapsed' : '');
  row.setAttribute('role', 'listitem');
  row.dataset.groupId = group.id;

  const chevron = iconButton('layer-group-chevron', 'chevron_right', `${group.collapsed ? 'Expand' : 'Collapse'} ${group.name}`);
  chevron.setAttribute('aria-expanded', String(!group.collapsed));
  chevron.addEventListener('click', () => {
    // View state only - kept with the project, but not an undo step.
    layerStack.setGroupCollapsed(group.id, !group.collapsed);
    renderLayersPanel();
    layersPanelList.querySelector(`.layer-group-row[data-group-id="${CSS.escape(group.id)}"] .layer-group-chevron`)?.focus();
  });

  const folder = document.createElement('span');
  folder.className = 'material-symbols-outlined layer-group-icon';
  folder.textContent = 'folder';
  folder.setAttribute('aria-hidden', 'true');

  const nameLabel = document.createElement('span');
  nameLabel.className = 'layer-name';
  nameLabel.textContent = group.name;
  const rename = (opts) => startRename(row, group.name, (name) => layerStack.renameGroup(group.id, name), { ...opts, key: group.id });
  const nameTap = bindNameTaps(nameLabel, group.id, rename);
  row.addEventListener('click', (e) => {
    if (e.target.closest('button, input, label')) return;
    if (e.target.closest('.layer-name')) nameTap(e);
  });

  const text = document.createElement('div');
  text.className = 'layer-text';
  const detail = document.createElement('span');
  detail.className = 'layer-detail';
  const count = memberIndices.length;
  detail.textContent = `Group · ${count} ${count === 1 ? 'layer' : 'layers'}` + (group.opacity < 1 ? ` · ${Math.round(group.opacity * 100)}%` : '');
  text.append(nameLabel, detail);

  const more = iconButton('layer-more-button', 'more_horiz', `Actions for ${group.name}`);
  more.setAttribute('aria-haspopup', 'menu');
  more.addEventListener('click', () => openContextMenu(more, groupMenuItems(group, row, rename)));

  row.append(chevron, folder, text, more, buildVisibilitySwitch(group.name, group.visible, (visible) => {
    layerStack.setGroupVisibility(group.id, visible);
    renderCanvas();
    commit();
  }));
  return row;
}

/**
 * Reference image layer controls: Pixelated/Original resolution, and (in
 * Pixelated mode) smoothed vs blocky downscale. Unchanged behaviour from
 * the earlier panel, now inline in its row card.
 */
function buildReferenceToggles(layer) {
  const layerStack = getLayerStack();
  const buttons = [];
  // 'pixelated' fits the source to the canvas grid; 'original' shows it at
  // its native resolution on screen, which needs the stored upload.
  const canGoOriginal = layer.referenceMode === REFERENCE_MODES.ORIGINAL || !!layer.originalSourceBlob;
  const modeToggle = iconButton('layer-reference-mode-toggle', layer.referenceMode === REFERENCE_MODES.ORIGINAL ? 'image' : 'grid_on', 'Toggle reference image resolution mode');
  modeToggle.disabled = !canGoOriginal;
  modeToggle.dataset.tooltip = modeToggle.disabled
    ? 'Upload a new reference image to enable Original resolution mode'
    : layer.referenceMode === REFERENCE_MODES.ORIGINAL
      ? 'Original resolution - tap for Pixelated (fit to the canvas grid)'
      : 'Pixelated (fit to the canvas grid) - tap for Original resolution';
  modeToggle.addEventListener('click', () => {
    layerStack.setReferenceMode(layer.referenceMode === REFERENCE_MODES.ORIGINAL ? REFERENCE_MODES.PIXELATED : REFERENCE_MODES.ORIGINAL);
    renderCanvas();
    commit();
  });
  buttons.push(modeToggle);

  // Pixelated only: smoothed (can look flat on a tiny canvas) or blocky.
  // Needs the decoded source in memory, so not after a reload.
  if (layer.referenceMode === REFERENCE_MODES.PIXELATED) {
    const smoothing = iconButton('layer-reference-smoothing-toggle', referenceImageSmoothing ? 'blur_on' : 'blur_off', 'Toggle reference image smoothing');
    smoothing.disabled = !referenceImageSourceImage;
    smoothing.dataset.tooltip = smoothing.disabled
      ? 'Re-upload the reference image to change smoothing (not available after a page reload)'
      : referenceImageSmoothing
        ? 'Smoothed downscale - tap for a blockier, unsmoothed one'
        : 'Blocky, unsmoothed downscale - tap for a smoothed one';
    smoothing.addEventListener('click', () => {
      referenceImageSmoothing = !referenceImageSmoothing;
      const imageData = fitImageToCanvas(referenceImageSourceImage, layerStack.width, layerStack.height, referenceImageSmoothing);
      layerStack.updateReferenceImageData(imageData.data);
      renderCanvas();
      commit();
    });
    buttons.push(smoothing);
  }
  return buttons;
}

/** Index of a layer by id right now (indices shift; ids don't). */
const indexOf = (id) => getLayerStack().getLayers().findIndex((l) => l.id === id);

/**
 * Which layer ⋯ menu items are available (layer-context-menu). Pure:
 * `hasContent` (any non-transparent pixel on the layer) and
 * `selectionHasContent` (inside the selection) come precomputed from
 * layerMenuItems. Cut needs a selection; Copy without one takes the
 * whole layer.
 */
export function layerMenuState({ layer, layers, index, hasSelection, hasContent, selectionHasContent }) {
  const atCap = layers.length >= MAX_LAYERS;
  const ref = !!layer.isReferenceImage;
  return {
    cut: { disabled: ref || !!layer.locked || !hasSelection || !selectionHasContent },
    copy: { disabled: ref || !(hasSelection ? selectionHasContent : hasContent) },
    paste: { disabled: atCap },
    duplicate: { disabled: atCap || ref },
    lock: { hidden: ref, label: layer.locked ? 'Unlock' : 'Lock', icon: layer.locked ? 'lock_open' : 'lock' },
    selectContent: { disabled: !hasContent },
    merge: { disabled: mergeButtonState(layers, index, new Set()).disabled },
    group: { disabled: !!layer.isBackground || ref },
    moveUp: { disabled: !!layer.isBackground },
    moveDown: { disabled: !!layer.isBackground },
    delete: { disabled: layers.length <= 1 },
  };
}

/**
 * The layer ⋯ menu, after Pixelmator Pro for iPad: a Cut/Copy/Paste
 * strip, then Duplicate/Lock/Rename, Select Content, Pixi's structure
 * items, and Delete last.
 */
function layerMenuItems(layer, row) {
  const layerStack = getLayerStack();
  const layers = layerStack.getLayers();
  const index = indexOf(layer.id);
  const { engine } = layer;
  const selection = getSelection();
  const s = layerMenuState({
    layer,
    layers,
    index,
    hasSelection: !!selection,
    hasContent: !!contentBounds(engine, { x: 0, y: 0, width: engine.width, height: engine.height }),
    selectionHasContent: !!selection && !!contentBounds(engine, selection),
  });
  return [
    {
      type: 'strip',
      label: 'Edit',
      items: [
        { label: 'Cut', icon: 'content_cut', disabled: s.cut.disabled, onSelect: cutActive },
        { label: 'Copy', icon: 'content_copy', disabled: s.copy.disabled, onSelect: copyActive },
        { label: 'Paste', icon: 'content_paste', disabled: s.paste.disabled, onSelect: pasteFromClipboard },
      ],
    },
    { label: 'Duplicate', icon: 'library_add', shortcut: '⌘J', disabled: s.duplicate.disabled, onSelect: duplicateActiveLayer },
    ...(s.lock.hidden ? [] : [{ label: s.lock.label, icon: s.lock.icon, onSelect: () => apply(() => layerStack.setLocked(indexOf(layer.id), !layer.locked)) }]),
    { label: 'Rename', icon: 'edit', onSelect: () => startRename(row, layer.name, (name) => layerStack.renameLayer(indexOf(layer.id), name), { restoreFocus: true, key: layer.id }) },
    'separator',
    { label: 'Select Content', icon: 'select', disabled: s.selectContent.disabled, onSelect: selectActiveContent },
    'separator',
    { label: 'Merge Down', icon: 'merge', shortcut: '⌘E', disabled: s.merge.disabled, onSelect: () => apply(() => layerStack.mergeDown(indexOf(layer.id))) },
    layer.groupId
      ? { label: 'Remove from Group', icon: 'folder_off', onSelect: () => apply(() => removeFromGroup(layer.id)) }
      : { label: 'Group', icon: 'create_new_folder', shortcut: '⌘G', disabled: s.group.disabled, onSelect: () => apply(() => layerStack.groupLayers([indexOf(layer.id)])) },
    { label: 'Move Up', icon: 'arrow_upward', disabled: s.moveUp.disabled, onSelect: () => apply(() => layerStack.moveLayerUp(indexOf(layer.id))) },
    { label: 'Move Down', icon: 'arrow_downward', disabled: s.moveDown.disabled, onSelect: () => apply(() => layerStack.moveLayerDown(indexOf(layer.id))) },
    'separator',
    { label: 'Delete Layer', icon: 'delete', danger: true, disabled: s.delete.disabled, onSelect: () => deleteLayerWithConfirm(layer) },
  ];
}

function groupMenuItems(group, row, rename) {
  const layerStack = getLayerStack();
  const memberCount = layerStack.groupMemberIndices(group.id).length;
  return [
    { label: 'Rename', icon: 'edit', onSelect: () => rename({ restoreFocus: true }) },
    { label: 'Opacity…', icon: 'tune', onSelect: (anchor) => openProperties({ kind: 'group', id: group.id }, anchor) },
    { label: 'Ungroup', icon: 'folder_off', onSelect: () => apply(() => (layerStack.ungroup(group.id), true)) },
    { label: 'Move Group Up', icon: 'arrow_upward', onSelect: () => apply(() => layerStack.moveGroup(group.id, 1)) },
    { label: 'Move Group Down', icon: 'arrow_downward', onSelect: () => apply(() => layerStack.moveGroup(group.id, -1)) },
    'separator',
    {
      label: 'Delete Group',
      icon: 'delete',
      danger: true,
      disabled: memberCount >= layerStack.getLayers().length,
      onSelect: async () => {
        const proceed = await confirmDialog({
          title: 'Delete group?',
          message: `Delete "${group.name}" and its ${memberCount} ${memberCount === 1 ? 'layer' : 'layers'}? You can undo this.`,
        });
        if (proceed) apply(() => layerStack.deleteGroup(group.id));
      },
    },
  ];
}

/** Runs a LayerStack change; on success, clears marks, repaints and commits (one undo step). */
function apply(change) {
  if (!change()) return;
  clearLayerMarks(); // indices shifted; stale marks would misalign
  renderCanvas();
  commit();
}

/**
 * Takes a layer out of its group: in place when it's the top or bottom
 * member, otherwise just above the group, so the group stays contiguous.
 */
function removeFromGroup(layerId) {
  const layerStack = getLayerStack();
  const index = indexOf(layerId);
  if (layerStack.moveLayerTo(index, index, null)) return true;
  const groupId = layerStack.getLayers()[index].groupId;
  const others = layerStack.groupMemberIndices(groupId).filter((i) => i !== index);
  const top = Math.max(...others);
  // `top` counts the layer itself when it's below top; moveLayerTo's index excludes it.
  return layerStack.moveLayerTo(index, top, null);
}

async function deleteLayerWithConfirm(layer) {
  const proceed = await confirmDialog({
    title: 'Delete layer?',
    message: `Delete "${layer.name}"? You can undo this.`,
  });
  if (!proceed) return;
  const layerStack = getLayerStack();
  layerStack.deleteLayer(indexOf(layer.id));
  clearLayerMarks(); // remaining indices shifted; stale marks would misalign
  if (layer.isReferenceImage) {
    // Forget the stored source - a future upload adds a new reference
    // layer from scratch and should default back to smoothed.
    referenceImageSourceImage = null;
    referenceImageSmoothing = true;
  }
  renderCanvas();
  commit();
}

/**
 * Shows #layer-menu filled with `items` beside `anchor` (a row's ⋯).
 * Items: { label, icon, shortcut?, disabled?, danger?, onSelect(anchor) },
 * 'separator', or { type: 'strip', label, items } - a capsule of items
 * shown icon over label (the Cut/Copy/Paste strip). Arrow keys move
 * through every item in order, strip included; Escape closes back to the
 * anchor, an outside press closes it. One menu, rebuilt per open, so
 * nothing piles up listeners on re-rendered rows.
 */
function openContextMenu(anchor, items) {
  layerMenu.innerHTML = '';
  for (const item of items) {
    if (item === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'topbar-menu-separator';
      sep.setAttribute('role', 'separator');
      layerMenu.appendChild(sep);
      continue;
    }
    if (item.type === 'strip') {
      const strip = document.createElement('div');
      strip.className = 'action-capsule layer-menu-strip';
      strip.setAttribute('role', 'group');
      strip.setAttribute('aria-label', item.label);
      for (const segment of item.items) strip.appendChild(menuButton(segment, anchor, 'action-capsule-segment'));
      layerMenu.appendChild(strip);
      continue;
    }
    layerMenu.appendChild(menuButton(item, anchor, 'topbar-menu-item' + (item.danger ? ' topbar-menu-item-danger' : '')));
  }
  layerMenu.classList.remove('hidden');
  layerMenu.anchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  const rect = anchor.getBoundingClientRect();
  const menuRect = layerMenu.getBoundingClientRect();
  const margin = 8;
  // Toward the canvas (the card's start side) when there's room, else below.
  let left = rect.left - menuRect.width - margin;
  if (left < margin) left = Math.min(rect.right + margin, window.innerWidth - menuRect.width - margin);
  const top = Math.max(margin, Math.min(rect.top, window.innerHeight - menuRect.height - margin));
  layerMenu.style.left = `${left}px`;
  layerMenu.style.top = `${top}px`;
  layerMenu.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
}

/** One menu button: icon, label, optional shortcut; closes the menu, then runs onSelect. */
function menuButton(item, anchor, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('role', 'menuitem');
  button.disabled = !!item.disabled;
  button.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${item.icon}</span>`;
  const label = document.createElement('span');
  label.textContent = item.label;
  button.appendChild(label);
  if (item.shortcut) {
    const kbd = document.createElement('kbd');
    kbd.className = 'topbar-menu-shortcut';
    kbd.textContent = item.shortcut;
    button.appendChild(kbd);
  }
  button.addEventListener('click', () => {
    // Synchronous through onSelect: Copy/Cut/Paste reach the clipboard
    // API inside this click, which Safari requires.
    closeContextMenu({ restoreFocus: false });
    item.onSelect(anchor);
  });
  return button;
}

function closeContextMenu({ restoreFocus = true } = {}) {
  if (layerMenu.classList.contains('hidden')) return;
  layerMenu.classList.add('hidden');
  layerMenu.anchor?.setAttribute('aria-expanded', 'false');
  if (restoreFocus && layerMenu.anchor?.isConnected) layerMenu.anchor.focus();
  layerMenu.anchor = null;
}

/**
 * Swaps a row's name label for a focused, selected text input. Enter/
 * blur commits through `save(name)` (via resolveLayerRename - empty or
 * unchanged names commit nothing), Escape cancels; either way the panel
 * re-renders. `done` guards the blur a commit's own re-render fires on
 * the detached input. If something else re-renders the panel mid-edit
 * (e.g. Cmd+Z) the edit is dropped, same as Escape. With `restoreFocus`
 * (a keyboard-started rename), focus returns to the name afterwards.
 */
function startRename(row, current, save, { restoreFocus = false, key } = {}) {
  const label = row.querySelector('.layer-name');
  if (!label || !label.isConnected) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'layer-name-input';
  input.value = current;
  input.setAttribute('aria-label', 'Name');
  input.autocomplete = 'off';
  input.spellcheck = false;

  let done = false;
  const finish = (commitIt) => {
    if (done) return;
    done = true;
    if (!input.isConnected) return; // panel re-rendered under the edit
    const name = commitIt ? resolveLayerRename(input.value, current) : null;
    if (name) {
      save(name);
      commit(); // re-renders the panel
    } else {
      renderLayersPanel();
    }
    if (restoreFocus) {
      const selector = `[data-layer-id="${CSS.escape(String(key))}"] .layer-name, [data-group-id="${CSS.escape(String(key))}"] .layer-name`;
      layersPanelList.querySelector(selector)?.focus();
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't also close an open popover
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));

  label.replaceWith(input);
  input.focus();
  input.select();
}

/**
 * Drag a row by its grip to reorder (and to move it into or out of a
 * group). The row follows the pointer; a line shows where it will land;
 * dropTarget + LayerStack.moveLayerTo decide and validate the move.
 */
function startDrag(e, layer, row) {
  if (selectMode) return;
  e.preventDefault();
  const grip = e.currentTarget;
  grip.setPointerCapture?.(e.pointerId);
  const items = displayItems.filter((it) => !(it.kind === 'layer' && it.id === layer.id));
  const mids = items.map((it) => {
    const r = it.el.getBoundingClientRect();
    return r.top + r.height / 2;
  });
  const listRect = layersPanelList.getBoundingClientRect();
  const startY = e.clientY;
  const indicator = document.createElement('div');
  indicator.className = 'layer-drop-indicator';
  layersPanelList.appendChild(indicator);
  row.classList.add('dragging');
  let gap = null;

  const stackIds = () => getLayerStack().getLayers().map((l) => l.id).filter((id) => id !== layer.id);

  const move = (ev) => {
    row.style.transform = `translateY(${ev.clientY - startY}px)`;
    gap = mids.filter((m) => m < ev.clientY).length;
    const target = dropTarget(items, gap, stackIds());
    const ref = items[gap]?.el ?? items[items.length - 1]?.el;
    const refRect = ref?.getBoundingClientRect();
    const y = !refRect ? 0 : items[gap] ? refRect.top - listRect.top - 2 : refRect.bottom - listRect.top + 2;
    indicator.style.top = `${y + layersPanelList.scrollTop}px`;
    indicator.classList.toggle('in-group', !!target?.groupId);
  };
  const end = (ev) => {
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', end);
    grip.removeEventListener('pointercancel', end);
    indicator.remove();
    row.classList.remove('dragging');
    row.style.transform = '';
    if (ev.type === 'pointercancel' || gap === null) return;
    const target = dropTarget(items, gap, stackIds());
    if (target) apply(() => getLayerStack().moveLayerTo(indexOf(layer.id), target.toIndex, target.groupId));
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

/** Fills the group Opacity popover from its target group. */
function syncPropertiesPopover() {
  const group = getLayerStack().getGroup(propertiesTarget.id);
  if (!group) return closeLayersOpacityPopover();
  layersPanelOpacityPopover.querySelector('#layer-properties-title').textContent = group.name;
  setOpacityFields(Math.round(group.opacity * 100));
}

function setOpacityFields(percent) {
  layersPanelOpacitySlider.value = String(percent);
  layersPanelOpacityNumber.value = String(percent);
}

/** Opens the group Opacity popover for `target`, beside `anchor`, kept on screen. */
function openProperties(target, anchor) {
  propertiesTarget = target;
  syncPropertiesPopover();
  layersPanelOpacityPopover.classList.remove('hidden'); // unhide before measuring
  const rect = (anchor?.isConnected ? anchor : layersPanel).getBoundingClientRect();
  const popRect = layersPanelOpacityPopover.getBoundingClientRect();
  const margin = 8;
  let left = rect.left - popRect.width - margin;
  if (left < margin) left = Math.min(rect.right + margin, window.innerWidth - popRect.width - margin);
  const top = Math.max(margin, Math.min(rect.top, window.innerHeight - popRect.height - margin));
  layersPanelOpacityPopover.style.left = `${left}px`;
  layersPanelOpacityPopover.style.top = `${top}px`;
  layersPanelOpacitySlider.focus();
}

export function closeLayersOpacityPopover() {
  layersPanelOpacityPopover?.classList.add('hidden');
  propertiesTarget = null;
}

/**
 * What the Merge button would do right now - the same choice
 * mergeMarkedOrActiveDown makes: the marked set when 2+ layers are
 * marked (marking already refuses the Background and reference layers;
 * a user-locked one among them disables it), else the active layer down,
 * refused for the bottom layer or when either layer is the Background,
 * reference image or a user-locked layer (LayerStack's own merge rules).
 */
export function mergeButtonState(layers, activeIndex, markedIds) {
  const marked = layers.filter((l) => markedIds.has(l.id));
  if (marked.length >= 2) return { disabled: marked.some((l) => l.locked), label: `Merge ${marked.length} layers` };
  const locked = (l) => !l || l.isBackground || l.isReferenceImage || !!l.locked;
  const disabled = activeIndex <= 0 || locked(layers[activeIndex]) || locked(layers[activeIndex - 1]);
  return { disabled, label: 'Merge down' };
}

/**
 * Duplicates the active layer (LayerStack.duplicateLayer) - the row menu's
 * Duplicate and workspace.js's Cmd/Ctrl+J.
 */
export function duplicateActiveLayer() {
  const layerStack = getLayerStack();
  apply(() => layerStack.duplicateLayer(layerStack.getActiveIndex()));
}

/**
 * Cmd/Ctrl+G and Select mode's Group: groups the marked layers (when
 * any are marked), otherwise the active layer.
 */
export function groupMarkedOrActive() {
  const layerStack = getLayerStack();
  const layers = layerStack.getLayers();
  const marked = layers.map((l, i) => (markedLayerIds.has(l.id) ? i : -1)).filter((i) => i !== -1);
  apply(() => layerStack.groupLayers(marked.length ? marked : [layerStack.getActiveIndex()]));
}

/**
 * Cmd/Ctrl+E and Select mode's Merge: merges the marked set (2+ layers)
 * if one exists, otherwise merges the active layer down into the layer
 * directly below it. Marks are always cleared afterward, win or no-op.
 * Only a successful merge re-renders/commits - the no-op paths leave the
 * stack and undo history untouched.
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
  if (!merged) {
    renderLayersPanel();
    return;
  }
  renderCanvas();
  commit();
}

function setSelectMode(on) {
  selectMode = on;
  clearLayerMarks();
  renderLayersPanel();
}

/** Wires the Layers panel's DOM once - see workspace.js's own bindDomOnce for the analogous pattern. */
export function initLayers(root = document) {
  layersPanel = root.querySelector('#layers-panel');
  layersPanelHeader = root.querySelector('#layers-panel-header');
  layersPanelToggle = root.querySelector('#layers-panel-toggle');
  layersPanelList = root.querySelector('#layers-panel-list');
  layersPanelOpacitySlider = root.querySelector('#layers-panel-opacity-slider');
  layersPanelOpacityNumber = root.querySelector('#layers-panel-opacity-number');
  layersPanelOpacityPopover = root.querySelector('#layers-panel-opacity-popover');
  addLayerButton = root.querySelector('#add-layer-button');
  addReferenceImageButton = root.querySelector('#add-reference-image-button');
  addReferenceImageInput = root.querySelector('#add-reference-image-input');
  selectBar = root.querySelector('#layers-select-bar');
  selectCount = root.querySelector('#layers-select-count');
  selectGroupButton = root.querySelector('#layers-select-group');
  selectMergeButton = root.querySelector('#layers-select-merge');
  layerMenu = root.querySelector('#layer-menu');

  syncLayersCollapse();
  layersPanelToggle.addEventListener('click', () => {
    layersPanelVisible = !layersPanelVisible;
    syncLayersCollapse();
  });
  bindPanelHeaderCollapse(layersPanelHeader, () => {
    layersPanelVisible = !layersPanelVisible;
    syncLayersCollapse();
  });

  // Header ⋯: Select Layers, Add Reference Image….
  initMenuButton(root.querySelector('#layers-panel-menu-button'), root.querySelector('#layers-panel-menu'));
  root.querySelector('#layers-select-mode-button').addEventListener('click', () => setSelectMode(true));
  root.querySelector('#layers-select-done').addEventListener('click', () => setSelectMode(false));
  selectGroupButton.addEventListener('click', () => {
    groupMarkedOrActive();
    setSelectMode(false);
  });
  selectMergeButton.addEventListener('click', () => {
    mergeMarkedOrActiveDown();
    setSelectMode(false);
  });

  // Row/group ⋯ menu: keyboard and outside-press handling for the one
  // shared #layer-menu.
  layerMenu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeContextMenu();
      return;
    }
    if (e.key === 'Tab') {
      closeContextMenu({ restoreFocus: false });
      return;
    }
    const items = [...layerMenu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const current = items.indexOf(document.activeElement);
    const next = menuKeyTarget(e.key, current, items.length);
    if (next !== current) {
      e.preventDefault();
      items[next]?.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (layerMenu.classList.contains('hidden')) return;
    if (layerMenu.contains(e.target) || layerMenu.anchor?.contains(e.target)) return;
    closeContextMenu({ restoreFocus: false });
  });

  // The active layer's blend and opacity, in the header row.
  headerBlend = root.querySelector('#layers-header-blend');
  headerOpacity = root.querySelector('#layers-header-opacity');
  headerOpacityReadout = root.querySelector('#layers-header-opacity-readout');
  for (const mode of BLEND_MODES) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = blendLabel(mode);
    headerBlend.appendChild(option);
  }
  headerBlend.addEventListener('change', () => {
    const layerStack = getLayerStack();
    layerStack.setBlendMode(layerStack.getActiveIndex(), headerBlend.value);
    renderCanvas();
    commit();
  });
  // Live while dragging; one undo step for the final value.
  const setActiveOpacity = (commitChange) => {
    const layerStack = getLayerStack();
    const percent = Number(headerOpacity.value);
    layerStack.setOpacity(layerStack.getActiveIndex(), percent / 100);
    headerOpacityReadout.textContent = `${percent}%`;
    renderCanvas();
    if (commitChange) commit();
  };
  headerOpacity.addEventListener('input', () => setActiveOpacity(false));
  headerOpacity.addEventListener('change', () => setActiveOpacity(true));

  function applyOpacity(value, { commitChange } = {}) {
    if (!propertiesTarget) return;
    const clamped = Math.max(0, Math.min(100, value));
    const layerStack = getLayerStack();
    // Live while dragging/typing; commit only the final value.
    layerStack.setGroupOpacity(propertiesTarget.id, clamped / 100);
    setOpacityFields(clamped);
    renderCanvas();
    if (commitChange) commit();
  }
  layersPanelOpacitySlider.addEventListener('input', () => applyOpacity(Number(layersPanelOpacitySlider.value)));
  layersPanelOpacitySlider.addEventListener('change', () => applyOpacity(Number(layersPanelOpacitySlider.value), { commitChange: true }));
  layersPanelOpacityNumber.addEventListener('change', () => applyOpacity(Number(layersPanelOpacityNumber.value) || 0, { commitChange: true }));

  document.addEventListener('pointerdown', (e) => {
    if (layersPanelOpacityPopover.classList.contains('hidden')) return;
    if (layersPanelOpacityPopover.contains(e.target)) return;
    if (e.target.closest?.('#layer-menu')) return;
    closeLayersOpacityPopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !layersPanelOpacityPopover.classList.contains('hidden')) closeLayersOpacityPopover();
  });

  addLayerButton.addEventListener('click', () => apply(() => getLayerStack().addLayer()));

  // Decode via the shared image-import helper, but skip Color Library
  // import's downsample/pixelate/quantize step entirely -
  // fitImageToCanvas keeps full fidelity, only scaling down when the
  // source is larger than the canvas.
  addReferenceImageButton.addEventListener('click', () => addReferenceImageInput.click());
  addReferenceImageInput.addEventListener('change', async () => {
    const file = addReferenceImageInput.files?.[0];
    addReferenceImageInput.value = '';
    if (!file) return;
    const image = await decodeImageFile(file);
    if (!image) {
      showToast(UNREADABLE_IMAGE_MESSAGE, { type: 'error' });
      return;
    }
    referenceImageSmoothing = true; // every new upload starts smoothed, in case Pixelated mode is chosen later
    const layerStack = getLayerStack();
    const imageData = fitImageToCanvas(image, layerStack.width, layerStack.height, referenceImageSmoothing);
    // A fresh upload defaults to 'original' mode - `file` (the raw
    // upload) is kept on the Layer as originalSourceBlob, for on-screen
    // Original-mode rendering and so it survives a reload.
    const added = layerStack.addReferenceImageLayer(imageData.data, 'Reference', {
      referenceMode: REFERENCE_MODES.ORIGINAL,
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
    closeContextMenu({ restoreFocus: false });
    selectMode = false;
    clearLayerMarks();
    // A stale reference-image source from a previously open project
    // would be meaningless (and could get re-fitted onto a differently-
    // sized canvas).
    referenceImageSourceImage = null;
    referenceImageSmoothing = true;
    renderLayersPanel();
  });
}
