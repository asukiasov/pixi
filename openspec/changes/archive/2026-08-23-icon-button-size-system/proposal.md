## Why

Pixi's icon buttons currently use inconsistent fixed sizes (1.4rem, 1.6rem,
1.8rem, 2.2rem, 2.6rem) set ad hoc per component in `style.css`, with no
shared scale behind them. That inconsistency already produced two real bugs:
the Color Library header's 5 icon buttons and the reference image layer
row's icon controls both overflow their `.right-sidebar` container. Because
`.color-library-panel`/`.layers-panel`/`.layers-panel-body` set
`overflow-y: auto` with no explicit `overflow-x`, CSS's overflow-pairing
rule implicitly makes them `overflow-x: auto` too — so the overflow doesn't
clip or wrap, it silently turns the row into a horizontally-scrollable strip
with an easy-to-miss scrollbar, hiding controls off-screen unless the user
knows to scroll right.

## What Changes

- Introduce a named icon-button size scale (XS/S/M/L/XL) as CSS custom
  properties (`--icon-size-xs` … `--icon-size-xl`), matching the 5 distinct
  sizes already in ad hoc use across the app (1.4/1.6/1.8/2.2/2.6rem) so
  every existing call site maps onto a step with no visual change except
  the two contexts fixed below.
- Reassign `.color-library-header-actions .icon-button` from its current
  M-equivalent (1.8rem) down to XS (1.4rem), and let the "COLOR LIBRARY"
  header label truncate (`min-width: 0` + ellipsis) instead of forcing the
  row wider than the sidebar — fixing the Color Library header overflow bug.
- Fix the reference image layer row overflow (visibility, thumbnail, name,
  lock icon, smoothing toggle, up/down/delete) by tightening the row's
  spacing budget (smaller `.layer-name-input` min-width, tighter
  `.layer-row-actions` gap) and, if that alone isn't enough at the sidebar's
  normal clamped width, allowing the row to wrap rather than overflow
  horizontally.
- Replace every other ad hoc `width`/`height` pair on icon-only buttons
  (tool rail, top bar, bottom bar, zoom controls, color picker popover
  header) with a reference to the matching scale variable, without changing
  their rendered size.
- Document the full existing-size → scale-step mapping, and which call
  sites were and weren't touched, in `design.md`.

## Capabilities

### New Capabilities
- `icon-button-sizing`: A shared XS–XL icon-button size scale (CSS custom
  properties) that every icon-only button in the app is sized from, replacing
  ad hoc per-component fixed widths/heights, with defined behavior for how
  crowded containers (Color Library header, layer rows) pick a size to stay
  within their container without introducing unwanted horizontal scroll.

### Modified Capabilities
(none — `openspec/specs/` has no existing capability covering icon/button
sizing; the two overflow fixes are UI-layer bugs in `layers` and
`color-library`'s existing panels, not changes to those capabilities'
functional requirements, so no delta is needed there.)

## Impact

- `style.css`: new `:root` custom properties for the size scale; updated
  per-context selectors for `.color-library-header-actions .icon-button`,
  `.layer-name-input`, `.layer-row-actions`, `.icon-button`,
  `.tools-sidebar .tool-button`, `.zoom-controls .icon-button`,
  `.bottom-bar-group .icon-button`, `.color-picker-popover-header
  .icon-button`, and `.color-library-header h2` (or equivalent) for the
  truncation fix.
- No `index.html` markup changes expected (sizes are assigned via existing
  context selectors, not new modifier classes on buttons) unless the layer
  row overflow fix needs a wrap-container change in `js/workspace.js`'s
  `buildLayerRow`.
- No behavior change to any button's functionality — sizing and layout only.
