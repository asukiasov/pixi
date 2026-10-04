// Floating workspace layout (5a-floating-shell). Always floating in the
// standalone app (5h-switch-on-floating): js/app.js applies it at boot and
// no query parameter changes that. Embeds (lib/pixi.js) never call
// applyLayout, so they stay docked.

/** Sets or clears `data-layout` on the workspace screen. */
export function applyLayout(screenEl, layout) {
  if (layout === 'floating') screenEl.dataset.layout = 'floating';
  else delete screenEl.dataset.layout;
}

/**
 * How far floating cards reach into the container from each edge, plus
 * `gap`, so the canvas can be fitted into the clear area between them.
 * Edges come from the slot: top/options are horizontal bars against the
 * top/bottom edge; tools/panels are columns against their `side`
 * ('left'|'right', from the 5g-prefs side preferences). Without a side,
 * the card's centre decides, which is only safe when the card is narrower
 * than half the container (both slots on one side can push the card
 * column past the middle of a narrow window, hence the explicit side).
 * Zero-size rects are hidden cards and are skipped.
 */
export function clearInsets(containerRect, cards, gap) {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const reach = (side, value) => {
    insets[side] = Math.max(insets[side], Math.max(0, value) + gap);
  };
  const midX = containerRect.left + containerRect.width / 2;
  for (const { slot, rect, side } of cards) {
    if (rect.width === 0 || rect.height === 0) continue;
    if (slot === 'top') reach('top', rect.bottom - containerRect.top);
    else if (slot === 'options') reach('bottom', containerRect.bottom - rect.top);
    else if ((side ?? (rect.left + rect.width / 2 < midX ? 'left' : 'right')) === 'left') reach('left', rect.right - containerRect.left);
    else reach('right', containerRect.right - rect.left);
  }
  return insets;
}

/**
 * The rectangle (relative to the container) left clear by `insets` - what
 * CanvasView fits and centres the canvas in. Never smaller than 1px, so a
 * tiny window covered by cards still yields a usable fit scale.
 */
export function clearArea(containerRect, insets) {
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(1, containerRect.width - insets.left - insets.right),
    height: Math.max(1, containerRect.height - insets.top - insets.bottom),
  };
}

const SLOTS = ['top', 'tools', 'panels', 'options'];

/**
 * DOM side of clearInsets: measures the floating cards inside `screenEl`
 * against `containerEl`. A card that is hidden doesn't count: display:none
 * gives a zero rect, and a card that keeps its box while hidden (the
 * collapsed right sidebar) must use visibility:hidden or opacity:0 - any
 * other way of hiding a card would reserve dead space beside the canvas.
 * The gap is the --float-gap token, resolved to px. The tools/panels
 * sides come from the screen's data-tools-side/data-panels-side
 * (js/prefs.js); unset, clearInsets falls back to each card's position.
 */
export function measureClearInsets(screenEl, containerEl) {
  const cards = [];
  const sides = { tools: screenEl.dataset.toolsSide, panels: screenEl.dataset.panelsSide };
  for (const slot of SLOTS) {
    for (const el of screenEl.querySelectorAll(`.slot-${slot}`)) {
      const style = getComputedStyle(el);
      const hidden = style.visibility === 'hidden' || style.opacity === '0';
      cards.push({ slot, side: sides[slot], rect: hidden ? { width: 0, height: 0 } : el.getBoundingClientRect() });
    }
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--float-gap)';
  screenEl.appendChild(probe);
  const gap = probe.getBoundingClientRect().width;
  probe.remove();
  return clearInsets(containerEl.getBoundingClientRect(), cards, gap);
}

/**
 * `el` if it is rendered, otherwise `fallback`. In the floating layout
 * (5b-top-bar-more) the top bar buttons that moved into the More menu are
 * display:none, so popovers anchored to them, and focus returning to
 * them, go to the More button instead.
 */
export function visibleAnchor(el, fallback) {
  if (!fallback || el.getClientRects().length > 0) return el;
  return fallback;
}

/**
 * Which inline side of `anchorRect` faces the canvas (5c-floating-tool-rail):
 * 'end' when the anchor's centre is in the left half of the viewport,
 * otherwise 'start'. Worked out from where the anchor actually is, not
 * from the slot variables, so a rail moved by the side prefs (5g) or
 * re-placed by the phone layout opens its tooltips and popovers inward
 * with no other change.
 */
export function canvasSide(anchorRect, viewportWidth) {
  return anchorRect.left + anchorRect.width / 2 < viewportWidth / 2 ? 'end' : 'start';
}
