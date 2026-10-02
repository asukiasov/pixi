// Toast / status messages (4e-toast-system) - small non-blocking messages
// at the bottom-centre of the screen, replacing `alert()` and silent
// failures. Same lazily-built, appended-to-<body> pattern as
// js/confirm-dialog.js, so any module on any screen can call showToast()
// without threading anything through index.html. Lives outside
// #screen-workspace, so hide-all-UI (4d) never hides it.
//
// When to call it (see openspec/specs/status-messages and
// docs/code-standards.md): an action the user directly started failed ->
// error toast; a background operation failed -> stay silent, unless the
// user's work may be lost (e.g. autosave); never alert().
//
// Split in two: createToastController() is pure lifetime logic (ids,
// durations, max-3 trimming, pause/resume) with injected timers, unit-
// tested in test/toast.test.js; the DOM layer below just renders it.

export const TOAST_DURATIONS = { info: 4000, error: 8000 };
export const MAX_TOASTS = 3;

/**
 * Pure toast lifetime state. `onChange(list)` fires with the visible
 * toasts (oldest first) after every change. Each toast auto-dismisses
 * after its type's duration; pause() freezes that countdown (hover/focus)
 * and resume() continues with whatever time was left.
 */
export function createToastController({
  onChange = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  now = () => Date.now(),
} = {}) {
  let toasts = [];
  let nextId = 1;
  const emit = () => onChange(toasts.slice());

  function startTimer(toast) {
    toast.startedAt = now();
    toast.timer = setTimer(() => dismiss(toast.id), toast.remaining);
  }

  function dismiss(id) {
    const toast = toasts.find((t) => t.id === id);
    if (!toast) return;
    if (toast.timer != null) clearTimer(toast.timer);
    toasts = toasts.filter((t) => t !== toast);
    emit();
  }

  function add(message, { type = 'info', action = null } = {}) {
    const toast = { id: nextId++, message, type, action, remaining: TOAST_DURATIONS[type] ?? TOAST_DURATIONS.info, timer: null, paused: false };
    toasts.push(toast);
    while (toasts.length > MAX_TOASTS) {
      const oldest = toasts.shift();
      if (oldest.timer != null) clearTimer(oldest.timer);
    }
    startTimer(toast);
    emit();
    return toast.id;
  }

  function pause(id) {
    const toast = toasts.find((t) => t.id === id);
    if (!toast || toast.paused) return;
    toast.paused = true;
    clearTimer(toast.timer);
    toast.timer = null;
    toast.remaining = Math.max(0, toast.remaining - (now() - toast.startedAt));
  }

  function resume(id) {
    const toast = toasts.find((t) => t.id === id);
    if (!toast || !toast.paused) return;
    toast.paused = false;
    startTimer(toast);
  }

  function runAction(id) {
    const toast = toasts.find((t) => t.id === id);
    if (!toast?.action) return;
    dismiss(id);
    toast.action.onClick();
  }

  return { add, dismiss, pause, resume, runAction, list: () => toasts.slice() };
}

// --- DOM layer -----------------------------------------------------------

let controller = null;
let stackEl = null;
let politeEl = null;
let assertiveEl = null;
const toastEls = new Map(); // id -> element, so re-renders keep hover/focus

/**
 * Builds the toast region (idempotent). Called once at app startup
 * (js/app.js) so the live regions already exist before the first
 * message - a region inserted at the same moment as its first text is
 * often not announced. showToast() also calls it, as a fallback for any
 * other host.
 */
export function initToasts() {
  ensureBuilt();
}

function ensureBuilt() {
  if (controller) return;
  const region = document.createElement('div');
  region.className = 'toast-region';
  // Visual stack (one order across both types) plus two visually hidden
  // live regions that carry the announcements - polite for info,
  // assertive (role=alert) for errors - so screen readers hear a toast
  // without focus moving.
  region.innerHTML = `
    <div class="toast-stack"></div>
    <div class="visually-hidden" role="status" aria-live="polite"></div>
    <div class="visually-hidden" role="alert"></div>
  `;
  document.body.appendChild(region);
  stackEl = region.querySelector('.toast-stack');
  politeEl = region.querySelector('[role="status"]');
  assertiveEl = region.querySelector('[role="alert"]');
  controller = createToastController({ onChange: render });
}

function buildToastEl(toast) {
  const el = document.createElement('div');
  el.className = `toast toast-${toast.type}`;
  el.innerHTML = `
    <span class="material-symbols-outlined toast-icon" aria-hidden="true">${toast.type === 'error' ? 'error' : 'info'}</span>
    <span class="toast-message"></span>
  `;
  el.querySelector('.toast-message').textContent = toast.message;
  if (toast.action) {
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'toast-action';
    actionButton.textContent = toast.action.label;
    actionButton.addEventListener('click', () => controller.runAction(toast.id));
    el.append(actionButton);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close icon-button';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
  close.addEventListener('click', () => controller.dismiss(toast.id));
  el.append(close);
  // Hover or focus inside pauses the countdown, so a toast never vanishes
  // mid-read (WCAG 2.2.1).
  el.addEventListener('pointerenter', () => controller.pause(toast.id));
  el.addEventListener('pointerleave', () => {
    if (!el.contains(document.activeElement)) controller.resume(toast.id);
  });
  el.addEventListener('focusin', () => controller.pause(toast.id));
  el.addEventListener('focusout', (e) => {
    if (!el.contains(e.relatedTarget) && !el.matches(':hover')) controller.resume(toast.id);
  });
  return el;
}

function render(list) {
  const ids = new Set(list.map((t) => t.id));
  for (const [id, el] of toastEls) {
    if (ids.has(id)) continue;
    // Don't strand keyboard focus on a removed toast.
    if (el.contains(document.activeElement)) document.activeElement.blur();
    el.remove();
    toastEls.delete(id);
  }
  for (const toast of list) {
    if (toastEls.has(toast.id)) continue;
    const el = buildToastEl(toast);
    toastEls.set(toast.id, el);
    stackEl.append(el);
    announce(toast);
  }
}

function announce(toast) {
  const target = toast.type === 'error' ? assertiveEl : politeEl;
  // One appended node per message, not a replaced textContent - two
  // toasts of the same type shown together would otherwise overwrite each
  // other before the first is read (and identical replacement text isn't
  // re-announced at all). Pruned once it's surely been read, so the
  // region doesn't grow without bound.
  const line = document.createElement('div');
  line.textContent = toast.message;
  target.append(line);
  setTimeout(() => line.remove(), 10000);
}

/**
 * Shows a toast. `type` is 'info' (default) or 'error'; `action` is an
 * optional `{ label, onClick }` button (e.g. Undo) that runs once and
 * dismisses the toast. Returns a function that dismisses it early.
 */
export function showToast(message, { type = 'info', action = null } = {}) {
  ensureBuilt();
  const id = controller.add(message, { type, action });
  return () => controller.dismiss(id);
}
