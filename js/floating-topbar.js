// Floating layout's slim top bar (5b-top-bar-more): the zoom pill menu and
// the More menu. Wired once from js/app.js, only in the floating layout.
//
// Most items forward a click to the control they replace (data-forward:
// the bottom bar's zoom buttons, and the top bar buttons hidden in this
// layout), so each feature keeps the one code path it has in the docked
// layout. 5h deletes those buttons and should replace each forward with a
// direct call. Theme is the exception: it sets a specific preference
// rather than cycling.

import { initMenuButton } from './topbar-menu.js';

/**
 * @param {{ theme: { getPreference(): string, setPreference(p: string): void } }} options
 *   `theme` is what js/theme.js's initThemeToggle() returns.
 */
export function initFloatingTopbar({ theme, root = document }) {
  const zoomPill = root.querySelector('#zoom-pill');
  const zoomMenu = root.querySelector('#zoom-menu');
  const moreButton = root.querySelector('#more-button');
  const moreMenu = root.querySelector('#more-menu');
  const recordToggle = root.querySelector('#record-toggle');
  const tilePreviewToggle = root.querySelector('#tile-preview-toggle');
  if (!zoomPill || !moreButton) return;

  // Item listeners run before the menu's own close-on-activate listener
  // (they're on the items; it's on the menu), so a forwarded action runs
  // first and focus then returns to the menu button.
  for (const item of root.querySelectorAll('.topbar-menu-item[data-forward]')) {
    item.addEventListener('click', () => root.querySelector(`#${item.dataset.forward}`)?.click());
  }

  initMenuButton(zoomPill, zoomMenu, {
    // Zoom in/out stay open so they can be pressed repeatedly.
    keepOpen: (item) => item.hasAttribute('data-keep-open'),
  });

  const recordItem = moreMenu.querySelector('[data-forward="record-toggle"]');
  const recordLabel = recordItem.querySelector('.topbar-menu-label');
  const tileItem = moreMenu.querySelector('[data-forward="tile-preview-toggle"]');
  const themeItems = [...moreMenu.querySelectorAll('[data-theme-choice]')];

  for (const item of themeItems) {
    item.addEventListener('click', () => {
      theme.setPreference(item.dataset.themeChoice);
      syncThemeItems();
    });
  }

  function syncThemeItems() {
    const current = theme.getPreference();
    for (const item of themeItems) {
      item.setAttribute('aria-checked', String(item.dataset.themeChoice === current));
    }
  }

  initMenuButton(moreButton, moreMenu, {
    // State is read from the real controls each time the menu opens, so
    // there's no second copy to keep in sync.
    onOpen() {
      recordItem.setAttribute('aria-checked', String(recordToggle.classList.contains('recording')));
      recordItem.disabled = recordToggle.disabled;
      recordLabel.textContent = recordToggle.disabled
        ? 'Record timelapse (not supported in this browser)'
        : 'Record timelapse';
      tileItem.setAttribute('aria-checked', String(tilePreviewToggle.classList.contains('active')));
      syncThemeItems();
    },
    // Theme radios stay open, so the choice can be seen taking effect.
    keepOpen: (item) => item.hasAttribute('data-theme-choice'),
  });

  // The red dot on More is CSS (:has(#record-toggle.recording)); the
  // accessible name follows the same class here.
  const syncRecordingName = () => {
    const label = recordToggle.classList.contains('recording') ? 'More (recording)' : 'More';
    moreButton.setAttribute('aria-label', label);
    moreButton.dataset.tooltip = label;
  };
  new MutationObserver(syncRecordingName).observe(recordToggle, { attributes: true, attributeFilter: ['class'] });
  syncRecordingName();
}
