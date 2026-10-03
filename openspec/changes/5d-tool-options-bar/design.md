## Context

See proposal.md for motivation and specs/floating-workspace/spec.md for
the required behaviour.

Current state that shapes the approach:

- **Who shows what today.** Each tool-scoped control is shown by its own
  code:
  - `applyToolScopedUI()` in `workspace.js` toggles `.hidden` on
    `#pencil-options` (Pencil/Eraser), `#square-constraint-options`
    (Rectangle/Select) and `#brushes-panel` (Brush).
  - `rectangle-fill-ui.js` toggles `#rectangle-options` (Rectangle).
  - `color-library-ui.js` toggles `#library-sequence-options`
    (Pencil/Brush).
  - `#pixel-perfect-toggle` and `#symmetry-toggle` are always visible in
    the top bar.
- **Where the state lives.**
  - On/off toggles keep their state in the button's `.active` class.
    Symmetry also keeps it in `data-symmetry-mode` and its label.
  - Size and Opacity are range inputs with `input` listeners and a text
    readout next to them.
  - Spacing and Rotation are number inputs with `change` listeners that
    clamp the value.
  - `initWorkspace()` resets Size, Spacing, Rotation and 1:1 by
    assigning `.value` or removing `.active` directly, with no event.
    That happens after `applyToolScopedUI()` runs.
- **What each control affects.**
  - Pixel-perfect only changes freehand strokes, so Pencil and Eraser
    (`strokeFreehand`, and `strokeFreehandThick` at size 1).
  - Symmetry wraps the Pencil, Eraser and Brush `applyPixel`.
  - That is where the per-tool table in the spec comes from.
- **The bottom of the screen today.** `.slot-options` is itself the
  glass card at the bottom centre. It holds `#palette-row`,
  `#selection-controls` and the hidden `.bottom-bar`.
  `measureClearInsets` measures `.slot-options` elements, and gives a
  card that is `display: none` a zero box.
- **Patterns from 5b and 5c to keep.**
  - New markup is `.floating-only`.
  - Controls forward to the existing control (`data-forward`), and
    state is read from the existing control, not stored a second time.
  - Show and hide is CSS-only.
  - Slot variables use logical insets.
  - A wrapper is `display: contents` in the docked layout.
  - `.glass` provides the card look.

## Goals / Non-Goals

**Goals:**
- One source of truth per setting: the existing control and its
  existing listener. The bar never applies a setting itself.
- One place that says which tool shows which control: `data-tools` on
  each bar group in the markup.
- Docked layout and embeds unchanged in look and behaviour.

**Non-Goals:**
- Moving the brush grid out of the right sidebar (5e).
- Moving selection Clear/Delete (5f).
- Removing the palette row or adding a Rainbow toggle (5i).
- Arrow-key roving focus inside the bar. Arrow keys belong to the
  sliders.
- Persisting Pixel-perfect or Symmetry per project. The known gap noted
  in `symmetry-ui.js` and `pixel-perfect-ui.js` stays as it is.
- Phone widths. That is a post-5h follow-up.

## Decisions

### 1. Proxies that forward, not relocated elements

The bar is new `.floating-only` markup inside `.slot-options`, with its
own buttons and range inputs. Each one points at its source control
with `data-forward="<id>"`. The sources stay where they are, hidden by
floating-only CSS.

- **Buttons** forward `click()` to the source, as the 5b menu items do.
- **Sliders** forward the value on each `input` event: set the source's
  `.value`, then dispatch the event its listener expects. That is
  `input` for Size and Opacity, and `change` for Spacing and Rotation.
  Dispatching `change` on every drag step applies Spacing and Rotation
  live, as the spec requires. The source's own clamping still runs.
- **Alternative: moving the real elements into the bar at boot (JS, in
  the floating layout only).** It has no sync problem, and every
  listener keeps working. Rejected for three reasons:
  - It breaks 5b's rule that nothing is created or moved by JS based on
    the layout.
  - It changes the DOM structure that 4d's structural `.ui-hidden`
    selectors and the per-panel `.hidden` toggles assume.
  - Spacing and Rotation would need their `type` switched from
    `number` to `range` at runtime.

  5h deletes the sources and can turn the proxies into the real
  controls then.

