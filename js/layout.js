// Floating workspace layout (5a-floating-shell). Dev-only until 5h: the
// page opts in with ?layout=floating, read once at boot. Embeds
// (lib/pixi.js) never call this, so they always stay docked.

/** 'floating' only for an exact `layout=floating` query parameter. */
export function resolveLayout(search) {
  return new URLSearchParams(search).get('layout') === 'floating' ? 'floating' : 'docked';
}

/** Sets or clears `data-layout` on the workspace screen. */
export function applyLayout(screenEl, layout) {
  if (layout === 'floating') screenEl.dataset.layout = 'floating';
  else delete screenEl.dataset.layout;
}

/**
 * How far floating cards reach into the container from each edge, plus
 * `gap`, so the canvas can be fitted into the clear area between them.
 * Edges come from the slot: top/options are horizontal bars against the
 * top/bottom edge; tools/panels are columns against whichever side they
 * actually sit on (so a mirrored layout needs no special case).
 * Zero-size rects are hidden cards and are skipped.
 */
export function clearInsets(containerRect, cards, gap) {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const reach = (side, value) => {
    insets[side] = Math.max(insets[side], Math.max(0, value) + gap);
  };
  const midX = containerRect.left + containerRect.width / 2;
  for (const { slot, rect } of cards) {
    if (rect.width === 0 || rect.height === 0) continue;
    if (slot === 'top') reach('top', rect.bottom - containerRect.top);
    else if (slot === 'options') reach('bottom', containerRect.bottom - rect.top);
    else if (rect.left + rect.width / 2 < midX) reach('left', rect.right - containerRect.left);
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
 * The gap is the --float-gap token, resolved to px.
 */
export function measureClearInsets(screenEl, containerEl) {
  const cards = [];
  for (const slot of SLOTS) {
    for (const el of screenEl.querySelectorAll(`.slot-${slot}`)) {
      const style = getComputedStyle(el);
      const hidden = style.visibility === 'hidden' || style.opacity === '0';
      cards.push({ slot, rect: hidden ? { width: 0, height: 0 } : el.getBoundingClientRect() });
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
