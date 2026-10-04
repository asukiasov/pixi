# Customize Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Customize Tools sheet that chooses and orders the tool rail's favorites, with a ⋯ overflow menu on the rail for the rest, persisted in Prefs, standalone app only.

**Architecture:** Pure `js/rail-tools.js` (ids, labels, list operations, drop index) feeds a new `railTools` field in `js/prefs.js`. `applyRailTools` in `js/tool-rail.js` reorders/hides the existing rail buttons. `js/tool-overflow.js` wires the ⋯ menu via `initMenuButton` (new side placement); `js/customize-tools-sheet.js` wires a modal `<dialog>` with tap, keyboard and pointer-drag editing. All wired once from `js/app.js`.

**Tech Stack:** vanilla ES modules, CSS custom properties, `node --test`.

Design: `docs/superpowers/specs/2026-10-04-customize-tools-design.md`.

## Global Constraints

- No build step, no new dependencies.
- Floating CSS never sets physical `left:`/`right:` (guarded by `test/floating-layout-css.test.js`); inline `style.left/top` set by JS positioning is fine (topbar menus already do it).
- Standalone only: nothing in `lib/pixi.js` changes.
- Storage key stays `pixi-prefs`; every storage access in try/catch (already in `loadPrefs`/`savePrefs`).
- Default rail = all 10 tools: move, pencil, eraser, bucket, brush, line, rectangle, selection, hand, eyedropper.
- Off-rail buttons use the `off-rail` class only; `.hidden`/`disabled` stay owned by `js/workspace.js` (embed `enabledTools`).
- Touch targets ≥ 44px. New icon names must be added to the Material Symbols `icon_names` list in `index.html` (alphabetical).
- Hint copy verbatim: "Drag your favorite tools into the list above…".

---

### Task 1: `js/rail-tools.js`

**Files:** Create `js/rail-tools.js`, `test/rail-tools.test.js`

**Produces:** `TOOL_IDS: readonly string[]`, `TOOL_LABELS: Record<string,string>`, `DEFAULT_RAIL_TOOLS`, `normalizeRailTools(raw) → string[]`, `overflowTools(rail) → string[]`, `insertTool(rail, id, index) → string[]`, `removeTool(rail, id) → string[]`, `isDefaultRail(rail) → boolean`, `dropIndex(rects, {x, y}) → number`.

- [ ] **Step 1: failing tests**

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_IDS, TOOL_LABELS, DEFAULT_RAIL_TOOLS, normalizeRailTools, overflowTools, insertTool, removeTool, isDefaultRail, dropIndex } from '../js/rail-tools.js';

