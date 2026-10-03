## 1. Pure helpers (TDD)

- [x] 1.1 `js/panel-rail.js`: export `NARROW_MAX_WIDTH = 600` and `openCardDefaults(viewportWidth)` returning `{ colors, brushes, layers }` (design decision 2). Write the tests first in `test/panel-rail.test.js`: 1180 and 600 → all `true`, 599 and 390 → all `false`
- [x] 1.2 `test/layout.test.js`: delete the `resolveLayout` tests (design decision 1). Keep the `clearInsets`, `clearArea`, `visibleAnchor` and `canvasSide` tests unchanged

## 2. Markup

- [x] 2.1 `index.html`: no structural change. Update comments that call the floating layout "dev-only" or say it applies only with `?layout=floating` (search for `layout=floating`, `dev-only`, `5h`)
- [x] 2.2 Confirm `lib/pixi.js` needs no change and is not touched (embed is always docked, and it never imports `app.js` or `layout.js`). `lib/pixi.test.js` still passes. The pre-existing `#record-toggle` embed crash is a separate bug fix and is not part of this change

## 3. CSS

- [x] 3.1 Card column width (design decision 4): add `--slot-cards-room` next to the other slot variables, built only from the tools-start, rail-width, cards-end and gap variables. Change the floating `.right-sidebar` width, and its collapsed-state width, from `15rem` to `min(15rem, var(--slot-cards-room))`
- [x] 3.2 Tool-options bar: `flex-wrap: wrap`, `min-width: 0` and `max-width: 100%` on `#tool-options-bar` and `.tool-options-group`. Slider groups wrap so the two sliders stack. The range input becomes `flex: 1 1 7rem; min-width: 4rem` (keeping the 44px hit height)
  - The range input also keeps `width: 7rem`: with only `flex-basis`, Chromium sized the bar from the input's wider native width, widening the bar at 1180 and wrapping the Brush bar at 768 (caught by 5.8)
- [x] 3.3 Palette card: floating `.options-card` gets `max-width: 100%` and `min-width: 0`, so `#palette-row`'s existing `overflow-x: auto` scrolls inside it
- [x] 3.4 Update the `style.css` header comment for the floating section (no longer `?layout=floating` only: always on in the standalone app, never in embeds)
- [x] 3.5 Extend `test/floating-layout-css.test.js`:
  - the new rules are scoped to `[data-layout="floating"]`
  - the column width uses `--slot-cards-room` and no fixed `15rem` remains in floating rules
  - the docked `.right-sidebar`, `.palette-row` and `.options-card` rules are unchanged

## 4. Wiring

- [x] 4.1 `js/app.js`:
  - remove the `resolveLayout` import and the `layout` constant, and call `applyLayout(screens.workspace, 'floating')`
  - remove every `layout === 'floating'` condition: the floating modules are always initialised, and `CanvasView` always gets `getClearInsets`
  - update the comment block above it
- [x] 4.2 `js/layout.js`: delete `resolveLayout`, and rewrite the header comment ("always floating in the standalone app; embeds never call `applyLayout`, so they stay docked")
- [x] 4.3 `js/panel-rail.js`: export `applyOpenCardDefaults()`. It reads `window.innerWidth`, calls `openCardDefaults`, and closes each card that should be closed via the existing paths: a click forwarded to `#color-library-header`, a click on `#layers-panel-toggle`, and `setBrushesCardOpen(false)`. It never opens a card
- [x] 4.4 `js/app.js` `openWorkspace()`: after `initWorkspace()` returns, call `applyOpenCardDefaults()`, then `canvasView.resetView(); canvasView.render();` (design decision 3). Add a comment that this is what makes Fit see the cards that are actually open on every open, not only the first
  - Found in the browser check: on the first open, Colors' `onWorkspaceReset` handler (`js/color-library-ui.js`) set `collapsed = false` only after awaiting the first palette load, so it reopened Colors after `applyOpenCardDefaults()`. The reset now runs before the await. Embeds end in the same state (the panel is uncollapsed either way), just synchronously
