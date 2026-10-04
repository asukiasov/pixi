import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, nextThemePreference, normalizeThemePreference, initThemeToggle, bindThemeRadios } from '../js/theme.js';

describe('resolveTheme', () => {
  test('"light" preference always resolves to light, regardless of OS', () => {
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('light', false), 'light');
  });

  test('"dark" preference always resolves to dark, regardless of OS', () => {
    assert.equal(resolveTheme('dark', true), 'dark');
    assert.equal(resolveTheme('dark', false), 'dark');
  });

  test('"system" preference follows the OS prefers-color-scheme state', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
  });
});

describe('nextThemePreference', () => {
  test('cycles light -> dark -> system -> light', () => {
    assert.equal(nextThemePreference('light'), 'dark');
    assert.equal(nextThemePreference('dark'), 'system');
    assert.equal(nextThemePreference('system'), 'light');
  });

  test('unrecognized input falls back to the start of the cycle', () => {
    assert.equal(nextThemePreference('bogus'), 'light');
  });

  test('cycling three times from any starting point returns to the start', () => {
    for (const start of ['light', 'dark', 'system']) {
      let value = start;
      for (let i = 0; i < 3; i++) value = nextThemePreference(value);
      assert.equal(value, start);
    }
  });
});

describe('normalizeThemePreference', () => {
  test('passes through valid preferences unchanged', () => {
    assert.equal(normalizeThemePreference('light'), 'light');
    assert.equal(normalizeThemePreference('dark'), 'dark');
    assert.equal(normalizeThemePreference('system'), 'system');
  });

  test('falls back to "system" for unset/invalid/corrupted values', () => {
    assert.equal(normalizeThemePreference(undefined), 'system');
    assert.equal(normalizeThemePreference(null), 'system');
    assert.equal(normalizeThemePreference(''), 'system');
    assert.equal(normalizeThemePreference('purple'), 'system');
    assert.equal(normalizeThemePreference(42), 'system');
  });
});

