## 1. Pure helpers (TDD)

- [x] 1.1 Add `canvasSide(anchorRect, viewportWidth)` to `js/layout.js`: returns `'end'` when the anchor's horizontal centre is in the left half of the viewport, else `'start'`. Write the tests first in `test/layout.test.js` (rail at left, rail at right, anchor exactly centred, narrow viewport)
- [x] 1.2 New `js/tool-rail.js` with `syncToolButtons(buttons, currentTool)`, which sets `.active` and `aria-pressed` on every button. Write the tests first in `test/tool-rail.test.js` with fake buttons: exactly one pressed, all pressed=false for an unknown tool, and a disabled/hidden button never pressed while another is current

## 2. Markup

- [x] 2.1 `index.html`: wrap the ten `.tool-button[data-tool]`s in `<div class="tool-rail-tools">` and add `aria-pressed="false"` to each
- [x] 2.2 Make the same change in `lib/pixi.js`'s rail template, and confirm `lib/pixi.test.js` still passes

## 3. CSS

- [x] 3.1 Docked: `.tool-rail-tools { display: contents; }` and nothing else, so the docked layout is unchanged
- [x] 3.2 Floating rail (`[data-layout="floating"]` only):
  - add `--rail-button-size: 2.75rem` and derive `--slot-rail-width` from it
  - rail: `height: auto`, keep the `max-height`, `overflow: visible`
  - `.tool-rail-tools`: a flex column that scrolls (`overflow-y: auto`, `min-height: 0`, `flex: 0 1 auto`)
  - tool buttons at `--rail-button-size`
  - the tool-scoped toggle groups get `order: 1`, and `.fg-bg-swatches` gets `order: 2`
- [x] 3.3 Floating swatches: the stack is 2.75rem square with 1.75rem swatches. Each `.fg-bg-corner-button::before` is a transparent hit area of at least 24×24px that extends into the free corner and the rail padding, never over a swatch face. The drawn icons keep their size
- [x] 3.4 Extend `test/floating-layout-css.test.js`:
  - the new rail, scroller, order and corner-hit-area rules exist only under `[data-layout="floating"]`
  - outside it, the only `.tool-rail-tools` rule is `display: contents`
  - the floating `.slot-tools` has no clipping `overflow`

## 4. Wiring

- [x] 4.1 `js/workspace.js`: replace the two `.active` loops (tool click handler and the restricted-tools reset) with `syncToolButtons`
- [x] 4.2 `bindTooltips`: when the target is inside `.tools-sidebar` and the screen is floating, place the tooltip on `canvasSide` of the rail. `'start'` reuses `.left-side` and its position math. Leave the docked branches untouched
- [x] 4.3 `openColorPicker`: when floating, use `canvasSide` of the rail's rect to pick the side, place the picker horizontally beyond the rail's edge (not the swatch's), and keep the existing flip and viewport clamp as the fallback

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 Serve locally with `?layout=floating` at 1180×820 and 1024×768:
  - the rail starts under the top bar and hugs its contents
  - the Rectangle tool shows Filled and 1:1 above the swatches
  - the tool buttons measure ≥44px
  - the Pencil/Eraser flyout sits beside the wider rail
  - Fit keeps the artwork clear of the rail
- [x] 5.3 Short window (e.g. 1180×520): only the tools scroll, and the swatches, Swap and Reset stay visible and work
- [x] 5.4 Corner hit areas: probe a grid with `elementFromPoint`. Swap and Reset each have a ≥24×24px area, and every point on each swatch face hits the swatch
- [x] 5.5 Toward the canvas:
  - rail on the left: the tooltip and colour picker open to the right of the rail without covering it
  - set `--slot-tools-start: auto; --slot-tools-end: var(--float-edge-end)` by hand to put the rail on the right: both open to the left, fully on screen
- [x] 5.6 Selected tool: click a tool, press a shortcut, and open another project. Exactly one tool button has `aria-pressed="true"` each time
- [x] 5.7 Without the parameter: the docked rail, swatches, tooltips and colour picker look and behave as before
- [x] 5.8 Run `web-design-guidelines` on the changed markup/CSS/JS before code review
- [x] 5.9 Update `docs/ui-reference.md`'s floating-layout paragraph to describe the rail and its swatch foot
