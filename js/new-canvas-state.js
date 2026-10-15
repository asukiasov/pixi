// New Canvas screen state (New Canvas redesign): which tile is selected,
// the size and the background. DOM-free so it's unit-testable (see
// test/new-canvas-state.test.js); js/new-canvas.js renders it.
//
// `selected` is 'last' (the Last used tile), a preset size, or 'custom'.
// A typed size picks its tile: a matching square preset first, then
// Last used, otherwise Custom.

export const PRESET_SIZES = [16, 32, 64, 128];
export const MIN_SIZE = 1;
export const MAX_SIZE = 256;

export function clampSize(value) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
}

/** The screen as it opens: the last-used size and background, on Last used. */
export function initialState(last) {
  return { width: last.width, height: last.height, background: last.background, last, selected: 'last' };
}

/** Picks the Last used tile ('last') or a preset size. */
export function selectTile(state, tile) {
  if (tile === 'last') return { ...state, width: state.last.width, height: state.last.height, selected: 'last' };
  return { ...state, width: tile, height: tile, selected: tile };
}

/** A typed (or swapped) size, clamped, with the tile it matches. */
export function setSize(state, width, height) {
  const w = clampSize(width);
  const h = clampSize(height);
  let selected = 'custom';
  if (w === h && PRESET_SIZES.includes(w)) selected = w;
  else if (w === state.last.width && h === state.last.height) selected = 'last';
  return { ...state, width: w, height: h, selected };
}

export function swapSize(state) {
  return setSize(state, state.height, state.width);
}

export function setBackground(state, background) {
  return { ...state, background };
}

/** The inspector's preset summary name. */
export function tileLabel(state) {
  if (state.selected === 'last') return 'Last used';
  if (state.selected === 'custom') return 'Custom';
  return `${state.selected} × ${state.selected}`;
}
