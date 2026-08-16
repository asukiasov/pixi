## Context

`js/canvas-settings.js`'s `initCanvasSettings` previously just toggled
`.hidden` on `#canvas-settings-panel`, a block sitting in
`workspace-main`'s normal flow (between the canvas container and the
palette row) styled with `border-top` and no positioning of its own -
opening it pushed the palette row and bottom bar down. `js/workspace.js`'s
`openColorPicker` already has the exact popover pattern this needs
(unhide to measure real size, then clamp `left`/`top` to the viewport
with an 8px margin, flipping side/direction if the preferred position
would overflow) - reused here rather than reinvented.

## Goals / Non-Goals

**Goals:**
- Canvas Settings never shifts the Workspace layout when opened/closed.
- Same open/close affordances the color-picker popover already has:
  explicit close button, outside click, Escape.

**Non-Goals:**
- No change to Canvas Settings' actual functionality (rename/resize/
  rotate) - purely presentation.
- No shared/extracted "popover" component in this slice - the
  positioning math is duplicated (once in `js/workspace.js` for the
  color picker, once in `js/canvas-settings.js` here) rather than
  factored into a shared helper module. Small enough to duplicate for
  now; worth revisiting if a third popover needs the same logic.

## Decisions

**Opens below the anchor, not beside it.** The color-picker popover
opens to the side of its anchor (a tools-sidebar swatch, in a narrow
vertical rail where "beside" has room). The gear icon lives in the
horizontal top bar, where beside would risk covering the next button -
the same reasoning `2d-canvas-navigation`'s top-bar tooltip fix already
established (tooltips there show below, not to the side). Canvas
Settings follows that same convention: opens below, flips above only if
that would overflow the viewport's bottom edge.

**`initCanvasSettings` returns a `close()` method now.** Every other
tool-scoped panel (Brushes, Pencil options, Rectangle options) gets
reset to a known hidden/shown state in `js/workspace.js`'s per-project
reset block when a new project opens. Canvas Settings previously had no
such reset - not a bug when it was an always-in-flow panel a user would
notice was open, but worth closing explicitly now that it's a popover
that could otherwise linger open (and mispositioned, since its anchor
hasn't moved but the panel's cached position might be stale) across a
project switch.

## Risks / Trade-offs

- Duplicated positioning math (see Non-Goals) - acceptable for two
  call sites; would need factoring out if a third popover appears.
