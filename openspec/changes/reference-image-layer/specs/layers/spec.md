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

### Requirement: Reference image layer is reorder-locked
The reference image layer SHALL NOT be movable up or down in the stack,
matching the Background layer's existing reorder-lock behavior. The
Layers panel SHALL show a lock indicator on it and disable its reorder
controls.

#### Scenario: Reorder controls disabled for the reference layer
- **WHEN** the Layers panel shows the reference image layer
- **THEN** its move-up and move-down controls are disabled, and a lock
  indicator is shown

#### Scenario: Reordering other layers around a locked reference layer
- **WHEN** the user reorders two regular layers while a reference image
  layer is elsewhere in the stack
- **THEN** the reference image layer's own position in the stack does not
  change

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
  accept a new reference image layer upload
