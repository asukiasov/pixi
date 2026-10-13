# Glass and Panel Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the menus, popovers and confirm dialog on Forma glass, give the Layers panel an inline blend and opacity header with checkbox visibility, make every colour swatch round, modernise the colour picker, and give Ellipse its own fill icon.

**Architecture:** Glass reuses Forma's `.glass` (`forma-ui/components.css`). The floating layout adds it through `FORMA_CLASSES` in `js/layout.js` for static markup, or the JS that builds an element adds it directly. Each surface's own opaque box rules get a `:not(:where(.glass))` guard, so the docked embed layout keeps its box. Logic changes are two small pure functions, `headerPropertiesState` and `fillIconFor`, both unit-tested. Everything else is CSS and markup, checked by static tests that read the files (the repo's pattern: `test/floating-layout-css.test.js`, `test/forma-ui.test.js`).

**Tech Stack:** Vanilla HTML/CSS/JS ES modules, `node --test` (no DOM, no jsdom), Playwright for visual checks.

Spec: `docs/superpowers/specs/2026-10-13-glass-and-panel-polish-design.md`

## Global Constraints

- No build step, no new dependencies.
- Material Symbols is a subset font: any new glyph name must be added to the `icon_names=` list in `index.html`'s `<link>` (alphabetical).
- Native `<dialog>` sheets (Prefs, Customize Tools, Standard Libraries) stay opaque, because WebKit leaks glass through top-layer dialogs.
- Hit targets stay at least 44px.
- Colour tokens: `--color-accent`, `--color-danger`, `--color-surface`, `--color-border`, `--glass-border`, `--ghost-hover`, `--float-radius` (all in `forma-ui/tokens.css`).
- Run the whole suite with `npm test`; it must end with `# fail 0`.
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

### Task 1: Glass menus and popovers

**Files:**
- Modify: `js/layout.js:14-21` (`FORMA_CLASSES`)
- Modify: `style.css` (`.workspace-screen[data-layout="floating"] .topbar-menu:not(.hidden)` ~line 3324, `.topbar-menu-item` ~3343, `.topbar-menu-separator` ~3404, `.canvas-settings-panel` ~1168, `.color-picker-popover` ~2116)
- Test: `test/floating-layout-css.test.js` (append)

**Interfaces:**
- Produces: in the floating layout every `.topbar-menu`, `.canvas-settings-panel` (Canvas Settings, Transform, group Opacity popover) and `#color-picker-popover` carries `glass`. Later tasks rely on this for the colour picker.

- [ ] **Step 1: Write the failing tests**

Append to `test/floating-layout-css.test.js`:

```js
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
```

Check that `readFileSync`, `describe`, `test` and `assert` are already imported at the top of the file; they are (lines 1-9).

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test test/floating-layout-css.test.js`
Expected: the three new tests FAIL (`.topbar-menu gets .glass` and so on).

- [ ] **Step 3: Add the selectors to `FORMA_CLASSES`**

In `js/layout.js`, change the first entry to:

```js
  ['.slot-tools, .panel-rail, .options-card, .tool-options-bar, #selection-bar, #back-to-gallery-button, #zoom-pill, .topbar-group, #more-button, .right-sidebar > .layers-panel, .topbar-menu, .canvas-settings-panel, #color-picker-popover', ['glass']],
```

`test/layout.test.js` checks that each class and id in the table exists in `index.html`. `.topbar-menu` and `.canvas-settings-panel` are static in `index.html`, so it passes. `#tool-overflow-menu`, `#layer-menu` and `#palette-menu` all carry `topbar-menu` statically.

- [ ] **Step 4: Guard the opaque box rules**

In `style.css`, split the floating menu rule (~line 3324) into layout and box:

```css
/* Positioned by js/topbar-menu.js. Forma .glass in the floating layout
   (js/layout.js); the box below is for a menu that isn't glass. */
.workspace-screen[data-layout="floating"] .topbar-menu:not(.hidden) {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  min-width: 13rem;
  padding: 0.35rem;
  border-radius: 14px;
}

.workspace-screen[data-layout="floating"] .topbar-menu:not(.hidden):not(:where(.glass)) {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

/* On glass: rows are inset pills on the ghost fill, like Pixelmator's. */
.topbar-menu.glass .topbar-menu-item {
  border-radius: 9px;
}

.topbar-menu.glass .topbar-menu-item:not(:disabled):hover,
.topbar-menu.glass .topbar-menu-item:focus-visible {
  background: var(--ghost-hover);
}

.topbar-menu.glass .topbar-menu-separator {
  margin: 0.3rem 0.6rem;
  background: var(--glass-border);
}
```

`border-radius: 14px` must sit after `.glass` in the cascade. `.glass` sets `border-radius: var(--float-radius)`, and the selector above is more specific, so it wins.

In `.canvas-settings-panel` (~line 1168), move `background`, `border`, `border-radius` and `box-shadow` out into a new rule:

```css
.canvas-settings-panel:not(:where(.glass)) {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
```

Do the same for `.color-picker-popover` (~line 2116):

```css
.color-picker-popover:not(:where(.glass)) {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
```

and add `border-radius: 18px;` to a `.color-picker-popover.glass { border-radius: 18px; }` rule after it. All three surfaces are `position: fixed`, which `.glass` needs.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: `# fail 0`. If `test/layout.test.js`'s "never maps a class the markup already carries statically" fails, a surface already has `glass` in its `class=` attribute. Remove it from the markup; the table owns it.

- [ ] **Step 6: Commit**

```bash
git add js/layout.js style.css test/floating-layout-css.test.js
git commit -m "Menus and popovers on Forma glass in the floating layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Glass confirm dialog with pill buttons

**Files:**
- Modify: `js/confirm-dialog.js:17-27` (built markup)
- Modify: `style.css` (`.confirm-overlay` ~2903, `.confirm-dialog` ~2913, `.confirm-dialog-confirm` ~2942)
- Test: `test/floating-layout-css.test.js` (append)

- [ ] **Step 1: Write the failing test**

```js
describe('Confirm dialog on glass (2026-10-13 polish)', () => {
  const js = readFileSync(new URL('../js/confirm-dialog.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

  test('the dialog is glass, Cancel a ghost pill', () => {
    assert.match(js, /class="confirm-dialog glass"/);
    assert.match(js, /class="ghost-button ghost-text glass-pill confirm-dialog-cancel"/);
    assert.match(js, /class="confirm-dialog-confirm"/);
  });

  test('the backdrop dims and blurs; the confirm is a red pill', () => {
    assert.match(css, /\.confirm-overlay \{[^}]*backdrop-filter: blur\(6px\)/);
    assert.match(css, /\.confirm-dialog-confirm \{[^}]*border-radius: 999px;[^}]*background: var\(--color-danger\)/);
  });
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `node --test test/floating-layout-css.test.js`
Expected: FAIL on both new tests.

- [ ] **Step 3: Change the markup**

In `js/confirm-dialog.js` `ensureBuilt()`:

```js
  overlayEl.innerHTML = `
    <div class="confirm-dialog glass" role="alertdialog" aria-modal="true">
      <h2 class="confirm-dialog-title"></h2>
      <p class="confirm-dialog-message"></p>
      <div class="confirm-dialog-actions">
        <button type="button" class="ghost-button ghost-text glass-pill confirm-dialog-cancel">Cancel</button>
        <button type="button" class="confirm-dialog-confirm">Delete</button>
      </div>
    </div>
  `;
```

Update the file's header comment: "dark-themed to match the rest of the app" becomes "a Forma glass card over a dimmed, lightly blurred page".

- [ ] **Step 4: Change the CSS**

Replace the `.confirm-overlay`, `.confirm-dialog` and `.confirm-dialog-confirm` rules with:

```css
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

/* Forma .glass (set in js/confirm-dialog.js); positioned for its ::before. */
.confirm-dialog {
  position: relative;
  width: 20rem;
  max-width: calc(100vw - 2rem);
  padding: 1.25rem;
  border-radius: 18px;
}

.confirm-dialog-actions button {
  min-height: 44px;
  font: inherit;
  font-weight: 600;
}

.confirm-dialog-cancel {
  border: 1px solid var(--glass-border);
}

.confirm-dialog-confirm {
  padding: 0 1.25rem;
  border: none;
  border-radius: 999px;
  background: var(--color-danger);
  color: #fff;
  cursor: pointer;
}

.confirm-dialog-confirm:hover {
  filter: brightness(1.08);
}

.confirm-dialog-confirm:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-transparency: reduce) {
  .confirm-overlay {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: rgba(0, 0, 0, 0.5);
  }
}
```

The `.confirm-dialog { border-radius: 18px }` rule must come after `forma-ui/components.css`'s `.glass`. `style.css` loads after it, and both have the same specificity, so it wins.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add js/confirm-dialog.js style.css test/floating-layout-css.test.js
git commit -m "Confirm dialog: glass card, ghost Cancel, red pill confirm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Layers header — blend and opacity inline

**Files:**
- Modify: `index.html:1167-1186` (Layers panel: add a properties row after `#layers-panel-header`, remove `#layers-properties-button`) and `index.html:1207-1220` (popover: drop the blend row)
- Modify: `js/layers-ui.js` (new export `headerPropertiesState`; header sync in `renderLayersPanel`; wiring in init ~line 980-1020; remove the "Opacity & Blend…" layer menu item at line 552; popover becomes group-only)
- Modify: `style.css` (new `.layers-header-properties` rules; delete `.layers-panel-blend-select` ~1619-1641 only if nothing else uses it — grep first)
- Test: `test/layers-marking.test.js` (append; it already stubs `document` and imports `js/layers-ui.js`)

**Interfaces:**
- Produces: `export function headerPropertiesState(layer)` → `{ blendMode: string, opacityPercent: number, disabled: boolean }`

- [ ] **Step 1: Write the failing test**

Append to `test/layers-marking.test.js`, and add `headerPropertiesState` to the existing `await import('../js/layers-ui.js')` destructure:

```js
describe('headerPropertiesState', () => {
  test('follows the layer: blend mode and rounded opacity percent', () => {
    assert.deepEqual(
      headerPropertiesState({ blendMode: 'multiply', opacity: 0.456 }),
      { blendMode: 'multiply', opacityPercent: 46, disabled: false },
    );
  });

  test('a reference image layer disables the controls', () => {
    assert.equal(headerPropertiesState({ blendMode: 'normal', opacity: 1, isReferenceImage: true }).disabled, true);
  });

  test('no layer: disabled, at the defaults', () => {
    assert.deepEqual(headerPropertiesState(undefined), { blendMode: 'normal', opacityPercent: 100, disabled: true });
  });
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `node --test test/layers-marking.test.js`
Expected: FAIL — `headerPropertiesState is not a function`.

- [ ] **Step 3: Implement the pure function**

In `js/layers-ui.js`, next to `layerDetail` (~line 223):

```js
/** What the header's blend and opacity controls show for the active layer. */
export function headerPropertiesState(layer) {
  if (!layer) return { blendMode: 'normal', opacityPercent: 100, disabled: true };
  return { blendMode: layer.blendMode, opacityPercent: Math.round(layer.opacity * 100), disabled: !!layer.isReferenceImage };
}
```

Run: `node --test test/layers-marking.test.js` — Expected: PASS.

- [ ] **Step 4: Markup**

In `index.html`, delete the `#layers-properties-button` button (lines ~1175-1177). Directly after the closing `</div>` of `#layers-panel-header` (and before `#layers-select-bar`), add the row. It sits outside the header because the header is `role="button"`, and controls can't nest inside it:

```html
        <!-- The active layer's blend mode and opacity, always visible,
             after Pixelmator Pro (js/layers-ui.js). -->
        <div id="layers-header-properties" class="layers-header-properties">
          <select id="layers-header-blend" class="layers-header-blend" aria-label="Blend mode"></select>
          <input type="range" id="layers-header-opacity" class="layers-header-opacity" min="0" max="100" value="100" aria-label="Opacity" />
          <output id="layers-header-opacity-readout" class="layers-header-opacity-readout" for="layers-header-opacity">100%</output>
        </div>
```

In the popover (`#layers-panel-opacity-popover`), delete the `<label class="layer-properties-row" id="layer-properties-blend-row">…</label>` block. Change its comment to: "Opacity for one group, opened from the group's ⋯ menu. A layer's blend and opacity live in the panel's header row."

- [ ] **Step 5: Wire it in `js/layers-ui.js`**

1. Module state: replace `layersPanelBlendSelect` with `headerBlend`, `headerOpacity` and `headerOpacityReadout`.
2. Add after `headerPropertiesState`:

```js
function syncHeaderProperties() {
  const layerStack = getLayerStack();
  const state = headerPropertiesState(layerStack.getActiveLayer());
  headerBlend.value = state.blendMode;
  headerBlend.disabled = state.disabled;
  headerOpacity.value = String(state.opacityPercent);
  headerOpacity.disabled = state.disabled;
  headerOpacityReadout.textContent = `${state.opacityPercent}%`;
}
```

3. In `renderLayersPanel`, replace the last line (`if (propertiesTarget && …) syncPropertiesPopover();`) with:

```js
  syncHeaderProperties();
  if (propertiesTarget && !layersPanelOpacityPopover.classList.contains('hidden')) syncPropertiesPopover();
```

4. In `syncPropertiesPopover`, delete the `blendRow` lookup and the whole `else` (layer) branch. `propertiesTarget` is now always a group:

```js
/** Fills the group Opacity popover from its target group. */
function syncPropertiesPopover() {
  const group = getLayerStack().getGroup(propertiesTarget.id);
  if (!group) return closeLayersOpacityPopover();
  layersPanelOpacityPopover.querySelector('#layer-properties-title').textContent = group.name;
  setOpacityFields(Math.round(group.opacity * 100));
}
```

5. In `applyOpacity`, drop the layer branch: `layerStack.setGroupOpacity(propertiesTarget.id, clamped / 100);`.
6. In `layerMenuItems`, delete the line `{ label: 'Opacity & Blend…', … }` (line ~552).
7. In init, delete the `#layers-properties-button` click listener (~lines 982-990). Remove `'#layers-properties-button, '` from the outside-press check, leaving `e.target.closest?.('#layer-menu')`. Fill and wire the header controls:

```js
  headerBlend = root.querySelector('#layers-header-blend');
  headerOpacity = root.querySelector('#layers-header-opacity');
  headerOpacityReadout = root.querySelector('#layers-header-opacity-readout');
  for (const mode of BLEND_MODES) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = blendLabel(mode);
    headerBlend.appendChild(option);
  }
  headerBlend.addEventListener('change', () => {
    const layerStack = getLayerStack();
    layerStack.setBlendMode(layerStack.getActiveIndex(), headerBlend.value);
    renderCanvas();
    commit();
  });
  // Live while dragging; one undo step for the final value.
  const setActiveOpacity = (commitChange) => {
    const layerStack = getLayerStack();
    const percent = Number(headerOpacity.value);
    layerStack.setOpacity(layerStack.getActiveIndex(), percent / 100);
    headerOpacityReadout.textContent = `${percent}%`;
    renderCanvas();
    if (commitChange) commit();
  };
  headerOpacity.addEventListener('input', () => setActiveOpacity(false));
  headerOpacity.addEventListener('change', () => setActiveOpacity(true));
```

`LayerStack.getActiveIndex()`, `getActiveLayer()`, `setOpacity(index, opacity)` and `setBlendMode(index, mode)` exist in `lib/pixel-engine/layers.js`.

`lib/pixi.js` (the embed) builds its own smaller markup without the Layers panel. Put the new `querySelector` calls after `initLayersPanel`'s existing early return for a missing panel, if it has one. If it doesn't, guard with `if (!headerBlend) return;` before wiring, so the embed doesn't throw.

- [ ] **Step 6: CSS**

Add to `style.css` after the Pixelmator-style Layers block (~line 4860):

```css
/* The active layer's blend and opacity, under the title. */
.layers-header-properties {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) 2.6rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem 0.5rem;
  border-bottom: 1px solid var(--glass-border);
}

.layers-header-blend {
  min-height: 36px;
  padding: 0 0.5rem;
  border: none;
  border-radius: 9px;
  background: var(--ghost-hover);
  color: inherit;
  font: inherit;
  font-size: 0.85rem;
}

.layers-header-opacity {
  width: 100%;
  min-height: 44px;
  margin: 0;
  accent-color: var(--color-accent);
}

.layers-header-opacity-readout {
  text-align: end;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}

.layers-header-properties :disabled {
  opacity: 0.5;
}
```

Grep `style.css`, `js/` and `index.html` for `layers-panel-blend-select`, `layers-panel-opacity-toggle`, `layers-panel-opacity-icon` and `layers-panel-opacity-readout`. Delete the rules (~lines 1612-1700) for any class no markup or JS still uses. Keep `.layers-panel-opacity-slider` and `.layers-panel-opacity-number`; the group popover still uses them.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: `# fail 0`. `test/floating-layout-css.test.js` and `test/layout.test.js` scan `index.html` ids; fix any that referenced `layers-properties-button`.

- [ ] **Step 8: Manual check**

Serve (`python3 -m http.server 8000` from the repo root) and open `http://localhost:8000`. Open a project. Check each of these:

- Changing blend and opacity in the header updates the canvas.
- One undo reverts one opacity drag.
- Switching layers updates the header.
- A reference image layer greys the controls.
- Group ⋯ → Opacity… still opens its popover.

- [ ] **Step 9: Commit**

```bash
git add index.html js/layers-ui.js style.css test/layers-marking.test.js
git commit -m "Layers: blend and opacity for the active layer in the header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Layers rows — checkbox visibility, bar grip, add_circle

**Files:**
- Modify: `js/layers-ui.js:231-245` (`buildVisibilitySwitch`), the grip comment at ~line 400
- Modify: `style.css` (`.layer-switch*` ~5001-5058, `.layer-grip` ~4909, `.layers-add-icon` ~1508-1535)
- Modify: `index.html:37` (font `icon_names`), `index.html:1178-1182` (add-layer button)
- Delete: `assets/icons/layers_add.svg`
- Test: `test/floating-layout-css.test.js` (append)

- [ ] **Step 1: Write the failing tests**

```js
describe('Layers rows (2026-10-13 polish)', () => {
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
```

- [ ] **Step 2: Run them and check they fail**

Run: `node --test test/floating-layout-css.test.js`
Expected: the three new tests FAIL.

- [ ] **Step 3: Add layer icon**

In `index.html`, replace the add-layer button's `<span class="layers-add-icon"></span>` and the comment above it with:

```html
            <button type="button" id="add-layer-button" class="tool-button icon-button" aria-label="Add layer" data-tooltip="Add layer">
              <span class="material-symbols-outlined" aria-hidden="true">add_circle</span>
            </button>
```

In the font `<link>` on line 37, insert `add_circle,` right after `add,` in `icon_names=`. Delete the `.layers-add-icon` rule and its comment block in `style.css` (~1508-1535). Run `git rm assets/icons/layers_add.svg`.

- [ ] **Step 4: Checkbox visibility**

Replace `buildVisibilitySwitch` in `js/layers-ui.js`:

```js
/** Visibility: a round checkbox in the accent colour, checked = shown. */
function buildVisibilitySwitch(name, visible, onChange) {
  const label = document.createElement('label');
  label.className = 'layer-visibility';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'layer-visibility-check';
  input.checked = visible;
  input.setAttribute('aria-label', `Show ${name}`);
  input.addEventListener('change', () => onChange(input.checked));
  label.append(input);
  return label;
}
```

In `style.css`, replace every `.layer-switch*` rule (~5000-5058, including the reduced-motion block) with:

```css
/* Visibility: a round accent checkbox (Pixelmator Pro), 44px hit area. */
.layer-visibility {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
}

.layer-visibility-check {
  appearance: none;
  -webkit-appearance: none;
  display: grid;
  place-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  border: 2px solid var(--color-text-secondary);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.layer-visibility-check::after {
  content: '';
  width: 5px;
  height: 10px;
  border: solid transparent;
  border-width: 0 2px 2px 0;
  transform: translate(0, -1px) rotate(45deg);
}

.layer-visibility-check:checked {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.layer-visibility-check:checked::after {
  border-color: #fff;
}

.layer-visibility-check:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Grep for `layer-switch` in `js/`, `style.css` and `test/`, and update any leftover references, such as group rows that call `buildVisibilitySwitch` (they share the function, so they change too).

- [ ] **Step 5: Bar grip**

Replace the `.layer-grip` background lines in `style.css` (keep width, stretch, cursor and `touch-action`):

```css
.layer-grip {
  flex: none;
  width: 22px;
  align-self: stretch;
  /* Two bars, the shape of Material's drag_handle; drawn in CSS so the
     grip stays visible if the icon font fails. */
  background:
    linear-gradient(var(--color-text-secondary) 0 0) center calc(50% - 3px) / 14px 2px no-repeat,
    linear-gradient(var(--color-text-secondary) 0 0) center calc(50% + 3px) / 14px 2px no-repeat;
  border-radius: 1px;
  cursor: grab;
  /* The grip starts a drag, never a scroll. */
  touch-action: none;
}
```

Remove the old `-webkit-mask`/`mask` lines. In `js/layers-ui.js` (~line 400), change the comment "Dots drawn in CSS" to "Bars drawn in CSS".

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add -A index.html js/layers-ui.js style.css test/floating-layout-css.test.js assets/icons
git commit -m "Layers rows: round visibility checkbox, bar grip, add_circle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Round swatches and a modern colour picker

**Files:**
- Modify: `style.css` (`.palette-swatch` ~1992, `.color-library-swatch` ~2389, `.standard-library-swatches span` ~4411, `.color-picker-*` ~4649-4850)
- Modify: `index.html:513-515` (close button), `index.html:556-566` (actions)
- Test: `test/floating-layout-css.test.js` (append)

- [ ] **Step 1: Write the failing tests**

```js
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

  test('close is a ghost circle; actions are one capsule of two segments', () => {
    assert.match(html, /id="color-picker-close" class="ghost-button color-picker-close"/);
    assert.match(html, /<div class="color-picker-actions glass-pill" role="group" aria-label="Color actions">/);
    assert.match(html, /id="color-picker-add" class="color-picker-action"/);
  });
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `node --test test/floating-layout-css.test.js`
Expected: the three new tests FAIL.

- [ ] **Step 3: Round swatches with a ringed active state**

The active swatch gets an outer accent ring with a surface-coloured gap, so it shows on any colour.

- `.palette-swatch`: `border-radius: 50%;` and `border: none; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15);`.
  - `.palette-swatch.active`: `box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent);`.
  - `.palette-swatch:not(.active):hover`: `box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text-secondary);`.
- `.color-library-swatch`: the same three changes (base, `.active`, `:not(.active):hover`). In edit mode (`.color-library-grid.editing .color-library-swatch`), keep `border-style: dashed`; add `border: 2px dashed var(--color-text-secondary);` there, since the base no longer has a border.
- `.standard-library-swatches span`: `border-radius: 50%;`.
- `.color-picker-palette-swatch, .color-picker-history-swatch`: `border-radius: 50%;`.

The colour bar (`.color-bar .color-library-swatch`, ~4487) only sets size, so it inherits round. Add `margin: 4px 2px;` there so the 4px ring isn't clipped by the bar's scroller.

- [ ] **Step 4: Header — pill compare chip, ghost close**

- `.color-picker-compare`: `border-radius: 999px;`.
- In `index.html`, the close button becomes:

```html
          <button type="button" id="color-picker-close" class="ghost-button color-picker-close" aria-label="Close">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
```

```css
.color-picker-close {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  padding: 0;
  border-radius: 50%;
  background: var(--ghost-hover);
}

.color-picker-close .material-symbols-outlined {
  font-size: 1.1rem;
}

/* 2rem looks right in the header; the hit area still reaches 44px. */
.color-picker-close::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.color-picker-close {
  position: relative;
}
```

Check `js/workspace.js`'s picker code for `#color-picker-close` lookups by class (`grep -n "color-picker-close\|icon-button" js/color-picker.js js/workspace.js`). Ids are unchanged, so only a class-based lookup would need a fix.

- [ ] **Step 5: Tabs as a pill segmented control**

```css
.color-picker-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--ghost-hover);
}

.color-picker-tab {
  flex: 1;
  min-height: 34px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.color-picker-tab[aria-selected="true"] {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.2);
}
```

The tabs are 34px tall inside a 40px pill; they sit in one strip with no gaps, so a tap can't miss a segment.

- [ ] **Step 6: Actions as one capsule, icon over label**

Replace the `.color-picker-actions` markup in `index.html`:

```html
        <div class="color-picker-actions glass-pill" role="group" aria-label="Color actions">
          <!-- "Add to palette" - wired in js/color-library-ui.js. -->
          <button type="button" id="color-picker-add" class="color-picker-action">
            <span class="material-symbols-outlined" aria-hidden="true">add</span><span>Add to palette</span>
          </button>
          <!-- Ramp from the colour being edited -> #ramp-preview-row. -->
          <button type="button" id="color-picker-generate-ramp" class="color-picker-action">
            <span class="material-symbols-outlined" aria-hidden="true">gradient</span><span>Ramp</span>
          </button>
        </div>
```

Replace the three `.color-picker-actions*` rules:

```css
.color-picker-actions {
  display: flex;
  overflow: hidden;
  background: var(--ghost-hover);
}

.color-picker-action {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}

.color-picker-action + .color-picker-action {
  border-inline-start: 1px solid var(--glass-border);
}

.color-picker-action:hover {
  background: var(--ghost-hover);
}

.color-picker-action:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.color-picker-action .material-symbols-outlined {
  font-size: 1.3rem;
}
```

`.glass-pill` only sets `border-radius: 999px`; it isn't `.glass`, so it needs no positioning.

- [ ] **Step 7: Thin rounded slider tracks (Value tab)**

```css
.color-value-row input[type="range"] {
  width: 100%;
  height: 6px;
  margin: 0;
  border-radius: 999px;
  background: var(--color-border);
  accent-color: var(--color-accent);
  appearance: none;
  -webkit-appearance: none;
}

.color-value-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
}

.color-value-row input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
}
```

The row stays `min-height: 36px`, and the whole `<label>` row is the hit target. The Classic tab's hue slider is already a rounded spectrum pill; leave it.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 9: Commit**

```bash
git add index.html style.css test/floating-layout-css.test.js
git commit -m "Colour picker: round swatches everywhere, pill tabs, capsule actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ellipse fill icon

**Files:**
- Modify: `js/rectangle-fill-ui.js`
- Modify: `index.html:579-582` (two more SVGs)
- Test: `test/shape-tools.test.js` (append)

**Interfaces:**
- Produces: `export function fillIconFor(tool, filled)` → one of `'rectangle-outline' | 'rectangle-filled' | 'ellipse-outline' | 'ellipse-filled'`

- [ ] **Step 1: Write the failing test**

Add `import { fillIconFor } from '../js/rectangle-fill-ui.js';` to the imports at the top of `test/shape-tools.test.js`. Its only import is `js/shape-tools.js`, which the file already loads without a DOM stub. Then append:

```js
describe('fillIconFor', () => {
  test('Rectangle keeps the rectangle icons', () => {
    assert.equal(fillIconFor('rectangle', false), 'rectangle-outline');
    assert.equal(fillIconFor('rectangle', true), 'rectangle-filled');
  });

  test('Ellipse gets ellipse icons', () => {
    assert.equal(fillIconFor('ellipse', false), 'ellipse-outline');
    assert.equal(fillIconFor('ellipse', true), 'ellipse-filled');
  });
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `node --test test/shape-tools.test.js`
Expected: FAIL — `fillIconFor is not a function`.

- [ ] **Step 3: Markup — four icons, each tagged with its key**

Replace the two SVGs inside `#rectangle-fill-toggle` in `index.html`:

```html
          <svg class="rectangle-fill-icon" data-fill-icon="rectangle-outline" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true"><path d="M80-160v-640h800v640H80Zm80-80h640v-480H160v480Zm0 0v-480 480Z"/></svg>
          <svg class="rectangle-fill-icon hidden" data-fill-icon="rectangle-filled" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true"><path d="M80-160v-640h800v640H80Z"/></svg>
          <svg class="rectangle-fill-icon hidden" data-fill-icon="ellipse-outline" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true"><path fill-rule="evenodd" d="M80-480a400 280 0 1 0 800 0a400 280 0 1 0-800 0Zm80 0a320 200 0 1 0 640 0a320 200 0 1 0-640 0Z"/></svg>
          <svg class="rectangle-fill-icon hidden" data-fill-icon="ellipse-filled" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true"><path d="M80-480a400 280 0 1 0 800 0a400 280 0 1 0-800 0Z"/></svg>
```

The old ids `rectangle-fill-icon-outline` and `rectangle-fill-icon-filled` go away. Grep `js/` and `test/` for them first and update any other user.

- [ ] **Step 4: Implement**

Rewrite the body of `js/rectangle-fill-ui.js` below the imports (keep the header comment; add one line saying the icon follows the active shape tool):

```js
let filled = false;
let tool = 'rectangle';

/** Which of the toggle's four icons shows, for the active shape tool. */
export function fillIconFor(activeTool, isFilled) {
  return `${activeTool === 'ellipse' ? 'ellipse' : 'rectangle'}-${isFilled ? 'filled' : 'outline'}`;
}

export function initRectangleFill(root = document) {
  const panel = root.querySelector('#rectangle-options');
  const toggle = root.querySelector('#rectangle-fill-toggle');
  if (!toggle) return; // standalone-only (absent from lib/pixi.js's embed markup)
  const icons = toggle.querySelectorAll('[data-fill-icon]');

  function render() {
    const key = fillIconFor(tool, filled);
    for (const icon of icons) icon.classList.toggle('hidden', icon.dataset.fillIcon !== key);
    toggle.classList.toggle('active', filled);
    toggle.dataset.tooltip = tool === 'ellipse' ? 'Filled ellipse' : 'Filled rectangle';
  }

  toggle.addEventListener('click', () => {
    filled = !filled;
    setShapeFilled(filled);
    render();
  });

  root.querySelectorAll('.tool-button[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.tool;
      panel.classList.toggle('hidden', next !== 'rectangle' && next !== 'ellipse');
      if (next === 'rectangle' || next === 'ellipse') {
        tool = next;
        render();
      }
    });
  });
}
```

Keyboard shortcuts switch tools through `button.click()` (`js/workspace.js` ~line 1901), so they reach this listener too.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add index.html js/rectangle-fill-ui.js test/shape-tools.test.js
git commit -m "Ellipse: its own outline and filled icons on the Filled toggle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Visual check, guidelines review, docs

**Files:**
- Modify: `docs/specs/layers/spec.md`, `docs/specs/color-library/spec.md`, `docs/specs/shape-tools/spec.md`, `docs/ui-reference.md`, `docs/roadmap.md`

- [x] **Step 1: Screenshots**

Start `python3 -m http.server 8000` in the background. With Playwright, take screenshots of each item below in dark and light themes, at 1280×800 and 390×844, in Chromium and in WebKit. For WebKit, use `webkit.launchPersistentContext(dir, …)`, because an ephemeral context can't create a project.

1. A project with a few coloured pixels.
2. More ⋯ menu open over artwork.
3. Palette menu open.
4. Delete Palette confirm open (create a throwaway palette first).
5. Layers panel with a group and a reference image.
6. Colour picker on each of the four tabs.
7. Ellipse tool selected with Filled on, then off.

Look at each one. Check that:

- Menus and the confirm dialog show blurred artwork behind them.
- Text stays readable in both themes.
- Swatches are round with a visible active ring.
- In WebKit, the confirm dialog shows no crisp cards through it.

If it does, add `.confirm-dialog.glass::before { display: none; }` with a comment, then retest and commit.

- [x] **Step 2: Web Interface Guidelines review**

Invoke the `web-design-guidelines` skill on the changed files: `index.html`, `style.css`, `js/confirm-dialog.js`, `js/layers-ui.js`, `js/rectangle-fill-ui.js`. Fix any findings, run `npm test`, and commit as "Guidelines fixes for glass and panel polish".

- [x] **Step 3: Docs**

- `docs/specs/layers/spec.md`: the header row shows the active layer's blend mode and opacity (disabled for a reference image; edits undoable); visibility is a checkbox; a group's opacity is set from its ⋯ menu; the "Opacity & Blend…" layer item is gone.
- `docs/specs/color-library/spec.md`: swatches are round everywhere; the active swatch is ringed.
- `docs/specs/shape-tools/spec.md`: the Filled toggle shows ellipse icons for Ellipse and rectangle icons for Rectangle.
- `docs/ui-reference.md`: update the Layers panel, colour picker, menus and confirm dialog entries to match.
- `docs/roadmap.md`: under the UI polish pass, add "Glass menus, popovers and confirm dialog; Layers header blend/opacity; round swatches; Ellipse fill icon (2026-10-13). Next: Transform categories and rotation dial, then Copy/Cut/Paste and Merge."

- [x] **Step 4: Commit**

```bash
git add docs
git commit -m "Specs, UI reference and roadmap: glass and panel polish

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [x] **Step 5: Code review**

Invoke `superpowers:requesting-code-review` for the branch (model `sonnet`, per CLAUDE.md's dispatch table; this is a medium-risk UI diff).
