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

describe('floating top bar (5b)', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';
  const MOVED = ['#canvas-settings-toggle', '#export-button', '#record-toggle', '#tile-preview-toggle', '#hide-ui-toggle', '#theme-toggle', '.bottom-bar'];

  test('moved controls and the bottom zoom bar are hidden only in the floating layout', () => {
    const hiding = all.filter((r) => /display:\s*none/.test(r.body) && MOVED.some((id) => r.selector.includes(id)));
    for (const id of MOVED) {
      const rule = hiding.find((r) => r.selector.includes(id));
      assert.ok(rule, `${id} has a hiding rule`);
      assert.ok(rule.selector.startsWith(FLOATING), `${id} is hidden only under ${FLOATING}`);
    }
  });

  test('.floating-only markup is hidden outside the floating layout', () => {
    const base = all.find((r) => r.context === '' && r.selector === '.floating-only');
    assert.ok(base);
    assert.match(base.body, /display:\s*none/);
    for (const id of ['#topbar-title', '#zoom-pill', '#more-button']) {
      const shown = all.find((r) => r.selector.startsWith(FLOATING) && r.selector.includes(id) && /display:\s*(block|inline-flex|flex)/.test(r.body));
      assert.ok(shown, `${id} is shown in the floating layout`);
    }
  });

  test('the recording dot on More pulses only without a reduced-motion preference', () => {
    const dot = all.filter((r) => r.selector.includes('#record-toggle.recording') && r.selector.includes('#more-button::after'));
    assert.ok(dot.some((r) => r.context === '' && !/animation/.test(r.body)));
    const animated = dot.filter((r) => /animation/.test(r.body));
    assert.ok(animated.length > 0);
    for (const r of animated) assert.match(r.context, /prefers-reduced-motion:\s*no-preference/);
  });

  test('top bar menu items are at least 44px tall', () => {
    const item = all.find((r) => r.selector === '.topbar-menu-item');
    assert.match(item.body, /min-height:\s*44px/);
  });
});

describe('floating tool rail (5c)', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';
  const RAIL = ['.tool-rail-tools', '.fg-bg-swatch-stack', '.fg-bg-corner-button', '.swap-corner', '.reset-corner'];

  test('outside the floating layout the only .tool-rail-tools rule is display: contents', () => {
    const docked = all.filter((r) => r.selector.includes('.tool-rail-tools') && !r.selector.startsWith(FLOATING));
    assert.equal(docked.length, 1);
    assert.equal(docked[0].selector, '.tool-rail-tools');
    assert.match(docked[0].body, /^\s*display:\s*contents;\s*$/);
  });

  test('only the tool list scrolls, and the floating rail itself does not clip', () => {
    const scroller = all.find((r) => r.selector === `${FLOATING} .tool-rail-tools`);
    assert.match(scroller.body, /overflow-y:\s*auto/);
    assert.match(scroller.body, /min-height:\s*0/);
    const rail = all.filter((r) => r.selector === `${FLOATING} .slot-tools`);
    const overflow = rail.filter((r) => /(^|[\s;])overflow(-[xy])?:/.test(r.body));
    assert.equal(overflow.length, 1);
    assert.match(overflow[0].body, /overflow:\s*visible/);
  });

  test('the swatches are ordered after the tool-scoped toggles', () => {
    const toggles = all.find((r) => r.selector === `${FLOATING} .tools-sidebar .rectangle-options`);
    const swatches = all.find((r) => r.selector === `${FLOATING} .tools-sidebar .fg-bg-swatches`);
    const order = (r) => Number(/order:\s*(\d+)/.exec(r.body)[1]);
    assert.ok(order(swatches) > order(toggles));
  });

  test('tool buttons use the 44px rail size', () => {
    const root = all.find((r) => r.selector === FLOATING && /--rail-button-size:/.test(r.body));
    assert.match(root.body, /--rail-button-size:\s*2\.75rem/);
    const buttons = all.find((r) => r.selector.startsWith(FLOATING) && r.selector.includes('.tool-rail-tools') && r.selector.endsWith('.tool-button'));
    assert.match(buttons.body, /width:\s*var\(--rail-button-size\)/);
    assert.match(buttons.body, /height:\s*var\(--rail-button-size\)/);
  });

  test('new rail and swatch overrides are scoped to the floating layout', () => {
    const added = all.filter((r) => RAIL.some((s) => r.selector.includes(s)) && /rail-padding|rail-button-size|1\.5rem/.test(r.body));
    assert.ok(added.length >= 4);
    for (const r of added) assert.ok(r.selector.startsWith(FLOATING), r.selector);
  });

  test('Swap/Reset hit areas are 24px (1.5rem)', () => {
    const corner = all.find((r) => r.selector === `${FLOATING} .fg-bg-corner-button`);
    assert.match(corner.body, /width:\s*1\.5rem/);
    assert.match(corner.body, /height:\s*1\.5rem/);
  });
});
