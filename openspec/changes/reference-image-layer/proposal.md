## Why

Pixel artists commonly trace over a reference image (a photo, a sketch, a
existing sprite) while drawing. Today the only way to bring an image into
Pixi is Brush Import (2m) or Color Library Import (2n), both of which
downsample/pixelate/quantize the source — destroying the fine detail a
trace guide needs. Roadmap's "Not yet scheduled" section (see
`openspec/roadmap.md`, "Reference image layer (trace-over)") and the tier
matrix worksheet (`docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md`)
already call this out as a planned, Pro-only capability, raised
2026-08-18. This change formalizes it as an OpenSpec proposal.

## What Changes

- Add a "Reference image" upload action (Layers panel) that decodes a
  user-picked image file and adds it to the layer stack as a new **kind**
  of locked layer, kept at full source-image fidelity (no downsampling,
  pixelation, or color quantization) — distinct from Brush Import (2m) and
  Color Library Import (2n), which both intentionally reduce fidelity for
  a different purpose (editable pixel content).
- The reference layer is **non-drawable**: it cannot become the active
  layer's drawing target for Pencil/Eraser/Bucket Fill/shape tools, and
  the layer stack cannot select it as active for drawing purposes. This is
  a new restriction — stricter than the existing Background layer (2g),
  which is drawable (only reorder-locked and eraser-special-cased); see
  design.md for how this differs from the existing `isBackground` lock.
- The reference layer is **reorder-locked**, matching the Background
  layer's existing reorder-lock pattern (`isBackground`'s move-up/move-down
  disabling in `js/layers.js` / `js/workspace.js`) applied to this new
  layer kind instead.
- The reference layer is **always excluded from export**, regardless of
  its own visibility toggle, in every export format (PNG/WebP/JPG) and at
  every scale — a non-printing guide layer. This is unconditional (no
  export-popover toggle to include it), unlike the Background layer's
  opt-in "Transparent background" override.
- The reference layer's visibility toggle still controls whether it's
  drawn on-screen (so the user can hide the guide while checking their
  work), independent of the always-on export exclusion above.
- The reference layer can be deleted like a regular layer (subject to the
  existing "can't delete the only layer" rule) and participates in
  undo/redo like other layer mutations.
- Reuses `js/image-import.js`'s `decodeImageFile` step (already shared by
  2m/2n) but skips its downsample/pixelate/quantize step entirely — the
  decoded image is drawn at native resolution onto the new layer's pixel
  buffer (clipped/positioned to the canvas dimensions; exact fit behavior
  is a design.md decision).
- Tier gating: this capability depends on Layers (Phase 2a, Pro-only per
  the tier matrix worksheet) and is itself marked Pro-only in the
  worksheet. **No tier-gating mechanism exists yet in code** (tiers are a
  planning-only worksheet, not implemented — confirmed via repo search:
  no Standard/Pro flag or gate exists in `js/` or `openspec/specs/` today).
  Tier enforcement is explicitly **out of scope** for this change; it is
  built as designed and ready to be gated once a Standard/Pro split ships
  as its own change.
- Distinct from the roadmap's separate "Import screen" idea (.aseprite,
  reference images, palette files as editable content) — that flow is
  about importing files as editable pixel/palette data; this change is
  specifically a non-editable trace-over guide layer.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `layers`: adds a new locked layer kind (reference image layer) alongside
  the existing Background layer kind — introduces a non-drawable lock
  (new: the Background layer has no such lock today, only a reorder lock)
  and an upload/add action that populates the new layer from a decoded
  image at full fidelity instead of starting blank.
- `export`: adds an unconditional exclusion rule — reference image layers
  are never composited into exported output, regardless of visibility or
  format, on top of the existing "only visible layers are composited"
  rule.

## Impact

- `js/layers.js`: `Layer`/`LayerStack` need a way to represent a
  non-drawable, reorder-locked, export-excluded layer kind (extending or
  paralleling `isBackground`), plus a constructor/factory path that seeds
  a layer's pixel buffer from decoded image data instead of blank.
- `js/workspace.js`: Layers panel needs an "Add reference image" upload
  control (file picker), `buildLayerRow` needs a lock indicator + disabled
  reorder controls for this layer kind (paralleling the Background
  lock-icon code), and the active-layer-selection path needs to refuse
  making a reference layer the active (drawing target) layer.
- `js/export.js` (or wherever `LayerStack`'s compositing/export methods
  live per `js/layers.js`'s `#compositeToCanvas`/`toPNGBlob`): export
  compositing needs to always skip reference image layers, independent of
  the existing `skipBackground` transparent-background override.
- `js/image-import.js`: no behavior change expected — this change is a new
  consumer of `decodeImageFile`, bypassing `downsampleToImageData`/the
  thresholding/clustering steps entirely.
- `openspec/specs/layers/spec.md`, `openspec/specs/export/spec.md`: new
  requirements/scenarios via delta specs under this change.
- No Supabase/persistence schema impact assumed beyond whatever
  `toProjectRecord`/`fromProjectRecord` already do for layer pixel data
  (reference layer pixels persist like any other layer's) — confirm in
  design.md.
