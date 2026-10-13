// Floating workspace layout (5a-floating-shell). Pure CSS, so like
// test/text-selection.test.js this reads style.css and checks the rules
// rather than rendering anything.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORMA_CLASSES } from '../js/layout.js';

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

// The glass, ghost button, slider and swatch pair looks are Forma UI
// components (forma-ui/components.css); js/layout.js's FORMA_CLASSES puts
// their classes on the floating workspace's elements.
const all = rules(css);
const formaSelector = (cls) => FORMA_CLASSES.filter(([, classes]) => classes.includes(cls)).map(([selector]) => selector).join(', ');

describe('glass card (5a)', () => {
  // The confirm dialog's dimmed scrim is the one exception: it blurs the
  // page behind a modal, it isn't a glass surface.
  test('style.css has no backdrop-filter: the blur lives in Forma UI', () => {
    assert.doesNotMatch(css.replace(/\.confirm-overlay \{[^}]*\}/g, ''), /backdrop-filter/);
  });

  test('glass tokens exist for both themes', () => {
    const tokens = readFileSync(new URL('../forma-ui/tokens.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const block = (selector) => {
      const start = tokens.indexOf(`${selector} {`);
      assert.notEqual(start, -1, `${selector} not found`);
      return tokens.slice(start, tokens.indexOf('}', start));
    };
    const root = block(':root');
    const light = block(':root[data-theme="light"]');
    for (const token of ['--float-radius', '--float-gap', '--float-edge', '--glass-tint', '--glass-border', '--glass-blur', '--float-shadow']) {
      assert.match(root, new RegExp(`${token}:`), token);
    }
    assert.match(light, /--glass-tint:/);
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
    const docked = all.filter((r) => r.selector.includes('.options-card') && !r.selector.startsWith(FLOATING));
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
    assert.equal(tools.size, 11);
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
  test('every new rail, card, close and column rule is scoped to the floating layout', () => {
    const newRules = all.filter((r) => (NEW.some((s) => r.selector.includes(s) || r.body.includes(s))
      || r.selector.includes('.right-sidebar >') || /\.right-sidebar\s*>\s*\.collapsed/.test(r.selector)));
    assert.ok(newRules.length >= 8);
    for (const r of newRules) {
      for (const sel of r.selector.split(/,(?![^(]*\))/)) assert.ok(sel.trim().startsWith(FLOATING), sel.trim());
    }
  });

  test('outside the floating layout nothing styles .panel-rail, .panel-close or a closed Brushes card', () => {
    const docked = all.filter((r) => !r.selector.startsWith(FLOATING)
      && /\.panel-rail|\.panel-close|\.brushes-panel\.collapsed/.test(r.selector));
    assert.deepEqual(docked.map((r) => r.selector), []);
  });

  test('the glass lists name the rail and the cards, not the whole sidebar', () => {
    assert.doesNotMatch(css, /:is\([^)]*\.slot-panels[^)]*\)/);
    const glass = formaSelector('glass');
    for (const part of ['.panel-rail', '.right-sidebar > .layers-panel']) {
      assert.ok(glass.includes(part), part);
    }
    assert.ok(!glass.includes('.right-sidebar,'), glass);
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
  const selectors = (r) => r.selector.split(/,(?![^(]*\))/).map((s) => s.trim());

  test('every #selection-bar rule and the #selection-controls hide are scoped to the floating layout', () => {
    const barRules = all.filter((r) => /#selection-bar|\.selection-bar/.test(r.selector));
    assert.ok(barRules.length >= 4);
    for (const r of barRules) for (const sel of selectors(r)) assert.ok(sel.startsWith(FLOATING), sel);
    const hide = all.filter((r) => r.selector.includes('#selection-controls') && /display:\s*none/.test(r.body));
    assert.ok(hide.some((r) => r.selector === `${FLOATING} #selection-controls`));
    for (const r of hide) assert.ok(r.selector.startsWith(FLOATING), r.selector);
  });

  test('outside the floating layout nothing styles the bar but .floating-only', () => {
    const docked = all.filter((r) => !r.selector.startsWith(FLOATING) && /selection-bar/.test(r.selector));
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
    assert.ok(formaSelector('glass').includes('#selection-bar'));
  });

  test('the docked .selection-controls rules are unchanged', () => {
    const docked = all.filter((r) => /\.selection-controls/.test(r.selector) && !r.selector.startsWith(FLOATING));
    assert.deepEqual(docked.map((r) => r.selector), ['.selection-controls', '.selection-controls .tool-button']);
    assert.match(docked[0].body, /display:\s*flex/);
    assert.match(docked[1].body, /flex:\s*1/);
  });
});

describe('narrow windows (5h)', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';
  const bodyOf = (selector) => all.filter((r) => r.selector === selector).map((r) => r.body);

  test('--slot-cards-room is built only from the slot variables', () => {
    const decl = /--slot-cards-room:\s*([^;]+);/.exec(css);
    assert.ok(decl);
    const vars = decl[1].match(/--[\w-]+/g);
    // 5g-prefs: built from the column's offset and the far side's reserve,
    // which each side combination sets.
    assert.deepEqual([...new Set(vars)].sort(), ['--float-gap', '--slot-cards-far', '--slot-cards-offset']);
  });

  test('the card column (open and collapsed) is capped by --slot-cards-room', () => {
    for (const sel of [`${FLOATING} .right-sidebar`, `${FLOATING} .right-sidebar.right-sidebar-collapsed`]) {
      const widths = bodyOf(sel).map((b) => /(?:^|[\s;])width:\s*([^;]+);/.exec(b)?.[1]).filter(Boolean);
      assert.deepEqual(widths, ['min(17.5rem, var(--slot-cards-room))'], sel);
    }
  });

  test('no floating rule keeps a fixed 15rem width', () => {
    for (const r of all.filter((x) => x.selector.includes('[data-layout="floating"]'))) {
      assert.doesNotMatch(r.body, /(?:^|[\s;])width:\s*15rem/, r.selector);
    }
  });

  test('the tool-options bar, its groups and the palette card can shrink', () => {
    for (const sel of [`${FLOATING} .tool-options-bar`, `${FLOATING} .tool-options-group`, `${FLOATING} .options-card`]) {
      const body = bodyOf(sel).join(';');
      assert.match(body, /min-width:\s*0/, sel);
      assert.match(body, /max-width:\s*100%/, sel);
    }
    for (const sel of [`${FLOATING} .tool-options-bar`, `${FLOATING} .tool-options-group`]) {
      assert.match(bodyOf(sel).join(';'), /flex-wrap:\s*wrap/, sel);
    }
  });

  test('the range input shrinks from 7rem to 4rem, keeping its 44px hit height', () => {
    const body = bodyOf(`${FLOATING} .tool-options-slider input[type="range"]`).join(';');
    assert.match(body, /flex:\s*1 1 7rem/);
    assert.match(body, /min-width:\s*4rem/);
    assert.match(body, /height:\s*44px/);
  });

  test('the new constraints are all scoped to the floating layout', () => {
    for (const r of all.filter((x) => /--slot-cards-room|flex:\s*1 1 7rem/.test(x.body))) {
      assert.ok(r.selector.includes('[data-layout="floating"]'), r.selector);
    }
  });

  test('the docked .right-sidebar, .palette-row and .options-card rules are unchanged', () => {
    const docked = (sel) => all.filter((r) => r.context === '' && r.selector === sel);
    assert.match(docked('.right-sidebar')[0].body, /width:\s*clamp\(8rem, 22vw, 13rem\)/);
    assert.equal(docked('.options-card').length, 1);
    assert.match(docked('.options-card')[0].body, /^\s*display:\s*contents;\s*$/);
    const palette = docked('.palette-row')[0].body;
    assert.match(palette, /overflow-x:\s*auto/);
    assert.doesNotMatch(palette, /min-width|max-width/);
  });
});

describe('Pixelmator visual pass', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';

  test('the top bar is no card: pass-through, and its groups are glass', () => {
    const top = all.find((r) => r.selector === `${FLOATING} .slot-top` && /pointer-events/.test(r.body));
    assert.match(top.body, /pointer-events:\s*none/);
    assert.match(top.body, /background:\s*transparent/);
    assert.ok(formaSelector('glass-pill').includes('.topbar-group'));
  });

  test('the old accent fills for pressed/open floating buttons are gone', () => {
    const accent = all.filter((r) => r.selector.startsWith(FLOATING) && /\[aria-(pressed|expanded)="true"\]/.test(r.selector)
      && /var\(--color-accent/.test(r.body));
    assert.deepEqual(accent.map((r) => r.selector), []);
  });

  test('the floating workspace has a themed backdrop', () => {
    const canvas = all.find((r) => r.selector === `${FLOATING} .canvas-container`);
    assert.match(canvas.body, /background:\s*var\(--workspace-backdrop\)/);
    assert.match(all.find((r) => r.selector === ':root[data-theme="light"]').body, /--workspace-backdrop:/);
  });
});

describe('side prefs (5g)', () => {
  const FLOATING = '.workspace-screen[data-layout="floating"]';
  const VARS = ['--slot-tools-start', '--slot-tools-end', '--slot-panels-start', '--slot-panels-end',
    '--slot-cards-start', '--slot-cards-end', '--slot-cards-offset', '--slot-cards-far', '--slot-reserve-start', '--slot-reserve-end'];
  const declared = (body) => new Map([...body.matchAll(/(--slot-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const sideRule = (tools, panels) => all.find((r) => r.selector === `${FLOATING}[data-tools-side="${tools}"][data-panels-side="${panels}"]`);

  test('the base block declares every side variable (tools left, panels right)', () => {
    const base = all.find((r) => r.selector === FLOATING && /--slot-tools-start/.test(r.body));
    const vars = declared(base.body);
    for (const v of VARS) assert.ok(vars.has(v), v);
    assert.equal(vars.get('--slot-tools-end'), 'auto');
    assert.equal(vars.get('--slot-panels-start'), 'auto');
    assert.equal(vars.get('--slot-cards-start'), 'auto');
    assert.equal(vars.get('--slot-cards-end'), 'var(--slot-cards-offset)');
  });

  for (const [tools, panels] of [['right', 'left'], ['left', 'left'], ['right', 'right']]) {
    test(`tools ${tools}, panels ${panels} sets every side variable`, () => {
      const rule = sideRule(tools, panels);
      assert.ok(rule, `${tools}/${panels}`);
      const vars = declared(rule.body);
      for (const v of VARS) assert.ok(vars.has(v), v);
      // The tool rail is always on the outer edge of its side.
      const [toolsIn, toolsOut] = tools === 'left' ? ['start', 'end'] : ['end', 'start'];
      assert.match(vars.get(`--slot-tools-${toolsIn}`), new RegExp(`^var\\(--float-edge-${toolsIn}\\)$`));
      assert.equal(vars.get(`--slot-tools-${toolsOut}`), 'auto');
      // The cards sit beside the mini-rail, inward.
      const cardsIn = panels === 'left' ? 'start' : 'end';
      assert.equal(vars.get(`--slot-cards-${cardsIn}`), 'var(--slot-cards-offset)');
    });
  }

  test('on the same side the mini-rail and cards step past the tool rail', () => {
    for (const [side, edge] of [['left', 'start'], ['right', 'end']]) {
      const vars = declared(sideRule(side, side).body);
      assert.match(vars.get(`--slot-panels-${edge}`), /var\(--slot-step\)/);
      assert.match(vars.get('--slot-cards-offset'), /2 \* var\(--slot-step\)/);
    }
  });

  test('the bottom slot is centred between the rails, each side keeping its own reserve clear', () => {
    const options = all.find((r) => r.selector === `${FLOATING} .slot-options` && /max-width/.test(r.body));
    assert.match(options.body, /inset-inline:\s*var\(--slot-reserve-start\) var\(--slot-reserve-end\)/);
    assert.match(options.body, /margin-inline:\s*auto/);
    assert.match(options.body, /max-width:\s*calc\(100% - var\(--slot-reserve-start\) - var\(--slot-reserve-end\)\)/);
  });

  test('on the same side the far reserve is just the edge', () => {
    assert.equal(declared(sideRule('left', 'left').body).get('--slot-reserve-end'), 'var(--float-edge-end)');
    assert.equal(declared(sideRule('right', 'right').body).get('--slot-reserve-start'), 'var(--float-edge-start)');
  });
});

describe('hide while drawing (5g)', () => {
  const STROKING = '.workspace-screen[data-layout="floating"][data-auto-hide="on"][data-stroking]';
  const hiding = all.filter((r) => r.selector.includes(STROKING) && /opacity:\s*0\b/.test(r.body));

  test('every floating region fades and stops taking input mid-stroke', () => {
    assert.ok(hiding.length > 0);
    const selectors = hiding.map((r) => r.selector).join('\n');
    for (const part of ['.slot-top', '.slot-tools', '.panel-rail', '.right-sidebar', '.slot-options', '#selection-bar']) {
      assert.ok(selectors.includes(part), part);
    }
    for (const r of hiding) assert.match(r.body, /pointer-events:\s*none/);
  });

  test('the fade waits a moment, so a tap does not flicker, with or without motion', () => {
    const delays = all.filter((r) => r.selector.includes(STROKING) && /transition:/.test(r.body));
    assert.ok(delays.length >= 2);
    for (const r of delays) assert.match(r.body, /transition:\s*opacity\s+\S+\s+\S+\s+0\.25s/);
    assert.ok(delays.some((r) => r.context.includes('prefers-reduced-motion: no-preference')));
    assert.ok(delays.some((r) => r.context === '' && /opacity\s+0s/.test(r.body)));
  });
});

describe('Prefs sheet (5g)', () => {
  test('rows, the Done button and the selects are at least 44px tall', () => {
    const px = (r, prop) => Number(new RegExp(`(?:^|[\\s;])${prop}:\\s*(\\d+)px`).exec(r.body)?.[1]);
    assert.ok(px(all.find((r) => r.selector === '.prefs-row'), 'min-height') >= 44);
    assert.ok(px(all.find((r) => r.selector === '.prefs-done'), 'height') >= 44);
    assert.ok(px(all.find((r) => r.selector === '.prefs-select select'), 'min-height') >= 44);
  });

  test('the sheet is opaque, over a dimmed backdrop', () => {
    assert.ok(all.some((r) => r.selector === '.prefs-sheet::backdrop'));
    const sheet = all.filter((r) => r.selector === '.prefs-sheet');
    assert.equal(sheet.length, 1);
    assert.match(sheet[0].body, /background:\s*var\(--color-surface\)/);
    assert.doesNotMatch(sheet[0].body, /backdrop-filter/);
  });
});

describe('Color Library popovers', () => {
  // Generate ramp opens from the colour picker too. The popovers sit at
  // the workspace screen's top level, outside every slot, so no slot's
  // stacking context can put them under the picker.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

  // The class attributes of the elements enclosing `id`, outermost first.
  function ancestorClasses(id) {
    const stack = [];
    const tag = /<(\/?)(div|aside|nav|section|main|header|dialog)\b([^>]*)>/g;
    for (const m of html.matchAll(tag)) {
      if (m[1]) { stack.pop(); continue; }
      if (m[3].includes(`id="${id}"`)) return stack;
      stack.push(/class="([^"]*)"/.exec(m[3])?.[1] ?? '');
    }
    return null;
  }

  test('the import, ramp and new-palette popovers and the palette menu are outside every slot', () => {
    for (const id of ['import-preview-row', 'ramp-preview-row', 'new-palette-row', 'palette-menu']) {
      const classes = ancestorClasses(id);
      assert.ok(classes, `${id} found`);
      assert.ok(classes.some((c) => c.includes('workspace-screen')), `${id} is on the workspace screen`);
      assert.ok(!classes.some((c) => /\bslot-/.test(c)), `${id} is outside the slots: ${classes.join(' > ')}`);
    }
  });
});

describe('Glass menus and popovers (2026-10-13 polish)', () => {
  test('FORMA_CLASSES puts glass on menus and popovers', async () => {
    const { FORMA_CLASSES } = await import('../js/layout.js');
    const glassSelectors = FORMA_CLASSES.filter(([, c]) => c.includes('glass')).map(([s]) => s).join(', ');
    for (const s of ['.topbar-menu', '.canvas-settings-panel', '#color-picker-popover']) {
      assert.ok(glassSelectors.includes(s), `${s} gets .glass`);
    }
  });

  test('menu and popover box rules step aside for .glass', () => {
    const src = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    for (const sel of ['.topbar-menu:not(.hidden):not(:where(.glass))', '.canvas-settings-panel:not(:where(.glass))', '.color-picker-popover:not(:where(.glass))']) {
      assert.ok(src.includes(sel), sel);
    }
  });

  test('menu items have an inset rounded hover on the ghost fill', () => {
    const src = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    assert.match(src, /\.topbar-menu\.glass \.topbar-menu-item:not\(:disabled\):hover,\s*\.topbar-menu\.glass \.topbar-menu-item:focus-visible \{\s*background: var\(--ghost-hover\);/);
  });
});

describe('Confirm dialog on glass (2026-10-13 polish)', () => {
  const js = readFileSync(new URL('../js/confirm-dialog.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

  test('the dialog is glass, Cancel a ghost pill', () => {
    assert.match(js, /class="confirm-dialog glass"/);
    assert.match(js, /class="ghost-button ghost-text glass-pill confirm-dialog-cancel"/);
    assert.match(js, /class="confirm-dialog-confirm"/);
  });

  test('the alertdialog is named and described by its title and message', () => {
    assert.match(js, /role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"/);
    assert.match(js, /<h2 id="confirm-dialog-title" class="confirm-dialog-title">/);
    assert.match(js, /<p id="confirm-dialog-message" class="confirm-dialog-message">/);
  });

  test('the docked Filled toggle exposes its state as aria-pressed', () => {
    const fill = readFileSync(new URL('../js/rectangle-fill-ui.js', import.meta.url), 'utf8');
    assert.match(fill, /toggle\.setAttribute\('aria-pressed', String\(filled\)\)/);
  });

  test('the backdrop dims and blurs; the confirm is a red pill', () => {
    assert.match(css, /\.confirm-overlay \{[^}]*backdrop-filter: blur\(6px\)/);
    assert.match(css, /\.confirm-dialog-confirm \{[^}]*border-radius: 999px;[^}]*background: var\(--color-danger\)/);
  });

  // WebKit drops the scrim's blur under a second backdrop-filter, so the
  // dialog paints the tint itself instead of through .glass::before.
  test('the dialog has no blurred ::before; it tints over the scrim blur', () => {
    assert.match(css, /\.confirm-dialog\.glass::before \{\s*display: none;/);
    assert.match(css, /\.confirm-dialog\.glass \{[^}]*background: var\(--glass-tint\)/);
  });
});

describe('Layers rows (2026-10-13 polish)', () => {
  // A fractional column clipped "Normal" to "Non" in a 390px window.
  test('the header blend select sizes to its longest mode', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    assert.match(css, /\.layers-header-properties \{[^}]*grid-template-columns: auto minmax\(0, 1fr\) 2\.6rem;/);
  });

  test('the header blend select is a 44px hit target', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    assert.match(css, /\.layers-header-blend \{[^}]*min-height: 44px;/);
  });

  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../js/layers-ui.js', import.meta.url), 'utf8');

  test('Add layer uses the add_circle glyph, in the font subset', () => {
    assert.match(html, /id="add-layer-button"[^>]*>\s*<span class="material-symbols-outlined" aria-hidden="true">add_circle<\/span>/);
    assert.match(html, /icon_names=[^"]*\badd_circle\b/);
    assert.doesNotMatch(css, /layers-add-icon|layers_add\.svg/);
  });

  test('visibility is a round checkbox, not a switch', () => {
    assert.doesNotMatch(js, /role', 'switch'/);
    assert.match(css, /\.layer-visibility-check \{[^}]*border-radius: 50%/);
  });

  test('the grip draws two bars (drag_handle), not dots', () => {
    assert.doesNotMatch(css, /\.layer-grip \{[^}]*radial-gradient/);
    assert.match(css, /\.layer-grip \{[^}]*linear-gradient/);
  });
});

describe('Colour picker and swatches (2026-10-13 polish)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const rule = (sel) => {
    const at = css.indexOf(`\n${sel} {`);
    assert.notEqual(at, -1, `${sel} not found`);
    return css.slice(at, css.indexOf('}', at));
  };

  test('every swatch is round', () => {
    for (const sel of ['.palette-swatch', '.color-library-swatch', '.standard-library-swatches span', '.color-picker-palette-swatch,\n.color-picker-history-swatch']) {
      assert.match(rule(sel), /border-radius: 50%/, sel);
    }
  });

  test('tabs are a pill segmented control, the compare chip a pill', () => {
    assert.match(rule('.color-picker-tabs'), /border-radius: 999px/);
    assert.match(rule('.color-picker-tab'), /border-radius: 999px/);
    assert.match(rule('.color-picker-compare'), /border-radius: 999px/);
  });

  test('close is a ghost circle; actions are two separate pills, icon beside label', () => {
    assert.match(html, /id="color-picker-close" class="color-picker-close"/);
    assert.match(html, /<div class="color-picker-actions" role="group" aria-label="Color actions">/);
    assert.match(rule('.color-picker-actions'), /gap: 8px/);
    assert.doesNotMatch(rule('.color-picker-actions'), /border-radius|overflow: hidden/);
    assert.match(html, /id="color-picker-add" class="color-picker-action"/);
    const action = rule('.color-picker-action');
    assert.match(action, /border-radius: 999px/);
    assert.match(action, /min-height: 44px/);
    assert.doesNotMatch(action, /flex-direction: column/);
    assert.doesNotMatch(css, /\.color-picker-action \+ \.color-picker-action/);
  });
});

// A palette made, imported or left by Delete used to inherit the previous
// palette's sideways scroll (only a menu pick reset it), so at 390px an
// empty palette's hint started off-screen beside the palette button.
describe('Colour bar scroll and empty hint', () => {
  const ui = readFileSync(new URL('../js/color-library-ui.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

  test('the bar scrolls back to the start whenever a different palette renders', () => {
    const render = ui.slice(ui.indexOf('function renderColorLibraryPanel()'));
    const body = render.slice(0, render.indexOf('\n}\n'));
    assert.match(body, /if \(active\?\.id !== renderedPaletteId\) \{\s*colorLibraryGrid\.scrollLeft = 0;\s*renderedPaletteId = active\?\.id;/);
  });

  test('the empty hint ellipsizes in the bar, with the full text as a tooltip', () => {
    assert.match(ui, /empty\.title = empty\.textContent;/);
    const rule = css.match(/\.color-bar \.color-library-empty \{[^}]*\}/)?.[0] ?? '';
    assert.match(rule, /min-width: 0;/);
    assert.match(rule, /text-overflow: ellipsis;/);
    assert.match(rule, /white-space: nowrap;/);
  });
});
