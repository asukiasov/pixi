// The Customize Tools sheet: which tools the tool rail shows, and in what
// order, after Pixelmator Pro for iPad's Customize Tools screen. Opened
// from the rail's ⋯ menu and from Prefs; wired once from js/app.js
// (standalone only). Like the Prefs sheet it keeps no state of its own:
// it renders from getPrefs().railTools and hands every change to
// setPrefs, which saves and applies it at once.
//
// Editing, so dragging is never the only way:
// - drag a tile (pointer events: mouse, touch, Apple Pencil) within the
//   top row to reorder, from the grid into the row to add, or out of the
//   row to remove;
// - press a tile (tap, click, Enter, Space) to move it to the other list;
// - Alt+Left/Right moves a favorite one place.
// A polite status region says what changed.

import { TOOL_IDS, TOOL_LABELS, overflowTools, insertTool, removeTool, isDefaultRail, dropIndex } from './rail-tools.js';

// How far a press moves before it is a drag rather than a tap.
const DRAG_THRESHOLD = 6;

/**
 * @param {{
 *   getPrefs: () => import('./prefs.js').Prefs,
 *   setPrefs: (next: import('./prefs.js').Prefs) => void,
 *   root?: ParentNode,
 * }} options
 * @returns {{ open(returnFocusTo?: HTMLElement | null): void } | null}
 */
