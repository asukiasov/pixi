## Why

`reference-image-layer` (shipped) added a locked, non-drawable reference
image layer for tracing over, and its post-launch "smoothing toggle"
follow-up (also shipped, 2026-08-18) let the user pick smoothed vs.
nearest-neighbor filtering when the source image is downscaled to fit the
canvas's fixed pixel grid (16/32/64/128px). Live user testing showed the
toggle barely helps: a detailed photo crushed into e.g. a 64x64 grid loses
almost all detail regardless of which filter is used, reading as
"vectorized" either way. The user's own words when asked whether to
revisit the bigger fix: **"toggle was doing something. but not
unpixelating. so when pixelating is off - image should look original."**

`reference-image-layer/design.md`'s "Smoothing toggle" decision explicitly
considered and deferred this larger fix ("decouple the reference layer
from the fixed pixel grid... a much larger change to the compositing/
export/persistence model") in favor of the smaller toggle. The user has
now explicitly asked for the deferred approach. This change designs and
specs it; see design.md for the core architecture decision.

## What Changes

- The existing reference image smoothing toggle is reinterpreted/extended
  into a two-mode toggle: **Pixelated** (today's existing behavior,
  unchanged — the reference image is fit/downscaled to the canvas's fixed
  pixel grid, smoothed or nearest-neighbor per the existing sub-choice)
  and **Original** (new — the reference image renders on-screen at its
  own native resolution, independent of the canvas's fixed pixel grid, no
  downscaling artifacts).
- Original-resolution rendering is on-screen only. Export and thumbnails
  continue to unconditionally exclude the reference layer entirely,
  regardless of mode — this existing behavior is unchanged.
- The reference layer stays reorderable in the Layers panel (per
  `reference-image-layer`'s "Position lock" decision), and in Original
  mode it must still render at the correct visual stacking position
  relative to drawing layers as the user reorders it — not always-on-top
  or always-behind regardless of panel position.
- Original-mode rendering must track the workspace's pan/zoom viewport
  transform (`js/canvas-view.js`) so the reference image stays aligned
  with the pixel canvas as the user navigates.
- Switching between Pixelated and Original mode is undoable, consistent
  with other layer-affecting changes (matching the existing smoothing
  toggle's undo behavior).
- New default: a freshly uploaded reference image defaults to Original
  mode (see design.md's "Default mode" decision for reasoning), replacing
  today's implicit "always pixelated" starting state. Pixelated mode
  remains fully available as a toggle target.
- Persistence: an Original-mode reference layer's full-resolution source
  is persisted (as a Blob) so it survives a reload, with an explicit,
  documented scope limit on storage footprint — see design.md.
- No change to `merge-layers`'s existing exclusion of the reference layer
  from merge operations (still unaffected — see design.md).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `layers`: extends the existing reference image layer and its smoothing
  toggle requirement with a new original-resolution rendering mode,
  changes the on-screen compositing/rendering contract for a reference
  layer in that mode, changes persistence to (conditionally) store a
  full-resolution source image, and changes the default mode for a fresh
  upload.

## Impact

- `js/layers.js`: `Layer`/`LayerStack` need to represent a reference
  layer's rendering mode and (in Original mode) a reference to its
  original-resolution source, and `LayerStack`'s on-screen render output
  needs to become mode-aware instead of always returning one flat
  same-size raster — see design.md for the recommended approach.
- `js/canvas-view.js`: on-screen rendering (`render()`, `#applyTransform`)
  needs to support drawing a reference image at native resolution,
  correctly stacked and kept in sync with pan/zoom, alongside the existing
  single composited raster.
- `js/image-import.js`: `fitImageToCanvas` (the existing pixelated-fit
  path) is unchanged; Original mode does not downscale at all, so no new
  utility is needed there beyond what design.md specifies.
- `js/workspace.js`: the reference layer row's smoothing toggle UI is
  reinterpreted as a mode toggle (Pixelated smoothed/unsmoothed stays a
  sub-choice under Pixelated mode, per design.md); upload flow's default
  mode changes.
- `js/persistence.js` / Dexie schema: a new field to store an
  Original-mode reference layer's source Blob; see design.md for scope
  and size-limitation handling.
- `openspec/specs/layers/spec.md`: requirement changes/additions via this
  change's delta spec.
- `openspec/changes/merge-layers/`: no changes — reference layer remains
  excluded from merge, confirmed unaffected in design.md.
