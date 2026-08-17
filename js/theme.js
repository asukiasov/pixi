/**
 * Light/dark/system theme toggle.
 *
 * Three preference states, cycled by the top-bar button:
 *   'light'  - always light
 *   'dark'   - always dark
 *   'system' - follow the OS `prefers-color-scheme`, live (updates
 *              immediately if the OS setting changes while the app is open)
 *
 * The preference is persisted in localStorage (this app is otherwise
 * Dexie/IndexedDB for project data, but there's no existing localStorage/
 * IndexedDB precedent for small UI prefs like panel visibility - it isn't
 * persisted at all today, see js/workspace.js's in-memory `state.
 * rightSidebarVisible` - so localStorage is the simplest fit for a single
 * small string preference, not a new IndexedDB store for one value).
 *
 * The *resolved* theme ('light' or 'dark' - what's actually painted) is
 * applied as `data-theme` on <html>, which style.css's tokens key off of.
 * Resolution always happens here in JS (never via a CSS
 * prefers-color-scheme media query) so that 'system' mode can react live
 * to OS changes without a page reload.
 */

const STORAGE_KEY = 'pixi-theme-preference';
const PREFERENCES = ['light', 'dark', 'system'];

// Click order: light -> dark -> system -> light ...
const CYCLE_ORDER = ['light', 'dark', 'system'];

const ICONS = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'brightness_auto',
};

// Mirrors style.css's --color-bg token for each resolved theme, so
// <meta name="theme-color"> (the browser chrome color - mobile address
// bar, task switcher) can be kept in sync from JS. Not read from the CSS
// var itself since that requires a layout-triggering computed-style read;
// these are static and cheap to duplicate here.
const THEME_COLOR = {
  light: '#f2f2f7',
  dark: '#1c1c1e',
};

const LABELS = {
  light: 'Theme: Light',
  dark: 'Theme: Dark',
  system: 'Theme: System',
};

/** Falls back to 'system' for anything unrecognized (unset, corrupted, old value). */
export function normalizeThemePreference(value) {
  return PREFERENCES.includes(value) ? value : 'system';
}

/**
 * Resolves a preference + the OS's current prefers-color-scheme state to
 * a concrete theme. Pure function - no DOM/matchMedia access - so it's
 * directly unit-testable.
 */
export function resolveTheme(preference, systemPrefersDark) {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

/** Returns the next preference in the click cycle. */
export function nextThemePreference(current) {
  const idx = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
}

function readStoredPreference() {
  try {
    return normalizeThemePreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage disabled/unavailable (e.g. private browsing edge cases) -
    // fall back to 'system' for this session rather than throwing.
    return 'system';
  }
}

function writeStoredPreference(preference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Non-fatal - the preference just won't survive a reload.
  }
}

/**
 * Wires the theme toggle button: applies the persisted/system-resolved
 * theme immediately, keeps it live if `preference === 'system'` and the
 * OS scheme changes, and cycles+persists the preference on click.
 *
 * Called once at boot (js/app.js), not per Workspace open - the button is
 * a static element present for the whole page lifetime, unlike Workspace-
 * scoped controls that get re-initialized per project.
 */
export function initThemeToggle(button) {
  let preference = readStoredPreference();
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function apply() {
    const resolved = resolveTheme(preference, media.matches);
    document.documentElement.setAttribute('data-theme', resolved);
    const icon = button.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = ICONS[preference];
    const label = LABELS[preference];
    button.setAttribute('aria-label', label);
    button.setAttribute('data-tooltip', label);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute('content', THEME_COLOR[resolved]);
  }

  media.addEventListener('change', () => {
    if (preference === 'system') apply();
  });

  button.addEventListener('click', () => {
    preference = nextThemePreference(preference);
    writeStoredPreference(preference);
    apply();
  });

  apply();
}
