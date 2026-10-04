// Forma UI (forma-ui/): the shared design system Pixi consumes. Static
// checks, like test/floating-layout-css.test.js: they read the files
// rather than rendering anything. Visual sameness is checked separately
// with scripts/style-snapshot.mjs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} not found`);
  return css.slice(start, css.indexOf('}', start));
}

const declared = (body) => new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

const COLOR = [
  '--color-bg', '--color-surface', '--color-surface-alt', '--color-track', '--color-border',
  '--color-text', '--color-text-secondary', '--color-text-tertiary', '--color-text-muted',
  '--color-text-subtle', '--color-text-subtle-2', '--color-accent', '--color-accent-strong',
  '--color-accent-soft', '--color-danger', '--color-success', '--color-overlay', '--color-overlay-soft',
];
const TOKENS = [
  ...COLOR,
  '--glass-tint', '--glass-tint-hover', '--glass-border', '--glass-highlight', '--glass-blur',
  '--float-radius', '--float-gap', '--float-edge', '--float-shadow',
  '--ghost-hover', '--ghost-on-bg', '--ghost-on-fg',
  '--icon-size-xs', '--icon-size-s', '--icon-size-m', '--icon-size-l', '--icon-size-xl',
  '--home-scrim-inner', '--home-scrim-outer',
];
const THEMED = [
  ...COLOR,
  '--glass-tint', '--glass-tint-hover', '--glass-border', '--glass-highlight',
  '--float-shadow', '--ghost-hover', '--ghost-on-bg', '--ghost-on-fg',
  '--home-scrim-inner', '--home-scrim-outer',
];
const ALLOWED_OVERRIDES = ['--color-accent', '--color-accent-strong', '--color-accent-soft'];

describe('Forma UI tokens', () => {
  const tokens = strip(read('forma-ui/tokens.css'));

  test('every token is defined on :root (the dark default)', () => {
    const d = declared(block(tokens, ':root'));
    for (const t of TOKENS) assert.ok(d.has(t), t);
  });

  test('themed tokens are redefined for light', () => {
    const d = declared(block(tokens, ':root[data-theme="light"]'));
    for (const t of THEMED) assert.ok(d.has(t), t);
  });

  test('tokens.css defines only the listed tokens', () => {
    for (const t of declared(tokens)) assert.ok(TOKENS.includes(t), `${t} is not in the token list`);
  });

  test('there is no prefers-color-scheme query (apps set data-theme)', () => {
    assert.doesNotMatch(tokens, /prefers-color-scheme/);
  });

  test("Pixi's style.css redefines no Forma token on :root except the accent overrides", () => {
    const css = strip(read('style.css'));
    for (const selector of [':root', ':root[data-theme="light"]']) {
      const d = declared(block(css, selector));
      for (const t of TOKENS) {
        if (!ALLOWED_OVERRIDES.includes(t)) assert.ok(!d.has(t), `${selector} redefines ${t}`);
      }
    }
  });
});

describe('Forma UI is linked before style.css', () => {
  const PAGES = [
    ['index.html', 'forma-ui/', ['tokens.css', 'components.css']],
    ['lib/pixi-embed-example.html', '../forma-ui/', ['tokens.css', 'components.css']],
  ];
  for (const [page, prefix, files] of PAGES) {
    test(page, () => {
      const html = read(page);
      const app = html.indexOf('style.css"');
      assert.notEqual(app, -1);
      let last = -1;
      for (const f of files) {
        const at = html.indexOf(`href="${prefix}${f}"`);
        assert.notEqual(at, -1, `${page} links ${prefix}${f}`);
        assert.ok(at > last, `${f} is linked in order`);
        assert.ok(at < app, `${f} comes before style.css`);
        last = at;
      }
    });
  }
});

describe('Forma UI stands alone', () => {
  const ids = [...read('index.html').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const files = readdirSync(new URL('../forma-ui/', import.meta.url)).filter((f) => /\.(css|html|md)$/.test(f));

  for (const file of files) {
    test(`${file} never references Pixi`, () => {
      const src = read(`forma-ui/${file}`);
      assert.doesNotMatch(src, /\.\.\//, 'no paths outside the folder');
      assert.doesNotMatch(src, /workspace-screen|data-layout|style\.css|\bjs\//);
      for (const id of ids) assert.ok(!new RegExp(`#${id}(?![\\w-])`).test(src), `#${id}`);
    });
  }
});

describe('Forma UI components', () => {
  const components = strip(read('forma-ui/components.css'));

  for (const selector of ['.glass', '.glass-pill', '.glass-circle', '.ghost-button', '.primary-button', '.slider', '.swatch-pair']) {
    test(`defines ${selector}`, () => {
      assert.match(components, new RegExp(`(^|[\\s,}])${selector.replace('.', '\\.')}[\\s,{:.]`));
    });
  }

  test('glass blurs only inside @supports, on ::before, with the -webkit- prefix', () => {
    const supports = components.slice(components.indexOf('@supports'));
    assert.match(supports, /\.glass::before[\s\S]*?-webkit-backdrop-filter:\s*blur\(var\(--glass-blur\)\)/);
    const outside = components.slice(0, components.indexOf('@supports'));
    assert.doesNotMatch(outside, /backdrop-filter/);
  });

  test('reduced transparency is a positive query', () => {
    assert.match(components, /@media \(prefers-reduced-transparency: reduce\)/);
  });

  test("style.css no longer defines the components", () => {
    const css = strip(read('style.css'));
    for (const selector of ['.glass', '.glass-pill', '.glass-circle', '.ghost-button', '.primary-button', '.slider', '.swatch-pair']) {
      // A rule *starting* with the component class (descendant uses such
      // as `.new-canvas-card .primary-button` stay in Pixi legitimately).
      assert.doesNotMatch(css, new RegExp(`^${selector.replace('.', '\\.')}(:[\\w-]+)?\\s*[,{]`, 'm'), selector);
    }
  });
});
