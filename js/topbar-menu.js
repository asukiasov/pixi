// Menu buttons for the floating top bar (5b-top-bar-more): the zoom pill
// and More. Implements the WAI-ARIA menu-button pattern - the button
// reports aria-expanded, focus moves into the menu, arrows/Home/End move
// between items, Escape closes and refocuses the button, a press outside
// closes. Only one top bar menu is open at a time.

/**
 * Index of the item a navigation key moves to, wrapping at both ends.
 * `index` is -1 when nothing in the menu has focus yet. Keys that don't
 * navigate return `index` unchanged.
 */
export function menuKeyTarget(key, index, count) {
  if (count === 0) return -1;
  switch (key) {
    case 'ArrowDown': return (index + 1) % count;
    case 'ArrowUp': return index <= 0 ? count - 1 : index - 1;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return index;
  }
}

const MARGIN = 8;

// The single open menu's controller, so opening one closes the other and
// one document listener can serve every menu.
let openMenu = null;
let outsidePressBound = false;

function bindOutsidePressOnce() {
  if (outsidePressBound) return;
  outsidePressBound = true;
  document.addEventListener('pointerdown', (e) => {
    if (!openMenu) return;
    if (openMenu.menu.contains(e.target) || openMenu.button.contains(e.target)) return;
    openMenu.close({ restoreFocus: false });
  });
}

function enabledItems(menu) {
  return [...menu.querySelectorAll('[role^="menuitem"]')].filter(
    (item) => !item.disabled && item.getAttribute('aria-disabled') !== 'true',
  );
}

/**
 * Below the button, flipping above if it would overflow the bottom.
 * Aligned to whichever edge of the button is nearer the middle of the
 * screen, so a menu from a button at the inline end opens inward.
 */
function positionMenu(menu, button) {
  const rect = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();

  let top = rect.bottom + MARGIN;
  if (top + menuRect.height > window.innerHeight - MARGIN) {
    top = rect.top - menuRect.height - MARGIN;
  }
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - menuRect.height - MARGIN));

  const openTowardStart = rect.left + rect.width / 2 > window.innerWidth / 2;
  let left = openTowardStart ? rect.right - menuRect.width : rect.left;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - menuRect.width - MARGIN));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

/**
 * Wires `button` to open `menu` (an element with role="menu", hidden with
 * the .hidden class while closed). `onOpen()` runs just before the menu
 * shows, to refresh item states. Activating an item closes the menu unless
 * `keepOpen(item)` returns true. Items run their own click listeners.
 */
export function initMenuButton(button, menu, { onOpen = () => {}, keepOpen = () => false } = {}) {
  bindOutsidePressOnce();
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  if (menu.id) button.setAttribute('aria-controls', menu.id);

  const controller = {
    button,
    menu,
    isOpen: () => openMenu === controller,
    open,
    close,
  };

  function open({ focus = 'first' } = {}) {
    if (openMenu && openMenu !== controller) openMenu.close({ restoreFocus: false });
    onOpen();
    // Unhide before measuring - .hidden is display:none.
    menu.classList.remove('hidden');
    positionMenu(menu, button);
    button.setAttribute('aria-expanded', 'true');
    openMenu = controller;
    const items = enabledItems(menu);
    const target = focus === 'last' ? items.at(-1) : items[0];
    target?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (openMenu !== controller) return;
    menu.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    openMenu = null;
    if (restoreFocus) button.focus();
  }

  button.addEventListener('click', () => {
    if (controller.isOpen()) close();
    else open();
  });

  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open({ focus: e.key === 'ArrowUp' ? 'last' : 'first' });
    }
  });

  menu.addEventListener('keydown', (e) => {
    const items = enabledItems(menu);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      close({ restoreFocus: false });
      return;
    }
    const current = items.indexOf(document.activeElement);
    const next = menuKeyTarget(e.key, current, items.length);
    if (next !== current) {
      e.preventDefault();
      e.stopPropagation();
      items[next]?.focus();
    }
  });

  // Items are <button>s, so Enter/Space already fire click. Closing runs
  // after the item's own listeners (bubble phase, on the menu) so a
  // forwarded action sees the menu as it was when activated.
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[role^="menuitem"]');
    if (!item || !menu.contains(item)) return;
    if (keepOpen(item)) return;
    // Focus goes back to the button even when the item opened a popover,
    // the same place it stayed when the old top bar button was clicked.
    close();
  });

  return controller;
}
