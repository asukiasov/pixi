## Why

The Workspace canvas currently only zooms via two-finger touch pinch (no
mouse/keyboard path at all) and always opens at a fit-to-container scale
with no way to jump to 100%, no way to see what zoom level you're at, and
no way to pan around once zoomed in past the container (aside from the
same pinch gesture). On a mouse/trackpad-only setup none of this is
reachable. Separately, the Layers panel currently lives below the canvas
in the same vertical stack as Canvas Settings, taking up permanent
vertical space even when the user doesn't need it open — inconsistent
with the Brushes panel, which already moved to a dedicated, collapsible
right-side sidebar in a prior change.

## What Changes

- Zoom in/out via `+`/`-` buttons and Cmd/Ctrl `+`/`-` keyboard shortcuts,
  operating the CanvasView zoom that today is only reachable through
  touch pinch.
- Three zoom preset buttons: **100%** (exact 1:1 pixel-to-CSS-px), **Fit
  Screen** (existing fit-and-center behavior), and **Fill Screen** (scale
  up to cover the container, cropping overflow).
- A live zoom-percentage readout in the bottom-left of the Workspace
  screen, updating with every zoom change (buttons, shortcuts, presets,
  or touch pinch).
- A new **Hand** tool in the tools sidebar for panning the canvas via
  drag; coexists with the existing two-finger touch pan.
- The Layers panel moves out of `workspace-main`'s vertical stack into a
  right-side sidebar (alongside the Brushes panel), with its own
  show/hide toggle independent of the Brushes panel's tool-scoped
  visibility.

## Capabilities

### New Capabilities
- `canvas-navigation`: zoom (buttons, keyboard shortcuts, presets,
  percentage readout) and panning (Hand tool) for the Workspace canvas
  viewport.

### Modified Capabilities
- `layers`: adds requirements for the Layers panel's placement (right-side
  sidebar) and a show/hide toggle for the whole panel. No change to any
  existing layer-operation requirement (add/delete/reorder/opacity/blend/
  etc.) — this only adds new requirements about where and how the panel
  itself is presented.

## Impact

- `js/canvas-view.js`: gains a public zoom API (set/step zoom, fit,
  fill, 100%) and a Hand-tool-driven pan path, plus a way to report the
  current effective zoom percentage to the caller.
- `js/workspace.js`: wires the new zoom buttons/shortcuts/presets, the
  Hand tool (added to the existing tool dispatch), and the zoom-percentage
  readout; moves Layers panel show/hide state into the same kind of
  per-project reset block the Brushes panel already has.
- `index.html` / `style.css`: new zoom controls in the bottom bar, a Hand
  tool button in the tools sidebar, Layers panel repositioned into the
  right-side sidebar area with a collapse toggle.
- No engine.js/layers.js/persistence.js changes expected — this is
  viewport/UI, not drawing or storage.