- [x] 4.5 Search `js/` for remaining references to `?layout=floating` or a docked default in comments, and update them

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 Serve locally **without any query parameter** at 1180×820 and 768×1024. The Workspace is floating: the top bar is Back, title, zoom pill, Undo, Redo, More; there is the tool rail, the mini-rail with Colors and Layers open, and the tool-options bar above the palette card. Fit keeps the artwork clear of every card
- [x] 5.3 `?layout=floating`, `?layout=docked` and `?layout=xyz` all give the same floating Workspace. Gallery → open another project keeps it floating. Back/Forward and reload on `#/project/<id>` still work (url-routing unchanged)
- [x] 5.4 Fit after resets, at 1180×820: close Colors and Layers, then open another project. The cards are open again and the canvas is fitted beside them, not into the wider area
- [x] 5.5 Narrow, at 390×844:
  - project open → all three cards closed, the mini-rail shows them closed, and the whole canvas is visible between the rail and the mini-rail
  - open Layers → it sits between the rail and the mini-rail, covering neither, every control in it reachable, and the artwork does not move
  - Pencil, Eraser, Brush, Rectangle and Select → every tool-options control is inside the bar and on screen, and each slider can be dragged end to end
  - the palette row scrolls sideways inside its card
  - top bar, rail and More menu are fully usable
  - with 5f merged, make a selection and check the selection action bar stays on screen
- [x] 5.6 Also at 390×844: open Colors, Brushes (Brush tool) and Layers together. The column stops above the bottom cards and shares the height (5e), and every header is visible. Resize to 1180 wide and back: no card opens or closes
- [x] 5.7 Landscape phone at 844×390: note how it looks, and fix only if a control is unreachable (design risk). Record the result here
  - Result (headless Chromium): every control reachable. The tool rail scrolls its tools, the Colors and Layers cards share the short height and scroll inside themselves, and the tool-options bar and palette fit on one row. Cramped but usable; no fix needed
- [x] 5.8 Wide windows unchanged: at 1180×820 and 768×1024, the tool-options bar, palette card and card column look the same as before this change (screenshot compare against `main` with `?layout=floating`)
  - Result: pixel-identical to `main?layout=floating` at 1180×820 and 768×1024 for Pencil, Eraser, Brush, Rectangle and Select
- [x] 5.9 WebKit pass (Playwright WebKit) at 1180×820 and 390×844: glass look or opaque fallback, the menus, tool-options sliders and drawing all work
  - Result: all checks pass in WebKit. Headless WebKit can't store Blobs in IndexedDB in an ephemeral context, so the script used a persistent profile; the icon font didn't load there (existing fallback hid the ligatures)
- [ ] 5.10 **User check on a real iPad** (roadmap 5a note), landscape and portrait, with touch and Apple Pencil: drawing, pinch, the cards, the tool-options sliders and the menus. Record the result here before merge
  - Not done: needs the user on a real iPad. Merged at the user's request with this open
- [x] 5.11 Embeds: `lib/pixi.test.js` passes and `lib/pixi.js` has no diff. Manual embed mounting is blocked by the known `#record-toggle` crash, so note that it was not exercised
  - Result: tests pass and `git diff main -- lib/pixi.js` is empty. Embed mounting not exercised (known `#record-toggle` crash)
- [x] 5.12 Run `web-design-guidelines` on the changed CSS/JS before code review
  - Result: no violations (44px hit targets kept, `min-width: 0` on flex children, safe-area edges unchanged, one `innerWidth` read per open)

## 6. Docs

- [x] 6.1 `docs/ui-reference.md`:
  - rewrite the 5a paragraph: floating is the standalone app's only layout, `?layout` is ignored, and the docked description below applies to `Pixi.mount()` embeds
  - add the narrow-window defaults (`NARROW_MAX_WIDTH`, `applyOpenCardDefaults`), the card column's `--slot-cards-room`, and the bar/palette wrapping and scrolling
  - adjust the intro of the docked Workspace description so it reads as the embed layout
- [x] 6.2 `README.md` and any other docs under `docs/` that describe the Workspace layout or mention `?layout=floating`: update to the floating layout (search first, and skip if none)
  - No other docs mention the layout (README, CONTRIBUTING, docs/*.md checked)
- [x] 6.3 `openspec/roadmap.md`: mark the switch-on done when merged, and keep the docked-deletion remainder of 5h and the embed fix listed as next steps