export function initCustomizeToolsSheet({ getPrefs, setPrefs, root = document }) {
  const sheet = root.querySelector('#customize-tools-sheet');
  if (!sheet) return null;

  const railList = sheet.querySelector('#customize-tools-rail');
  const gridList = sheet.querySelector('#customize-tools-grid');
  const railZone = sheet.querySelector('.customize-tools-rail-zone');
  const gridZone = sheet.querySelector('.customize-tools-grid-zone');
  const empty = sheet.querySelector('#customize-tools-empty');
  const status = sheet.querySelector('#customize-tools-status');
  const resetButton = sheet.querySelector('#customize-tools-reset');
  const doneButton = sheet.querySelector('#customize-tools-done');

  const marker = document.createElement('div');
  marker.className = 'customize-tools-marker';
  marker.hidden = true;
  railZone.append(marker);

  let returnFocus = null;

  const rail = () => getPrefs().railTools;
  const label = (id) => TOOL_LABELS[id];
  const iconFor = (id) =>
    root.querySelector(`#tools-sidebar .tool-button[data-tool="${id}"] .material-symbols-outlined`)?.textContent.trim() ?? '';

  function tile(id, onRail) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'customize-tools-tile';
    button.dataset.tileTool = id;
    button.setAttribute('aria-describedby', onRail ? 'customize-tools-rail-help' : 'customize-tools-grid-help');
    const circle = document.createElement('span');
    circle.className = 'customize-tools-tile-icon';
    const glyph = document.createElement('span');
    glyph.className = 'material-symbols-outlined';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = iconFor(id);
    circle.append(glyph);
    const text = document.createElement('span');
    text.className = 'customize-tools-tile-label';
    text.textContent = label(id);
    button.append(circle, text);
    item.append(button);
    return item;
  }

  /** Rebuilds both lists; `focus` is a tool id, or 'done'. */
  function render(focus = null) {
    const current = rail();
    railList.replaceChildren(...current.map((id) => tile(id, true)));
    gridList.replaceChildren(...overflowTools(current).map((id) => tile(id, false)));
    empty.hidden = current.length > 0;
    resetButton.disabled = isDefaultRail(current);
    if (focus === 'done') doneButton.focus();
    else if (focus) sheet.querySelector(`[data-tile-tool="${focus}"]`)?.focus();
  }

  function announce(message) {
    status.textContent = message;
  }

  function commit(next, message, focus = null) {
    setPrefs({ ...getPrefs(), railTools: next });
    render(focus);
    announce(message);
  }

  const place = (list, id) => `position ${list.indexOf(id) + 1} of ${list.length}`;
  const moved = (list, id) => `${label(id)}, ${place(list, id)}`;
  const added = (list, id) => `${label(id)} added, ${place(list, id)}`;

  // Tap / click / Enter / Space: to the other list. Focus follows the
  // tile, so pressing again puts it back.
  let suppressClick = false;
  sheet.addEventListener('click', (e) => {
    const button = e.target.closest('.customize-tools-tile');
    if (!button) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const id = button.dataset.tileTool;
    const current = rail();
    if (current.includes(id)) {
      commit(removeTool(current, id), `${label(id)} removed from the tool rail`, id);
    } else {
      const next = insertTool(current, id, current.length);
      commit(next, added(next, id), id);
    }
  });

  sheet.addEventListener('keydown', (e) => {
    // The workspace's document-level shortcuts (tool letters, Tab to hide
    // the interface, Escape to deselect) mustn't run under the modal. The
    // dialog's own Escape-to-close is a default action and still happens.
    e.stopPropagation();
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const button = e.target.closest?.('#customize-tools-rail .customize-tools-tile');
    if (!button) return;
    e.preventDefault();
    const id = button.dataset.tileTool;
    const current = rail();
    const index = current.indexOf(id) + (e.key === 'ArrowLeft' ? -1 : 1);
    if (index < 0 || index >= current.length) return;
    const next = insertTool(current, id, index);
    commit(next, moved(next, id), id);
  });

  resetButton.addEventListener('click', () => {
    commit([...TOOL_IDS], 'Tool rail reset to every tool', 'done');
  });

  // ------------------------------------------------------------------
  // Drag. The pressed tile captures the pointer, so every move and the
  // release come back to it wherever the pointer goes. A copy of the
  // tile (the ghost) follows the pointer; over the top row a marker
  // shows where it will land.

  let press = null;

  const inside = (rect, { x, y }, pad = 0) =>
    x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;

  function otherRailRects(id) {
    return [...railList.querySelectorAll('.customize-tools-tile')]
      .filter((el) => el.dataset.tileTool !== id)
      .map((el) => el.getBoundingClientRect());
  }

  // Where the pointer would drop: an index in the top row, or null.
  function dropTarget(point) {
    if (!inside(railZone.getBoundingClientRect(), point, 16)) return null;
    const rects = otherRailRects(press.id);
    return { index: dropIndex(rects, point), rects };
  }

  function showMarker(target) {
    if (!target) {
      marker.hidden = true;
      return;
    }
    const zone = railZone.getBoundingClientRect();
    const { index, rects } = target;
    const sample = press.tile.getBoundingClientRect();
    let x;
    let y;
    if (rects.length === 0) {
      x = zone.left + zone.width / 2;
      y = zone.top + (zone.height - sample.height) / 2;
    } else if (index < rects.length) {
      x = rects[index].left - 4;
      y = rects[index].top;
    } else {
      x = rects.at(-1).right + 4;
      y = rects.at(-1).top;
    }
    marker.style.insetInlineStart = `${x - zone.left - 1.5}px`;
    marker.style.top = `${y - zone.top}px`;
    marker.style.height = `${sample.height}px`;
    marker.hidden = false;
  }

  function startDrag() {
    const rect = press.tile.getBoundingClientRect();
    const ghost = press.tile.cloneNode(true);
    ghost.className = 'customize-tools-tile customize-tools-ghost';
    ghost.removeAttribute('data-tile-tool');
    ghost.removeAttribute('aria-describedby');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.tabIndex = -1;
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    sheet.append(ghost);
    press.ghost = ghost;
    press.dragging = true;
    press.tile.classList.add('is-dragging');
    sheet.classList.add('is-dragging');
  }

  function moveDrag(point) {
    press.ghost.style.transform = `translate(${point.x - press.x}px, ${point.y - press.y}px)`;
    const target = dropTarget(point);
    press.target = target;
    showMarker(target);
    gridZone.classList.toggle('is-drop-target', !target && press.fromRail);
  }

  function endDrag() {
    if (!press) return;
    press.ghost?.remove();
    press.tile.classList.remove('is-dragging');
    sheet.classList.remove('is-dragging');
    gridZone.classList.remove('is-drop-target');
    marker.hidden = true;
    press = null;
  }

  function dropDrag() {
    const { id, fromRail, target } = press;
    const current = rail();
    endDrag();
    if (target) {
      const next = insertTool(current, id, target.index);
      if (next.join() === current.join()) return;
      commit(next, fromRail ? moved(next, id) : added(next, id));
    } else if (fromRail) {
      commit(removeTool(current, id), `${label(id)} removed from the tool rail`);
    }
  }

  sheet.addEventListener('pointerdown', (e) => {
    suppressClick = false;
    const tileEl = e.target.closest('.customize-tools-tile');
    if (!tileEl || press) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    press = {
      id: tileEl.dataset.tileTool,
      fromRail: railList.contains(tileEl),
      tile: tileEl,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dragging: false,
      ghost: null,
      target: null,
    };
    try {
      tileEl.setPointerCapture(e.pointerId);
    } catch {
      // No active pointer (a synthetic event): moves still bubble here.
    }
  });

  sheet.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.pointerId) return;
    const point = { x: e.clientX, y: e.clientY };
    if (!press.dragging) {
      if (Math.hypot(point.x - press.x, point.y - press.y) < DRAG_THRESHOLD) return;
      startDrag();
    }
    e.preventDefault();
    moveDrag(point);
  });

  sheet.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.pointerId) return;
    if (!press.dragging) {
      press = null;
      return;
    }
    // The click that follows the release would otherwise move the tile
    // to the other list as well.
    suppressClick = true;
    dropDrag();
  });

  sheet.addEventListener('pointercancel', endDrag);
  sheet.addEventListener('lostpointercapture', (e) => {
    if (press && e.pointerId === press.pointerId && press.dragging) endDrag();
  });

  // ------------------------------------------------------------------

  doneButton.addEventListener('click', () => sheet.close());

  sheet.addEventListener('close', () => {
    endDrag();
    returnFocus?.focus();
    returnFocus = null;
  });

  return {
    open(returnFocusTo = null) {
      returnFocus = returnFocusTo;
      render();
      status.textContent = '';
      sheet.showModal();
    },
  };
}
