# Visible Edit Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut and Copy on the selection bar (now icon-only), plus a Merge button in the Layers header.

**Architecture:** These are buttons only. They call the existing `cutActive`/`copyActive` (js/workspace.js) and `mergeMarkedOrActiveDown` (js/layers-ui.js). Enabled state reuses the existing `layerMenuState`/`mergeButtonState`. The floating bar's proxies mirror their sources' `disabled`.

**Tech Stack:** Vanilla JS ES modules and `node --test`. No build step.

**Spec:** `docs/superpowers/specs/2026-10-15-visible-edit-actions-design.md`

## Global Constraints

- `js/clipboard.js` and the paste logic don't change.
- Copy/Cut clicks call `copyActive()`/`cutActive()` synchronously in the click handler, with no `await` before the call.
- Tooltips: "Cut (⌘X)", "Copy (⌘C)", "Delete", "Clear selection (⌘D)", "Merge down (⌘E)" / "Merge N layers (⌘E)".
- Icons (Material Symbols): `content_cut`, `content_copy`, `delete`, `deselect`, `merge`.
- Run tests with `npm test`. All tests must pass before each commit.

---

### Task 1: Selection bar markup, Cut and Copy wiring, and enabled state

**Files:**
- Modify: `index.html` (`#selection-controls` ~L1151, `#selection-bar` ~L1188)
- Modify: `js/workspace.js` (`updateSelectionControls` ~L438, init refs ~L2560, listeners ~L1964)
- Modify: `js/layers-ui.js` (`renderLayersPanel` ~L279)
- Modify: `js/selection-bar.js` (proxy loop in `initSelectionBar`)
- Modify: `style.css` (~L3950 `#selection-bar .tool-button`)
- Test: `test/selection-bar.test.js`

**Interfaces:**
- Produces: `export function updateSelectionControls()` in js/workspace.js, which is called from `renderLayersPanel()`.

- [ ] **Step 1: Write the failing markup test.** Append to `test/selection-bar.test.js` (add `import { readFileSync } from 'node:fs';` at the top):

```js
describe('selection bar markup', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const bar = html.match(/<div id="selection-bar"[\s\S]*?<\/div>/)[0];
  test('proxies are cut, copy, delete, clear - icon-only, labelled', () => {
    const forwards = [...bar.matchAll(/data-forward="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(forwards, ['selection-cut-button', 'selection-copy-button', 'selection-delete-button', 'selection-clear-button']);
    for (const btn of bar.match(/<button[\s\S]*?<\/button>/g)) {
      assert.match(btn, /aria-label="[^"]+"/);
      assert.match(btn, /icon-button/);
    }
  });
  test('docked source has Cut and Copy', () => {
    assert.match(html, /id="selection-cut-button"/);
    assert.match(html, /id="selection-copy-button"/);
  });
});
```

- [ ] **Step 2:** Run `npm test`. Expected: the new tests FAIL.

- [ ] **Step 3: Markup.** Replace `#selection-controls`' buttons with:

```html
<button type="button" id="selection-cut-button" class="tool-button">Cut</button>
<button type="button" id="selection-copy-button" class="tool-button">Copy</button>
<button type="button" id="selection-clear-button" class="tool-button">Clear selection</button>
<button type="button" id="selection-delete-button" class="tool-button">Delete</button>
```

Replace `#selection-bar`'s contents with:

```html
<button type="button" class="tool-button icon-button" data-forward="selection-cut-button" aria-label="Cut" data-tooltip="Cut (⌘X)"><span class="material-symbols-outlined" aria-hidden="true">content_cut</span></button>
<button type="button" class="tool-button icon-button" data-forward="selection-copy-button" aria-label="Copy" data-tooltip="Copy (⌘C)"><span class="material-symbols-outlined" aria-hidden="true">content_copy</span></button>
<span class="selection-bar-divider" aria-hidden="true"></span>
<button type="button" class="tool-button icon-button" data-forward="selection-delete-button" aria-label="Delete" data-tooltip="Delete"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
<button type="button" class="tool-button icon-button" data-forward="selection-clear-button" aria-label="Clear selection" data-tooltip="Clear selection (⌘D)"><span class="material-symbols-outlined" aria-hidden="true">deselect</span></button>
```

