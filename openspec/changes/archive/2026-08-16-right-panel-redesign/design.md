## Context

The right sidebar (`#right-sidebar` in `index.html`, `.right-sidebar` in
`style.css`) is a flex column of three sections: `#layers-panel`,
`#brushes-panel` (tool-scoped, Brush tool only), `#color-library-panel`.
Today: Layers is first with `max-height: 35%`; Color Library is last
with `flex: 1` (fills whatever's left). Layers already has one show/hide
toggle (`#layers-panel-toggle` in the bottom bar, driving
`state.layersPanelVisible`) that fully removes the panel via a `hidden`
class. There's no equivalent for Color Library or Brushes, and no
control that hides the sidebar as a whole.

Tooltips are a single shared `.tool-tooltip` element positioned by
`bindTooltips()` in `js/workspace.js`, always placed to the right of the
hovered element (`rect.right + 12`) except inside `.workspace-topbar`
(placed below instead). This matches the left `.tools-sidebar` but pushes
off-screen for `.right-sidebar` buttons near the viewport's right edge.

The color-picker popover (`openColorPicker`, ~`js/workspace.js:930`)
already clamps its position to stay within the viewport when opened near
an edge - the same clamping approach is reused for the new Opacity
popover.

See `proposal.md` - Why / What Changes for motivation and scope. See
`specs/layers/spec.md`, `specs/color-library/spec.md`,
`specs/canvas-navigation/spec.md` for the resulting requirements.

## Goals / Non-Goals

**Goals:**
- Reorder the three right-sidebar sections and rebalance their sizing
  (Color Library bounded, Layers fills remainder).
- One whole-sidebar visibility toggle, independent of per-panel state.
- Per-panel collapse-to-header for Color Library and Layers, with
  Layers' existing bottom-bar toggle folded into the same state.
- One-line Blend mode + Opacity toolbar in the Layers panel.
- Right-sidebar-aware tooltip positioning.

**Non-Goals:**
- No changes to Brushes panel's own tool-scoped visibility logic, beyond
  its position shifting down one slot.
- No persistence of any new toggle/collapse state across reloads
  (matches current `layersPanelVisible` behavior).
- No changes to layer compositing, opacity range, or blend mode values
  themselves - only how they're presented/edited.
- No redesign of the color-picker popover itself, only reuse of its
  viewport-clamping approach for the new Opacity popover.

## Decisions

**Reordering via markup order, not CSS `order`.** Move the
`#color-library-panel` block above `#layers-panel` in `index.html`
directly (both currently sit as flex children of `#right-sidebar`
relying on document order). Simpler than adding `order` properties, and
keeps DOM order matching visual order for accessibility/tab order.

**Sizing: swap which section is bounded vs. flexible.**
`.color-library-panel` moves from `flex: 1` to `max-height: clamp(200px,
30vh, 250px)` with its own `overflow-y: auto` (unchanged pattern, just a
different height source). `.layers-panel` moves from `max-height: 35%`
to `flex: 1; min-height: 0` so it now absorbs remaining space, matching
Color Library's old role. `.brushes-panel` (`max-height: 35%`, tool-
scoped) is unaffected by this swap - it still caps itself independently
of neighbors when the Brush tool is active. `.color-library-grid`'s
`grid-template-columns: repeat(auto-fill, minmax(1.6rem, 1fr))` becomes
`minmax(19px, 1fr)` with `gap` trimmed from `0.3rem` to `0.25rem`, so
more swatches fit inside the smaller bounded height.

**Whole-sidebar toggle: `display: none` + a persisted last-known-width
concept is unnecessary.** Since `.right-sidebar` uses `clamp()` for its
width rather than a fixed value, hiding it via `display: none` and
showing it again naturally restores the same clamped width - no need to
snapshot/restore a width value. New `state.rightSidebarVisible` (default
`true`), a new icon button in `.workspace-topbar` (e.g. `panel_right`
Material icon, mirroring `#layers-panel-toggle`'s `active`-class
convention), toggling a `hidden` class on `#right-sidebar`.

