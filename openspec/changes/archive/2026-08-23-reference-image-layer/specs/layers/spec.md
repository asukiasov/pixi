## ADDED Requirements

### Requirement: Reference image layer
The user SHALL be able to add a **reference image layer** to the layer
stack by picking an image file (`image/*`). The uploaded image SHALL be
decoded and drawn onto the new layer's pixel buffer at its original
fidelity — no downsampling, pixelation, or color quantization is applied,
unlike Brush Import (2m) and Color Library Import (2n). A canvas SHALL
allow at most one reference image layer at a time; it counts toward the
existing 8-layer maximum.

#### Scenario: Adding a reference image layer
- **WHEN** the user picks an image file via the "Add reference image"
  control
- **THEN** a new reference image layer is added to the top of the stack,
  showing the picked image's full-fidelity pixel content, and is not made
  the active (drawing) layer

#### Scenario: Reference image keeps full fidelity
- **WHEN** a high-resolution or many-colored image is uploaded as a
  reference layer
- **THEN** the layer's pixel content matches the source image at its
  original resolution and colors, with no pixelation or palette reduction
  applied

#### Scenario: Only one reference image layer per canvas
- **WHEN** a canvas already has a reference image layer and the user tries
  to add another
- **THEN** the "Add reference image" control is disabled (or the user is
  prompted to replace the existing one — see design.md), and no second
  reference image layer is added

### Requirement: Reference image layer is non-drawable
The reference image layer SHALL NOT be selectable as the active
(drawing-target) layer. Pencil, Eraser, Bucket Fill, and shape tools SHALL
have no effect on it, even if some other mechanism attempts to target it.

#### Scenario: Reference layer cannot become active
- **WHEN** the user clicks a reference image layer's row in the Layers
  panel to select it
- **THEN** it does not become the active layer; the previously active
  layer remains active (or the layer directly below it becomes active —
  see design.md for the exact fallback), and its content is unaffected by
  subsequent drawing input

#### Scenario: Drawing tools do not affect the reference layer
- **WHEN** the reference image layer exists in the stack (visible or
  hidden, above or below the active layer)
- **THEN** no drawing tool ever modifies its pixel content, regardless of
  which other layer is active

### Requirement: Reference image layer is reorderable
Unlike the Background layer, the reference image layer SHALL be freely
movable up and down in the stack, same as a regular layer, so the user
can position it below their drawing layers instead of it permanently
covering the canvas view. It remains subject to the same
position-locking rule that already applies around the Background layer:
a move that would relocate the Background layer out of its fixed slot
SHALL still be refused, whether the layer initiating the move is the
reference image layer, a regular layer, or the Background layer itself.
(Revised 2026-08-18, after live testing surfaced the reference layer
permanently occluding the canvas at its original locked-on-top position
— see design.md's "Position lock" decision. The original "reorder-locked"
requirement this replaces is superseded, not additive.)

#### Scenario: Reference layer can be moved like a regular layer
- **WHEN** the user clicks the reference image layer's move-up or
  move-down control
- **THEN** it swaps position with its neighbor in that direction, same as
  a regular layer would, unless that neighbor is the Background layer

#### Scenario: Background layer's position stays fixed regardless of the mover
- **WHEN** any move (of the reference image layer, a regular layer, or an
  attempt to move the Background layer itself) would relocate the
  Background layer from its slot
- **THEN** the move is refused and no layer's position changes

#### Scenario: Reordering other layers around the reference layer
- **WHEN** the user reorders two regular layers while the reference image
  layer sits elsewhere in the stack
- **THEN** the reference image layer's own position in the stack does not
  change (only layers directly involved in a swap move)

### Requirement: Reference image layer visibility and deletion
The user SHALL be able to toggle the reference image layer's visibility
(controlling only its on-screen rendering, per the existing Layer
visibility requirement) and delete it, subject to the existing "cannot
delete the only remaining layer" rule. Both actions SHALL be undoable,
consistent with other layer changes.

#### Scenario: Hiding the reference layer
- **WHEN** the user hides the reference image layer
- **THEN** it no longer renders on-screen, but its pixel data and locked
  properties are unchanged, and it remains excluded from export exactly as
  when visible (see the `export` capability)

#### Scenario: Deleting the reference layer
- **WHEN** the user deletes the reference image layer and at least one
  other layer exists
- **THEN** it is removed from the stack, and the canvas can subsequently
  accept a new reference image layer upload (starting fresh: no stored
  source image or smoothing setting carries over to the new upload)

### Requirement: Reference image smoothing toggle
The user SHALL be able to toggle whether the reference image layer's
downscale (when the source image is larger than the canvas) is smoothed
(averaged/blended, the default) or unsmoothed (nearest-neighbor, blockier
- see fitImageToCanvas's `smooth` parameter in design.md). Toggling
re-fits the currently-stored source image at the new setting, replacing
the layer's pixel content in place, without changing its name, position,
or any other layer. The toggle SHALL be disabled when no source image is
held in memory for the current reference layer (e.g. after a page
reload, or if the reference layer was deleted and a fresh one hasn't been
uploaded yet), since there is nothing to re-fit from without re-uploading.
(Added 2026-08-18, after live testing showed that on the small fixed
canvas sizes (16-128px) this feature supports, a smoothed downscale of a
detailed source image can average away nearly all detail into flat color
regions, which read as "vectorized." This does not by itself restore lost
resolution — see design.md's "Smoothing toggle" decision for why a full
decouple-from-the-pixel-grid redesign was considered and explicitly
deferred in favor of this smaller-scoped fix.)

#### Scenario: Toggling smoothing re-fits from the stored source
- **WHEN** the user clicks the reference layer's smoothing toggle while
  its source image is still held in memory
- **THEN** the layer's pixel content is replaced with the source image
  re-fit at the new smoothing setting; the layer's name, position, and
  visibility are unchanged

#### Scenario: Toggle is disabled without a held source image
- **WHEN** no source image is held in memory for the current reference
  layer (e.g. after a page reload)
- **THEN** the smoothing toggle control is disabled

#### Scenario: A new upload always starts smoothed
- **WHEN** the user uploads a new reference image (after deleting a
  previous one, or on a canvas that never had one)
- **THEN** the initial fit uses smoothing on, regardless of what setting
  a previous reference layer (if any) was last toggled to
