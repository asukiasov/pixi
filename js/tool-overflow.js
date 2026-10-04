// The tool rail's ⋯ button (Customize Tools): a menu of the tools that
// aren't on the rail, then Customize Tools…. Wired once from js/app.js
// (standalone only). Items forward a click to the hidden rail button, so
// choosing a tool keeps the one code path in js/workspace.js. While the
// current tool is off the rail, ⋯ shows as active and names it.

import { initMenuButton } from './topbar-menu.js';
import { overflowTools, TOOL_LABELS } from './rail-tools.js';

/**
 * @param {{
 *   getRailTools: () => string[],
 *   onCustomize: () => void,
 *   root?: ParentNode,
 * }} options
 * @returns {{ refresh(): void } | null} refresh() re-reads the rail after a change.
 */
export function initToolOverflow({ getRailTools, onCustomize, root = document }) {
  const button = root.querySelector('#tool-overflow-button');
  const menu = root.querySelector('#tool-overflow-menu');
  const screen = root.querySelector('#screen-workspace');
  if (!button || !menu || !screen) return null;

  const railButton = (id) => root.querySelector(`#tools-sidebar .tool-button[data-tool="${id}"]`);

  function icon(name) {
    const el = document.createElement('span');
    el.className = 'material-symbols-outlined';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = name;
    return el;
  }

  function toolItem(id, current) {
    const source = railButton(id);
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'topbar-menu-item';
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(id === current));
    const label = document.createElement('span');
    label.className = 'topbar-menu-label';
    label.textContent = TOOL_LABELS[id];
    item.append(icon(source.querySelector('.material-symbols-outlined')?.textContent.trim() ?? ''), label);
    const shortcut = source.dataset.shortcut;
    if (shortcut) {
      item.setAttribute('aria-keyshortcuts', shortcut);
      const kbd = document.createElement('kbd');
      kbd.className = 'topbar-menu-shortcut';
      kbd.setAttribute('aria-hidden', 'true');
      kbd.textContent = shortcut;
      item.append(kbd);
    }
    item.addEventListener('click', () => source.click());
    return item;
  }

  // Rebuilt on every open, from the rail as it is then.
  function build() {
    const current = screen.dataset.currentTool;
    const items = overflowTools(getRailTools())
      .filter((id) => railButton(id) && !railButton(id).disabled)
      .map((id) => toolItem(id, current));

    const customize = document.createElement('button');
    customize.type = 'button';
    customize.id = 'tool-overflow-customize';
    customize.className = 'topbar-menu-item';
    customize.setAttribute('role', 'menuitem');
    customize.setAttribute('aria-haspopup', 'dialog');
    customize.append(icon('handyman'), 'Customize Tools…');
    // After the menu's own close, which returns focus to ⋯ and would
    // otherwise run against the already-modal sheet.
    customize.addEventListener('click', () => setTimeout(onCustomize));

    const separator = document.createElement('div');
    separator.className = 'topbar-menu-separator';
    separator.setAttribute('role', 'separator');

    menu.replaceChildren(...(items.length ? [...items, separator] : []), customize);
  }

  function refresh() {
    const current = screen.dataset.currentTool;
    const offRail = Boolean(current) && TOOL_LABELS[current] !== undefined && !getRailTools().includes(current);
    button.classList.toggle('active', offRail);
    button.setAttribute('aria-label', offRail ? `More tools, ${TOOL_LABELS[current]} selected` : 'More tools');
  }

  initMenuButton(button, menu, { onOpen: build, placement: 'side' });
  build();
  // The same signal js/tool-options-bar.js follows for tool changes.
  new MutationObserver(refresh).observe(screen, { attributes: true, attributeFilter: ['data-current-tool'] });
  refresh();
  return { refresh };
}
