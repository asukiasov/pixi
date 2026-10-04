## Context

See proposal.md for motivation and specs/floating-workspace/spec.md for
the required behaviour. The visible choices were settled with the user
before writing this:

- one column with shared height
- a vertical mini-rail at the right edge
- open/closed only, no collapse-to-header
- Brushes follows the Brush tool and can be closed
- Colors and Layers open, reset on every project open
- card and rail order Colors, Brushes, Layers
- the right-sidebar toggle removed with no replacement

Current state that shapes the approach:

- **One sidebar element.** `#right-sidebar` (`.right-sidebar
  .slot-panels`, an `<aside>` inside `.workspace-body`) holds, in DOM
  order:
  - `#color-library-panel`
  - `#import-preview-row` and `#ramp-preview-row`, which are
    `position: fixed` popovers, siblings of the sections and not inside
    one
  - `#brushes-panel`, which holds the grid, the add/delete toolbar, the
    in-flow `#brush-editor-panel`, and 5d's hidden
    `.brush-stroke-settings` rows
  - `#layers-panel`

  In the floating layout the whole aside is one `.glass` card, 15rem
  wide, starting below the top bar.
- **Who owns each panel's open state.**
  - Color Library: `collapsed` in `color-library-ui.js`, toggled by
    clicking `#color-library-header` (`role="button"`, via
    `bindPanelHeaderCollapse`). It sets `.collapsed` on the panel and
    `aria-expanded` on the header. Reset to expanded on project open.
  - Layers: `layersPanelVisible` in `layers-ui.js`, toggled by either
    `#layers-panel-toggle` (top bar) or the header. It sets
    `.collapsed`, `aria-expanded`, and `.active` on the toggle. Reset to
    open on project open.
  - Brushes: no user state. `applyToolScopedUI()` toggles `.hidden`
    (`display: none !important`) when the tool isn't Brush, and calls
    `closeBrushEditor()` when leaving Brush.
- **`bindPanelHeaderCollapse` ignores clicks whose target is inside a
  `button`, `select` or `input`.** A button placed in a header does not
  collapse the panel by bubbling.
- **Whole-sidebar toggle.** `setRightSidebarVisible()` sets
  `.right-sidebar-collapsed` and `inert` on the aside.
  `state.rightSidebarVisible` resets to `true` in `initWorkspace()`. The
  floating CSS fades the aside with `visibility`/`opacity`, which is the
  hiding style `measureClearInsets` expects.
- **Fit.** `measureClearInsets` measures every `.slot-<name>` element. A
  `panels` box counts toward whichever side its centre is on, and the
  largest reach wins. Zero-size boxes are skipped.
- **Layer opacity popover** closes on any outside `pointerdown`, but not
  on keyboard activation elsewhere.
- **Tooltips.** `bindTooltips` already sends targets inside
  `.right-sidebar` to the left (`.left-side`), and places tooltips for
  5c's floating `.tools-sidebar` with `canvasSide()`.
- **Patterns from 5b–5d to keep.**
  - New markup is `.floating-only`.
  - Controls forward to the existing control (`data-forward`), and
    state is read back from the source rather than stored a second time.
  - Show and hide is CSS-driven.
  - Slots use logical insets via variables.
  - `.glass` look comes by selector.
  - Wrappers are `display: contents` in the docked layout where needed.

## Goals / Non-Goals

**Goals:**
- One source of truth per card's open state: the existing Color Library
  and Layers collapse state, plus one new flag for Brushes.
- Card show/hide and stacking entirely in CSS. No height measuring.
- The `panels` slot stays mirrorable by swapping variable pairs (5g).
- Docked layout and embeds unchanged in look and behaviour.

**Non-Goals:**
- Remembering open cards, pinning, contextual auto-open, handedness
  (5g).
- Dragging, resizing or reordering cards.
- Changing what any panel contains, apart from 5d's already-hidden
  Spacing/Rotation rows.
- Removing the docked collapse-to-header behaviour or the docked toggles
  (5h).
- Phone widths.

## Decisions

### 1. Keep one `#right-sidebar`, make it a see-through column of cards

In the floating layout `#right-sidebar` stops being the card and
becomes a transparent flex column. It works like 5d's `.slot-options`:
`gap: var(--float-gap)`, `pointer-events: none` on the column and
`auto` on its children. Each of the three sections becomes a `.glass`
card by selector. The column's `max-height` runs from below the top bar
to the bottom edge, as the aside's does today.