- [ ] **Step 4: CSS.** In `style.css`, in the `#selection-bar .tool-button` rule, change `padding: 0 1.1rem;` to `padding: 0;` (the buttons are icon-only now). Add:

```css
.workspace-screen[data-layout="floating"] #selection-bar .selection-bar-divider {
  align-self: stretch;
  width: 1px;
  margin-block: 0.4rem;
  background: currentColor;
  opacity: 0.2;
}
```

- [ ] **Step 5: Wiring in js/workspace.js.** Add `layerMenuState` to the existing `./layers-ui.js` import. Add `selectionCutButton: root.querySelector('#selection-cut-button'), selectionCopyButton: root.querySelector('#selection-copy-button'),` next to `selectionDeleteButton` in the state init. Next to the `selectionDeleteButton` listener, add:

```js
  // Synchronous: the clipboard write must start inside the click (clipboard.js's writeImage).
  state.selectionCutButton.addEventListener('click', () => cutActive());
  state.selectionCopyButton.addEventListener('click', () => copyActive());
```

Replace `updateSelectionControls` with:

```js
/**
 * Shows the selection controls while there's a selection, and sets Cut
 * and Copy's enabled state from the layer menu's rules (layerMenuState).
 * Also run from renderLayersPanel(), so a stroke or an active-layer change
 * refreshes it.
 */
export function updateSelectionControls() {
  state.selectionControlsEl.classList.toggle('hidden', !state.selection);
  if (!state.selection || !state.selectionCutButton) return;
  const layers = state.layerStack.getLayers();
  const index = state.layerStack.getActiveIndex();
  const layer = layers[index];
  if (!layer) return;
  const s = layerMenuState({
    layer,
    layers,
    index,
    hasSelection: true,
    hasContent: true,
    selectionHasContent: !!contentBounds(layer.engine, state.selection),
  });
  state.selectionCutButton.disabled = s.cut.disabled;
  state.selectionCopyButton.disabled = s.copy.disabled;
}
```

In `js/layers-ui.js`, import `updateSelectionControls` from `./workspace.js` (add it to the existing import) and call it in `renderLayersPanel()` right after the `if (!layersPanelList) return;` guard.

- [ ] **Step 6: Proxies mirror `disabled`.** In `js/selection-bar.js`'s `initSelectionBar`, replace the proxy loop with:

```js
  for (const proxy of bar.querySelectorAll('button[data-forward]')) {
    const target = root.querySelector(`#${proxy.dataset.forward}`);
    proxy.addEventListener('click', () => target?.click());
    if (!target) continue;
    // Cut/Copy are disabled when there's nothing under the selection.
    const sync = () => { proxy.disabled = target.disabled; };
    sync();
    new MutationObserver(sync).observe(target, { attributes: true, attributeFilter: ['disabled'] });
  }
```

Update the module's header comment so it lists Cut and Copy as proxies too.

- [ ] **Step 7:** Run `npm test`. Expected: all PASS.

- [ ] **Step 8: Browser check** (serve the repo, e.g. `python3 -m http.server`). In the floating layout, make a selection over empty pixels: Cut and Copy are disabled. Draw inside it: they're enabled. Switch to a locked layer: Cut is disabled and Copy stays enabled. Copy and then ⌘V pastes a layer. Cut clears the pixels. Docked layout: the text buttons behave the same.

- [ ] **Step 9: Commit.**

```bash
git add index.html style.css js/workspace.js js/layers-ui.js js/selection-bar.js test/selection-bar.test.js
git commit -m "Selection bar: icon-only, with Cut and Copy"
```

### Task 2: Merge button in the Layers header

**Files:**
- Modify: `index.html` (~L1229, before `#add-layer-button`)
- Modify: `js/layers-ui.js` (init ~L1001, listeners ~L1112, `renderLayersPanel`)
- Test: `test/layer-menu.test.js`

**Interfaces:**
- Consumes: `mergeButtonState(layers, activeIndex, markedIds) → { disabled, label }` and `mergeMarkedOrActiveDown()` (both exist).

- [ ] **Step 1: Failing test.** Append to `test/layer-menu.test.js` (add `import { readFileSync } from 'node:fs';` if missing):