**Per-panel collapse: a `collapsed` class per panel, not removing DOM.**
`.layers-panel.collapsed` / `.color-library-panel.collapsed` hide
everything but the header (`display: none` on the toolbar/list or
select/grid children) and switch the section's sizing to `flex: none;
max-height: none` sized to just the header's content height, via a
`min-height`/`height: auto` override while collapsed - simplest is
giving the header a fixed height and setting the panel's `max-height` to
that value when collapsed, since both panels already establish a header
height. A chevron icon (`expand_more`/rotated) in each header toggles
this class; clicking anywhere on the header row (not just the icon)
toggles it, consistent with common accordion UX. `state.layersPanelVisible`
is renamed in spirit to mean "collapsed" rather than "hidden" - reuse
the same boolean (inverted meaning is small enough not to warrant a
rename in code) and keep `#layers-panel-toggle` wired to it, now
toggling the `collapsed` class instead of `hidden`. Color Library gets
its own new `state.colorLibraryCollapsed` boolean with only the header
entry point.

**Layers toolbar one-line row: number input + popover, following the
color-picker popover's clamping pattern.** `.layers-panel-toolbar`
becomes `flex-direction: row; align-items: center`.
`.layers-panel-blend-select` drops `width: 100%` for `width: auto`
(browser sizes a `<select>` to its selected `<option>` text by default).
The existing `<input type="range">` opacity slider moves out of the
always-visible row into a new `#layers-panel-opacity-popover` (`position:
fixed`, `hidden` by default), opened by clicking
`#layers-panel-opacity-readout` (repurposed from a plain text span into
a small button showing e.g. "100%"). A sibling `<input type="number">` is not introduced separately from the readout -
instead the readout becomes a `<button>` that opens the popover
(matching Photoshop's own click-to-reveal-slider interaction), and the
popover itself contains both the slider and a small number field for
direct entry, satisfying "typing a value directly" from the spec
without needing two separate always-visible controls. Popover
positioning reuses `openColorPicker`'s clamp-to-viewport math, opened
anchored below the toolbar row. Closes on outside click / Escape, same
listener pattern `openColorPicker`'s popover already uses.

**Tooltip fix: branch on `.right-sidebar` ancestry, mirror the
arrow.** In `bindTooltips()`'s `show()`, add `target.closest('.right-
sidebar')` as a second case alongside the existing `isTopbar` check.
When true: measure `tooltipEl`'s width after setting its content (needed
since content length varies), then position `left = rect.left -
tooltipWidth - 12`, keep vertical centering as-is, and add a
`.tool-tooltip.left-side` class whose `::after` arrow mirrors to the
opposite edge (`left: 100%` / `border-left-color` instead of `right:
100%` / `border-right-color`).

## Risks / Trade-offs

- **[Risk]** Collapsing both Color Library and Layers at once via header
  clicks leaves only the Brushes panel (or nothing, outside Brush tool)
  visible, plus two thin header bars - a degenerate but harmless state.
  → No mitigation needed; it's reachable, intentional per the spec (each
  panel collapses independently), and reversible with one more click
  each.
- **[Risk]** Reusing `state.layersPanelVisible` with an inverted
  practical meaning (visible→expanded) could confuse future readers of
  the code. → Mitigated with a code comment at the state declaration
  clarifying the semantics moved from hidden/shown to
  collapsed/expanded, without a full rename (keeps the diff smaller and
  avoids touching every call site).
- **[Risk]** Shrinking swatch `minmax` to 19px could make swatches hard
  to tap precisely on touch/iOS. → The existing `no-buzz`/hover-effect
  CSS already handles touch-target styling separately from swatch size;
  19px matches the user's requested 18-20px range and is consistent with
  Photoshop's own compact swatch size, so no separate mitigation planned
  - flagged here in case real-device testing shows otherwise.
