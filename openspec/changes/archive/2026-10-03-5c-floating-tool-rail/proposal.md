## Why

Since 5a the tool rail floats as a card, but it is still the docked
sidebar inside a glass shape. On the iPad it is built for, three things
get in the way:

- Tool buttons are 41.6px, under the 44px touch minimum. The Swap and
  Reset corner buttons on the colour swatches are about 17px, too small
  to hit reliably with a finger or the Pencil.
- On a short screen the whole rail scrolls, so the colour swatches can
  scroll out of sight.
- Tooltips and the colour picker always open to the physical right. 5g's
  handedness setting will mirror the rail to the right edge, and they
  would then open off screen.

5c is the next roadmap step (`openspec/roadmap.md`, Phase 5). It turns
the card into the rail the target layout describes: the same tools, with
the foreground/background swatches, Swap and Reset at its foot.

## What Changes

All of this applies only in the floating layout (`?layout=floating`),
except the accessibility fix in the last bullet. The docked layout and
`Pixi.mount()` embeds look and work the same as before.

- **Rail shape**: the rail starts just below the top bar and is only as
  tall as its contents. The tools stay in their current order.
- **Swatches at the foot**: foreground/background swatches, Swap and
  Reset sit at the bottom of the rail. When the screen is too short for
  the whole rail, only the tool buttons scroll. The tool-scoped toggles
  and swatches stay visible.
- **Tool-scoped toggles stay for now**: Rectangle's Filled toggle, the
  1:1 toggle and the Color Library sequence toggle stay in the rail,
  between the tools and the swatches. 5d moves them into the
  tool-options bar.
- **Touch targets**:
  - Every tool button is at least 44×44px. The rail gets a little wider
    to fit them.
  - Swap and Reset keep their Photoshop-style corner icons and look. Each
    gets a larger invisible hit area of at least 24×24px that does not
    cover the swatch faces. A full 44px area at each corner does not fit
    in a rail this narrow without covering the swatches. See design.md,
    decision 3.
- **Opens toward the canvas**: tooltips and the colour picker opened from
  the rail open on the side facing the canvas, worked out from where the
  rail actually is. With the rail on the left that is the same side as
  today. When 5g mirrors the layout, nothing else has to change.
- **Active tool announced** (both layouts): each tool button reports
  whether it is the selected tool (`aria-pressed`). Today the selection
  is shown only visually. Nothing changes on screen.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `floating-workspace`: adds requirements for the floating tool rail's
  layout, its swatch foot, its touch targets, which side its tooltips
  and popovers open on, and the selected-tool state. Existing
  requirements are unchanged: the rail is still in the `tools` slot, and
  Fit already measures the rail's real width.

`toolrail-magnetic-hover` stays true unchanged. The same ten buttons keep
the effect at their new size.

## Impact

- `style.css`: floating-only rules for the rail's height and width, 44px
  tool buttons, keeping the swatch block pinned to the rail's foot with
  the tool-scoped toggles above it, and bigger corner hit areas.
  `--slot-rail-width` grows, and the Pencil/Eraser options card beside
  the rail moves out with it automatically.
- `js/workspace.js`:
  - The rail tooltip and `openColorPicker` choose a side from the rail's
    position instead of always using the right.
  - The tool click handler and the restricted-tools reset set
    `aria-pressed`, through a small helper in a new `js/tool-rail.js`.
- `js/layout.js`: a small, pure, unit-tested helper that picks the
  inline side facing the canvas from an anchor's rectangle and the
  viewport width.
- `index.html` / `lib/pixi.js`: one wrapper around the ten tool buttons,
  so they can scroll on their own. It has no effect in the docked layout
  (`display: contents`). The tool buttons get an initial
  `aria-pressed="false"`.
- Tests: the side-picking helper, the `aria-pressed` helper (exactly one
  pressed tool, including with an embed's tool restriction), and CSS checks that the new rail rules
  are scoped to `[data-layout="floating"]`.
- Depends on 5b being merged (done). 5b's spec delta only touches top bar
  requirements, so the two deltas don't conflict.
