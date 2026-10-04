// The Prefs sheet (5g-prefs): a modal <dialog> opened from the More
// menu's Prefs item, styled after Pixelmator Pro for iPad's Settings
// sheet. Wired once from js/app.js (standalone only). It holds no state
// of its own: it reads the current prefs each time it opens and hands
// every change to `setPrefs`, which saves and applies it right away.

/**
 * @param {{
 *   getPrefs: () => import('./prefs.js').Prefs,
 *   setPrefs: (next: import('./prefs.js').Prefs) => void,
 *   root?: ParentNode,
 * }} options
 */
export function initPrefsSheet({ getPrefs, setPrefs, root = document }) {
  const sheet = root.querySelector('#prefs-sheet');
  const openItem = root.querySelector('#more-prefs');
  const moreButton = root.querySelector('#more-button');
  if (!sheet || !openItem) return;

  const toolsSide = sheet.querySelector('#prefs-tools-side');
  const panelsSide = sheet.querySelector('#prefs-panels-side');
  const autoHide = sheet.querySelector('#prefs-auto-hide');
  const pins = [...sheet.querySelectorAll('[data-pin]')];

  function sync() {
    const prefs = getPrefs();
    toolsSide.value = prefs.toolsSide;
    panelsSide.value = prefs.panelsSide;
    autoHide.checked = prefs.autoHide;
    for (const pin of pins) pin.checked = prefs.pinned[pin.dataset.pin];
  }

  function read() {
    const pinned = {};
    for (const pin of pins) pinned[pin.dataset.pin] = pin.checked;
    // Over the current prefs, so fields this sheet doesn't show
    // (railTools, edited by Customize Tools) are kept.
    return { ...getPrefs(), toolsSide: toolsSide.value, panelsSide: panelsSide.value, pinned, autoHide: autoHide.checked };
  }

  sheet.addEventListener('change', () => setPrefs(read()));

  openItem.addEventListener('click', () => {
    // After the More menu's own close, which returns focus to More and
    // would otherwise run against the already-modal sheet.
    setTimeout(() => {
      sync();
      sheet.showModal();
    });
  });

  sheet.querySelector('#prefs-done').addEventListener('click', () => sheet.close());

  // A press on the backdrop: the <dialog> itself is the target only
  // outside .prefs-sheet-inner, which fills the visible sheet.
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });

  // Back to the menu button the sheet was reached from.
  sheet.addEventListener('close', () => moreButton?.focus());
}
