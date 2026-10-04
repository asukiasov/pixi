## 1. Pure helpers (TDD)

- [x] 1.1 New `js/panel-rail.js` with `panelRailState(classList)` returning `{ expanded, unavailable }` (design decision 5). Write the tests first in `test/panel-rail.test.js` with fake class lists: open, `.collapsed`, `.hidden`, and both `.hidden` and `.collapsed`
- [x] 1.2 `applyPanelRailState(button, state, labels)`: sets `aria-expanded`, sets or removes `aria-disabled="true"`, and switches `aria-label`/`data-tooltip` between the normal and unavailable labels. Tests with fake elements: expanded, closed, unavailable, and unavailable then available again (attribute removed, label restored)
- [x] 1.3 `test/layout.test.js`: `clearInsets` with two `panels` boxes on the right (rail against the edge, card column beside it) reaches to the column's left edge. With a zero-height column it reaches to the rail's left edge

## 2. Markup

- [x] 2.1 `index.html`: inside `.workspace-body`, just before `#right-sidebar`, add `<nav id="panel-rail" class="panel-rail slot-panels floating-only" aria-label="Panels">` with three 44px `tool-button icon-button` buttons: Colors (`aria-controls="color-library-panel"`, forwards to `color-library-header`), Brushes (`aria-controls="brushes-panel"`), Layers (`aria-controls="layers-panel"`, forwards to `layers-panel-toggle`). Each has `aria-expanded`, `data-tooltip` and a Material Symbol. Add a comment naming each source, for 5h
- [x] 2.2 Add a `.floating-only` `.panel-close` button (Material Symbol `close`, `aria-label="Close Color Library"` / `"Close Brushes"` / `"Close Layers"`) in `#color-library-header .panel-header-top` and `#layers-panel-header .panel-header-top` after the chevron, and in `.brushes-panel-header`
- [x] 2.3 Update the `#right-sidebar` order comment and the `#right-sidebar-toggle` / `#layers-panel-toggle` comments to note their floating-layout replacements
- [x] 2.4 Confirm `lib/pixi.js` needs no change (embed is always docked, and `panel-rail.js` is never wired there), and that `lib/pixi.test.js` still passes. The pre-existing `#record-toggle` embed crash is a separate bug fix and is not part of 5e

## 3. CSS

- [x] 3.1 Slot variables: add `--slot-cards-start: auto` and `--slot-cards-end: calc(var(--float-edge-end) + var(--slot-rail-width) + var(--float-gap))` next to `--slot-panels-*`. Use logical insets only
- [x] 3.2 `.panel-rail`: positioned at `--float-below-top` with `--slot-panels-start/end`, `--slot-rail-width` wide, hugging its buttons (vertical flex, rail padding as 5c). Buttons are `--rail-button-size` square, and the open look is styled from `[aria-expanded="true"]` with the same accent as an active tool. `[aria-disabled="true"]` uses the existing disabled look
- [x] 3.3 `#right-sidebar` in floating: re-point the existing `.slot-panels` position rule to the column with `--slot-cards-start/end`. Make it a transparent flex column with `gap: var(--float-gap)`, `pointer-events: none` (children `auto`), no own background/border/shadow, and the same `max-height` and 15rem width as today
- [x] 3.4 Glass selector lists: remove `.slot-panels`, add `.panel-rail` and `#right-sidebar > :is(.color-library-panel, .brushes-panel, .layers-panel)`. Give the three cards `position: relative`. Drop the docked borders between sections inside floating cards
- [x] 3.5 Card sizing (design decision 1): each card is a flex column, `flex: 0 1 auto`, `overflow: hidden`, with `min-height` equal to its header. Header `flex: none`, and the body/grid/list area `min-height: 0; overflow-y: auto`. Override the docked `.brushes-panel { max-height: 35% }` and `.layers-panel { flex: 1 1 auto }` in floating, and give Colors a floating `max-height` cap
- [x] 3.6 Closed cards: floating `.collapsed` on the three cards is `display: none`. Hide `.panel-collapse-chevron` in floating. Set `pointer-events: none` on `.panel-header` inside the column, with `auto` on its `button`, `select` and `input` descendants. The `.panel-close` buttons are `--rail-button-size` square
- [x] 3.7 Floating-only `display: none` on `#layers-panel-toggle` and `#right-sidebar-toggle`
- [x] 3.8 Extend `test/floating-layout-css.test.js`:
  - every new rail, column, card, `.collapsed` and toggle-hiding rule is scoped to `[data-layout="floating"]`
  - outside it there is no rule for `.panel-rail`, `.panel-close` or `.brushes-panel.collapsed`
  - the glass lists no longer name `.slot-panels`
  - the rail and the column positions use only `inset-inline-*`

## 4. Wiring

