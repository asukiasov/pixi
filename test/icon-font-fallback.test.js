import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkIconFontLoaded, initIconFontFallback } from '../js/icon-font-fallback.js';

// checkIconFontLoaded is the pure half - no DOM, just a document.fonts-
// shaped object (or something falsy/incomplete standing in for browsers
// without the CSS Font Loading API) - so these drive it directly with
// fakes, same spirit as test/theme.test.js's fakeElement/fakeButton
// stubs for the DOM-wiring half below.

describe('checkIconFontLoaded', () => {
  test('resolves true when load() resolves a non-empty array (a matching FontFace loaded)', async () => {
    const fonts = { load: async () => [{ family: 'Material Symbols Outlined' }] };
    assert.equal(await checkIconFontLoaded(fonts), true);
  });

  test('resolves false when load() resolves an empty array (no matching FontFace registered - stylesheet never applied)', async () => {
    const fonts = { load: async () => [] };
    assert.equal(await checkIconFontLoaded(fonts), false);
  });

  test('resolves false when load() rejects (e.g. blocked network request)', async () => {
    const fonts = { load: async () => { throw new Error('network error'); } };
    assert.equal(await checkIconFontLoaded(fonts), false);
  });

  test('resolves false when load() never settles within the timeout', async () => {
    const fonts = { load: () => new Promise(() => {}) }; // never resolves/rejects
    assert.equal(await checkIconFontLoaded(fonts, { timeoutMs: 10 }), false);
  });

  test('resolves null (unknown) when given no fonts object', async () => {
    assert.equal(await checkIconFontLoaded(undefined), null);
    assert.equal(await checkIconFontLoaded(null), null);
  });

  test('resolves null (unknown) when the fonts object has no load()', async () => {
    assert.equal(await checkIconFontLoaded({}), null);
  });
});

describe('initIconFontFallback', () => {
  function fakeDoc(fonts) {
    const classes = new Set();
    return {
      fonts,
      documentElement: {
        classList: {
          add: (cls) => classes.add(cls),
          contains: (cls) => classes.has(cls),
        },
      },
    };
  }

  test('adds "icon-font-failed" to <html> when the font fails to load', async () => {
    const doc = fakeDoc({ load: async () => [] });
    await initIconFontFallback(doc);
    assert.equal(doc.documentElement.classList.contains('icon-font-failed'), true);
  });

  test('does not add the class when the font loads successfully', async () => {
    const doc = fakeDoc({ load: async () => [{ family: 'Material Symbols Outlined' }] });
    await initIconFontFallback(doc);
    assert.equal(doc.documentElement.classList.contains('icon-font-failed'), false);
  });

  test('does not add the class when load status is unknown (no Font Loading API)', async () => {
    const doc = fakeDoc(undefined);
    await initIconFontFallback(doc);
    assert.equal(doc.documentElement.classList.contains('icon-font-failed'), false);
  });
});

// WebKit ran the check before the Google Fonts stylesheet had registered
// any @font-face, so load() resolved [] and every icon was hidden for the
// session. The check now waits for the icon <link> to settle first.
describe('initIconFontFallback waits for the icon stylesheet', () => {
  function fakeLink({ sheet = null } = {}) {
    const listeners = {};
    return {
      sheet,
      addEventListener: (type, fn) => { listeners[type] = fn; },
      fire(type) { if (type === 'load') this.sheet = {}; listeners[type]?.(); },
    };
  }
  function fakeDoc(link, fonts) {
    const classes = new Set();
    return {
      fonts,
      querySelector: (sel) => (sel.includes('Material+Symbols') ? link : null),
      documentElement: { classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) } },
    };
  }
  // Faces exist only once the stylesheet has loaded, as in a browser.
  const fontsFor = (link) => ({ load: async () => (link.sheet ? [{ family: 'Material Symbols Outlined' }] : []) });

  test('a stylesheet still loading is not a failure', async () => {
    const link = fakeLink();
    const doc = fakeDoc(link, fontsFor(link));
    const done = initIconFontFallback(doc, { timeoutMs: 1000 });
    setTimeout(() => link.fire('load'), 5);
    await done;
    assert.equal(doc.documentElement.classList.contains('icon-font-failed'), false);
  });

  test('an already loaded stylesheet is checked straight away', async () => {
    const link = fakeLink({ sheet: {} });
    const doc = fakeDoc(link, fontsFor(link));
    await initIconFontFallback(doc, { timeoutMs: 1000 });
    assert.equal(doc.documentElement.classList.contains('icon-font-failed'), false);
  });

  test('a stylesheet that errors hides the ligature text', async () => {
    const link = fakeLink();
    const doc = fakeDoc(link, fontsFor(link));
    const done = initIconFontFallback(doc, { timeoutMs: 1000 });
    setTimeout(() => link.fire('error'), 5);
    await done;
    assert.equal(doc.documentElement.classList.contains('icon-font-failed'), true);
  });
});
