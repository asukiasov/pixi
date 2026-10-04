// Floating layout's selection action bar (5f-selection-action-bar). Wired
// once from js/app.js, only in the floating layout.
//
// Clear selection and Delete are proxies for #selection-clear-button and
// #selection-delete-button (data-forward="<id>"), like the 5d bar. Whether
// the bar shows is CSS-only: it reads #selection-controls' .hidden back
// with :has(), and the workspace screen's data-selection-drag hides it
// during Select/Move drags. This module only places it: centred above the
// selection's on-screen box, flipped below when there's no room, inside
// the area the other floating cards leave clear.

import { measureClearInsets } from './layout.js';

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/**
 * Where the bar goes, as client pixels. All rectangles are client-pixel
 * `{ left, top, right, bottom }` boxes: `selection` is the selection
 * overlay's box, `clear` the area left clear by the slot cards, `outer`
 * the screen inset by its edges (safe areas included). `bar` is
 * `{ width, height }`.
 *
 * Bounds are `clear` when the bar fits in it, otherwise `outer` (a narrow
 * window). x is centred on the selection, clamped into the bounds. y is
 * above the selection when that fits, else below, else ('held') the above
 * position clamped into the bounds - which holds the bar at the top of the
 * clear area when the selection fills it. A selection entirely outside
 * the bounds is always 'held', at the edge nearest it.
 *
 * @returns {{ x: number, y: number, side: 'above' | 'below' | 'held' }}
 */
export function placeSelectionBar(selection, bar, clear, outer, gap) {
  const fitsClear = bar.width <= clear.right - clear.left && bar.height <= clear.bottom - clear.top;
  const b = fitsClear ? clear : outer;
  const centre = (selection.left + selection.right) / 2;
  const x = clamp(centre - bar.width / 2, b.left, b.right - bar.width);
  const fits = (y) => y >= b.top && y + bar.height <= b.bottom;

  const outside = selection.right < b.left || selection.left > b.right
    || selection.bottom < b.top || selection.top > b.bottom;
  const above = selection.top - gap - bar.height;
  const below = selection.bottom + gap;
  let y;
  let side;
  if (!outside && fits(above)) [y, side] = [above, 'above'];
  else if (!outside && fits(below)) [y, side] = [below, 'below'];
  else [y, side] = [clamp(above, b.top, b.bottom - bar.height), 'held'];

  return { x: Math.round(x), y: Math.round(y), side };
}

/**
 * @param {{
 *   root?: ParentNode,
 *   onCanvasViewChange: (fn: () => void) => void,
 *   currentSelectionClientRect: () => DOMRect | null,
 * }} options
 *   Both come from js/workspace.js, passed in so this module stays
 *   importable by its unit tests (workspace.js needs a DOM at load).
 */
export function initSelectionBar({ root = document, onCanvasViewChange, currentSelectionClientRect }) {
  const bar = root.querySelector('#selection-bar');
  const screen = root.querySelector('.workspace-screen');
  const source = root.querySelector('#selection-controls');
  if (!bar || !screen || !source) return;

  for (const proxy of bar.querySelectorAll('button[data-forward]')) {
    proxy.addEventListener('click', () => root.querySelector(`#${proxy.dataset.forward}`)?.click());
  }

  // The clear area and outer box only change when a card or the screen
  // changes size, so they're cached and re-measured from the observers
  // below, never per frame (measureClearInsets appends a probe).
  let clear = null;
  let outer = null;
  let gap = 0;
  const measure = () => {
    const screenRect = screen.getBoundingClientRect();
    const insets = measureClearInsets(screen, screen);
    clear = {
      left: screenRect.left + insets.left,
      top: screenRect.top + insets.top,
      right: screenRect.right - insets.right,
      bottom: screenRect.bottom - insets.bottom,
    };
    // The screen inset by --float-edge-* (safe areas included) and the
    // float gap, resolved by one probe.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;'
      + 'inset-block:var(--float-edge-top) var(--float-edge-bottom);'
      + 'inset-inline:var(--float-edge-start) var(--float-edge-end);'
      + 'padding-inline-start:var(--float-gap)';
    screen.appendChild(probe);
    const probeRect = probe.getBoundingClientRect();
    gap = parseFloat(getComputedStyle(probe).paddingInlineStart) || 0;
    probe.remove();
    outer = { left: probeRect.left, top: probeRect.top, right: probeRect.right, bottom: probeRect.bottom };
  };

  let frame = 0;
  const place = () => {
    frame = 0;
    // Not displayed (no selection, interface hidden): nothing to place.
    if (bar.getClientRects().length === 0) return;
    const selection = currentSelectionClientRect?.();
    if (!selection) return;
    if (!clear) measure();
    const { x, y } = placeSelectionBar(selection, { width: bar.offsetWidth, height: bar.offsetHeight }, clear, outer, gap);
    bar.style.setProperty('--selection-bar-x', `${x}px`);
    bar.style.setProperty('--selection-bar-y', `${y}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
  };

  onCanvasViewChange?.(schedule);

  // Clear-area changes: a card opening, closing or resizing, the
  // tool-options bar appearing, the window resizing. Class changes too,
  // for a card hidden by visibility (the collapsed right sidebar), which
  // keeps its size.
  const remeasure = () => {
    clear = null;
    schedule();
  };
  const slots = screen.querySelectorAll('.slot-top, .slot-tools, .slot-panels, .slot-options');
  if (typeof ResizeObserver === 'function') {
    const resize = new ResizeObserver(remeasure);
    resize.observe(screen);
    for (const slot of slots) resize.observe(slot);
  }
  const classes = new MutationObserver(remeasure);
  for (const slot of slots) classes.observe(slot, { attributes: true, attributeFilter: ['class'] });
  // A side pref change (5g-prefs) moves cards without resizing them.
  classes.observe(screen, { attributes: true, attributeFilter: ['data-tools-side', 'data-panels-side'] });

  // Shown/hidden (the source's .hidden) or a drag ending: place it on the
  // first frame it's displayed, at its real size. The mutation callback is
  // a microtask after clearSelection(), before the browser's focus fixup,
  // so focus still sits in the bar here if it was there.
  new MutationObserver(() => {
    if (source.classList.contains('hidden') && bar.contains(document.activeElement)) {
      // To the selected tool's rail button, or ⋯ when that tool is off
      // the rail (Customize Tools) and its button is hidden.
      const pressed = root.querySelector('.tools-sidebar [data-tool][aria-pressed="true"]');
      const target = pressed?.classList.contains('off-rail') ? root.querySelector('#tool-overflow-button') : pressed;
      target?.focus();
    }
    schedule();
  }).observe(source, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(schedule).observe(screen, { attributes: true, attributeFilter: ['data-selection-drag', 'class'] });
}