- **Shared height without measuring.**
  - Every card is a flex column with `flex: 0 1 auto` and
    `overflow: hidden`. Its header is `flex: none`, and its body
    scrolls (`min-height: 0; overflow-y: auto`).
  - A floor of one header height (`min-height` on the card) keeps
    every header visible.
  - When the column hits its `max-height`, flex shrink takes height
    from each card in proportion to its size. The tallest (usually
    Layers) gives the most.
  - The docked fixed caps (`.color-library-panel`'s
    `clamp(200px, 30vh, 250px)`, `.brushes-panel`'s `max-height: 35%`)
    are overridden in floating. Colors keeps a `max-height` cap so it
    can't push Layers off on a tall palette. Brushes' 35% was a share
    of a full-height sidebar and means nothing in an auto-height
    column.
- **Fit.** The column keeps `.slot-panels`. Its box spans the open
  cards, so `measureClearInsets` reaches to the left edge of the
  widest card. With every card closed the column has no height and is
  skipped, so Fit reaches to the mini-rail instead (decision 2). The
  fixed popovers inside the column don't add to its box.
- **Docked:** no rule changes. The new floating rules are all under
  `[data-layout="floating"]`.
- **Alternative: split `.slot-panels` into three positioned per-card
  slots.** Rejected:
  - Stacking independent absolutely-positioned cards needs each card's
    `top` to depend on the heights above it. That means JS measuring
    and re-measuring on every layer add, palette change and brush
    editor open. 5d rejected the same thing for the bottom stack.
  - It would also mean moving the sections out of the aside, breaking
    4d's structural `.ui-hidden` selectors and the `inert` wiring.
- **Alternative: keep one glass card with dividers between sections.**
  Rejected, because the spec requires a separate card per panel so a
  closed panel leaves no trace.

### 2. Mini-rail: a sibling element in the `panels` slot

New `.floating-only` markup, `<nav id="panel-rail" class="panel-rail
slot-panels" aria-label="Panels">`, sits inside `.workspace-body` just
before `#right-sidebar`. It holds three 44px buttons in DOM and visual
order: Colors, Brushes, Layers.

- **Placement variables.** The rail uses the existing
  `--slot-panels-start/end` (against the end edge). The column gets a
  new pair, `--slot-cards-start: auto` and `--slot-cards-end:
  calc(var(--float-edge-end) + var(--slot-rail-width) +
  var(--float-gap))`.
  - Both start just below the top bar, at `--float-below-top`.
  - The rail is `--slot-rail-width` wide, reusing 5c's token, and
    hugs its three buttons.
  - 5g's handedness flip swaps both start/end pairs and nothing else.
- **Why a sibling and not inside the aside:**
  - `setRightSidebarVisible` sets `inert` on the aside, so a rail
    inside it would be disabled along with it.
  - The aside must stay a single column for decision 1.
  - As a direct child of `.workspace-body` the rail is already
    covered by 4d's `.workspace-body > :not(.workspace-main)`
    hide-interface rule. No new `.ui-hidden` selector is needed.
- **Tab order.** Rail first, then the cards, so a keyboard user reaches
  the icon, then the card it opened.
- **Alternative: a horizontal strip on top of the column, or icons at
  the top bar's end.** The user chose the vertical rail.

### 3. Open/closed is the existing collapsed state

In the floating layout `.collapsed` on a card means closed:
`display: none` for the whole card, instead of the docked
"shrink to header".

- **Colors.** The rail button and the card's close button forward a
  `click()` to `#color-library-header`. The click's target is the
  header itself, so `bindPanelHeaderCollapse`'s button filter lets it
  through.
- **Layers.** Both forward a `click()` to the (now hidden)
  `#layers-panel-toggle`, as 5b's menu items do.
- **Brushes** has no existing state, so it gets the one new flag.
  - `export function setBrushesCardOpen(open)` in `workspace.js`, next
    to `brushesPanel` and `closeBrushEditor`, toggles `.collapsed` on
    `#brushes-panel`, and calls `closeBrushEditor()` when closing.
  - `initWorkspace()` calls `setBrushesCardOpen(true)` beside its other
    per-open resets.
  - The flag is independent of the tool's `.hidden`. The card shows
    only when neither class is set, so `applyToolScopedUI()` is
    untouched and the "stays closed across tool switches" rule falls
    out for free.
  - Nothing in the docked layout ever calls `setBrushesCardOpen(false)`,
    and docked CSS has no `.brushes-panel.collapsed` rule, so the docked
    layout is unchanged.
- **Defaults.** Colors and Layers already reset to open on project
  open, and Brushes now does too. That meets "Panel cards on project
  open" with no new reset code, apart from the Brushes call.
- **Alternative: a new `data-open-cards` attribute on the workspace
  screen, owned by the rail module, with CSS showing cards from it.**
  Rejected. It would be a second copy of the Colors and Layers state
  that the docked headers and the Layers toggle also write, so the two
  would drift.
- **Alternative: keep collapse-to-header and add a separate close
  state.** The user chose open/closed only.

### 4. Card close buttons, and the header's own click

Each card header gets a `.floating-only` 44px close button
(`.panel-close`, `aria-label="Close Color Library"` and so on).

- **Placement.**
  - For Colors and Layers it goes in `.panel-header-top`, after the
    chevron.
  - For Brushes it goes in `.brushes-panel-header`.
  - The chevron is `display: none` in floating.
- **Behaviour.** Each close button forwards as in decision 3, then
  moves focus to its rail button, because the close button is about to
  disappear. The click is left to bubble: the header ignores clicks on
  buttons, and the document-level listener that hides tooltips must
  see it, or the rail button's tooltip stays on screen (found in code
  review).