describe('tool ids', () => {
  test('ten tools in rail order, each labelled', () => {
    assert.deepEqual([...TOOL_IDS], ['move', 'pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'selection', 'hand', 'eyedropper']);
    for (const id of TOOL_IDS) assert.equal(typeof TOOL_LABELS[id], 'string');
    assert.equal(TOOL_LABELS.selection, 'Select');
  });
  test('the default rail is every tool', () => assert.deepEqual([...DEFAULT_RAIL_TOOLS], [...TOOL_IDS]));
});

describe('normalizeRailTools', () => {
  test('non-arrays give a fresh default', () => {
    for (const raw of [undefined, null, 'pencil', {}, 3]) assert.deepEqual(normalizeRailTools(raw), [...TOOL_IDS]);
    assert.notEqual(normalizeRailTools(undefined), DEFAULT_RAIL_TOOLS);
  });
  test('keeps order, drops unknowns and duplicates', () => {
    assert.deepEqual(normalizeRailTools(['hand', 'lasso', 'pencil', 'hand', 7]), ['hand', 'pencil']);
  });
  test('an empty rail stays empty', () => assert.deepEqual(normalizeRailTools([]), []));
});

describe('list operations', () => {
  test('overflowTools is the rest, in default order', () => {
    assert.deepEqual(overflowTools(['hand', 'move']), ['pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'selection', 'eyedropper']);
  });
  test('insertTool adds at an index (clamped)', () => {
    assert.deepEqual(insertTool(['move', 'pencil'], 'hand', 1), ['move', 'hand', 'pencil']);
    assert.deepEqual(insertTool(['move'], 'hand', 99), ['move', 'hand']);
    assert.deepEqual(insertTool(['move'], 'hand', -3), ['hand', 'move']);
  });
  test('insertTool moves an existing tool; index counts the list without it', () => {
    assert.deepEqual(insertTool(['a', 'b', 'c'].map((x) => x), 'a', 1), ['b', 'a', 'c']);
    assert.deepEqual(insertTool(['move', 'pencil', 'eraser'], 'eraser', 0), ['eraser', 'move', 'pencil']);
  });
  test('removeTool and isDefaultRail', () => {
    assert.deepEqual(removeTool(['move', 'pencil'], 'move'), ['pencil']);
    assert.equal(isDefaultRail([...TOOL_IDS]), true);
    assert.equal(isDefaultRail(insertTool([...TOOL_IDS], 'move', 1)), false);
    assert.equal(isDefaultRail([]), false);
  });
});

describe('dropIndex', () => {
  // Two rows of 3 tiles, 60px wide, 80px tall.
  const rects = [0, 1, 2, 3, 4, 5].map((i) => ({ left: (i % 3) * 70, top: Math.floor(i / 3) * 90, width: 60, height: 80 }));
  test('before a tile when left of its centre in its row', () => {
    assert.equal(dropIndex(rects, { x: 10, y: 40 }), 0);
    assert.equal(dropIndex(rects, { x: 40, y: 40 }), 1);
    assert.equal(dropIndex(rects, { x: 200, y: 40 }), 3);
    assert.equal(dropIndex(rects, { x: 75, y: 130 }), 4);
  });
  test('past the last tile, and an empty row', () => {
    assert.equal(dropIndex(rects, { x: 500, y: 130 }), 6);
    assert.equal(dropIndex([], { x: 0, y: 0 }), 0);
  });
});
```

- [ ] **Step 2:** `node --test test/rail-tools.test.js` → FAIL (module not found).
- [ ] **Step 3: implement**

```js
// Which tools sit on the tool rail, and in what order (Customize Tools).
// DOM-free so it's unit-testable (test/rail-tools.test.js); the stored
// list lives in js/prefs.js as `railTools`.

export const TOOL_IDS = Object.freeze(['move', 'pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'selection', 'hand', 'eyedropper']);

export const TOOL_LABELS = Object.freeze({
  move: 'Move', pencil: 'Pencil', eraser: 'Eraser', bucket: 'Bucket', brush: 'Brush',
  line: 'Line', rectangle: 'Rectangle', selection: 'Select', hand: 'Hand', eyedropper: 'Eyedropper',
});

export const DEFAULT_RAIL_TOOLS = TOOL_IDS;

/** Known ids in the given order, without duplicates; a non-array gives the default. */
export function normalizeRailTools(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_RAIL_TOOLS];
  const rail = [];
  for (const id of raw) {
    if (TOOL_IDS.includes(id) && !rail.includes(id)) rail.push(id);
  }
  return rail;
}

/** The tools not on the rail, in default order: the ⋯ menu and the sheet's grid. */
export function overflowTools(rail) {
  return TOOL_IDS.filter((id) => !rail.includes(id));
}

/**
 * `id` at `index` (clamped), taken out of its old place first, so
 * `index` counts the list without it. Add, reorder and drop in one.
 */
export function insertTool(rail, id, index) {
  const rest = rail.filter((t) => t !== id);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

export function removeTool(rail, id) {
  return rail.filter((t) => t !== id);
}

export function isDefaultRail(rail) {
  return rail.length === TOOL_IDS.length && rail.every((id, i) => id === TOOL_IDS[i]);
}

/**
 * Where a tile dropped at `point` goes in a wrapping row, given the
 * other tiles' rects in order: before the first tile in a later row, or
 * in the pointer's row left of the tile's centre.
 */
export function dropIndex(rects, { x, y }) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (y < r.top) return i;
    if (y <= r.top + r.height && x < r.left + r.width / 2) return i;
  }
  return rects.length;
}
```

- [ ] **Step 4:** test passes. **Step 5:** commit "Customize Tools: rail-tools model".

### Task 2: `railTools` in Prefs

**Files:** Modify `js/prefs.js`, `js/prefs-sheet.js`, `test/prefs.test.js`

**Consumes:** `normalizeRailTools`, `DEFAULT_RAIL_TOOLS` (Task 1). **Produces:** `Prefs.railTools: string[]`.

- [ ] **Step 1: tests** — update the defaults test to include `railTools: [...10 ids]`; add:

```js
test('railTools normalizes and falls back to every tool', () => {
  assert.deepEqual(normalizePrefs({ railTools: ['hand', 'nope', 'hand'] }).railTools, ['hand']);
  assert.deepEqual(normalizePrefs({ railTools: 'hand' }).railTools, [...DEFAULT_PREFS.railTools]);
  assert.deepEqual(normalizePrefs({ railTools: [] }).railTools, []);
});
```
and add `railTools: ['pencil', 'move']` to the round-trip prefs object.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** in `js/prefs.js`: import from `./rail-tools.js`, add `railTools: string[]` to the typedef, `railTools: DEFAULT_RAIL_TOOLS` to `DEFAULT_PREFS`, `railTools: normalizeRailTools(source.railTools)` to `normalizePrefs`. In `js/prefs-sheet.js` `read()` return `{ ...getPrefs(), toolsSide: …, panelsSide: …, pinned, autoHide: … }` so the sheet never drops `railTools`.
- [ ] **Step 4:** pass. **Step 5:** commit.

### Task 3: Rail shows only favorites

**Files:** Modify `js/tool-rail.js`, `test/tool-rail.test.js`, `js/app.js`, `style.css`

**Produces:** `applyRailTools(container, rail, anchor = null)`.

- [ ] **Step 1: tests** (fake container):

```js
function fakeContainer(tools) {
  const children = tools.map((t) => ({ ...fakeButton(t), classList: classSet() }));
  return {
    children,
    querySelectorAll: () => [...children],
    insertBefore(node, anchor) {
      children.splice(children.indexOf(node), 1);
      const at = anchor ? children.indexOf(anchor) : children.length;
      children.splice(at, 0, node);
    },
  };
}
// classSet(): { toggle(name, on), contains(name) } over a Set.
test('rail order first, the rest after and marked off-rail', () => {
  const c = fakeContainer(['move', 'pencil', 'eraser', 'hand']);
  applyRailTools(c, ['hand', 'move']);
  assert.deepEqual(c.children.map((b) => b.dataset.tool), ['hand', 'move', 'pencil', 'eraser']);
  assert.deepEqual(c.children.map((b) => b.classList.contains('off-rail')), [false, false, true, true]);
});
test('tools go before the anchor', () => { /* container with an extra non-tool anchor node last; it stays last */ });
```
- [ ] **Step 3: implement**

```js
/**
 * Puts the tool buttons in `rail` order before `anchor` (the ⋯ button),
 * the rest after them with the `off-rail` class, which hides them.
 * Moving the nodes keeps their listeners. `.hidden`/`disabled` (the
 * embed's enabledTools) are left alone, and so is the bare-letter
 * shortcut, which clicks the button whether it shows or not.
 */
export function applyRailTools(container, rail, anchor = null) {
  const buttons = [...container.querySelectorAll('.tool-button[data-tool]')];
  const onRail = (b) => rail.includes(b.dataset.tool);
  const ordered = [
    ...rail.map((id) => buttons.find((b) => b.dataset.tool === id)).filter(Boolean),
    ...buttons.filter((b) => !onRail(b)),
  ];
  for (const button of ordered) {
    container.insertBefore(button, anchor);
    button.classList.toggle('off-rail', !onRail(button));
  }
}
```
CSS: `.tool-rail-tools .tool-button.off-rail { display: none; }`. `js/app.js`: call `applyRailTools(railTools, prefs.railTools, overflowButton)` at boot and in `setPrefs`.
- [ ] Steps 2/4/5: fail, pass, commit.

### Task 4: ⋯ overflow menu

**Files:** Modify `js/topbar-menu.js`, `test/topbar-menu.test.js`, `index.html`, `style.css`, `js/app.js`; Create `js/tool-overflow.js`

**Produces:** `sideMenuPosition(rect, size, viewport, margin = 8) → { left, top }`; `initMenuButton(…, { placement: 'below' | 'side' })`; `initToolOverflow({ root }) → { refresh() }`; markup ids `#tool-overflow-button`, `#tool-overflow-menu`, `#tool-overflow-customize`.

- [ ] **Step 1: tests**

```js
describe('sideMenuPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 200, height: 300 };
  test('opens past the end edge when there is room, top-aligned', () => {
    assert.deepEqual(sideMenuPosition({ left: 10, right: 54, top: 100, bottom: 144 }, size, viewport), { left: 62, top: 100 });
  });
  test('opens toward the start from a rail on the end side', () => {
    assert.deepEqual(sideMenuPosition({ left: 946, right: 990, top: 100, bottom: 144 }, size, viewport), { left: 738, top: 100 });
  });
  test('clamps to the viewport bottom', () => {
    assert.equal(sideMenuPosition({ left: 10, right: 54, top: 700, bottom: 744 }, size, viewport).top, 492);
  });
});
```
- [ ] **Step 3: implement** in `js/topbar-menu.js`:

```js
/** Beside the button, on the side with more room, top-aligned and kept on screen. */
export function sideMenuPosition(rect, size, viewport, margin = MARGIN) {
  const after = viewport.width - rect.right;
  let left = after >= size.width + 2 * margin || after >= rect.left ? rect.right + margin : rect.left - size.width - margin;
  left = Math.max(margin, Math.min(left, viewport.width - size.width - margin));
  const top = Math.max(margin, Math.min(rect.top, viewport.height - size.height - margin));
  return { left, top };
}
```
`positionMenu(menu, button, placement)`: for `'side'` use `sideMenuPosition(button.getBoundingClientRect(), menu.getBoundingClientRect(), { width: innerWidth, height: innerHeight })`. `initMenuButton` takes `placement = 'below'`.

Markup, inside `.tool-rail-tools` after the eyedropper button:

```html
<button type="button" id="tool-overflow-button" class="tool-button magnetic-hover" aria-label="More tools" data-tooltip="More tools">
  <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
</button>
```
and the menu as a sibling of `#more-menu`'s pattern, placed after `#tools-sidebar`:
`<div id="tool-overflow-menu" class="topbar-menu tool-overflow-menu floating-only hidden" role="menu" aria-label="More tools"></div>` (the `.topbar-menu` floating rule gives it the popover look; it is inside `.workspace-screen`).

`js/tool-overflow.js`:

```js
// The tool rail's ⋯ button (Customize Tools): a menu with the tools that
// aren't on the rail, then Customize Tools…. Items forward a click to the
// hidden rail button, so selection keeps one code path. While the current
// tool is off the rail, ⋯ shows as active and names it.
import { initMenuButton } from './topbar-menu.js';
import { overflowTools, TOOL_LABELS } from './rail-tools.js';

export function initToolOverflow({ getRailTools, root = document }) {
  const button = root.querySelector('#tool-overflow-button');
  const menu = root.querySelector('#tool-overflow-menu');
  const screen = root.querySelector('#screen-workspace');
  if (!button || !menu || !screen) return null;
  const railButton = (id) => root.querySelector(`#tools-sidebar .tool-button[data-tool="${id}"]`);

  function build() {
    const current = screen.dataset.currentTool;
    const items = overflowTools(getRailTools()).filter((id) => !railButton(id)?.disabled).map((id) => {
      const source = railButton(id);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'topbar-menu-item';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(id === current));
      item.dataset.tool = id;
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = source?.querySelector('.material-symbols-outlined')?.textContent.trim() ?? '';
      const label = document.createElement('span');
      label.className = 'topbar-menu-label';
      label.textContent = TOOL_LABELS[id];
      item.append(icon, label);
      if (source?.dataset.shortcut) {
        item.setAttribute('aria-keyshortcuts', source.dataset.shortcut);
        const kbd = document.createElement('kbd');
        kbd.className = 'topbar-menu-shortcut';
        kbd.setAttribute('aria-hidden', 'true');
        kbd.textContent = source.dataset.shortcut;
        item.append(kbd);
      }
      item.addEventListener('click', () => railButton(id)?.click());
      return item;
    });
    const customize = document.createElement('button');
    customize.type = 'button';
    customize.id = 'tool-overflow-customize';
    customize.className = 'topbar-menu-item';
    customize.setAttribute('role', 'menuitem');
    customize.setAttribute('aria-haspopup', 'dialog');
    customize.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">handyman</span>Customize Tools…';
    const parts = items.length ? [...items, separator()] : [];
    menu.replaceChildren(...parts, customize);
  }

  function separator() {
    const el = document.createElement('div');
    el.className = 'topbar-menu-separator';
    el.setAttribute('role', 'separator');
    return el;
  }

  function refresh() {
    const current = screen.dataset.currentTool;
    const offRail = current && !getRailTools().includes(current);
    button.classList.toggle('active', Boolean(offRail));
    const name = offRail ? `More tools, ${TOOL_LABELS[current]} selected` : 'More tools';
    button.setAttribute('aria-label', name);
  }

  initMenuButton(button, menu, { onOpen: build, placement: 'side' });
  build();
  new MutationObserver(refresh).observe(screen, { attributes: true, attributeFilter: ['data-current-tool'] });
  refresh();
  return { refresh };
}
```
`initToolOverflow` must take `onCustomize` instead of the sheet finding the item: the item is rebuilt on every open, so the sheet binds `menu.addEventListener('click', e => e.target.closest('#tool-overflow-customize') && …)` — implemented as: `initToolOverflow({ getRailTools, onCustomize })`, and the customize item's listener calls `setTimeout(onCustomize)` (after the menu's own close returns focus to ⋯). `refresh()` is also called from `setPrefs` in `js/app.js`. Add `#tool-overflow-button` to `initMagneticHover`'s list. Add `handyman` and `chevron_right` to the font `icon_names`.
- [ ] Steps 2/4/5: fail, pass, commit.

### Task 5: Customize Tools sheet

**Files:** Create `js/customize-tools-sheet.js`; Modify `index.html`, `style.css`, `js/prefs-sheet.js` (no logic: markup only), `js/app.js`

**Consumes:** Task 1 helpers, `getPrefs`/`setPrefs`. **Produces:** `initCustomizeToolsSheet({ getPrefs, setPrefs, root }) → { open(returnFocusTo) }`.

- [ ] **Step 1: markup** (after `#prefs-sheet`):

```html
<dialog id="customize-tools-sheet" class="customize-tools-sheet" aria-labelledby="customize-tools-title">
  <div class="customize-tools-inner">
    <header class="prefs-header customize-tools-header">
      <button type="button" id="customize-tools-reset" class="customize-tools-reset">Reset</button>
      <h2 id="customize-tools-title" class="prefs-title">Customize Tools</h2>
      <button type="button" id="customize-tools-done" class="prefs-done" aria-label="Done">
        <span class="material-symbols-outlined" aria-hidden="true">check</span>
      </button>
    </header>
    <div class="customize-tools-body">
      <section class="customize-tools-zone" data-zone="rail" aria-labelledby="customize-tools-rail-label">
        <h3 id="customize-tools-rail-label" class="visually-hidden">On the tool rail</h3>
        <ul id="customize-tools-rail" class="customize-tools-row" role="list"></ul>
        <p id="customize-tools-empty" class="customize-tools-empty" hidden>No tools on the rail. Every tool is in the ⋯ menu.</p>
      </section>
      <p class="customize-tools-hint">Drag your favorite tools into the list above…</p>
      <section class="customize-tools-zone" data-zone="grid" aria-labelledby="customize-tools-grid-label">
        <h3 id="customize-tools-grid-label" class="visually-hidden">Other tools</h3>
        <ul id="customize-tools-grid" class="customize-tools-grid" role="list"></ul>
      </section>
      <p id="customize-tools-rail-help" class="visually-hidden">Press to remove from the tool rail. Alt plus Left or Right Arrow moves it.</p>
      <p id="customize-tools-grid-help" class="visually-hidden">Press to add to the end of the tool rail.</p>
      <p id="customize-tools-status" class="visually-hidden" aria-live="polite"></p>
    </div>
  </div>
</dialog>
```
Prefs gets a section before Layout:

```html
<section class="prefs-section" aria-labelledby="prefs-tools-heading">
  <h3 id="prefs-tools-heading" class="prefs-section-heading">Tools</h3>
  <div class="prefs-group">
    <button type="button" id="prefs-customize-tools" class="prefs-row prefs-row-button" aria-haspopup="dialog">
      <span class="prefs-row-label">Customize Tools…</span>
      <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
    </button>
  </div>
</section>
```

- [ ] **Step 2: `js/customize-tools-sheet.js`**

```js
// The Customize Tools sheet: choose and order the tool rail's favorites,
// modelled on Pixelmator Pro for iPad. Opened from the rail's ⋯ menu and
// from Prefs; wired once from js/app.js (standalone only). Like the Prefs
// sheet it keeps no state: it renders from getPrefs().railTools and hands
// every change to setPrefs, which saves and applies it at once.
//
// Editing: drag (pointer events - mouse, touch, Pencil) to add, reorder
// or remove; press a tile to move it between the lists; Alt+Left/Right
// moves a favorite one place. A polite live region says what changed.
import { TOOL_IDS, TOOL_LABELS, overflowTools, insertTool, removeTool, isDefaultRail, normalizeRailTools, dropIndex } from './rail-tools.js';

const DRAG_THRESHOLD = 6;

export function initCustomizeToolsSheet({ getPrefs, setPrefs, root = document }) { … }
```
Body (implemented in full in the file):
- `render(focusId)` rebuilds both `<ul>`s from `railTools` / `overflowTools`, each tile `<li><button class="customize-tools-tile" data-tile-tool=id aria-describedby=…-help>` with an icon (copied from the rail button) in `.customize-tools-tile-icon` and the label; toggles `#customize-tools-empty`, disables Reset when `isDefaultRail`; focuses `[data-tile-tool=focusId]` when given.
- `commit(next, message, focusId)`: `setPrefs({ ...getPrefs(), railTools: next })`, `render(focusId)`, `announce(message)`.
- click on a tile (unless `suppressClick`): favorite → `removeTool`, "X removed"; grid → `insertTool(rail, id, rail.length)`, "X added, position n of n".
- keydown on a favorite with `altKey` and ArrowLeft/ArrowRight: `insertTool(rail, id, i ± 1)`, "X, position p of n"; `preventDefault`.
- `sheet` keydown: `stopPropagation()` so the workspace's document shortcuts (tool letters, Escape clears selection, Tab hides UI) don't run under the modal; native Escape still closes.
- Drag: `pointerdown` (primary button/pen/touch) on a tile records `{ id, from, x, y, pointerId }`, `setPointerCapture`; `pointermove` past `DRAG_THRESHOLD` starts: clones the tile into a fixed `.customize-tools-ghost` (pointer-events none), adds `.is-dragging` to the tile; then each move translates the ghost and, if the pointer is inside the rail zone's rect, shows `.customize-tools-marker` at `dropIndex(rectsWithoutDragged, point)` (absolute in the rail zone at the start edge of that tile, or end edge of the last); outside, hides the marker and marks the grid zone `.is-drop-target` when the source is a favorite. `pointerup`: in the rail zone → `insertTool(rail, id, index)`; else from a favorite → `removeTool`; sets `suppressClick = true` (reset on the next pointerdown). `pointercancel`/`lostpointercapture` → cleanup with no change.
- `open(returnFocusTo)`: `render()`, `showModal()`; `close` → `returnFocusTo?.focus()`. ✓ closes; Reset → `commit([...TOOL_IDS], 'Tools reset to default')`.

- [ ] **Step 3: CSS** — full-screen opaque sheet (`width: 100vw; height: 100dvh; max-width/max-height: none; margin: 0; border-radius: 0`), body centred column max 56rem, `.customize-tools-row`/`-grid` as flex-wrap centred lists with `gap`, tiles 80px wide min 44px icon circle 52px (`--prefs-fill` background), label 0.8rem centred, `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none`; rail zone min-height to stay a drop target when empty; `.is-dragging { opacity: 0.35 }`; ghost fixed, z above, scale 1.08, shadow; marker 3px accent bar 56px tall; reset is a text button 44px tall start-aligned (`grid-column: 1; justify-self: start`), disabled at 0.4 opacity; focus-visible accent outline; reduced-motion respected for any transition; `.prefs-row-button` resets button chrome (`width: 100%; border: 0; background: none; color: inherit; font: inherit; text-align: start`).

- [ ] **Step 4: wire in `js/app.js`** — `const customize = initCustomizeToolsSheet({ getPrefs, setPrefs })` with `setPrefs` shared with the Prefs sheet (extract a `setPrefs(next)` function that saves, applies to the screen, applies rail tools and refreshes the overflow); `initToolOverflow({ getRailTools: () => prefs.railTools, onCustomize: () => customize.open(overflowButton) })`; `#prefs-customize-tools` click → `customize.open(thatRow)`.

- [ ] **Step 5:** `npm test`, browser smoke, commit.

### Task 6: Docs

**Files:** `docs/specs/floating-workspace/spec.md` (new requirements: Customizable tool rail, Tool overflow menu, Customize Tools sheet, Customize Tools is accessible; Prefs sheet requirement gains the Tools row), `docs/ui-reference.md` (rail + sheet + Prefs Tools group), `docs/roadmap.md` (Phase 5 item, done).

### Task 7: Verification

- `npm test` all green.
- Playwright (persistent context) screenshots in Chromium + WebKit at 1180×820 and 768×1024, tools left and right: rail customized + ⋯ open, ⋯ active for an off-rail tool, the sheet, mid-drag, after Reset.
- Functional checks: drag reorder/add/remove with mouse and touch-emulated pointer, Alt+Arrow, tap add/remove, shortcut for an off-rail tool selects it and marks ⋯, reload keeps order.
- `web-design-guidelines` on the changed UI, fix findings; then code review; fix; merge.
