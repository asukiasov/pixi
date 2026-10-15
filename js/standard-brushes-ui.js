// Standard Brushes sheet (#standard-brushes-sheet): each pack from
// js/standard-brushes.js with a strip of its brushes and Add, Restore
// (some were deleted) or Added. Adding copies the pack's missing brushes
// into customBrushes (js/persistence.js) and calls onBrushesChanged so the
// brush palette re-reads them. Opened from the brush palette's toolbar
// (#standard-brushes-button); not in the docked embed (lib/pixi.js).

import { createCustomBrush, listCustomBrushes } from './persistence.js';
import { loadStandardBrushes, standardBrushRows, missingPackBrushes } from './standard-brushes.js';
import { drawBrushPreview } from './brush-preview.js';
import { showToast } from './toast.js';

const BUTTON_TEXT = { add: 'Add', restore: 'Restore', added: 'Added' };

function buttonLabel(row) {
  if (row.status === 'added') return `${row.name} is in your brushes`;
  if (row.status === 'restore') return `Restore deleted ${row.name} brushes`;
  return `Add ${row.name}`;
}

async function addPack(row) {
  for (const brush of missingPackBrushes(row, await listCustomBrushes())) {
    await createCustomBrush(brush.name, brush.width, brush.height, brush.pixels, brush.packInfo);
  }
}

async function renderPacks(listEl, packs, onBrushesChanged) {
  const rows = standardBrushRows(packs, await listCustomBrushes());
  listEl.innerHTML = '';
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'prefs-row standard-library-row';
    const label = document.createElement('div');
    label.className = 'standard-library-label';
    const name = document.createElement('span');
    name.className = 'prefs-row-label';
    name.textContent = row.name;
    const previews = document.createElement('span');
    previews.className = 'standard-brush-previews';
    previews.setAttribute('aria-hidden', 'true');
    for (const brush of row.brushes) previews.appendChild(drawBrushPreview(document.createElement('canvas'), brush));
    label.append(name, previews);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-button standard-library-add';
    button.textContent = BUTTON_TEXT[row.status];
    button.disabled = row.status === 'added';
    button.setAttribute('aria-label', buttonLabel(row));
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await addPack(row);
        showToast(row.status === 'restore' ? `Restored ${row.name}` : `Added ${row.name}`);
      } catch {
        showToast(`Couldn't add ${row.name}. Try again.`, { type: 'error' });
      }
      await onBrushesChanged();
      await renderPacks(listEl, packs, onBrushesChanged);
      // The next pack to add, or Done once every pack is added.
      (listEl.querySelector('.standard-library-add:not(:disabled)') ?? listEl.closest('dialog')?.querySelector('#standard-brushes-done'))?.focus();
    });
    item.append(label, button);
    listEl.appendChild(item);
  }
}

export function initStandardBrushes(root, { onBrushesChanged }) {
  const openButton = root.querySelector('#standard-brushes-button');
  const sheet = root.querySelector('#standard-brushes-sheet');
  if (!openButton || !sheet) return; // standalone-only (absent from lib/pixi.js's embed markup)
  const listEl = sheet.querySelector('#standard-brushes-list');
  openButton.addEventListener('click', async () => {
    listEl.textContent = 'Loading…';
    sheet.showModal();
    await renderPacks(listEl, await loadStandardBrushes(), onBrushesChanged);
  });
  sheet.querySelector('#standard-brushes-done').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close(); // backdrop
  });
}
