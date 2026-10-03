## 1. Pure helpers (TDD)

- [x] 1.1 New `js/selection-bar.js` with `placeSelectionBar(selection, bar, clear, outer, gap)` returning `{ x, y, side }` (design decision 3). Write the tests first in `test/selection-bar.test.js`:
  - selection in the middle → `'above'`, centred
  - selection just below the top of the clear area → `'below'`
  - selection against the clear area's start or end edge → x clamped inside, as close to centre as allowed
  - selection larger than the clear area → `'held'` at the clear area's top
  - selection entirely above, below, left of and right of the clear area → `'held'`, fully inside, at the nearest edge
  - clear area narrower or shorter than the bar → bounds fall back to `outer`
  - zero-size or 1×1 selection
- [x] 1.2 `test/layout.test.js`: `clearInsets` ignores an element with no slot (documents that the slot-less bar never affects Fit). Skip this if the existing slot-loop test already covers it, and note that here. **Skipped:** `clearInsets` has no notion of a slot-less card (an undefined slot would fall into its column branch); the guarantee is `measureClearInsets` only querying `.slot-*`, which needs a DOM. Checked in the browser instead (5.9)

## 2. Markup

- [x] 2.1 `index.html`: inside `.workspace-main`, directly after `.slot-options`, add `<div id="selection-bar" class="selection-bar floating-only" role="group" aria-label="Selection actions">` with two `tool-button no-buzz` buttons, "Clear selection" (`data-forward="selection-clear-button"`) and "Delete" (`data-forward="selection-delete-button"`). Add a comment naming the sources, for the later docked deletion
- [x] 2.2 Update the `#selection-controls` and `.options-card` comments to say that in the floating layout the selection controls are shown in `#selection-bar` instead
- [x] 2.3 Confirm `lib/pixi.js` needs no change (embed is always docked, and `selection-bar.js` is never wired there), and that `lib/pixi.test.js` still passes. The pre-existing `#record-toggle` embed crash is a separate bug fix and is not part of 5f

## 3. CSS

