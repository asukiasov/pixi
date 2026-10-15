// Standard Brushes: the brush packs that ship with Pixi (Shapes, Nature,
// Texture & Dither, Soft, Game & UI), added to the user's brushes from the
// Standard Brushes sheet the way Standard Libraries adds palettes. The
// list is downloaded from the site (assets/brushes/standard.json), falling
// back to the built-in copy (js/default-brush-packs.js) offline. Added
// brushes are copied into customBrushes with pack, packName, packBrushId
// and packIndex, so they can be deleted one by one and restored. DOM-free,
// unit-tested (test/standard-brushes.test.js); js/standard-brushes-ui.js
// renders the sheet.

import { patternToPixels } from './brushes.js';
import { DEFAULT_BRUSH_PACKS } from './default-brush-packs.js';

export const STANDARD_BRUSHES_URL = 'assets/brushes/standard.json';

const ID = /^[a-z0-9-]+$/;
const ROW = /^[.X1-9]+$/;
const MIN_SIZE = 3;
const MAX_SIZE = 16;

const isName = (value) => typeof value === 'string' && value.trim() !== '';
const isId = (value) => typeof value === 'string' && ID.test(value);

/** One pack brush as `{ id, name, width, height, pixels }`, or null if malformed. */
function parseBrush(raw) {
  if (!raw || !isId(raw.id) || !isName(raw.name) || !Array.isArray(raw.rows)) return null;
  const { rows } = raw;
  const width = typeof rows[0] === 'string' ? rows[0].length : 0;
  const height = rows.length;
  if (width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE) return null;
  if (!rows.every((row) => typeof row === 'string' && row.length === width && ROW.test(row))) return null;
  const pixels = patternToPixels(rows);
  if (pixels.length === 0) return null;
  return { id: raw.id, name: raw.name.trim(), width, height, pixels };
}

/**
 * The well-formed packs of a downloaded list, each brush turned into
 * pixels, or null if it isn't a list. Drops malformed or duplicate brushes,
 * then packs left with none (or a duplicate pack id).
 */
export function parseStandardBrushes(json) {
  if (!Array.isArray(json)) return null;
  const packs = [];
  const packIds = new Set();
  for (const raw of json) {
    if (!raw || !isId(raw.id) || !isName(raw.name) || !Array.isArray(raw.brushes) || packIds.has(raw.id)) continue;
    const brushIds = new Set();
    const brushes = [];
    for (const rawBrush of raw.brushes) {
      const brush = parseBrush(rawBrush);
      if (!brush || brushIds.has(brush.id)) continue;
      brushIds.add(brush.id);
      brushes.push(brush);
    }
    if (brushes.length === 0) continue;
    packIds.add(raw.id);
    packs.push({ id: raw.id, name: raw.name.trim(), brushes });
  }
  return packs;
}

export const BUILT_IN_BRUSH_PACKS = parseStandardBrushes(DEFAULT_BRUSH_PACKS);

/** `pack/packBrushId` of every pack brush the user already has. */
function presentKeys(existingBrushes) {
  return new Set(existingBrushes.filter((b) => b.pack).map((b) => `${b.pack}/${b.packBrushId}`));
}

/** Each pack with `status`: 'add' (none of its brushes present), 'restore' (some), 'added' (all). */
export function standardBrushRows(packs, existingBrushes) {
  const present = presentKeys(existingBrushes);
  return packs.map((pack) => {
    const count = pack.brushes.filter((b) => present.has(`${pack.id}/${b.id}`)).length;
    const status = count === 0 ? 'add' : count === pack.brushes.length ? 'added' : 'restore';
    return { ...pack, status };
  });
}

/** The pack's brushes the user doesn't have, ready for createCustomBrush. */
export function missingPackBrushes(pack, existingBrushes) {
  const present = presentKeys(existingBrushes);
  return pack.brushes
    .map((brush, packIndex) => ({ brush, packIndex }))
    .filter(({ brush }) => !present.has(`${pack.id}/${brush.id}`))
    .map(({ brush, packIndex }) => ({
      name: brush.name,
      width: brush.width,
      height: brush.height,
      pixels: brush.pixels,
      packInfo: { pack: pack.id, packName: pack.name, packBrushId: brush.id, packIndex },
    }));
}

/** Downloads the list, or returns the built-in packs when that fails or the file is unusable. */
export async function loadStandardBrushes(fetchFn = globalThis.fetch) {
  try {
    const response = await fetchFn(STANDARD_BRUSHES_URL, { cache: 'no-cache' });
    if (!response.ok) return BUILT_IN_BRUSH_PACKS;
    const parsed = parseStandardBrushes(await response.json());
    return parsed?.length ? parsed : BUILT_IN_BRUSH_PACKS;
  } catch {
    return BUILT_IN_BRUSH_PACKS;
  }
}

/**
 * The brush palette's sections: Core, then each added pack (in
 * `packOrder`, unknown packs after by name, brushes by packIndex), then My
 * Brushes (user-made, oldest first). Empty sections are left out.
 */
export function brushSections(coreBrushes, customBrushes, packOrder) {
  const packs = new Map();
  const mine = [];
  for (const brush of customBrushes) {
    if (!brush.pack) {
      mine.push(brush);
      continue;
    }
    if (!packs.has(brush.pack)) packs.set(brush.pack, { id: `pack:${brush.pack}`, pack: brush.pack, title: brush.packName || brush.pack, brushes: [] });
    packs.get(brush.pack).brushes.push(brush);
  }
  const rank = (pack) => {
    const index = packOrder.indexOf(pack);
    return index === -1 ? Infinity : index;
  };
  const packSections = [...packs.values()]
    .sort((a, b) => rank(a.pack) - rank(b.pack) || a.title.localeCompare(b.title))
    .map(({ id, title, brushes }) => ({ id, title, brushes: brushes.sort((a, b) => (a.packIndex ?? 0) - (b.packIndex ?? 0)) }));
  mine.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return [
    { id: 'core', title: 'Core', brushes: coreBrushes },
    ...packSections,
    { id: 'mine', title: 'My Brushes', brushes: mine },
  ].filter((section) => section.brushes.length > 0);
}