```js
test('Layers header has a Merge button before Add layer', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const header = html.match(/<div class="panel-header-top">[\s\S]*?id="add-layer-button"/g).find((h) => h.includes('Layers</h2>'));
  assert.match(header, /id="merge-layer-button"[^>]*aria-label="Merge down"/);
});

test('mergeButtonState labels: Merge down, Merge N layers', () => {
  const layers = [L(), L(), L()];
  assert.equal(mergeButtonState(layers, 2, new Set()).label, 'Merge down');
  assert.equal(mergeButtonState(layers, 2, new Set([layers[0].id, layers[1].id, layers[2].id])).label, 'Merge 3 layers');
  assert.equal(mergeButtonState(layers, 0, new Set()).disabled, true);
});
```

- [ ] **Step 2:** Run `npm test`. Expected: the header test FAILS (the label test may already pass, which is fine).

- [ ] **Step 3: Markup.** Insert before `#add-layer-button`:

```html
<button type="button" id="merge-layer-button" class="tool-button icon-button" aria-label="Merge down" data-tooltip="Merge down (⌘E)">
  <span class="material-symbols-outlined" aria-hidden="true">merge</span>
</button>
```

- [ ] **Step 4: Wiring.** In `js/layers-ui.js`, declare `let mergeLayerButton = null;` next to `addLayerButton`. In init, add `mergeLayerButton = root.querySelector('#merge-layer-button');`. Next to the add-layer listener, add `mergeLayerButton?.addEventListener('click', () => mergeMarkedOrActiveDown());`. The header's collapse already ignores button clicks (`bindPanelHeaderCollapse`). In `renderLayersPanel()`, after `activeIndex` is computed, add:

```js
  if (mergeLayerButton) {
    const merge = mergeButtonState(layers, activeIndex, markedLayerIds);
    mergeLayerButton.disabled = merge.disabled;
    mergeLayerButton.setAttribute('aria-label', merge.label);
    mergeLayerButton.dataset.tooltip = `${merge.label} (⌘E)`;
  }
```

Check that marking or unmarking a layer re-renders the panel. If it doesn't, call the same block from the marking path (`syncSelectBar`).

- [ ] **Step 5:** Run `npm test`. Expected: all PASS.

- [ ] **Step 6: Browser check.** On the bottom or Background layer, Merge is disabled. On layer 2 it's enabled, and a click merges down as one undo step. In Select mode with 3 marked, the tooltip reads "Merge 3 layers (⌘E)". Check both the floating and docked layouts.

- [ ] **Step 7: Commit.**

```bash
git add index.html js/layers-ui.js test/layer-menu.test.js
git commit -m "Layers header: visible Merge button"
```

### Task 3: UI review and docs

**Files:** `docs/specs/floating-workspace/spec.md` (Selection action bar ~L706), `docs/specs/clipboard/spec.md`, `docs/specs/layers/spec.md` ("Merge without a keyboard" ~L604), `docs/ui-reference.md` (~L310 selection bar, plus the Layers header section), `docs/roadmap.md` (~L449 and ~L721).

- [ ] **Step 1:** Run the `web-design-guidelines` skill on the diff (`git diff main -- index.html style.css js/`). Fix any real issues and re-run `npm test`.
- [ ] **Step 2: Specs.** floating-workspace: the bar holds icon-only Cut, Copy, Delete and Clear selection, in that order, with a divider after Copy, and Cut/Copy are disabled when nothing is under the selection (with a scenario). clipboard: Cut and Copy are also on the selection action bar. layers: "Merge without a keyboard" adds the Layers header Merge button, labelled by `mergeButtonState`.
- [ ] **Step 3: ui-reference.md.** Describe the new selection bar buttons and the header's `#merge-layer-button`.
- [ ] **Step 4: roadmap.md.** In the Layer context menu entry, replace "Item 7 (a visible Merge button) is still open." with "Items 7 and the selection-bar half of 8 done 2026-10-15 (`docs/superpowers/specs/2026-10-15-visible-edit-actions-design.md`)." Strike "Next: Copy/Cut/Paste and Merge." in the same way as the neighbouring done items.
- [ ] **Step 5: Commit.** `git commit -am "Docs: visible edit actions"`
- [ ] **Step 6:** Run `superpowers:requesting-code-review` (sonnet), then `superpowers:finishing-a-development-branch`.
