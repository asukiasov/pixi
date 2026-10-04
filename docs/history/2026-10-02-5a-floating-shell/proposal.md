## Why

Phase 5 rebuilds the Workspace as floating controls over a full-screen
canvas (see `docs/roadmap.md`, Phase 5). Every later Phase 5 change
(top bar, tool rail, tool-options bar, cards, Prefs) needs the same base:
a full-screen canvas, one card look, and a single place that decides
which screen side each part sits on. Building that base first, behind a
switch, lets 5b–5g land one at a time without users ever seeing a
half-converted workspace.

## What Changes

- A dev-only layout switch: opening the app with `?layout=floating`
  renders the Workspace in the new floating layout. Without it, users get
  today's docked layout, unchanged. 5h makes floating the default and
  removes the switch.
- In the floating layout the canvas area fills the whole Workspace, and
  today's regions (top bar, tool rail, right sidebar, palette row, zoom
  bar) are laid over it as floating cards in their target positions,
  with their contents unchanged. Later changes redesign each region's
  contents.
- A shared frosted-glass card look (semi-transparent blurred backdrop,
  ~16px radius, soft shadow) in both themes, with an opaque fallback when
  the user asks for reduced transparency or the browser can't blur.
- Named placement slots (top, tools, panels, options) decide which side
  each floating part sits on. Parts never set a physical side themselves,
  so the later handedness preference (5g) only has to swap the slots.
- Fit (and the initial view when opening a project) centres the canvas
  in the area left clear by the floating cards, not under them.
- New shared values for the floating UI: card radius, card gap,
  edge margin, glass tint/blur, shadow.

## Capabilities

### New Capabilities

- `floating-workspace`: the floating Workspace layout — the switch that
  enables it, the full-screen canvas, floating regions in named slots,
  the glass card look and its opaque fallback, and fitting the canvas to
  the clear area.

### Modified Capabilities

_None._ The docked layout, every tool, and `hide-interface` behave
exactly as today. In the floating layout, Hide interface already meets
its "canvas doesn't move" requirement because the canvas is
full-screen there.

## Impact

- `style.css`: new tokens, a `.glass` card style with fallback, the
  `[data-layout="floating"]` layout rules and slot rules.
- `index.html` / a small new `js/layout.js`: reads the switch at boot and
  sets `data-layout` on `#screen-workspace`.
- `js/canvas-view.js`: Fit/initial view honour the clear-area insets in
  the floating layout.
- `lib/pixi.js` (`Pixi.mount()`): unaffected; embeds stay docked.
- New tests: the switch parser, clear-area fit maths, and CSS checks for
  the glass fallback and slot rules.
