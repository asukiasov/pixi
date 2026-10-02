// Hide-all-UI (4d-hide-all-ui) - the Tab shortcut's "should this keypress
// toggle the interface?" rule, kept DOM-free so it's unit-testable (see
// test/hide-ui.test.js). The toggle itself (class flip, pan compensation,
// focus handoff) lives in js/workspace.js's setUiHidden, next to the
// right-sidebar toggle it sits beside.

const CANVAS_CONTAINER_ID = 'workspace-canvas-container';

/**
 * True for a plain Tab (no Shift/Meta/Ctrl/Alt) while nothing interactive
 * has focus - `activeElement` is null, <body>, or the canvas container.
 * With any control focused, Tab keeps its normal focus-navigation job, so
 * keyboard users are never trapped by the shortcut.
 */
export function isHideUiShortcut(event, activeElement) {
  if (event.key !== 'Tab') return false;
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  if (!activeElement) return true;
  return activeElement.tagName === 'BODY' || activeElement.id === CANVAS_CONTAINER_ID;
}
