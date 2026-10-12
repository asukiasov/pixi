// Standard Libraries: the palettes that ship with Pixi (Kit Kat, PICO-8,
// Pixi Basics...), re-addable at any time without touching the user's own
// palettes. The list is downloaded from the site (assets/palettes/
// standard.json; Supabase Storage once Phase 3 lands), falling back to the
// built-in copy offline. DOM-free, unit-tested (test/standard-libraries.test.js);
// js/color-library-ui.js renders the sheet.

import { STANDARD_PALETTES } from './default-color-library.js';

export const STANDARD_LIBRARIES_URL = 'assets/palettes/standard.json';

const HEX = /^#[0-9a-f]{6}$/i;

/** The well-formed `{ name, colors }` entries of a downloaded list (colours lower-cased), or null if it isn't a list. */
export function parseStandardLibraries(json) {
  if (!Array.isArray(json)) return null;
  return json
    .filter((p) => p && typeof p.name === 'string' && p.name.trim() && Array.isArray(p.colors) && p.colors.length > 0 && p.colors.every((c) => typeof c === 'string' && HEX.test(c)))
    .map((p) => ({ name: p.name.trim(), colors: p.colors.map((c) => c.toLowerCase()) }));
}

/** Each standard palette with `added`: whether the library already has a palette of that name (case-insensitive). */
export function standardLibraryRows(standard, existingNames) {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return standard.map((p) => ({ ...p, added: taken.has(p.name.toLowerCase()) }));
}

/** Downloads the list, or returns the built-in one when that fails or the file is unusable. */
export async function loadStandardLibraries(fetchFn = globalThis.fetch) {
  try {
    const response = await fetchFn(STANDARD_LIBRARIES_URL, { cache: 'no-cache' });
    if (!response.ok) return STANDARD_PALETTES;
    const parsed = parseStandardLibraries(await response.json());
    return parsed?.length ? parsed : STANDARD_PALETTES;
  } catch {
    return STANDARD_PALETTES;
  }
}
