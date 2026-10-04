## Why

While drawing, especially on an iPad's smaller screen, the top bar, tool
rail, right sidebar, palette row, and zoom bar take a large share of the
screen. The only existing hide control is the right-sidebar toggle.
Artists expect the Photoshop/Procreate habit: one action that leaves
only the canvas, and an obvious way back.

## What Changes

- A new "Hide interface" button in the workspace top bar.
- Pressing it, or Tab when no control has focus, hides every piece of
  workspace chrome (top bar, tool rail, right sidebar, palette row,
  bottom zoom bar, selection controls). Only the canvas remains, and it
  stays where it was on screen.
- While hidden, a small floating "Show interface" button stays in the
  top-right corner, reachable by touch. Tab or Escape also brings the
  interface back.
- Drawing, pan/pinch-zoom, tool shortcuts, and undo/redo keep working
  while the interface is hidden.
- The state is session-only: opening a project always starts with the
  interface visible.

## Capabilities

### New Capabilities

- `hide-interface`: a whole-workspace hide/show of every UI region
  except the canvas, with a toggle button, a Tab shortcut, and an
  always-reachable way back.

### Modified Capabilities

_None._ The right-sidebar toggle keeps its own independent state.

## Impact

- `index.html`: the top-bar button, the floating restore button, and
  `fullscreen`/`fullscreen_exit` added to the Material Symbols subset.
- New `js/hide-ui.js` (the pure shortcut predicate), wired from
  `js/workspace.js`.
- `js/canvas-view.js`: a public `panBy(dx, dy)`.
- `style.css`: `.ui-hidden` rules and floating-button styling.
- New `test/hide-ui.test.js`.