// initThemeToggle() is the DOM/localStorage/matchMedia-wiring half - this
// repo has no jsdom/browser test harness (see test/router.test.js and
// friends, all DOM-free), so these stub just the handful of methods
// initThemeToggle actually calls: document.documentElement, a
// meta[name="theme-color"] lookup, a fake button, localStorage, and a
// matchMedia() result whose `matches`/'change' listener the test can
// drive directly. Real behavior, not tautological - each test exercises
// the module's actual persistence/live-update/click-cycle logic through
// these fakes, not a re-statement of the stub itself.
describe('initThemeToggle', () => {
  let restoreGlobals;

  function fakeElement(extra = {}) {
    const attrs = {};
    return {
      attrs,
      setAttribute: (k, v) => { attrs[k] = v; },
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      ...extra,
    };
  }

  function fakeButton() {
    const icon = fakeElement();
    icon.textContent = '';
    const listeners = {};
    const btn = fakeElement({
      querySelector: (sel) => (sel === '.material-symbols-outlined' ? icon : null),
      addEventListener: (type, cb) => { listeners[type] = cb; },
    });
    btn.icon = icon;
    btn.click = () => listeners.click && listeners.click();
    return btn;
  }

  function fakeMediaQuery(initialMatches) {
    let matches = initialMatches;
    let onChange = null;
    return {
      get matches() { return matches; },
      addEventListener: (type, cb) => { if (type === 'change') onChange = cb; },
      setOSDark(value) { matches = value; if (onChange) onChange(); },
    };
  }

  function fakeStorage(initial = {}) {
    const store = { ...initial };
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      store,
    };
  }

  /** Installs the fakes as globals (bare `document`/`window`/`localStorage`
   * identifiers in theme.js resolve through globalThis in Node, same as
   * they'd resolve through the real `window` in a browser) and returns
   * everything the test needs to inspect/drive. */
  function setUp({ storedPreference, osPrefersDark = false } = {}) {
    const html = fakeElement();
    const metaThemeColor = fakeElement();
    const media = fakeMediaQuery(osPrefersDark);
    const storage = fakeStorage(
      storedPreference !== undefined ? { 'pixi-theme-preference': storedPreference } : {}
    );
    const button = fakeButton();

    globalThis.document = {
      documentElement: html,
      querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? metaThemeColor : null),
    };
    globalThis.window = { matchMedia: () => media };
    globalThis.localStorage = storage;

    restoreGlobals = () => {
      delete globalThis.document;
      delete globalThis.window;
      delete globalThis.localStorage;
    };

    return { html, metaThemeColor, media, storage, button };
  }

  afterEach(() => {
    if (restoreGlobals) restoreGlobals();
  });

  test('setPreference picks a specific theme, saves it and updates the button', () => {
    const { html, storage, button } = setUp({ storedPreference: 'system', osPrefersDark: false });
    const theme = initThemeToggle(button);
    assert.equal(theme.getPreference(), 'system');

    theme.setPreference('dark');
    assert.equal(theme.getPreference(), 'dark');
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(storage.getItem('pixi-theme-preference'), 'dark');
    assert.equal(button.getAttribute('aria-label'), 'Theme: Dark');
    assert.equal(button.icon.textContent, 'dark_mode');
  });

  test('the click cycle continues from a value set with setPreference', () => {
    const { storage, button } = setUp({ storedPreference: 'light' });
    const theme = initThemeToggle(button);
    theme.setPreference('system');
    button.click(); // system -> light
    assert.equal(theme.getPreference(), 'light');
    assert.equal(storage.getItem('pixi-theme-preference'), 'light');
  });

  test('setPreference ignores unknown values by falling back to system', () => {
    const { button } = setUp({ storedPreference: 'dark' });
    const theme = initThemeToggle(button);
    theme.setPreference('neon');
    assert.equal(theme.getPreference(), 'system');
  });

  test('applies the stored preference immediately on init', () => {
    const { html, button } = setUp({ storedPreference: 'dark' });
    initThemeToggle(button);
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(button.icon.textContent, 'dark_mode');
    assert.equal(button.getAttribute('aria-label'), 'Theme: Dark');
  });

  test('no stored preference defaults to "system", resolved against the OS state', () => {
    const { html } = setUp({ osPrefersDark: true });
    const button = fakeButton();
    initThemeToggle(button);
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(button.icon.textContent, 'brightness_auto');
  });

  test('an invalid stored value falls back to "system" rather than throwing', () => {
    const { html } = setUp({ storedPreference: 'purple', osPrefersDark: false });
    const button = fakeButton();
    initThemeToggle(button);
    assert.equal(html.getAttribute('data-theme'), 'light');
    assert.equal(button.icon.textContent, 'brightness_auto');
  });

  test('clicking cycles the preference, persists it, and re-applies the theme', () => {
    const { html, storage, button } = setUp({ storedPreference: 'light' });
    initThemeToggle(button);

    button.click(); // light -> dark
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(storage.getItem('pixi-theme-preference'), 'dark');

    button.click(); // dark -> system (OS default here is light)
    assert.equal(html.getAttribute('data-theme'), 'light');
    assert.equal(storage.getItem('pixi-theme-preference'), 'system');
    assert.equal(button.icon.textContent, 'brightness_auto');
  });

  test('OS scheme change updates the theme live only while preference is "system"', () => {
    const { html, media, button } = setUp({ storedPreference: 'system', osPrefersDark: false });
    initThemeToggle(button);
    assert.equal(html.getAttribute('data-theme'), 'light');

    media.setOSDark(true);
    assert.equal(html.getAttribute('data-theme'), 'dark');

    // Lock to 'dark' explicitly, then flip the OS back to light - should
    // NOT move, since the preference is no longer 'system'.
    button.click(); // system -> light
    button.click(); // light -> dark
    assert.equal(html.getAttribute('data-theme'), 'dark');
    media.setOSDark(false);
    assert.equal(html.getAttribute('data-theme'), 'dark');
  });

  test('keeps <meta name="theme-color"> in sync with the resolved theme', () => {
    const { metaThemeColor, button } = setUp({ storedPreference: 'dark' });
    initThemeToggle(button);
    assert.equal(metaThemeColor.getAttribute('content'), '#1c1c1e');

    button.click(); // dark -> system (OS default here is light, from setUp's osPrefersDark: false)
    assert.equal(metaThemeColor.getAttribute('content'), '#ececf0');
  });

  // Regression test (CFIX-3, found by the code-standards red-team):
  // window.matchMedia() was called unguarded - some restrictive/sandboxed
  // environments throw when it's invoked (not just when it's missing).
  test('a throwing matchMedia() does not crash init - falls back to light, cycling still works', () => {
    const html = fakeElement();
    const metaThemeColor = fakeElement();
    const storage = fakeStorage();
    const button = fakeButton();

    globalThis.document = {
      documentElement: html,
      querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? metaThemeColor : null),
    };
    globalThis.window = {
      matchMedia: () => {
        throw new Error('matchMedia blocked in this environment');
      },
    };
    globalThis.localStorage = storage;
    restoreGlobals = () => {
      delete globalThis.document;
      delete globalThis.window;
      delete globalThis.localStorage;
    };

    assert.doesNotThrow(() => initThemeToggle(button));
    assert.equal(html.getAttribute('data-theme'), 'light');

    // Clicking still cycles/persists even without a live media query.
    button.click(); // system -> light
    assert.equal(storage.getItem('pixi-theme-preference'), 'light');
  });
  test('subscribe listeners hear every change, from setPreference or a click', () => {
    const { button } = setUp({ storedPreference: 'light' });
    const theme = initThemeToggle(button);
    const heard = [];
    theme.subscribe((p) => heard.push(p));
    theme.setPreference('system');
    button.click(); // system -> light
    assert.deepEqual(heard, ['system', 'light']);
  });
});

// The home screen's Light/Dark/Auto radios. DOM-free like the rest of
// this file: fake radios with `value`/`checked` and a change listener,
// and a fake theme object with the same shape initThemeToggle returns.
describe('bindThemeRadios', () => {
  function fakeRadio(value) {
    const listeners = {};
    return {
      value,
      checked: false,
      addEventListener: (type, cb) => { listeners[type] = cb; },
      choose() { this.checked = true; listeners.change?.(); },
    };
  }

  function fakeTheme(initial) {
    let preference = initial;
    const subscribers = [];
    return {
      getPreference: () => preference,
      setPreference(p) { preference = p; for (const fn of subscribers) fn(p); },
      subscribe: (fn) => { subscribers.push(fn); },
    };
  }

  const radios = () => ['light', 'dark', 'system'].map(fakeRadio);
  const checkedValue = (rs) => rs.filter((r) => r.checked).map((r) => r.value);

  test('checks the radio for the current preference', () => {
    const rs = radios();
    bindThemeRadios(rs, fakeTheme('dark'));
    assert.deepEqual(checkedValue(rs), ['dark']);
  });

  test('choosing a radio sets that preference', () => {
    const rs = radios();
    const theme = fakeTheme('system');
    bindThemeRadios(rs, theme);
    rs[0].choose();
    assert.equal(theme.getPreference(), 'light');
  });

  test('follows a preference changed somewhere else', () => {
    const rs = radios();
    const theme = fakeTheme('light');
    bindThemeRadios(rs, theme);
    theme.setPreference('system');
    assert.deepEqual(checkedValue(rs), ['system']);
  });
});
