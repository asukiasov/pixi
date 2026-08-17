/**
 * Detects whether the Material Symbols icon font (loaded via the <link>
 * in index.html's <head>) actually loaded, and if not, flags <html> with
 * `.icon-font-failed` so style.css can hide the raw ligature fallback
 * text (e.g. "home", "undo", "expand_more") instead of showing it -
 * every icon-only button already has an aria-label and/or data-tooltip,
 * so it stays identifiable either way. See docs/audits/
 * 2026-08-17-ui-polish-audit.md AUD-5.
 *
 * Uses the CSS Font Loading API (document.fonts). That API is missing on
 * very old browsers (e.g. Safari < 13) - checkIconFontLoaded treats that
 * as "unknown" (null), not "failed", so this never misfires the fallback
 * on a browser that simply lacks the API but would have rendered the
 * font fine.
 */

const FONT_SPEC = '24px "Material Symbols Outlined"';
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Given a `document.fonts`-like object (or a falsy stand-in for browsers
 * without the Font Loading API), resolves to:
 *   true  - the font is confirmed loaded
 *   false - the font failed to load, or didn't load within the timeout
 *   null  - the Font Loading API isn't available; caller should treat
 *           this as "unknown" and leave fallback styling off
 *
 * Deliberately uses `fontSet.load()`'s resolved array (a list of the
 * FontFaces that matched and loaded) rather than `fontSet.check()`:
 * check() only asks "can the browser render this text right now, with
 * whatever font it currently has" - since a generic system fallback can
 * always render *something*, Chromium (confirmed via manual testing)
 * returns true from check() even for a font-family that was never
 * registered at all, which would make it useless as a load-failure
 * signal here. load()'s returned array is empty when nothing matching
 * FONT_SPEC's family was ever registered - i.e. when the icon font's
 * <link rel="stylesheet"> never actually applied.
 *
 * Pure aside from the fontSet argument (and a timer), so it's directly
 * unit-testable with a fake fonts object - no DOM/network involved.
 */
export function checkIconFontLoaded(fontSet, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!fontSet || typeof fontSet.load !== 'function') {
    return Promise.resolve(null);
  }
  const loadPromise = Promise.resolve(fontSet.load(FONT_SPEC))
    .then((matches) => Array.isArray(matches) && matches.length > 0)
    .catch(() => false);
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(false), timeoutMs);
  });
  return Promise.race([loadPromise, timeoutPromise]);
}

/**
 * Wires the check up to <html>.classList - the DOM-touching half. Only
 * ever adds the class, never removes it (there's nothing to recover
 * from mid-session - if the font eventually loads, the page still
 * showed broken text for that window, so a fallback isn't a smoother
 * experience to leave the app in).
 */
export async function initIconFontFallback(doc = document) {
  const loaded = await checkIconFontLoaded(doc.fonts);
  if (loaded === false) {
    doc.documentElement.classList.add('icon-font-failed');
  }
}
