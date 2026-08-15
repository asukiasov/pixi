## Why

Requested directly: Canvas Settings (name, resize, rotate) was a panel
docked to the bottom of `workspace-main`, pushing the canvas/palette
layout when opened. Every other on-demand panel in the Workspace (the
color picker, and now the confirm-delete dialog) is a popover/overlay
that floats over the canvas instead of shifting the layout — Canvas
Settings was the one holdout.

## What Changes

- Canvas Settings becomes a popover anchored to the gear icon
  (`#canvas-settings-toggle`) in the top bar: opens below the icon
  (flipping above if that would overflow the bottom of the viewport,
  same clamped-to-viewport pattern the color-picker popover uses),
  closes via a new explicit close (×) button, clicking outside it,
  Escape, or re-clicking the gear icon.
- No change to what it does (rename, resize, rotate) or the
  `onResize`/`onRotate`/`onRename` callback contract with
  `js/workspace.js` — purely a presentation change from a docked panel
  to a floating popover.

## Capabilities

### Modified Capabilities
- `canvas-settings`: adds a "Canvas Settings is a popover, not a docked
  panel" requirement describing where/how it opens and closes. Every
  existing requirement (rename, resize, rotate, undo/redo) is unchanged.

## Impact

- `index.html`: `#canvas-settings-panel` gains a header close button
  (`#canvas-settings-close`); no longer sits in `workspace-main`'s normal
  document flow once positioned (see style.css).
- `js/canvas-settings.js`: `initCanvasSettings` gains a `positionPanel`
  helper (unhide-then-clamp, same as `openColorPicker`) and outside-
  click/Escape/close-button handling; returns a new `close()` method the
  per-project reset in `js/workspace.js` calls so a freshly opened
  project always starts with the popover closed.
- `style.css`: `.canvas-settings-panel` switches from a docked,
  full-width, `border-top`-only block to `position: fixed` popover
  styling matching `.color-picker-popover` (background, border, radius,
  shadow, z-index, fixed width).
