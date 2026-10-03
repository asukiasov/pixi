// Floating layout's panel mini-rail and card close buttons
// (5e-cards-mini-rail). Wired once from js/app.js (the standalone app is
// always floating; embeds never load this).
//
// A card's open/closed state is the panel's existing collapsed state
// (.collapsed on the card), never stored here: Colors forwards to its
// header, Layers to the (hidden) top bar toggle, Brushes to
// setBrushesCardOpen in js/workspace.js. Each rail button's state is read
// back from its card's class by a MutationObserver, so every path that
// opens or closes a card shows up on the rail. Floating CSS turns
// .collapsed into "not displayed".

/**
 * A rail button's state from its card's classes: `.collapsed` is closed by
 * the user, `.hidden` is hidden by the tool (only Brushes, outside the
 * Brush tool), which makes the button unavailable.
 */
export function panelRailState(classList) {
  const hidden = classList.contains('hidden');
  return { expanded: !hidden && !classList.contains('collapsed'), unavailable: hidden };
}

/**
 * Writes `state` onto a rail button: aria-expanded, aria-disabled (kept
 * focusable, so the explanation can be read), and the label/tooltip,
 * which switches to `unavailableLabel` while unavailable.
 */
export function applyPanelRailState(button, { expanded, unavailable }, { label, unavailableLabel = label }) {
  button.setAttribute('aria-expanded', String(expanded));
  if (unavailable) button.setAttribute('aria-disabled', 'true');
  else button.removeAttribute('aria-disabled');
  const text = unavailable ? unavailableLabel : label;
  button.setAttribute('aria-label', text);
  button.setAttribute('data-tooltip', text);
}

/**
 * How far the bottom cards (the options slot) reach up from the bottom of
 * the workspace screen, when they sit horizontally under the card column;
 * 0 when they don't overlap it or aren't shown. The column's max-height
 * subtracts this (plus the float gap), so stacked cards stop above the
 * tool-options bar and palette card instead of covering them.
 */
export function optionsReach(optionsRect, columnRect, screenRect) {
  if (optionsRect.width === 0 || optionsRect.height === 0) return 0;
  const overlaps = optionsRect.right > columnRect.left && optionsRect.left < columnRect.right;
  return overlaps ? Math.max(0, Math.round(screenRect.bottom - optionsRect.top)) : 0;
}

/** Windows narrower than this (CSS px) open projects with every card closed. */
export const NARROW_MAX_WIDTH = 600;

/**
 * Which cards a project opens with (5h-switch-on-floating): all three at
 * NARROW_MAX_WIDTH and wider, none below it, so a phone-width window
 * fits the canvas between the tool rail and the mini-rail. Decided from
 * the width at open only; resizing never opens or closes a card.
 */
export function openCardDefaults(viewportWidth) {
  const open = viewportWidth >= NARROW_MAX_WIDTH;
  return { colors: open, brushes: open, layers: open };
}

// Kept from initPanelRail for applyOpenCardDefaults.
let brushesSetter = null;

/**
 * Closes the cards openCardDefaults says should start closed, through the
 * same paths the rail uses. Called right after initWorkspace() has reset
 * all three to open, so it never opens anything.
 */
export function applyOpenCardDefaults(root = document) {
  const defaults = openCardDefaults(window.innerWidth);
  const isOpen = (id) => {
    const card = root.querySelector(`#${id}`);
    return card && !card.classList.contains('collapsed');
  };
  if (!defaults.colors && isOpen('color-library-panel')) root.querySelector('#color-library-header')?.click();
  if (!defaults.layers && isOpen('layers-panel')) root.querySelector('#layers-panel-toggle')?.click();
  if (!defaults.brushes) brushesSetter?.(false);
}

const PANELS = [
  {
    card: 'color-library-panel',
    label: 'Colors',
    // Popovers that belong to this card; cancelled when it closes.
    popovers: [
      ['import-preview-row', 'import-preview-cancel'],
      ['ramp-preview-row', 'ramp-preview-cancel'],
    ],
  },
  { card: 'brushes-panel', label: 'Brushes', unavailableLabel: 'Brushes (Brush tool)' },
  { card: 'layers-panel', label: 'Layers' },
];

/**
 * @param {{
 *   root?: ParentNode,
 *   setBrushesCardOpen: (open: boolean) => void,
 *   closeLayersOpacityPopover: () => void,
 * }} options
 *   Both callbacks come from js/workspace.js / js/layers-ui.js, passed in
 *   so this module stays importable by its unit tests.
 */
export function initPanelRail({ root = document, setBrushesCardOpen, closeLayersOpacityPopover }) {
  brushesSetter = setBrushesCardOpen;
  const rail = root.querySelector('#panel-rail');
  if (!rail) return;
  const byId = (id) => root.querySelector(`#${id}`);

  for (const panel of PANELS) {
    const card = byId(panel.card);
    const button = rail.querySelector(`[aria-controls="${panel.card}"]`);
    if (!card || !button) continue;
    const closeButton = card.querySelector('.panel-close');
    const isOpen = () => !card.classList.contains('collapsed');

    // Colors and Layers forward to their existing control; Brushes has
    // no control to forward to, so it calls its setter.
    const source = button.dataset.forward ? byId(button.dataset.forward) : null;
    const toggle = () => {
      if (source) source.click();
      else setBrushesCardOpen?.(!isOpen());
    };

    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      toggle();
    });
    closeButton?.addEventListener('click', () => {
      // Left to bubble: the Colors/Layers header ignores clicks on
      // buttons (bindPanelHeaderCollapse), and the document-level click
      // listener that hides tooltips (js/workspace.js) must still see it.
      if (isOpen()) toggle();
      // The close button is about to disappear; focus goes to the rail.
      button.focus();
    });

    let wasOpen = isOpen();
    const sync = () => {
      applyPanelRailState(button, panelRailState(card.classList), panel);
      const open = isOpen();
      if (wasOpen && !open) closeOwnedPopovers(panel);
      wasOpen = open;
    };
    new MutationObserver(sync).observe(card, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  // Keeps the card column above the bottom cards where they overlap. Their
  // size changes with the tool, wrapping and the selection controls, so it
  // is measured, not estimated; the column's own height never feeds back
  // (only its horizontal extent is read).
  const screen = root.querySelector('.workspace-screen');
  const options = root.querySelector('.slot-options');
  const column = byId('right-sidebar');
  if (screen && options && column && typeof ResizeObserver === 'function') {
    const reserve = () => {
      const reach = optionsReach(options.getBoundingClientRect(), column.getBoundingClientRect(), screen.getBoundingClientRect());
      screen.style.setProperty('--slot-options-reach', `${reach}px`);
    };
    const observer = new ResizeObserver(reserve);
    observer.observe(options);
    observer.observe(screen);
    reserve();
  }

  // In the floating layout a card is open or closed, and the close button
  // is the one way to close it, so the role="button" headers stop being
  // tab stops (their pointer target is turned off in CSS).
  for (const id of ['color-library-header', 'layers-panel-header']) {
    byId(id)?.setAttribute('tabindex', '-1');
  }

  function closeOwnedPopovers(panel) {
    if (panel.card === 'layers-panel') closeLayersOpacityPopover?.();
    for (const [popoverId, cancelId] of panel.popovers ?? []) {
      const popover = byId(popoverId);
      if (popover && !popover.classList.contains('hidden')) byId(cancelId)?.click();
    }
    // Brushes: setBrushesCardOpen(false) already closes the brush editor.
  }
}