- **The header's own click is turned off in floating.**
  - `pointer-events: none` on `.panel-header` in the floating column,
    and `auto` on the buttons and selects inside it. A tap on the
    title area then hits nothing.
  - `panel-rail.js` sets `tabindex="-1"` on the two `role="button"`
    headers at init (floating only), so the close button is the one
    keyboard stop for closing.
  - **Alternative: let the whole header close the card.** Rejected. It
    is a large accidental-close target on iPad, and with the chevron
    gone nothing signals it.

### 5. Mirroring state back to the rail

New `js/panel-rail.js`, wired once from `app.js` in the floating layout
only, the same way as `initToolOptionsBar()`.

- One `MutationObserver` per card watches its `class`, and calls a pure
  helper `panelRailState(cardClassList)` that returns
  `{ expanded, unavailable }`:
  - `expanded = !collapsed && !hidden`
  - `unavailable = hidden`, which only Brushes ever is
- The button gets `aria-expanded`, plus `aria-disabled="true"` and a
  tooltip/label of "Brushes (Brush tool)" while unavailable.
  - A click on an `aria-disabled` button is a no-op.
  - `aria-disabled` rather than `disabled` keeps it focusable and
    hoverable, so the explanation can be read (spec).
- Because the observer watches the card, every way the state can
  change shows up on the rail: the rail itself, the close button, the
  docked-only paths, project-open resets, and tool switches.
- **ARIA.** Disclosure buttons (`aria-expanded` + `aria-controls`), not
  `aria-pressed`. They show and hide a region, which is what the
  disclosure pattern is for. 5d's toggles were modes. The pressed look
  is styled from `[aria-expanded="true"]`.
- **Pure helpers, unit-tested** (`test/panel-rail.test.js`, fake
  elements):
  - `panelRailState(classList)`
  - `applyPanelRailState(button, state, labels)`, which sets
    `aria-expanded`, `aria-disabled`, `aria-label` and `data-tooltip`

### 6. Closing a card closes what was opened from it

Floating only, in `panel-rail.js`. When the observer sees a card go
from open to closed:

- **Colors:** if `#import-preview-row` or `#ramp-preview-row` is shown,
  click its Cancel button. That is the existing cancel path, so nothing
  is saved.
- **Layers:** call `closeLayersOpacityPopover()`, newly exported from
  `layers-ui.js`. The outside-`pointerdown` close already covers
  pointer use, but not keyboard activation of a close button.
- **Brushes:** `setBrushesCardOpen(false)` already closes the editor.

The ramp preview can also be opened from the colour picker in the
tool rail. It is cancelled anyway, because it previews colours for the
palette shown in the Colors card and is anchored there. Docked collapse
keeps today's behaviour, because these hooks live only in the
floating-only module.

### 7. Top bar and the right-sidebar state

- **Hidden in floating:** `#layers-panel-toggle` and
  `#right-sidebar-toggle` get floating-only `display: none`, so the top
  bar matches the spec.