### 2. Mirroring state back: observe the sources

A new `js/tool-options-bar.js`, wired once from `app.js` in the floating
layout only, keeps the proxies matching their sources.

- **On/off and Symmetry.** A `MutationObserver` watches each source
  button's `class`, `aria-label` and `data-symmetry-mode` attributes.
  It copies these to the proxy:
  - `.active` as `aria-pressed`
  - the label, as `aria-label` and `data-tooltip`
  - the symmetry mode, as `data-symmetry-mode`

  So any code path that changes a toggle shows up in the bar. That
  includes the Rainbow swatch turning the library sequence off, and
  `initWorkspace()` clearing 1:1.
- **Slider values** can't be observed: a `.value` assignment fires no
  event and no mutation. The module re-reads every source value into its
  proxy, and recomputes the proxy readouts, whenever the current tool
  is recorded (decision 3).
  - `initWorkspace()` records the tool before it resets the slider
    values. The refresh therefore runs in the observer's microtask,
    which is after the synchronous `initWorkspace()` has finished.
  - A task checks this ordering in the browser. The fallback, if it
    proves fragile, is one explicit `refresh` call at the end of
    `initWorkspace()`.
  - While a proxy is being dragged, the source only changes through the
    proxy, so the two never disagree.
- **Readouts.** Size and Opacity proxies copy the source readout's text,
  so the format is defined in one place. Spacing and Rotation have no
  source readout. Their proxies format `${v}px` and `${v}°`, and set
  `aria-valuetext` to match.
- **Pure helpers, unit-tested** (`test/tool-options-bar.test.js`, with
  fake elements as in `tool-rail.test.js`):
  - `toolsShowing(groupToolsAttr)`, which parses `data-tools`
  - `forwardValue(proxy, source, eventType)`
  - `mirrorToggle(source, proxy)`

### 3. Show and hide: `data-current-tool` and CSS

- `applyToolScopedUI()` also sets
  `workspaceScreen.dataset.currentTool = state.currentTool`. This runs
  in both layouts and changes nothing on screen.
- Each bar group carries `data-tools="pencil eraser"` and so on. Groups
  are hidden by default. One CSS rule per tool that has options shows
  its groups:
  `[data-layout="floating"][data-current-tool="pencil"] .tool-options-group[data-tools~="pencil"]`.
  There are five such rules.
- The bar itself is hidden for the tools without options:
  `[data-current-tool]:not(:is([data-current-tool="pencil"], …))
  .tool-options-bar { display: none; }`.
  - **Alternative: a `:has()` rule** that hides the bar when no group is
    shown. Rejected, because it can't read which groups CSS has shown.
    It would have to repeat the same five tool selectors anyway.
  - A CSS test asserts that this list and the `data-tools` attributes
    together cover all ten tools, with no tool in both.
- **Why not reuse the sources' `.hidden` classes:** Pixel-perfect,
  Symmetry and Spacing/Rotation have no tool-scoped source panel, and
  three different modules toggle the panels that do exist. A single
  attribute keeps the per-tool table in one place (the markup).
- **Covered automatically:** Restricted tools and project open both go
  through `applyToolScopedUI()`. Keyboard shortcuts go through
  `.click()`, which goes through the click handler and then
  `applyToolScopedUI()`.

### 4. Bottom stack: a column of two cards

In the floating layout `.slot-options` stops being a card. It becomes a
transparent, centred flex column with `gap: var(--float-gap)`, at the
same bottom inset and max width as today. It holds:

1. `#tool-options-bar`, a `.glass` card (first in the DOM, so it is
   on top)
2. a new `<div class="options-card">` wrapping `#palette-row` and
   `#selection-controls`, with the card look applied by the floating
   selector

Other details:

- `.slot-options` is removed from the glass selector list and
  `.options-card` is added. In the docked layout `.options-card` is
  `display: contents`, so palette and selection controls keep their
  docked layout byte-for-byte. The same is done for 5c's tool wrapper.
- `align-items: center`, so each card is only as wide as its contents.
- **Fit:** `measureClearInsets` still measures `.slot-options`. Its box
  now spans both cards when the bar is shown, and only the palette card
  when the bar is `display: none`. So Fit at project open uses whatever
  is visible then. Later tool switches don't re-fit, as the existing
  requirement says.
