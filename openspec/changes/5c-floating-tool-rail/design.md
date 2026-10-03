## Context

See proposal.md for motivation and specs/floating-workspace/spec.md for
the required behaviour.

Current state that shapes the approach:

- `#tools-sidebar` is a flex column with `overflow-y: auto`. Its direct
  children, in DOM order, are:
  - the ten `.tool-button[data-tool]`s
  - `.fg-bg-swatches`
  - `#color-picker-popover` (`position: fixed`, so where it sits in the
    DOM doesn't matter)
  - `#rectangle-options`, `#square-constraint-options` and
    `#library-sequence-options`
  So the tool-scoped toggles currently sit *below* the swatches.
- 5a floats the rail with `.slot-tools`. Its width is
  `--slot-rail-width` (3.6rem) and its `max-height` ends at the bottom
  edge. The glass blur is on a `::before` layer.
- `measureClearInsets` reads the rail's real box, so a wider rail is
  picked up by Fit automatically. The Pencil/Eraser flyout's start is
  computed from `--slot-rail-width`.
- Tool buttons and `.icon-button` are `--icon-size-xl` (2.6rem, 41.6px).
  The swatch stack is 2.6rem square, with 1.7rem swatches and 1.05rem
  corner buttons.
- Tool selection goes through one click handler (`bindDomOnce`). Keyboard
  shortcuts call `button.click()`. Project open and embed restriction
  reset `.active` in a second loop (`workspace.js` ~line 2098).
- The tooltip (`bindTooltips`) picks a side by ancestor: top bar → below,
  right sidebar → left, else right. `openColorPicker` prefers the
  anchor's right side and flips only when there's no room.
- `lib/pixi.js` carries its own copy of the rail markup for embeds.

## Goals / Non-Goals

**Goals:**
- Every change is either scoped to `[data-layout="floating"]` or has no
  visible effect, so the docked layout looks the same.
- No hard-coded left/right for the rail's new behaviour, so 5g's
  handedness only swaps the slot variables.
- Keep the markup change minimal, because 5d removes the toggles from the
  rail and 5h deletes the docked CSS.

**Non-Goals:**
- Moving the tool-scoped toggles out of the rail (5d).
- Roving-tabindex / arrow-key navigation within the rail. Tab order stays
  as today.
- Changing the colour picker's contents or the swatch visuals beyond size.
- Handedness itself (5g). The "rail on the right" scenario is checked by
  overriding the slot variables by hand.

## Decisions

### 1. A scroll wrapper around the tool buttons only

Wrap the ten tool buttons in `<div class="tool-rail-tools">` in both
`index.html` and `lib/pixi.js`.

- **Docked layout:** `.tool-rail-tools { display: contents; }`, so
  layout, gaps and order are byte-for-byte the same.
- **Floating layout:**
  - The wrapper is a flex column with `overflow-y: auto`, `min-height: 0`
    and `flex: 0 1 auto`.
  - The rail itself becomes `overflow: visible` with `height: auto`. It
    keeps the existing `max-height`, so the wrapper is the only thing
    that shrinks.
  - The toggles get `order: 1` and `.fg-bg-swatches` gets `order: 2`, so
    the swatches render last without moving any markup.
- Existing selectors keep working: `.tools-sidebar [data-tool]` and
  `.tool-button[data-tool]` are descendant selectors, and no code uses a
  `.tools-sidebar >` child selector.
- **Alternative: `position: sticky; bottom: 0` on the swatches.** No
  markup change, but tools scrolling under the swatches would need a
  second glass surface on the swatch block, which shows as a visible
  band. It also leaves the toggles below the swatches. Rejected.
- **Alternative: moving the toggle divs above the swatches in the
  markup.** That changes their docked order. Rejected.
- **Side effect:** the rail no longer clips, so magnetic-hover scaling
  and the corner hit areas can't be cut off at the rail's edge. The
  wrapper still clips horizontally while it scrolls. That is fine,
  because the 44px buttons sit inside its padding.

### 2. Sizes: one new rail token, everything else derived

Under `[data-layout="floating"]`:

- Tool buttons use `--rail-button-size: 2.75rem` (44px).
- `--slot-rail-width` becomes `calc(var(--rail-button-size) + 2 * 0.5rem)`,
  which is 3.75rem.
- The swatch stack becomes 2.75rem square with 1.75rem swatches. The
  swatch faces are the same size as or bigger than docked, as the spec
  requires.
- The size scale (`icon-button-sizing`) is not changed. 44px is a
  floating-rail value, and 5h can promote it to the scale when the
  docked sizes go away.

### 3. Swap/Reset hit area: 24px minimum, not 44px

The user chose to keep the corner icons and enlarge the hit area.

- **Why not 44px:** the swatch pair is about 2.75rem wide. Two 44px
  corner areas plus two swatch faces can't fit in that width without
  covering a face, and the spec says a press on a face must always open
  the picker.
- **24×24px instead:** this is the WCAG 2.5.8 minimum. The icon keeps
  its 1.05rem drawn size. A transparent `::before` on each corner
  button, `inset: -0.2rem` or more, extends the hit area outward into
  the free corner squares and the rail's padding, never over a face.
- **Which control wins:** the corner buttons already stack above the
  swatches (`z-index: 1`), so where the areas meet, the corner wins. The
  area is sized so it only meets the face's outer border, not its fill.
- **Check:** verification measures it with `elementFromPoint` over a
  grid of points (task 4.2).
- **Alternative: a separate full-size Swap/Reset row.** This was offered
  and declined.

### 4. "Toward the canvas" from geometry, not from the DOM

Add a pure `canvasSide(anchorRect, viewportWidth)` to `js/layout.js`. It
returns `'end'` when the anchor's horizontal centre is in the left half
of the viewport, and `'start'` otherwise.

- The returned value is logical. The callers in this LTR app map it to
  right/left. The name keeps 5g/RTL from needing a second helper.
- **Tooltip:** `bindTooltips` gets a rail case. If the target is in
  `.tools-sidebar` and the screen is floating, it places the tooltip on
  `canvasSide`. A `'start'` result reuses the existing `.left-side`
  class and position math. The docked branch is untouched.
- **Colour picker:** `openColorPicker` chooses its preferred side from
  `canvasSide` when floating, and keeps its existing flip and clamp as
  the fallback. Its anchor becomes the rail's rect for the horizontal
  side, so the picker never covers the rail, and the swatch's rect for
  the vertical position.
- Unit tests cover `canvasSide` (left, right, centre, and a narrow
  viewport). The DOM placement is verified in the browser.
- **Alternative: read the slot CSS variables.** Rejected, because it
  reads intent rather than where the rail actually is, and breaks if the
  phone layout later re-places the rail by other means.

### 5. `aria-pressed` from one helper

Add a tiny `syncToolButtons(buttons, currentTool)` in a new
`js/tool-rail.js` that sets both `.active` and `aria-pressed`. It
replaces the two existing `.active` loops in `workspace.js` (the click
handler and the restriction reset).

- Shortcuts go through `.click()`, so they're covered.
- The initial `aria-pressed="false"` in markup avoids a moment where the
  buttons have no pressed state before the script runs.
- **Why a separate module:** the repo has no DOM test harness, and
  `workspace.js` reads `document` when it loads (see `lib/pixi.test.js`).
  A dependency-free module can be unit-tested in `test/tool-rail.test.js`
  with fake buttons (`classList.toggle`, `setAttribute`), the same way
  `topbar-menu.js` is tested. The tests check exactly one pressed
  button, a hidden or disabled current tool, and an unknown tool.

## Risks / Trade-offs

- **[A wider rail leaves less canvas]** The rail grows by 2.4px. Fit
  measures the real box, so the artwork never sits under the rail.
  → Negligible.
- **[Only 24px for Swap/Reset]** This is below Apple's 44pt guidance.
  → Accepted, as a consequence of keeping the corner design. If it
  proves fiddly on the iPad, 5d/5i can revisit it with the separate-row
  option. This is written down here so it isn't rediscovered as a bug.
- **[`display: contents` and accessibility]** Some older engines
  dropped `display: contents` elements from the accessibility tree. The
  wrapper is a plain `div` with no role, so nothing is lost. The buttons
  inside stay exposed.
- **[Overflow visible on the rail]** A future child that relied on the
  rail clipping it would spill. → Only the wrapper scrolls, and the
  picker is fixed. CSS tests assert that the rail has no `overflow`
  clipping only under floating.
- **[Embed markup drift]** `lib/pixi.js` must get the same wrapper.
  → A task to update both, and the embed tests must pass.

## Migration Plan

- Dev-only behind `?layout=floating`, except `aria-pressed`, which is
  invisible.
- Rollback is reverting the change.
- 5h folds the floating rail rules into the base CSS and drops the
  `display: contents` docked rule.
