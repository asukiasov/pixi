// Hide-all-UI (4d-hide-all-ui) - the Tab shortcut's "should this keypress
// toggle the interface?" rule, kept DOM-free so it's unit-testable (see
// test/hide-ui.test.js). The toggle itself (class flip, pan compensation,
// focus handoff) lives in js/workspace.js's setUiHidden, next to the
// right-sidebar toggle it sits beside.

const CANVAS_CONTAINER_ID = 'workspace-canvas-container';

/**
 * True for a plain Tab (no Shift/Meta/Ctrl/Alt) while nothing interactive
 * has focus - `activeElement` is null, <body>, or the canvas container -
 * and, when the interface is visible, only if the user's last pointer
 * interaction was on the canvas (`canvasEngaged`: they were drawing).
 * Otherwise Tab keeps its normal focus-navigation job: a focused control
 * always navigates, and a keyboard user who just arrived (focus on
 * <body>, canvas never touched) can still Tab into the controls instead
 * of hiding them. While hidden there's nothing to navigate to, so Tab on
 * <body> always restores.
 */
export function isHideUiShortcut(event, activeElement, { uiHidden = false, canvasEngaged = false } = {}) {
  if (event.key !== 'Tab') return false;
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  const nothingFocused = !activeElement || activeElement.tagName === 'BODY' || activeElement.id === CANVAS_CONTAINER_ID;
  if (!nothingFocused) return false;
  return uiHidden || canvasEngaged;
}