- `.slot-options` must not swallow pointer input in the gap between the
  cards. Use `pointer-events: none` on the column and `auto` on its
  children.
- **Alternative: position the bar on its own,** with a `bottom` offset
  equal to the palette card's height. Rejected, because that height
  changes when selection controls appear. It would need JS measuring,
  or a magic number.

### 5. Bar contents and styling

- **Groups, in order:**
  - size/opacity (`pencil eraser`)
  - spacing/rotation (`brush`)
  - Filled (`rectangle`)
  - 1:1 (`rectangle selection`)
  - Pixel-perfect (`pencil eraser`)
  - Symmetry (`pencil eraser brush`)
  - library sequence (`pencil brush`)

  This gives the order in the spec table for every tool.
- **Sliders.** A label (`Size`), a horizontal range of about 7rem, and
  a fixed-width readout. The track's hit box is 44px tall, with a
  visual track of about 4px. They reuse `bindSliderWheel` for Size and
  Opacity, exported from `workspace.js` already. They have no wheel
  binding for Spacing/Rotation, because today's number fields have none
  either.
- **Buttons** are 44×44 (`--rail-button-size`) icon buttons with
  `data-tooltip`. They copy the source icons:
  - Filled uses the two inline SVGs, swapped by `[aria-pressed]`.
  - 1:1 uses its text label.
  - Pixel-perfect, Symmetry and Color Library sequence use their
    Material Symbols.
- **Symmetry's mode marker.** The `::after` rules keyed on
  `#symmetry-toggle[data-symmetry-mode]` are widened to
  `:is(#symmetry-toggle, .tool-options-symmetry)` so both draw it.
- **Tooltips.** `bindTooltips` gets a case: a target inside
  `.tool-options-bar` puts its tooltip above, and the existing clamping
  keeps it on screen.
- **Accessibility.** The bar is `role="group"` with
  `aria-label="Tool options"`. Sliders have `aria-label` and
  `aria-valuetext`, and buttons have `aria-pressed`. A toolbar role is
  not used, because it implies arrow-key navigation, which the sliders
  need for themselves.

### 6. Hiding the moved sources

Floating-only `display: none` on:

- `#pencil-options`, which also leaves the floating glass selector
  list. The docked `.ui-hidden` rule for it stays.
- `#rectangle-options`, `#square-constraint-options` and
  `#library-sequence-options` in the rail
- `#pixel-perfect-toggle` and `#symmetry-toggle`
- the two Spacing/Rotation `.brushes-panel-row`s, which get a
  `.brush-stroke-settings` class to target them

The source modules keep toggling `.hidden` on these. That has no effect
under `display: none` and stays harmless.

The 5c rail CSS gave the toggles `order: 1`. Those rules become dead in
floating and are removed. `--slot-tools-flyout-*` existed only for
`#pencil-options` and is removed too.

## Risks / Trade-offs

- **[Two copies of each control until 5h]** A future change to a source
  control's markup (for example a new range) would not reach the proxy.
  → Ranges are copied from the source's `min`, `max` and `step` at boot
  rather than hard-coded in the proxy markup. Each proxy carries a
  comment naming its source, for 5h.
- **[Microtask ordering for the value refresh]** See decision 2.
  → It is verified in the browser, and the fallback is named.
- **[`dispatchEvent('change')` per drag step]** Spacing/Rotation
  handlers are cheap: a clamp and a state assignment. → Negligible.
- **[Bar width on narrow tablets]** Pencil's bar has two ~11rem slider
  groups and three 44px buttons, about 31rem. That fits iPad portrait
  (768px) inside the column's max width. → The column already
  has `max-width`, and the bar is allowed to wrap onto a second row
  rather than overflow. Phone widths are out of scope.
- **[Empty `options-card` when the palette is removed in 5i]** → 5i
  deletes the wrapper with the row.

## Migration Plan

- Dev-only behind `?layout=floating`. The only change visible outside it
  is the `data-current-tool` attribute.
- Rollback is reverting the change.
- 5h deletes the source controls, makes the proxies the real controls,
  and updates `brushes`, `symmetry-drawing` and the other specs to name
  the bar.
