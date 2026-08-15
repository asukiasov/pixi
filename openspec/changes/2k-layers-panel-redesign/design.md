## Context

`js/workspace.js`'s `buildLayerRow` previously built two stacked
sub-rows per layer (`.layer-row-top`: visibility/name/delete;
`.layer-row-bottom`: opacity/blend/reorder) - a compromise reached
earlier this project (see `2f`/adjacent history) when the Layers panel
moved from a full-width bottom-docked panel to the narrower right
sidebar and six controls no longer fit on one line. `js/engine.js`'s
`PixelEngine` already exposes `width`/`height`/`data` directly, the
same shape `js/gallery.js`'s project-tile thumbnails and this change's
new layer thumbnails both read from.

## Goals / Non-Goals

**Goals:**
- Match Photoshop's Layers panel presentation: a shared toolbar
  (Blend mode + Opacity) above a list of compact single-row layers
  with real thumbnails, not per-row duplicated controls.
- Zero behavior change to what's possible - this is a redesign of an
  existing, working panel, not new functionality.

**Non-Goals:**
- No drag-and-drop reordering (see proposal.md's Not Addressed).
- No Lock/Fill/adjustment-layer-link affordances - not part of this
  app's `LayerStack` data model, out of scope for a visual redesign.

## Decisions

**Toolbar's Blend mode and Opacity are two stacked rows, not one
line.** Photoshop's real panel fits both on one line because its
panel is much wider than this app's ~13rem-clamped right sidebar. An
early version tried one line and measured it overflowing the sidebar
at typical widths (confirmed via Playwright bounding-box checks); two
short full-width rows fit cleanly at every supported sidebar width,
including the narrowest clamped case (~128px).

**Opacity gets an icon, not the word "Opacity."** Matches the existing
Pencil Size/Opacity sliders' icon-only convention (no text label
there either) and reclaims horizontal space the narrowest sidebar
width needs - confirmed via the same overflow check.

**Thumbnails render the layer's real pixel data via `ImageData`, not a
cached/regenerated bitmap.** `buildLayerThumbnailCanvas` draws
directly from `layer.engine.data` every time the panel re-renders, the
same "just re-derive from source data" approach `buildBrushPreviewCanvas`
already uses for brush swatches - no invalidation/caching logic needed,
since `renderLayersPanel()` already rebuilds the whole list on every
layer-affecting action.

**Opacity/Blend mode moved from per-row to a shared toolbar bound to
`state.layerStack.getActiveIndex()`.** Matches Photoshop's actual
information architecture (these are properties of "the selected
layer," edited in one place) rather than needing a slider+dropdown
duplicated in a already-tight single-row layout for every layer.
`syncLayersPanelToolbar()` re-reads the active layer's values after
every `renderLayersPanel()` call (including when switching which
layer is active), so the toolbar never shows stale values.

## Risks / Trade-offs

- Losing the always-visible per-row opacity/blend affordance means
  changing a *non-active* layer's opacity/blend now takes an extra tap
  (select it first) - an explicit, accepted trade-off matching
  Photoshop's own panel, not an oversight.
