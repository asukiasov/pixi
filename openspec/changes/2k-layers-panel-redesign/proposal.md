## Why

Requested directly: "redraw layer panel... photoshop layer panel style"
(with a reference screenshot of Photoshop's actual Layers panel). The
existing panel worked but read as generic - two stacked sub-rows per
layer (visibility/name/delete, then opacity/blend/reorder), no
per-layer thumbnail, and Opacity/Blend mode duplicated as controls
inside every single row instead of a shared toolbar for the selected
layer.

## What Changes

- **Real per-layer thumbnails**: each row now shows a small live
  preview of that layer's actual pixel content (not a placeholder),
  Photoshop-style.
- **Blend mode + Opacity move to a panel-level toolbar** above the
  layer list, editing whichever layer is currently active/selected -
  matching Photoshop's own panel, where these aren't per-row controls.
  Switching the active layer re-syncs the toolbar to that layer's
  values.
- **Each layer is now one compact row** (was two stacked sub-rows):
  visibility toggle, thumbnail, name, and small reorder/delete icons.
- **Selected-row highlight** is now a solid accent bar (matching
  Photoshop's own selection highlight), not just a subtly darker
  background.
- No functional/behavioral change to what's possible - visibility,
  rename, opacity, blend mode, reorder, delete, add layer, and the
  8-layer cap are all unchanged; this is a presentation redesign only.

## Not addressed (know the limits)

- **No drag-and-drop reordering.** Photoshop reorders layers by
  dragging; this app has no drag-and-drop implementation for layers
  (a real engineering lift beyond this redesign's scope) and keeps the
  existing tap-to-reorder up/down arrows, restyled as small icons.
- **No Lock (transparency/pixels/position/all), Fill percentage, or
  adjustment-layer link icon** - Photoshop's panel has these; this
  app's `LayerStack` data model doesn't support any of them, and adding
  that functionality is out of scope for a visual redesign of the
  panel that already exists.

## Capabilities

### Modified Capabilities
- `layers`: adds two requirements capturing the parts of this redesign
  that are genuinely observable behavior, not pure visual styling - the
  live per-layer thumbnail, and Opacity/Blend mode moving to shared
  controls that follow the active layer. Every other requirement in the
  archived `layers` spec (add/delete/reorder/rename/visibility/opacity/
  blend mode/undo) is unchanged - this redesign doesn't add or remove
  what's possible, only how it's presented.

## Impact

- `index.html`: `#layers-panel` gains a `.layers-panel-toolbar`
  (Blend mode select + Opacity slider, two stacked rows to fit the
  right-sidebar's width) between the header and the layer list.
- `js/workspace.js`: new `buildLayerThumbnailCanvas(layer)` and
  `syncLayersPanelToolbar()`; `buildLayerRow` simplified from two
  sub-rows to one row (thumbnail added, opacity/blend controls
  removed - now toolbar-level); blend-select/opacity-slider wiring
  moved from per-row to `bindDomOnce`, operating on
  `state.layerStack.getActiveIndex()`.
- `style.css`: full restyle of `.layer-row` and its children; new
  `.layers-panel-toolbar`/`.layer-thumbnail`/`.layer-row-actions`
  rules; `.layer-row.active` uses a solid accent-blue background
  instead of a subtly darker one.