- [x] 3.1 `#selection-bar` in floating (`z-index: 15`, just under the slot cards' 20: the shared 20 would paint the bar over popovers nested in earlier cards, such as the colour picker): `position: fixed`, `inset-block-start: var(--selection-bar-y)`, `inset-inline-start: var(--selection-bar-x)` (logical insets only), a single row with `gap: var(--float-gap)`, card padding and radius, the floating-card `z-index` layer (below popovers and menus), and `pointer-events: auto`. Buttons are at least `--rail-button-size` tall with text padding
- [x] 3.2 Add `#selection-bar` to the glass selector lists (look, `::before` blur, reduced-transparency and no-blur fallbacks)
- [x] 3.3 Show/hide (design decision 2):
  - `.workspace-screen[data-layout="floating"]:has(#selection-controls.hidden) #selection-bar { display: none; }`
  - `.workspace-screen[data-layout="floating"][data-selection-drag] #selection-bar { visibility: hidden; }`
  - floating-only `display: none` on `#selection-controls`
- [x] 3.4 Extend `test/floating-layout-css.test.js`:
  - every `#selection-bar` and `#selection-controls` hide rule is scoped to `[data-layout="floating"]`
  - outside it the only rule naming `.selection-bar` is the `.floating-only` hide
  - the bar's position uses only `inset-*` logical properties
  - the glass lists name `#selection-bar`
  - the docked `.selection-controls` rules are unchanged

## 4. Wiring

- [x] 4.1 `js/canvas-view.js`: add an `onViewChange` handler fired at the end of `#applyTransform()`, and `getSelectionClientRect()`, which returns the overlay's `getBoundingClientRect()`, or `null` while the overlay is hidden. Add doc comments saying `#applyTransform()` is the single choke point for pan, zoom, pinch, `panBy`, presets and `setSelectionRect`
- [x] 4.2 `js/workspace.js`:
  - export `onCanvasViewChange(fn)`, which registers a module-level listener
  - export `currentSelectionClientRect()`, which forwards to the current view
  - in `initWorkspace()`'s `setHandlers`, add `onViewChange()` to call the listeners
- [x] 4.3 `js/workspace.js`: set `data-selection-drag` on the workspace screen in `onDrawStart` when the tool is Select, or the tool is Move and `state.selection` exists. Remove it in `onDrawEnd`, in `onDrawCancel`, and in `initWorkspace()`. Add a comment that it runs in both layouts and only floating CSS reads it
- [x] 4.4 `initSelectionBar({ onCanvasViewChange, currentSelectionClientRect })` in `js/selection-bar.js` (null-safe, no-op without `#selection-bar`):
  - buttons forward `click()` to their `data-forward` source
  - one rAF-coalesced `schedule()`. Each frame: skip if the bar has no client rects or there is no selection rect; read the bar's size; call `placeSelectionBar` with the cached clear area and the `outer` box (screen box inset by `--float-edge-*`, resolved via a probe once per resize); write `--selection-bar-x/y` in px
  - `onCanvasViewChange(schedule)`
  - a `ResizeObserver` on every `.slot-*` element and the workspace screen, which re-measures `measureClearInsets` into the cache and calls `schedule()`
  - a `MutationObserver` on `#selection-controls` (`class`) and the screen (`data-selection-drag`), which calls `schedule()`
- [x] 4.5 Focus (design decision 5): in the same `#selection-controls` observer, when the source becomes `.hidden` while `document.activeElement` is inside `#selection-bar`, focus the rail's `[data-tool][aria-pressed="true"]` button
- [x] 4.6 `js/app.js`: call `initSelectionBar()` next to `initPanelRail()`, only when `layout === 'floating'`

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 Serve locally with `?layout=floating` at 1180×820 and 768×1024. With the Select tool, drag a selection in the middle of the canvas. The bar appears centred above it with Clear selection and Delete, and the palette card shows no selection controls and keeps its height. The bar is not shown during the drag
- [x] 5.3 Placement at both sizes:
  - a selection just below the top bar → bar below it
  - selections against the tool rail and against the open panel cards → bar shifted inward, not over the card
  - zoom in until the selection fills the clear area → bar held at the top of the clear area
  - pan the selection fully off each edge → bar held on screen at the nearest edge
  - in every case the bar never covers the top bar, rail, mini-rail, open cards or bottom cards
- [x] 5.4 Following:
  - Hand-tool pan, pinch (or trackpad pinch), wheel zoom, keyboard zoom and every zoom pill item → the bar moves with the selection without disappearing
  - open and close Colors and Layers, switch to a tool with a tool-options bar, and resize the window → the bar re-places
  - check for visible lag during a fast pan, and if there is any, apply design.md's synchronous fallback and note it here. **Note:** checked in headless Chromium only (the bar stays one gap above the selection mid-pan; at most one frame behind by design). Not yet looked at on a real iPad; the synchronous fallback is not applied
- [x] 5.5 Move tool: drag the selection → the bar is hidden during the drag and reappears above the new position on release. A cancelled gesture (second finger during a Select drag) brings the bar back for the previous selection
- [x] 5.6 Actions:
  - Delete → pixels cleared, the selection and bar remain
  - Clear selection, Escape, Cmd/Ctrl+D, and a tap outside with the Select tool → the selection and bar disappear
  - opening another project → no bar
  - with a selection, switching to Pencil → bar stays
  - in every case the artwork never moves or re-fits
- [x] 5.7 Hide interface (Tab and from More): the bar hides and comes back with the interface while the selection exists. Escape restores the interface without clearing the selection (4d rule) and the bar returns
- [x] 5.8 Accessibility:
  - the bar is announced as the "Selection actions" group
  - the buttons are named by their text, are at least 44×44, and tab in visual order
  - the bar appearing does not move focus
  - keyboard Clear selection moves focus to the Select tool's rail button
  - keyboard Delete keeps focus on Delete
- [x] 5.9 Fit ignores the bar: with a selection shown, choose Fit from the zoom pill. The canvas fits the same clear area as with no selection
- [x] 5.10 Without the parameter: the docked layout looks and behaves exactly as before. `#selection-controls` shows in the bottom area with a selection, and no `#selection-bar` is visible. Pixel-compare against `main` at 1180×820 with and without a selection. `lib/pixi.js` is unchanged (the embed's pre-existing mount crash is tracked separately)
- [x] 5.11 Run `web-design-guidelines` on the changed markup/CSS/JS before code review

## 6. Docs

- [x] 6.1 `docs/ui-reference.md`:
  - add a "Floating selection action bar (5f-selection-action-bar)" paragraph covering the proxies, the `:has()` show/hide, `data-selection-drag`, placement and the flip, `onViewChange`, the clear-area cache and the focus rule
  - update the 5a and 5d paragraphs, which list `#selection-controls` in `.slot-options`/`.options-card`, to say it is hidden in floating