- **`#layers-panel-toggle` stays as the forward target** for Layers,
  like 5b's hidden buttons.
- **`setRightSidebarVisible` is untouched.** In floating nothing can
  call it with `false`, so the aside stays visible and non-inert. The
  floating `.right-sidebar-collapsed` rule stays as it is. It is dead in
  practice, but keeps `measureClearInsets`' "visibility, not display"
  contract written down until 5h deletes the toggle.

### 8. Glass selector, tooltips

- **Glass selector lists:** `.slot-panels` is removed and replaced with
  `.panel-rail` and `#right-sidebar > :is(.color-library-panel,
  .brushes-panel, .layers-panel)`. Each card gets `position: relative`
  for the `::before` blur layer. Because the blur lives on `::before`,
  the fixed popovers nested in the column are still positioned against
  the viewport (5a).
- **`bindTooltips`:** the `floatingRail` lookup widens from
  `.tools-sidebar` to `:is(.tools-sidebar, .panel-rail)`. The rail's
  tooltips then open toward the canvas via `canvasSide()`, which also
  handles 5g's mirror. Card header buttons are inside `.right-sidebar`
  and keep their existing left-side placement.

### 9. The column stops above the bottom cards (added during build)

Browser verification found that the default cards overlap the bottom
stack, not only on narrow tablets. At 1180×820 with the Brush tool
(Colors, Brushes and Layers open, one layer), the Layers card reached
y 773, and the tool-options bar and palette card start at y 700 and
span under the column. That breaks "Tool-options bar sits above the
palette card".

- `panel-rail.js` runs a `ResizeObserver` on `.slot-options` and the
  workspace screen. It sets `--slot-options-reach` on the screen to the
  distance from the bottom cards' top edge to the screen bottom, or
  `0px` when they don't overlap the column horizontally. The pure
  helper is `optionsReach(optionsRect, columnRect, screenRect)`, and it
  is unit-tested.
- The column's `max-height` subtracts
  `max(--float-edge-bottom, --slot-options-reach + --float-gap)`. The
  shared-height shrink (decision 1) then fits the cards above the
  bottom stack.
- Only the column's horizontal extent is read, so its own height never
  feeds back. Fit reads the column's left edge, not its height, so the
  canvas is unaffected.
- **Alternative: a fixed estimated reserve** (the original fallback in
  this design). Rejected, because the bottom stack's height varies with
  the tool, the bar wrapping onto two rows, and the selection controls.
  A fixed number would either waste space or still overlap.
- **Alternative: narrowing the options slot to avoid the column.**
  Rejected, because both the bar and the palette would wrap at 1180px.

This is the one place 5e measures. Decision 1's "no measuring" was
about stacking the cards, which stays pure CSS.

## Risks / Trade-offs

- **[Bottom cards and panel cards overlap]** Resolved by decision 9.
  → Verified at 1180×820 and 768×1024, with default contents and with
  every card open plus the brush editor and 8 layers.
- **[Third hidden state on Brushes]** `.hidden` (tool) and `.collapsed`
  (user) together could confuse a future reader. → A comment at
  `setBrushesCardOpen` explains the two, and the spec scenarios cover
  both orders.
- **[`tabindex` change from JS in floating]** It breaks 5b's "no
  layout-dependent DOM changes" rule in a small way. → The only
  alternative that keeps one keyboard stop is a docked-visible markup
  change. Two stops for one action is worse. It is applied in the
  floating-only module, and 5h removes the header `role="button"`
  anyway.
- **[Closing Colors cancels a ramp preview opened from the picker]**
  → Intended (decision 6). Noted in the spec's list.
- **[Flex shrink proportional to size]** A short Brushes card next to
  a very long Layers list barely shrinks, which is what we want. A
  long palette shrinks Colors, which then scrolls. → The Colors
  `max-height` cap limits how much it can take first.

## Migration Plan

- Dev-only behind `?layout=floating`. Outside it, the only change is
  the never-set `.collapsed` capability on `#brushes-panel` and the new
  `setBrushesCardOpen(true)` call on project open, which is a no-op
  there.
- Rollback is reverting the change.
- 5h deletes the docked sidebar CSS, the top bar toggles and
  collapse-to-header, and updates `layers`, `color-library` and
  `brushes` to describe the cards.
