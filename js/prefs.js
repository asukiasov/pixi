// Workspace preferences (5g-prefs): which side the tool rail and the
// panels sit on, which panel cards a project opens with, and whether the
// interface hides while drawing. Kept DOM-free so it's unit-testable (see
// test/prefs.test.js); js/prefs-sheet.js is the Prefs sheet that edits
// them. Standalone app only: wired from js/app.js, which Pixi.mount()
// embeds never load.
//
// Stored as one JSON string in localStorage, the same mechanism as the
// theme preference (js/theme.js). A preference isn't user data, so a
// failed read or write is silent: the defaults, or the change for this
// session only.

export const PREFS_STORAGE_KEY = 'pixi-prefs';

const SIDES = ['left', 'right'];
const CARDS = ['colors', 'brushes', 'layers'];

// Tools whose strokes hide the interface while auto-hide is on. The rest
// are taps (Bucket, Eyedropper), pan (Hand), or have their own drag
// feedback that needs the selection bar logic (Select, Move).
const AUTO_HIDE_TOOLS = new Set(['pencil', 'eraser', 'brush', 'line', 'rectangle']);

export const DEFAULT_PREFS = Object.freeze({
  toolsSide: 'left',
  panelsSide: 'right',
  pinned: Object.freeze({ colors: true, brushes: true, layers: true }),
  autoHide: false,
});

/** A complete, valid prefs object from anything; each field falls back on its own. */
export function normalizePrefs(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const pinnedSource = source.pinned && typeof source.pinned === 'object' ? source.pinned : {};
  const pinned = {};
  for (const card of CARDS) {
    pinned[card] = typeof pinnedSource[card] === 'boolean' ? pinnedSource[card] : DEFAULT_PREFS.pinned[card];
  }
  return {
    toolsSide: SIDES.includes(source.toolsSide) ? source.toolsSide : DEFAULT_PREFS.toolsSide,
    panelsSide: SIDES.includes(source.panelsSide) ? source.panelsSide : DEFAULT_PREFS.panelsSide,
    pinned,
    autoHide: typeof source.autoHide === 'boolean' ? source.autoHide : DEFAULT_PREFS.autoHide,
  };
}

/** Reads the stored prefs from a Storage-like object (or null). */
export function loadPrefs(storage) {
  try {
    const stored = storage?.getItem(PREFS_STORAGE_KEY);
    return normalizePrefs(stored ? JSON.parse(stored) : undefined);
  } catch {
    return normalizePrefs(undefined);
  }
}

/** Stores the prefs; storage being missing or full is ignored. */
export function savePrefs(storage, prefs) {
  try {
    storage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(normalizePrefs(prefs)));
  } catch {
    // Kept for this session only.
  }
}

/**
 * Writes the prefs the CSS reads onto the Workspace screen:
 * data-tools-side, data-panels-side (style.css's slot variables) and
 * data-auto-hide (the hide-while-drawing rule). Pins are read on project
 * open instead (js/panel-rail.js's applyOpenCardDefaults).
 */
export function applyPrefsToScreen(screenEl, prefs) {
  screenEl.dataset.toolsSide = prefs.toolsSide;
  screenEl.dataset.panelsSide = prefs.panelsSide;
  screenEl.dataset.autoHide = prefs.autoHide ? 'on' : 'off';
}

/** Whether a stroke with `tool` hides the interface while auto-hide is on. */
export function isAutoHideTool(tool) {
  return AUTO_HIDE_TOOLS.has(tool);
}
