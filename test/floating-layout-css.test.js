// Floating workspace layout (5a-floating-shell). Pure CSS, so like
// test/text-selection.test.js this reads style.css and checks the rules
// rather than rendering anything.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Splits CSS into { context, selector, body } rules, where context is the
// enclosing at-rule prelude ('' at top level). One nesting level is
// enough for style.css.
function rules(source) {
  const out = [];
  let i = 0;
  const walk = (context, end) => {
    while (i < end) {
      const open = source.indexOf('{', i);
      const close = source.indexOf('}', i);
      if (open === -1 || close < open) { i = close === -1 ? end : close + 1; return; }
      const prelude = source.slice(i, open).trim();
      i = open + 1;
      if (prelude.startsWith('@')) {
        walk(prelude, end);
      } else {
        const bodyEnd = source.indexOf('}', i);
        out.push({ context, selector: prelude, body: source.slice(i, bodyEnd) });
        i = bodyEnd + 1;
      }
    }
  };
  walk('', source.length);
  return out;
}

const all = rules(css);
const GLASS = '.slot-top, .slot-tools, .slot-panels, .slot-options, .pencil-options';

describe('glass card (5a)', () => {
  test('the opaque base sits outside any at-rule and has no blur', () => {
    const base = all.filter((r) => r.context === '' && r.selector.includes(GLASS));
    assert.equal(base.length, 1);
    assert.match(base[0].body, /background:\s*var\(--color-surface\)/);
    assert.doesNotMatch(base[0].body, /backdrop-filter/);
  });

  test('blur is only applied inside @supports, with the -webkit- prefix', () => {
    const blurred = all.filter((r) => /(^|[\s;])backdrop-filter:\s*blur/.test(r.body));
    assert.ok(blurred.length > 0);
    for (const r of blurred) {
      assert.match(r.context, /^@supports/);
      assert.match(r.body, /-webkit-backdrop-filter:\s*blur/);
    }
  });

  test('the blur is on ::before, not on the card (fixed popovers live inside cards)', () => {
    const blurred = all.filter((r) => /(^|[\s;])backdrop-filter:\s*blur/.test(r.body));
    for (const r of blurred) {
      for (const sel of r.selector.split(/,(?![^(]*\))/)) assert.match(sel.trim(), /::before$/);
    }
  });

  test('reduced transparency is a positive query that turns the blur off', () => {
    assert.doesNotMatch(css, /not\s*\(\s*prefers-reduced-transparency/);
    const reduced = all.filter((r) => /^@media\s*\(prefers-reduced-transparency:\s*reduce\)/.test(r.context));
    assert.ok(reduced.some((r) => r.selector.includes('::before') && /display:\s*none/.test(r.body)));
    assert.ok(reduced.some((r) => !r.selector.includes('::before') && /background:\s*var\(--color-surface\)/.test(r.body)));
  });

  test('glass tokens exist for both themes', () => {
    const root = all.find((r) => r.selector === ':root');
    const light = all.find((r) => r.selector === ':root[data-theme="light"]');
    for (const token of ['--float-radius', '--float-gap', '--float-edge', '--glass-tint', '--glass-border', '--glass-blur', '--float-shadow']) {
      assert.match(root.body, new RegExp(`${token}:`), token);
    }
    assert.match(light.body, /--glass-tint:/);
  });
});

describe('floating layout slots (5a)', () => {
  const floating = all.filter((r) => r.selector.includes('[data-layout="floating"]'));

  test('floating rules never set a physical left/right side', () => {
    assert.ok(floating.length > 0);
    for (const r of floating) {
      assert.doesNotMatch(r.body, /(?<![-\w])(left|right)\s*:/, r.selector);
    }
  });

  test('the docked layout keeps the options wrapper box-less', () => {
    const docked = all.find((r) => r.context === '' && r.selector === '.slot-options');
    assert.match(docked.body, /display:\s*contents/);
  });

  test('the canvas container fills the workspace', () => {
    const canvas = floating.find((r) => r.selector.endsWith('.canvas-container'));
    assert.match(canvas.body, /position:\s*absolute/);
    assert.match(canvas.body, /inset:\s*0/);
  });
});
