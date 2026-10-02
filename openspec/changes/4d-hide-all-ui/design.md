## Context

See proposal.md for motivation. The workspace is a flex layout:
`.workspace-topbar` sits above `.workspace-body`, which holds
`#tools-sidebar` | `.workspace-main` (canvas container, palette row,
selection controls, bottom bar) | `#right-sidebar`. `CanvasView` positions
the canvas with a pan offset measured from the container's top-left
corner, and nothing observes container resizes.

## Goals / Non-Goals

**Goals:** a single class flips the whole layout; the canvas doesn't
jump; there's always a way back on a keyboard-less iPad; keyboard
focus navigation is never broken.

**Non-Goals:** the browser Fullscreen API (a different feature, with
iOS limitations), persisting the state, and touch gestures such as
Procreate's four-finger tap.

## Decisions

**1. One `.ui-hidden` class on `#screen-workspace`, with CSS
`display: none` on each region.** `display: none` also removes the hidden
controls from tab order and the accessibility tree, with no `inert`
bookkeeping. The right sidebar's own collapsed/visible state is
untouched, so it comes back exactly as it was.

**2. Keep the canvas still by compensating pan.** Read the canvas
container's rect, toggle the class, read the rect again, then call a new
`CanvasView.panBy(oldLeft - newLeft, oldTop - newTop)`. The drawing stays
under the user's finger. *Alternative:* `resetView()` (re-fit). Rejected
because it throws away the user's zoom and pan.

**3. Tab only when nothing interactive is focused.** A pure
`isHideUiShortcut(event, activeElement)` returns true only for plain Tab
(no Shift/Meta/Ctrl/Alt) when the focused element is `<body>`, `null`,
or the canvas container. Any focused control keeps normal Tab
navigation, so keyboard users are never trapped. Bare-key tool
shortcuts already work when focus is on `<body>`, so this matches them.

**4. Floating restore button.** `#show-ui-button` is a fixed-position
icon button at the top-right, offset by `env(safe-area-inset-*)`. It is
rendered only while `.ui-hidden` is set, with a semi-opaque surface so
it reads over any canvas color. When the interface hides, focus moves to
it if a now-hidden control had focus; when the interface returns, focus
moves to the top-bar toggle in the same case. Focus is never lost to a
hidden element.

**5. Escape restores.** Escape already clears the selection, so
restoring in the same keypress is harmless. It also gives a familiar
"get me out" key.

**Icons:** `fullscreen` (hide) and `fullscreen_exit` (show) are added
to the `icon_names` subset in `index.html`. The list must stay
alphabetical for Google Fonts.

## Risks / Trade-offs

- [Tab does nothing visible when a control has focus, which may look
  inconsistent] → This is intentional and matches accessible-app
  conventions. The button's tooltip names the shortcut.
- [The floating button covers a corner of the canvas] → It's small,
  semi-transparent, and in the top-right, the corner least used for
  drawing.