- [x] 4.1 `js/workspace.js`: `export function setBrushesCardOpen(open)` toggles `.collapsed` on `#brushes-panel` and calls `closeBrushEditor()` when closing. Add a comment on `.hidden` (tool) vs `.collapsed` (user). Call `setBrushesCardOpen(true)` in `initWorkspace()` next to `renderBrushesPanel()`
- [x] 4.2 `js/layers-ui.js`: export `closeLayersOpacityPopover()`
- [x] 4.3 `initPanelRail(root)` in `js/panel-rail.js` (null-safe, no-op without `#panel-rail`):
  - Colors and Layers rail buttons and their `.panel-close` buttons forward `click()` (`#color-library-header` / `#layers-panel-toggle`). Close buttons let the click bubble (the header ignores button targets; the tooltip-hiding document listener needs it)
  - the Brushes rail button calls `setBrushesCardOpen(!open)` unless `aria-disabled`, and the Brushes close button calls `setBrushesCardOpen(false)`
  - after a close-button activation, focus the matching rail button
  - one `MutationObserver` per card on `class` → `panelRailState` → `applyPanelRailState`, run once at init
  - set `tabindex="-1"` on `#color-library-header` and `#layers-panel-header`
- [x] 4.4 In the same observer, on an open → closed transition: Colors clicks `#import-preview-cancel` / `#ramp-preview-cancel` if their popover is shown, and Layers calls `closeLayersOpacityPopover()` (design decision 6)
- [x] 4.5 `js/app.js`: call `initPanelRail()` next to `initToolOptionsBar()`, only when `layout === 'floating'`
- [x] 4.6 `bindTooltips`: widen the floating rail lookup to `:is(.tools-sidebar, .panel-rail)` so mini-rail tooltips open toward the canvas via `canvasSide()`. Docked branches untouched

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 Serve locally with `?layout=floating` at 1180×820 and 768×1024. On project open: top bar is Back, title, zoom pill, Undo, Redo, More. The mini-rail shows Colors, Brushes, Layers against the right edge below the top bar. Colors and Layers cards are open beside it, in that order. Fit keeps the artwork clear of the rail and cards
- [x] 5.3 Open and close each card from the rail and from its × in every order. The rail shows the right state each time, the remaining cards close up in order, and the artwork never moves or re-fits. Tapping a card's title does not close it. The gaps between cards pass pointer input to the canvas
- [x] 5.4 Brushes:
  - Brush tool shows the card between Colors and Layers, with no Spacing/Rotation rows
  - close it, then Pencil → Brush: it stays closed
  - reopen it from the rail
  - with Pencil active, the Brushes button is unavailable, says "Brush tool", and does nothing when pressed
  - with the brush editor open, closing the card or switching tool closes the editor
- [x] 5.5 Tall stack: Colors, Brushes and Layers all open with about 15 layers at both sizes. The column stops above the bottom edge, every header is visible, and the Layers list scrolls within its card. At 768×1024 with a few layers and the Brush tool, the bottom bar and palette card don't overlap the rail or cards. If they do, apply the design's narrow-width reserve and note it in design.md
  - They did overlap, already at 1180×820 with the default cards and the Brush tool (Layers reached y 773, bottom stack from y 700). Fixed with a measured reserve instead of the estimate (design decision 9, `optionsReach` + `--slot-options-reach`). Re-verified at both sizes, with default contents and with every card open plus the brush editor and 8 layers: the column ends at y 692 (1180×820) and y 896 (768×1024), above the bottom stack
- [x] 5.6 Popovers: the palette import and ramp previews and the layer opacity popover open fully on screen, not clipped by a card. Closing Colors (by pointer and by keyboard) with the import or ramp preview open cancels it, and no palette is saved. Closing Layers by keyboard with the opacity popover open closes it
- [x] 5.7 Project open resets: close Colors, Layers and Brushes, then open another project. All three are open again. Reload: same
- [x] 5.8 Accessibility:
  - rail is a labelled nav, and buttons announce their name and expanded state
  - Brushes reports unavailable but stays focusable
  - close buttons are named "Close <panel>", and closing from × moves focus to the rail button
  - one keyboard stop per close action (headers are not tab stops)
  - rail and × buttons are ≥44px
  - rail tooltips open toward the canvas and stay on screen
  - tab order is rail, then cards
- [x] 5.9 Hide interface (Tab): rail and cards hide, and come back in the same open/closed state
- [x] 5.10 Without the parameter: the docked layout looks and behaves exactly as before. That includes the top bar Layers and right-sidebar toggles, collapse-to-header on Colors and Layers, and Brushes showing only for the Brush tool. Pixel-compare against `main` at 1180×820 for Pencil and Brush, with Layers collapsed and the sidebar hidden. `lib/pixi.js` is unchanged (the embed's pre-existing mount crash is tracked separately)
- [x] 5.11 Run `web-design-guidelines` on the changed markup/CSS/JS before code review
- [x] 5.12 Update `docs/ui-reference.md`: add a floating cards and mini-rail paragraph, and adjust the 5a paragraph (`.slot-panels` is now the rail and the card column) and the 5b paragraph (no Layers or right-sidebar toggle in the floating top bar)
