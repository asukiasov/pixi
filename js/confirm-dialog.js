// Shared "Are you sure?" confirmation modal - dark-themed to match the
// rest of the app, replacing native window.confirm() (which the Gallery's
// project delete used to be the only place that even asked) everywhere
// the app deletes something irreversible: a project, a custom brush, a
// color palette, a layer. Lazily builds its DOM on first call and reuses
// a single overlay/dialog pair appended to <body>, so it works from any
// screen (Gallery, Workspace) without threading it through index.html.
let overlayEl = null;
let titleEl = null;
let messageEl = null;
let confirmButton = null;
let cancelButton = null;

function ensureBuilt() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.className = 'confirm-overlay hidden';
  overlayEl.innerHTML = `
    <div class="confirm-dialog" role="alertdialog" aria-modal="true">
      <h2 class="confirm-dialog-title"></h2>
      <p class="confirm-dialog-message"></p>
      <div class="confirm-dialog-actions">
        <button type="button" class="tool-button confirm-dialog-cancel">Cancel</button>
        <button type="button" class="tool-button confirm-dialog-confirm">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlayEl);
  titleEl = overlayEl.querySelector('.confirm-dialog-title');
  messageEl = overlayEl.querySelector('.confirm-dialog-message');
  confirmButton = overlayEl.querySelector('.confirm-dialog-confirm');
  cancelButton = overlayEl.querySelector('.confirm-dialog-cancel');
}

/**
 * Shows the confirm modal and resolves `true`/`false` with the user's
 * choice - `await`-able in place of `window.confirm()`. Dismissible via
 * Cancel, clicking outside the dialog, or Escape (all resolve `false`,
 * same as `window.confirm`'s Cancel button).
 */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Delete' } = {}) {
  ensureBuilt();
  titleEl.textContent = title;
  messageEl.textContent = message;
  confirmButton.textContent = confirmLabel;
  overlayEl.classList.remove('hidden');
  confirmButton.focus();

  return new Promise((resolve) => {
    function cleanup(result) {
      overlayEl.classList.add('hidden');
      confirmButton.removeEventListener('click', onConfirm);
      cancelButton.removeEventListener('click', onCancel);
      overlayEl.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }
    function onConfirm() {
      cleanup(true);
    }
    function onCancel() {
      cleanup(false);
    }
    function onOverlayClick(e) {
      if (e.target === overlayEl) cleanup(false);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') cleanup(false);
    }
    confirmButton.addEventListener('click', onConfirm);
    cancelButton.addEventListener('click', onCancel);
    overlayEl.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeydown);
  });
}
