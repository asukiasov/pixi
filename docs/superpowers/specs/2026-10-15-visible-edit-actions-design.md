# Visible edit actions — design

Finishes Part C ("Edit actions") of the 2026-10-13 UI feedback
(`2026-10-13-glass-and-panel-polish-design.md`): item 7, a visible Merge
button, and the part of item 8 that
`2026-10-13-layer-context-menu-design.md` left out, Cut and Copy on the
selection action bar.

Clipboard behaviour doesn't change. What gets copied with no selection
(the whole layer), paste placement (in place for Pixi's own copy,
otherwise centred and fitted), the system clipboard plus in-app record,
and ⌘C/⌘X/⌘V all stay as `docs/specs/clipboard/spec.md` describes. This
design only adds buttons that call the existing functions.

**Out of scope:** a visible Paste button (Paste stays in the layer ⋯ strip
and on ⌘V, because it doesn't need a selection), any change to
`js/clipboard.js`, and non-rectangular selections.

## 1. Selection action bar: Cut and Copy, all icon-only

- `#selection-controls`, the docked layout's source, gains
  `#selection-cut-button` ("Cut") and `#selection-copy-button` ("Copy"),
  which come before Clear selection and Delete. The docked layout keeps
  text buttons.
- Clicks call `cutActive()` / `copyActive()` in `js/workspace.js`, the
  same path ⌘X / ⌘C use, and call them synchronously inside the click
  handler so the clipboard write stays inside the user gesture.
- `#selection-bar` (floating) gets icon-only `data-forward` proxies in
  this order: Cut (`content_cut`) and Copy (`content_copy`), then a
  divider, then Delete (`delete`) and Clear selection (`deselect`). Each
  proxy has an `aria-label` and a `data-tooltip` with its shortcut: "Cut
  (⌘X)", "Copy (⌘C)", "Delete", "Clear selection (⌘D)". Use
  `.icon-button`, like the other floating icon buttons.
- **Enabled state** comes from the existing `layerMenuState` (from
  `js/layers-ui.js`) for the active layer, with
  `hasSelection: true`. Cut is disabled on a locked or reference layer, or
  when nothing is under the selection. Copy is disabled on a reference
  layer, or when nothing is under the selection. It's recomputed in
  `updateSelectionControls()`, which runs on every selection change, and
  also on active-layer changes and after each commit (a stroke can fill or
  empty the area).
- **Proxies mirror `disabled`.** `js/selection-bar.js` copies each
  source's `disabled` onto its proxy, once at init and whenever the
  attribute changes (a MutationObserver on the source buttons).

## 2. Merge button in the Layers header

- `#merge-layer-button` is an icon button (`merge`) in
  `.panel-header-top`, just before `#add-layer-button`.
- Its state comes from
  `mergeButtonState(layers, activeIndex, markedLayerIds)` and is applied
  in `renderLayersPanel()`. That covers `disabled`, plus an `aria-label`
  and `data-tooltip` of "Merge down (⌘E)" or "Merge N layers (⌘E)".
- Clicking it calls `mergeMarkedOrActiveDown()`, the same as ⌘E. The click
  must not toggle the header's collapse (handle it the same way as
  `#add-layer-button`).

## 3. Testing

- Unit: `layerMenuState` and `mergeButtonState` are already covered in
  `test/layer-menu.test.js`. Add `mergeButtonState` cases where they're
  missing (2+ marked gives "Merge N layers", a marked locked layer
  disables it).
- Markup (an index.html read, like `test/floating-layout-css.test.js`):
  the selection bar has 4 forwarding proxies in the order cut, copy,
  delete, clear, each with an aria-label, and `#merge-layer-button`
  exists in the Layers header before Add layer.
- Manual in the browser: Cut and Copy enable and disable as the selection
  moves over empty and filled pixels and onto a locked layer, the Merge
  label changes when layers are marked, and keyboard focus still lands
  correctly when the bar hides.
- Run `web-design-guidelines` on the changed UI before code review.

## 4. Docs

- `docs/specs/floating-workspace/spec.md`: the selection action bar
  requirement covers the new buttons, icons and order.
- `docs/specs/clipboard/spec.md`: Cut and Copy can also be reached from
  the selection action bar.
- `docs/specs/layers/spec.md`: "Merge without a keyboard" now includes
  the header button.
- `docs/ui-reference.md` (Selection bar, Layers header) and
  `docs/roadmap.md` (Part C done).
