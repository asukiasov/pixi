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
const GLASS = '.slot-top, .slot-tools, .panel-rail, .options-card, .tool-options-bar';
const GLASS_CARDS = '.right-sidebar > :is(.color-library-panel, .brushes-panel, .layers-panel)';

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

  test('the rail has no ordering rules left over from its tool-scoped toggles (5d)', () => {
    const ordered = all.filter((r) => r.selector.startsWith(FLOATING) && r.selector.includes('.tools-sidebar') && /(^|[\s;])order:/.test(r.body));
    assert.equal(ordered.length, 0);
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

describe('floating tool-options bar (5d)', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const BAR = ['.tool-options-bar', '.tool-options-group', '.tool-options-slider', '.tool-options-label', '.tool-options-readout', '.tool-options-filled', '.brush-stroke-settings'];
  const MOVED = ['#pencil-options', '#rectangle-options', '#square-constraint-options', '#library-sequence-options', '#pixel-perfect-toggle', '#symmetry-toggle', '.brush-stroke-settings'];

  test('every bar rule is scoped to the floating layout', () => {
    const barRules = all.filter((r) => BAR.some((s) => r.selector.includes(s)) && !r.selector.includes('.tool-options-symmetry'));
    assert.ok(barRules.length >= 8);
    for (const r of barRules) {
      if (r.selector.includes(GLASS)) continue; // the shared glass list (5a)
      for (const sel of r.selector.split(/,(?![^(]*\))/)) assert.ok(sel.trim().startsWith(FLOATING), sel.trim());
    }
  });

  test('the options column and palette card rules are scoped to the floating layout', () => {
    const column = all.filter((r) => r.selector.includes('.slot-options') && /pointer-events|gap|align-items/.test(r.body));
    assert.ok(column.length >= 2);
    for (const r of column) assert.ok(r.selector.startsWith(FLOATING), r.selector);
    const column0 = all.find((r) => r.selector === `${FLOATING} .slot-options` && /flex-direction:\s*column/.test(r.body));
    assert.match(column0.body, /pointer-events:\s*none/);
    assert.match(column0.body, /gap:\s*var\(--float-gap\)/);
    assert.match(column0.body, /align-items:\s*center/);
  });

  test('outside the floating layout the only .options-card rule is display: contents', () => {
    const docked = all.filter((r) => r.selector.includes('.options-card') && !r.selector.startsWith(FLOATING) && !r.selector.includes(GLASS));
    assert.equal(docked.length, 1);
    assert.equal(docked[0].selector, '.options-card');
    assert.match(docked[0].body, /^\s*display:\s*contents;\s*$/);
  });

  test('the moved controls are hidden only in the floating layout', () => {
    const hiding = all.filter((r) => /display:\s*none/.test(r.body) && r.selector.startsWith(FLOATING));
    for (const id of MOVED) assert.ok(hiding.some((r) => r.selector.includes(id)), `${id} is hidden in the floating layout`);
    const elsewhere = all.filter((r) => /display:\s*none/.test(r.body) && !r.selector.startsWith(FLOATING)
      && MOVED.some((id) => new RegExp(`${id.replace('.', '\\.')}(?![-\\w])`).test(r.selector)));
    assert.deepEqual(elsewhere.map((r) => r.selector), []);
  });

  test('the bar-hiding rule and the data-tools lists name every tool exactly once', () => {
    const tools = new Set([...html.matchAll(/data-tool="([a-z]+)"/g)].map((m) => m[1]));
    assert.equal(tools.size, 10);
    const shown = new Set([...html.matchAll(/data-tools="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean)));
    const hideRule = all.find((r) => r.selector.endsWith('.tool-options-bar') && /display:\s*none/.test(r.body) && r.selector.includes('data-current-tool'));
    const hidden = new Set([...hideRule.selector.matchAll(/data-current-tool="([a-z]+)"/g)].map((m) => m[1]));
    for (const t of hidden) assert.ok(!shown.has(t), `${t} is both hidden and shown`);
    assert.deepEqual([...new Set([...hidden, ...shown])].sort(), [...tools].sort());
  });

  test('each tool with options has a rule showing its groups', () => {
    const shown = new Set([...html.matchAll(/data-tools="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean)));
    const showRule = all.find((r) => r.selector.includes('.tool-options-group[data-tools~=') && /display:\s*flex/.test(r.body));
    for (const t of shown) {
      assert.ok(showRule.selector.includes(`[data-current-tool="${t}"] .tool-options-group[data-tools~="${t}"]`), t);
    }
  });

  test('bar buttons use the 44px rail size and slider hit boxes are 44px tall', () => {
    const buttons = all.find((r) => r.selector === `${FLOATING} .tool-options-bar .tool-button`);
    assert.match(buttons.body, /width:\s*var\(--rail-button-size\)/);
    assert.match(buttons.body, /height:\s*var\(--rail-button-size\)/);
    const range = all.find((r) => r.selector === `${FLOATING} .tool-options-slider input[type="range"]`);
    assert.match(range.body, /height:\s*44px/);
  });

  test('the symmetry badge is drawn on both the source and the bar proxy', () => {
    for (const mode of ['horizontal', 'vertical', 'both']) {
      assert.ok(all.some((r) => r.selector === `:is(#symmetry-toggle, .tool-options-symmetry)[data-symmetry-mode='${mode}']::after`), mode);
    }
  });

  test('the Pencil/Eraser flyout slot variables are gone', () => {
    assert.doesNotMatch(css, /--slot-tools-flyout/);
  });
});

describe('floating panel cards + mini-rail (5e)', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';
  const NEW = ['.panel-rail', '.panel-close', '--slot-cards-', '--panel-card-min-height'];
  const isGlass = (r) => r.selector.includes(GLASS);

  test('every new rail, card, close and column rule is scoped to the floating layout', () => {
    const newRules = all.filter((r) => !isGlass(r) && (NEW.some((s) => r.selector.includes(s) || r.body.includes(s))
      || r.selector.includes('.right-sidebar >') || /\.right-sidebar\s*>\s*\.collapsed/.test(r.selector)));
    assert.ok(newRules.length >= 8);
    for (const r of newRules) {
      for (const sel of r.selector.split(/,(?![^(]*\))/)) assert.ok(sel.trim().startsWith(FLOATING), sel.trim());
    }
  });

  test('outside the floating layout nothing styles .panel-rail, .panel-close or a closed Brushes card', () => {
    const docked = all.filter((r) => !r.selector.startsWith(FLOATING) && !isGlass(r)
      && /\.panel-rail|\.panel-close|\.brushes-panel\.collapsed/.test(r.selector));
    assert.deepEqual(docked.map((r) => r.selector), []);
  });

  test('the glass lists name the rail and the three cards, not the whole sidebar', () => {
    assert.doesNotMatch(css, /:is\([^)]*\.slot-panels[^)]*\)/);
    const glass = all.filter(isGlass);
    assert.ok(glass.length >= 5);
    for (const r of glass) assert.ok(r.selector.includes(GLASS_CARDS), r.selector);
  });

  test('the card column is a see-through, pass-through flex column', () => {
    const column = all.find((r) => r.selector === `${FLOATING} .right-sidebar` && /flex-direction:\s*column/.test(r.body));
    assert.match(column.body, /pointer-events:\s*none/);
    assert.match(column.body, /gap:\s*var\(--float-gap\)/);
    assert.match(column.body, /background:\s*transparent/);
  });

  test('rail and column positions use only logical insets and their slot variables', () => {
    const rail = all.find((r) => r.selector === `${FLOATING} .panel-rail`);
    assert.match(rail.body, /inset-inline-end:\s*var\(--slot-panels-end\)/);
    assert.match(rail.body, /inset-inline-start:\s*var\(--slot-panels-start\)/);
    const column = all.find((r) => r.selector === `${FLOATING} .right-sidebar` && /inset-inline-end/.test(r.body));
    assert.match(column.body, /inset-inline-end:\s*var\(--slot-cards-end\)/);
    assert.match(column.body, /inset-inline-start:\s*var\(--slot-cards-start\)/);
  });

  test('a closed card is not displayed, and the chevron gives way to the close button', () => {
    assert.ok(all.some((r) => r.selector === `${FLOATING} .right-sidebar > .collapsed` && /display:\s*none/.test(r.body)));
    assert.ok(all.some((r) => r.selector === `${FLOATING} .panel-collapse-chevron` && /display:\s*none/.test(r.body)));
  });

  test('the top bar Layers and right-sidebar toggles are hidden only in the floating layout', () => {
    const hiding = all.filter((r) => r.selector.startsWith(FLOATING) && /display:\s*none/.test(r.body));
    for (const id of ['#layers-panel-toggle', '#right-sidebar-toggle']) assert.ok(hiding.some((r) => r.selector.includes(id)), id);
    const elsewhere = all.filter((r) => !r.selector.startsWith(FLOATING) && /display:\s*none/.test(r.body)
      && /#layers-panel-toggle|#right-sidebar-toggle/.test(r.selector));
    assert.deepEqual(elsewhere.map((r) => r.selector), []);
  });

  test('rail and close buttons use the 44px rail size', () => {
    for (const sel of [`${FLOATING} .panel-rail .tool-button`, `${FLOATING} .panel-close`]) {
      const r = all.find((x) => x.selector === sel);
      assert.match(r.body, /width:\s*var\(--rail-button-size\)/, sel);
      assert.match(r.body, /height:\s*var\(--rail-button-size\)/, sel);
    }
  });
});

describe('floating selection action bar (5f)', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const isGlass = (r) => r.selector.includes(GLASS);
  const selectors = (r) => r.selector.split(/,(?![^(]*\))/).map((s) => s.trim());

  test('every #selection-bar rule and the #selection-controls hide are scoped to the floating layout', () => {
    const barRules = all.filter((r) => !isGlass(r) && /#selection-bar|\.selection-bar/.test(r.selector));
    assert.ok(barRules.length >= 4);
    for (const r of barRules) for (const sel of selectors(r)) assert.ok(sel.startsWith(FLOATING), sel);
    const hide = all.filter((r) => r.selector.includes('#selection-controls') && /display:\s*none/.test(r.body));
    assert.ok(hide.some((r) => r.selector === `${FLOATING} #selection-controls`));
    for (const r of hide) assert.ok(r.selector.startsWith(FLOATING), r.selector);
  });

  test('outside the floating layout nothing styles the bar but .floating-only', () => {
    const docked = all.filter((r) => !isGlass(r) && !r.selector.startsWith(FLOATING) && /selection-bar/.test(r.selector));
    assert.deepEqual(docked.map((r) => r.selector), []);
    assert.match(html, /id="selection-bar" class="selection-bar floating-only"/);
  });

  test('shown only while the source is, and hidden during selection drags', () => {
    const hidden = all.find((r) => r.selector === `${FLOATING}:has(#selection-controls.hidden) #selection-bar`);
    assert.match(hidden.body, /display:\s*none/);
    const drag = all.find((r) => r.selector === `${FLOATING}[data-selection-drag] #selection-bar`);
    assert.match(drag.body, /visibility:\s*hidden/);
  });

  test('the bar is fixed and positioned with logical insets only', () => {
    const bar = all.find((r) => r.selector === `${FLOATING} #selection-bar`);
    assert.match(bar.body, /position:\s*fixed/);
    assert.match(bar.body, /inset-block-start:\s*var\(--selection-bar-y/);
    assert.match(bar.body, /inset-inline-start:\s*var\(--selection-bar-x/);
    assert.match(bar.body, /pointer-events:\s*auto/);
    assert.doesNotMatch(bar.body, /(?<![-\w])(top|left|right|bottom)\s*:/);
  });

  test('buttons are at least the 44px rail size', () => {
    const buttons = all.find((r) => r.selector === `${FLOATING} #selection-bar .tool-button`);
    assert.match(buttons.body, /min-width:\s*var\(--rail-button-size\)/);
    assert.match(buttons.body, /min-height:\s*var\(--rail-button-size\)/);
  });

  test('the glass lists name #selection-bar', () => {
    const glass = all.filter(isGlass);
    assert.ok(glass.length >= 5);
    for (const r of glass) assert.ok(r.selector.includes('#selection-bar'), r.selector);
  });

  test('the docked .selection-controls rules are unchanged', () => {
    const docked = all.filter((r) => /\.selection-controls/.test(r.selector) && !r.selector.startsWith(FLOATING));
    assert.deepEqual(docked.map((r) => r.selector), ['.selection-controls', '.selection-controls .tool-button']);
    assert.match(docked[0].body, /display:\s*flex/);
    assert.match(docked[1].body, /flex:\s*1/);
  });
});
