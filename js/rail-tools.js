// Which tools sit on the tool rail, and in what order (Customize Tools).
// Kept free of DOM globals so it can be unit-tested without a browser
// (see test/rail-tools.test.js). The stored list is js/prefs.js's
// `railTools`; js/tool-rail.js applies it to the rail, js/tool-overflow.js
// lists the rest in the rail's ⋯ menu, and js/customize-tools-sheet.js
// edits it.

/** Every tool, in the rail's default order. */
export const TOOL_IDS = Object.freeze([
  'move', 'pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'selection', 'hand', 'eyedropper',
]);

/** Short names for the ⋯ menu and the Customize Tools sheet. */
export const TOOL_LABELS = Object.freeze({
  move: 'Move',
  pencil: 'Pencil',
  eraser: 'Eraser',
  bucket: 'Bucket',
  brush: 'Brush',
  line: 'Line',
  rectangle: 'Rectangle',
  selection: 'Select',
  hand: 'Hand',
  eyedropper: 'Eyedropper',
});

/** Every tool on the rail, so nothing changes until someone customizes. */
export const DEFAULT_RAIL_TOOLS = TOOL_IDS;

/**
 * Known ids in the given order, without duplicates; anything that isn't
 * an array gives the default. An empty rail is allowed. A tool added in
 * a later release isn't in anyone's stored list, so it starts in ⋯.
 */
export function normalizeRailTools(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_RAIL_TOOLS];
  const rail = [];
  for (const id of raw) {
    if (TOOL_IDS.includes(id) && !rail.includes(id)) rail.push(id);
  }
  return rail;
}

/** The tools not on the rail, in default order: ⋯'s items and the sheet's grid. */
export function overflowTools(rail) {
  return TOOL_IDS.filter((id) => !rail.includes(id));
}

/**
 * A new list with `id` at `index` (clamped), taken out of its old place
 * first - so `index` counts the list without it. Adding, reordering and
 * dropping are all this one operation.
 */
export function insertTool(rail, id, index) {
  const rest = rail.filter((tool) => tool !== id);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

export function removeTool(rail, id) {
  return rail.filter((tool) => tool !== id);
}

export function isDefaultRail(rail) {
  return rail.length === TOOL_IDS.length && rail.every((id, i) => id === TOOL_IDS[i]);
}

/**
 * Where a tile dropped at `point` lands in a wrapping row of tiles,
 * given the other tiles' rects in order: before the first tile of a row
 * below the pointer, or, in the pointer's row, before the first tile
 * whose centre is past it.
 */
export function dropIndex(rects, { x, y }) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (y < r.top) return i;
    if (y <= r.top + r.height && x < r.left + r.width / 2) return i;
  }
  return rects.length;
}
