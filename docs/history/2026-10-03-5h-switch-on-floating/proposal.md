## Why

5a–5f build the floating layout behind the dev-only `?layout=floating`
switch, so nobody uses it unless they know the URL. Once 5f lands, every
region of the target layout exists. The remaining Phase 5 work is 5g's
Prefs, which only tune that layout, and 5i, which is independent. So the
floating layout can become what users get, and Prefs can follow on top of
it.

This is the switch-on part of the roadmap's 5h, pulled ahead of 5g. The
other part, deleting the docked CSS and markup and syncing the specs that
describe it, stays for a later change. `Pixi.mount()` embeds are always
docked and still depend on that CSS.

## What Changes

- **BREAKING (for anyone used to the old look): the standalone app always
  uses the floating layout.** No opt-out, and no control to switch
  layouts. The `layout` query parameter is ignored: old
  `?layout=floating` links keep working, and `?layout=docked` (or any
  other value) also gives the floating layout.
- **Embeds unchanged**: `Pixi.mount()` stays docked, and nothing on the
  host page changes that. `lib/pixi.js` is not touched.
- **Every width is floating.** Below tablet width there is no separate
  layout and no fallback to docked. Narrow windows only have to be usable
  until the phone-layout follow-up. That needs four fixes, found at
  390×844 in the current floating layout:
  - **Cards start closed on narrow windows.** When a project opens in a
    window narrower than 600 CSS pixels, Colors, Brushes and Layers start
    closed, so Fit uses the space between the tool rail and the
    mini-rail. Today the open cards leave the canvas a 32px sliver behind
    them. Wider windows keep 5e's defaults (all open).
  - **Panel cards never cover the tool rail.** The card column narrows
    to the space between the rail and the mini-rail instead of keeping
    its fixed 15rem.
  - **The tool-options bar fits its card.** Sliders shrink and groups
    wrap, so no control runs past the card or the screen edge. Today
    Pencil's Size and Opacity are clipped at 390px.
  - **The palette row scrolls inside its card** rather than running past
    it.
- **Fit runs after the per-open card resets.** Today, on any project open
  after the first, Fit runs before the cards are reset to their defaults,
  so it fits beside the previous project's open cards. This change fits
  after the reset, which the narrow defaults depend on and which
  "Fit to the clear area" already requires.
- **Roadmap**: records that the switch-on moved ahead of 5g and why, that
  docked deletion is a later change, and the `Pixi.mount()` crash
  (`lib/pixi.js` lacks `#record-toggle`) as a separate bug fix to land
  before docked deletion.

Not in this change:

- deleting the docked CSS, markup, source controls and top bar toggles
- syncing `layers`, `color-library`, `brushes`, `hide-interface`,
  `canvas-navigation` and the other specs that describe the docked
  placement
- Prefs (5g)
- the phone layout itself (rail at the bottom, cards as sheets)
- the embed crash fix

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `floating-workspace`:
  - Modifies "Layout switch": the standalone app is always floating, the
    `layout` query parameter is ignored, and embeds stay docked. It also
    states that this capability takes precedence where other specs
    describe the docked placement of the same controls.
  - Modifies "Slim top bar": its "docked top bar unchanged" scenario now
    describes embeds, since the standalone app no longer has a docked
    layout.
  - Modifies "Panel cards on project open": cards start closed in narrow
    windows.
  - Adds "Narrow windows": every floating control stays reachable at
    phone widths, and the card column, tool-options bar and palette row
    fit.

`url-routing` is not modified. It never described the `layout` query
parameter, and the hash routes are unchanged. `embeddable-editor-api` is
not modified either, because embeds behave exactly as before.

## Impact

- `js/app.js`: always applies the floating layout. Drops
  `resolveLayout` and the `layout === 'floating'` conditions around the
  floating modules and the Fit options. After `initWorkspace()` it
  applies the per-open card defaults and then re-fits.
- `js/layout.js`: `resolveLayout` is removed, with its tests. Header
  comments no longer say "dev-only".
- `js/panel-rail.js`: a pure, tested `openCardDefaults(viewportWidth)` and
  an `applyOpenCardDefaults()` that closes cards through the existing
  forwarding paths.
- `style.css`: floating-only width rules for the card column, the
  tool-options bar's slider groups and the palette row. Docked rules are
  unchanged.
- Tests: `test/layout.test.js` (remove `resolveLayout`), the
  card-defaults helper, CSS checks for the new constraints.
- `docs/ui-reference.md`, `README.md` (if it mentions
  `?layout=floating`), `docs/roadmap.md`.
- No dependency on the embed fix. Embeds and `lib/pixi.js` are untouched,
  and the switch-on works without it. After the switch-on, though, the
  broken embed is the only place the docked layout runs. See design.md.
