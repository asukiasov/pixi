## MODIFIED Requirements

### Requirement: Reference image rendering mode
The reference image layer SHALL support two rendering modes for its
on-screen display: **Pixelated** (the image is fit/downscaled onto the
canvas's fixed pixel grid, per the existing "Reference image smoothing
toggle" requirement's smoothed/unsmoothed sub-choice) and **Original**
(the image renders at its own native source resolution, not downscaled
to the canvas's fixed grid). The mode is a per-reference-layer setting,
toggled independently of, and superseding, the prior single smoothed/
unsmoothed-only toggle: the smoothed/unsmoothed choice remains available
but only applies while the mode is Pixelated. Switching modes SHALL be
undoable, consistent with other layer changes. In Original mode, the
reference image SHALL still render at the correct visual position in the
Layers panel's stacking order relative to drawing layers (above or below,
per the layer's position — see "Reference image layer is reorderable"),
and SHALL stay aligned with the canvas through pan and zoom.

Original mode is on-screen rendering only. Export and thumbnails SHALL
continue to unconditionally exclude the reference image layer entirely,
in either mode, per the `export` capability's existing exclusion
requirement.

A newly uploaded reference image SHALL default to Original mode
(superseding the prior implicit always-Pixelated default). Pixelated mode
remains fully available via the mode toggle.

#### Scenario: A new upload defaults to Original mode
- **WHEN** the user uploads a new reference image (no previous reference
  layer existed, or a previous one was deleted first)
- **THEN** the reference layer initially renders at its original,
  un-downscaled resolution

#### Scenario: Switching to Pixelated mode downscales to the canvas grid
- **WHEN** the user toggles the reference layer from Original to
  Pixelated mode
- **THEN** the layer's on-screen rendering switches to the fit-to-canvas
  downscaled behavior (smoothed or unsmoothed, per the existing
  sub-choice), unchanged from the prior "Reference image smoothing
  toggle" requirement's behavior

#### Scenario: Switching to Original mode restores native resolution
- **WHEN** the user toggles the reference layer from Pixelated to
  Original mode while its source image is still held (in memory, or
  restorable from a persisted original — see the "Original-resolution
  source is persisted" requirement)
- **THEN** the layer's on-screen rendering switches to displaying the
  source image at its own native resolution, un-downscaled

#### Scenario: Original mode respects the layer's stacking position
- **WHEN** the reference layer is in Original mode and positioned between
  two drawing layers (or above/below all of them) in the Layers panel
- **THEN** its on-screen rendering appears at that same relative position
  — drawing layers above it in the stack visually cover it where they
  have opaque content, and it visually covers drawing layers below it,
  matching what the equivalent Pixelated-mode stacking would show

#### Scenario: Original mode tracks pan and zoom
- **WHEN** the user pans or zooms the workspace while the reference layer
  is in Original mode
- **THEN** the reference image's on-screen position and size update in
  lockstep with the canvas, remaining visually aligned with it

#### Scenario: Mode toggle is undoable
- **WHEN** the user toggles the reference layer's mode and then triggers
  Undo
- **THEN** the reference layer's mode (and its resulting on-screen
  rendering) reverts to what it was before the toggle

#### Scenario: Export and thumbnails are unaffected by mode
- **WHEN** the reference layer is in Original mode
- **THEN** exported files and thumbnails still exclude the reference
  layer entirely, exactly as when it is in Pixelated mode

## ADDED Requirements

### Requirement: Original-resolution source is persisted
When the reference image layer is in Original mode, its full-resolution
source image SHALL be persisted (alongside the project's existing layer
data) so that reopening the project restores Original-mode rendering
without requiring the user to re-upload. A reference layer in Pixelated
mode SHALL NOT add this additional stored data, preserving today's
storage footprint for that case.

#### Scenario: Reopening a project restores Original-mode rendering
- **WHEN** a project is saved with its reference layer in Original mode,
  then reopened (e.g. after a page reload)
- **THEN** the reference layer renders at its original resolution again,
  without the user needing to re-upload the image

#### Scenario: Pixelated-mode reference layers add no extra stored data
- **WHEN** a project's reference layer is in Pixelated mode (or the
  project has no reference layer)
- **THEN** no additional full-resolution source data is stored for it,
  beyond what the layer already stores today
