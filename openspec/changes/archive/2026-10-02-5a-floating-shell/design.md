## Context

See proposal.md for why. Relevant current state:

- `#screen-workspace` is a flex column: `.workspace-topbar`, then
  `.workspace-body` (row: `#tools-sidebar`, `.workspace-main`,
  `#right-sidebar`). `.workspace-main` stacks `.canvas-container`,
  `#palette-row`, `#selection-controls`, and `.bottom-bar`. `#pencil-options`
  is absolutely positioned inside `.canvas-container`.
- `CanvasView#resetView()` (`js/canvas-view.js`) fits and centres the
  canvas in `.canvas-container`'s full rect. `setZoomPreset('fill'|'100')`
  centres in the same rect. `js/app.js` calls `resetView()` on open and
  again next frame.
- 4d's `setUiHidden` keeps the canvas still by measuring the container
  before/after and calling `panBy`. With a container that never moves,
  that delta is zero, so it needs no change.
- Theme tokens live on `:root` / `:root[data-theme="light"]`. Tests
  (`test/text-selection.test.js`) already check CSS by parsing
  `style.css` in Node, with no browser.
- `lib/pixi.js` mounts the same `#screen-workspace` markup for embeds.

## Goals / Non-Goals

**Goals:**
- A layout switch with zero effect on users who don't opt in.
- The full-screen canvas, slots, glass look and clear-area fit that
  5b–5g build on, usable by hand in the floating layout from day one.

**Non-Goals:**
- Redesigning any region's contents (that's 5b–5f). Regions float with
  today's markup, merely restyled as cards.
- Handedness mirroring and the Prefs screen (5g). This change only makes
  mirroring a slot swap.
- Phone breakpoints. Below about 700px wide the floating layout may
  overlap; that's acceptable behind a dev switch.
- Floating layout in `Pixi.mount()`.

## Decisions

**1. Switch = `?layout=floating` query parameter, read once at boot.**
A new `js/layout.js` exports a pure `resolveLayout(search)` → `'floating'
| 'docked'` and `applyLayout(root, layout)` which sets
`data-layout` on `#screen-workspace`. `js/app.js` calls it at boot. The
router only rewrites the hash, so the query survives navigation.
*Alternatives:* localStorage flag (sticky and invisible, easy to forget
you're in it); a hash segment (collides with `url-routing`'s route
parser). A query parameter is visible in the URL and disappears with a
fresh link.

**2. Floating is an attribute-scoped override, not a new markup tree.**
All rules live under `.workspace-screen[data-layout="floating"]`.
`.workspace-screen` becomes `position: relative`; `.canvas-container`
becomes `position: absolute; inset: 0`; `.workspace-topbar`,
`#tools-sidebar`, `#right-sidebar`, and an `options` group become
`position: absolute` cards. `.workspace-body`/`.workspace-main` switch to
`display: contents` so their children can be positioned against the
screen without moving them in the DOM. This keeps every id, every JS
query, and 4d's structural `.ui-hidden` selectors working.
*Alternative:* a parallel floating markup. Rejected: doubles every id
and every wiring path, and `lib/pixi.js` mirrors this markup.

**3. Slots are CSS custom properties set once per slot.**
Each slot class (`.slot-top`, `.slot-tools`, `.slot-panels`,
`.slot-options`, added to the existing elements) positions itself with
`inset-inline-start`/`inset-inline-end` driven by variables such as
`--slot-tools-side: start`. Regions never set `left`/`right` themselves.
The selection controls, palette row and zoom bar share one
`.slot-options` wrapper along the bottom centre; `#pencil-options`
joins the `tools` slot, offset to sit beside the rail.
*Why:* 5g's handedness becomes one attribute (`data-hand="left"`) that
swaps two variables. *Alternative:* `dir="rtl"` mirroring. Rejected: it
would also mirror text, number inputs and sliders.

**4. Glass is one `.glass` look with an opaque fallback.**
New tokens: `--float-radius: 16px`, `--float-gap`, `--float-edge`,
`--glass-tint` and `--glass-border` (per theme; dark tint is
`--color-bg` at 88% alpha, light is white at 72% - the canvas backdrop is
light in both themes, and a 72% dark tint dropped secondary text to
~2.4:1, caught by the web-design-guidelines pass), `--glass-blur: 20px`, `--float-shadow`. The opaque
surface is the base. Inside `@supports (backdrop-filter: blur(1px)) or
(-webkit-backdrop-filter: blur(1px))` the card turns transparent and a
`::before` layer carries the tint and the blur. A positive
`@media (prefers-reduced-transparency: reduce)` restores the opaque
surface and hides the layer.
*Found during apply:* (a) `not (prefers-reduced-transparency: reduce)`
was the first plan, but Safari doesn't know that feature, so `not
(unknown)` evaluates false and would have switched glass off on every
iPad; the positive query fails safe instead. As a consequence, iPadOS's
Reduce Transparency setting isn't honoured until Safari supports the
query. (b) `backdrop-filter` on the card itself would make it the
containing block for `position: fixed` descendants, and three popovers
are nested inside cards (colour picker in the rail; palette
import/ramp previews in the right sidebar). The `::before` layer
avoids that. (c) The floating slots get the look by selector, not a
`glass` class in `index.html`, so the shared markup renders unchanged
in the docked layout.

**5. Clear-area fit through an injected insets function.**
`CanvasView` gains an optional `getClearInsets()` constructor option
returning `{top, right, bottom, left}` in CSS px (defaults to zeros, so
the docked layout and `Pixi.mount()` are unaffected). `resetView()` and
the Fill/100% presets size and centre within the container rect minus
those insets. The insets come from a pure `clearInsets(containerRect,
cardRects)` in `js/layout.js`: for each visible card, take how far it
reaches in from the edge it's against (by slot), plus `--float-gap`.
*Alternative:* static CSS variables for insets. Rejected: card sizes
depend on content and theme fonts, and the right sidebar can be hidden.

**6. Embeds stay docked by construction.** `Pixi.mount()` never calls
`applyLayout`, and the floating rules only match the attribute.

## Risks / Trade-offs

- [`backdrop-filter` over a large, frequently repainted canvas costs
  frames on older iPads] → Blur only the cards, not a full overlay. Check
  stroke latency on a real iPad during apply; drop `--glass-blur` to
  12px if needed.
- [`display: contents` removes `.workspace-main`'s box; any JS that
  measures it breaks] → grep for measurements of `.workspace-body`/
  `.workspace-main` during apply. Today only `.canvas-container` is
  measured.
- [Glass contrast over busy artwork] → tints are 88% (dark) / 72%
  (light) opaque, and text uses the existing `--color-text` tokens. Verify with
  `web-design-guidelines` before review.
- [Popovers (`position: fixed` + JS clamping) may open under a card] →
  acceptable in 5a. Each later change re-anchors its own popovers.
- [Panel contents keep their docked backgrounds (e.g. the Layers
  blend/opacity row is an opaque strip inside the glass card in dark
  theme)] → accepted for 5a; 5e redesigns the cards' contents.
- [Verified in Chromium only: the local Playwright's WebKit build wasn't
  installed] → check `?layout=floating` on a real iPad before 5h.

## Migration Plan

Ships dark: no user sees a change. Rollback = revert the change; there is
no stored state. 5h removes the switch, the docked rules, and
`display: contents`.
