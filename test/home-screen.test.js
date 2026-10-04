// Home screen redesign (Pixelmator-style Gallery + New Canvas). Markup and
// CSS only, so like test/floating-layout-css.test.js this reads the
// source files and checks them rather than rendering anything.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const html = read('index.html').toString('utf8');
const css = read('style.css').toString('utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function screen(id) {
  const start = html.indexOf(`<main id="${id}"`);
  assert.notEqual(start, -1, `#${id} not found`);
  return html.slice(start, html.indexOf('</main>', start));
}

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} not found`);
  return css.slice(start, css.indexOf('}', start));
}

describe('home screen backdrop', () => {
  test('artwork ships as WebP under assets/', () => {
    assert.ok(existsSync(new URL('../assets/home-bg.webp', import.meta.url)));
    const bytes = read('assets/home-bg.webp');
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP');
  });

  for (const id of ['screen-gallery', 'screen-new-canvas']) {
    test(`#${id} carries the decorative backdrop`, () => {
      assert.match(
        screen(id),
        /<div class="home-backdrop" aria-hidden="true">\s*<img src="assets\/home-bg\.webp" alt=""/,
      );
    });
  }

  test('the backdrop image covers the screen', () => {
    assert.match(block('.home-backdrop img'), /object-fit:\s*cover/);
  });

  test('scrim tokens are defined for both themes', () => {
    for (const theme of [block(':root'), block(':root[data-theme="light"]')]) {
      assert.match(theme, /--home-scrim-inner:/);
      assert.match(theme, /--home-scrim-outer:/);
    }
  });
});

describe('home screen glass surfaces', () => {
  test('hero card and Recents sheet use the shared .glass card', () => {
    const gallery = screen('screen-gallery');
    assert.match(gallery, /class="home-hero glass"/);
    assert.match(gallery, /class="home-recents glass"/);
  });

  test('New Canvas form sits in a glass card', () => {
    assert.match(screen('screen-new-canvas'), /class="new-canvas-card glass"/);
  });

  test('.glass cards are positioned (the blur layer is an absolute ::before)', () => {
    for (const selector of ['.home-hero', '.home-recents', '.new-canvas-card']) {
      assert.match(block(selector), /position:\s*relative/, selector);
    }
  });

  test('the project grid is a list', () => {
    assert.match(screen('screen-gallery'), /<ul id="gallery-grid" class="gallery-grid"/);
  });
});
