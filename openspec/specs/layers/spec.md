# layers Specification

## Purpose

Lets a user build a drawing out of multiple stacked, independently
controllable layers instead of one flat buffer, so separate elements
(sketch, lineart, shading, etc.) can be drawn, hidden, reordered, and blended
without affecting each other.

## Requirements

### Requirement: Starting layer
Creating a new canvas SHALL produce a layer stack with exactly one layer,
filled with the chosen background (transparent or white), which becomes
the active layer. A **white**-background canvas's starting layer SHALL be
flagged as the **Background layer** (locked in stacking position - see
the "Background layer is reorder-locked" requirement); a
**transparent**-background canvas's starting layer SHALL NOT be a
Background layer.

#### Scenario: New canvas has one layer
- **WHEN** the user creates a new canvas
- **THEN** the Workspace shows a layer stack containing exactly one layer,
  matching the chosen background, and it is the active layer

#### Scenario: White background produces a Background layer
- **WHEN** the user creates a canvas with a white background
- **THEN** the one starting layer is the Background layer

#### Scenario: Transparent background does not produce a Background layer
- **WHEN** the user creates a canvas with a transparent background
- **THEN** the one starting layer is a regular layer, not a Background
  layer

### Requirement: Background layer is reorder-locked
The Background layer (if a canvas has one) SHALL NOT be movable up or
down in the stack. The Layers panel SHALL show a lock indicator on it and
disable its reorder controls.

#### Scenario: Reorder controls disabled for the Background layer
- **WHEN** the Layers panel shows the Background layer
- **THEN** its move-up and move-down controls are disabled, and a lock
  indicator is shown

#### Scenario: Adding layers above the Background layer works normally
- **WHEN** the user adds a new layer while a Background layer exists
- **THEN** the new (regular, unlocked, transparent) layer is added above
  the active layer, and can be freely reordered among the other
  non-Background layers

### Requirement: Only one Background layer per canvas
A canvas SHALL have at most one Background layer, set only at creation
time (white background). Adding a layer never creates another one.

#### Scenario: Newly added layers are never Background layers
- **WHEN** the user adds a layer to a canvas that already has a
  Background layer
- **THEN** the new layer is a regular (non-Background) layer

### Requirement: Erasing on the Background layer reveals the background color
While the *active* layer is the Background layer, the Eraser tool SHALL
set erased pixels to the current Background color (`state.backgroundColor`,
from `2c2-color-panel`'s Foreground/Background model) instead of fully
transparent. Erasing on any other (non-Background) layer is unaffected -
it always produces full transparency, per the existing Eraser requirement
in `pixel-drawing-engine`.

#### Scenario: Erasing the Background layer
- **WHEN** the Background layer is active and the user erases part of it
- **THEN** the erased pixels become the current Background color, not
  transparent

#### Scenario: Erasing a non-Background layer is unaffected
- **WHEN** a regular (non-Background) layer is active and the user erases
  part of it
- **THEN** the erased pixels become fully transparent, exactly as before,
  regardless of what the Background color is set to

#### Scenario: Changing the Background color changes future erases, not past ones
- **WHEN** the user changes the Background color after already erasing
  part of the Background layer
- **THEN** already-erased pixels keep the color they were erased to;
  only subsequent erases use the new Background color

### Requirement: Add layer
The user SHALL be able to add a new, fully transparent layer above the
currently active layer, up to a maximum of 8 layers per canvas.

#### Scenario: Adding a layer
- **WHEN** the user adds a layer
- **THEN** a new transparent layer appears directly above the previously
  active layer, and becomes the active layer

#### Scenario: Layer limit reached
- **WHEN** the canvas already has 8 layers and the user tries to add another
- **THEN** the add-layer control is disabled and no layer is added

### Requirement: Delete layer
The user SHALL be able to delete any layer except when it is the only
remaining layer.

#### Scenario: Deleting a non-last layer
- **WHEN** the user deletes a layer and at least one other layer remains
- **THEN** that layer is removed from the stack, and if it was active, the
  layer that was directly below it becomes active (or the topmost remaining
  layer if the deleted one was at the bottom)

#### Scenario: Cannot delete the only layer
- **WHEN** the canvas has exactly one layer
- **THEN** the delete control is disabled for that layer

### Requirement: Reorder layers
The user SHALL be able to move a layer up or down in the stack.

#### Scenario: Moving a layer up
- **WHEN** the user moves a non-topmost layer up
- **THEN** it swaps position with the layer directly above it, and the
  visual stacking order (and therefore compositing order) updates to match

### Requirement: Rename layer
The user SHALL be able to rename a layer.

#### Scenario: Renaming a layer
- **WHEN** the user sets a new name for a layer
- **THEN** the layer's name updates and is shown in the Layers panel

### Requirement: Layer visibility
The user SHALL be able to toggle a layer's visibility. Hidden layers are
excluded from compositing (on-screen render and export) but keep their pixel
data.

#### Scenario: Hiding a layer
- **WHEN** the user hides a layer
- **THEN** that layer's content no longer appears in the composited canvas
  or in an exported PNG, but reappears unchanged if the layer is shown again

### Requirement: Layer opacity
The user SHALL be able to set a layer's opacity from 0–100%, applied during
compositing.

#### Scenario: Reducing opacity
- **WHEN** the user sets a layer's opacity to 50%
- **THEN** that layer's content is blended into the composited canvas at 50%
  strength, without altering the layer's underlying pixel data

### Requirement: Layer blend mode
The user SHALL be able to set a layer's blend mode to one of Normal,
Multiply, Screen, or Overlay, applied during compositing.

#### Scenario: Changing blend mode
- **WHEN** the user sets a layer's blend mode to Multiply
- **THEN** that layer composites using multiply blending against the layers
  below it

### Requirement: Active layer scoping
Pencil, eraser, and bucket fill SHALL act only on the active layer; other
layers are unaffected regardless of their stacking position or visibility.

#### Scenario: Drawing only affects the active layer
- **WHEN** the user draws with any tool while a given layer is active
- **THEN** only that layer's pixel data changes; all other layers remain
  exactly as they were

### Requirement: Composited render and export
The Workspace SHALL render the live, composited result of all visible
layers (respecting order, opacity, and blend mode), and PNG export SHALL
produce that same composited result flattened into a single image.

#### Scenario: Export reflects all visible layers
- **WHEN** the user exports a canvas with multiple visible layers
- **THEN** the exported PNG shows all of them composited together in stack
  order, at native resolution

#### Scenario: Hidden layers excluded from export
- **WHEN** the user exports a canvas with one or more hidden layers
- **THEN** the exported PNG does not include those layers' content

### Requirement: Layer changes are undoable
Adding, deleting, reordering, renaming, and changing a layer's visibility,
opacity, or blend mode SHALL be undoable/redoable the same way stroke and
fill actions are.

#### Scenario: Undoing a layer deletion
- **WHEN** the user deletes a layer and then taps Undo
- **THEN** the deleted layer reappears in its original position with its
  original content and settings

### Requirement: Layers panel position in the right sidebar
The Layers panel SHALL be the bottom-most section of the right sidebar,
below the Color Library panel and the Brushes panel (when Brushes is
shown), rather than the topmost section. Superseded from this
requirement's original form (a right-side sidebar alongside Brushes,
with no defined order) once Color Library moved above both.

#### Scenario: Layers renders below Color Library and Brushes
- **WHEN** the Workspace screen is open
- **THEN** the Layers panel appears below the Color Library panel in the
  right sidebar, and below the Brushes panel whenever Brushes is also
  visible

### Requirement: Layers panel collapse
The user SHALL be able to collapse the Layers panel down to just its
header row (hiding the toolbar and layer list, but not the header
itself) by clicking the panel header, and expand it again the same way.
The existing bottom-bar Layers toggle button SHALL drive and reflect
this same collapsed state, so either control collapses or expands the
panel identically. Superseded from this requirement's original form (a
toggle that fully hid/showed the panel) once the panel became
collapsible to its header row instead of disappearing entirely.

#### Scenario: Collapsing via the panel header
- **WHEN** the user clicks the Layers panel header
- **THEN** the toolbar and layer list disappear, only the header row
  remains, and the Color Library panel above grows to use the freed
  vertical space

#### Scenario: Expanding via the panel header
- **WHEN** the user clicks the header of a collapsed Layers panel
- **THEN** the toolbar and layer list reappear showing the current layer
  stack, unaffected by having been collapsed

#### Scenario: Bottom-bar toggle and header stay in sync
- **WHEN** the user collapses the Layers panel via the bottom-bar Layers
  button
- **THEN** the panel header shows the collapsed state (e.g. its chevron
  points the collapsed direction), and clicking the header then expands
  it; the reverse also holds when collapsing via the header first

#### Scenario: Independent of the Brushes panel
- **WHEN** the user collapses the Layers panel while the Brush tool is
  active (Brushes panel visible)
- **THEN** the Brushes panel remains visible, unaffected by the Layers
  panel's collapsed state

### Requirement: Layers panel shows a live thumbnail per layer
Each layer's row in the Layers panel SHALL show a thumbnail preview of
that layer's actual current pixel content, not a generic placeholder.
The thumbnail SHALL reflect the layer's content after any change (draw,
resize, rotate) the next time the panel re-renders.

#### Scenario: Thumbnail reflects drawn content
- **WHEN** the user draws on a layer and the Layers panel re-renders
- **THEN** that layer's thumbnail shows the new content

### Requirement: Opacity and Blend mode apply to the active layer via shared controls
The Layers panel SHALL offer one Opacity control and one Blend mode
selector, editing whichever layer is currently active, rather than
separate controls duplicated in every row. Selecting a different layer
SHALL update these controls to reflect that layer's own Opacity and
Blend mode. The two SHALL fit on a single row: the Blend mode selector
sized to its own content rather than the full row width, and Opacity
presented as a directly-editable numeric field (0-100) rather than an
always-visible slider - clicking the Opacity field SHALL open a slider
in a small popover for drag-to-set, and typing a value directly in the
field SHALL also work without opening the popover. Revised from this
requirement's original form (a full-width Blend selector above an
always-visible Opacity slider, stacked on two rows) once both were
compressed onto one line.

#### Scenario: Selecting a layer syncs the shared controls
- **WHEN** the user selects a different layer in the panel
- **THEN** the Opacity control and Blend mode selector update to show
  that layer's own values

#### Scenario: Changing Opacity or Blend mode affects only the active layer
- **WHEN** the user adjusts the shared Opacity control or Blend mode
  selector
- **THEN** only the currently active layer's opacity/blend mode changes

#### Scenario: Blend mode and Opacity share one row
- **WHEN** the Layers panel toolbar is visible
- **THEN** the Blend mode selector and the Opacity control both appear
  on the same row, without wrapping to a second line at the sidebar's
  normal width

#### Scenario: Typing an opacity value directly
- **WHEN** the user types a number into the Opacity field and confirms
  it
- **THEN** the active layer's opacity updates to that value, the same as
  dragging the slider would

#### Scenario: Adjusting opacity via the popover slider
- **WHEN** the user clicks the Opacity field and drags the slider that
  appears in the popover
- **THEN** the active layer's opacity updates live as the slider moves,
  and the numeric field reflects the current value

#### Scenario: Popover closes without committing an in-progress edit incorrectly
- **WHEN** the user clicks outside the open Opacity popover, or presses
  Escape
- **THEN** the popover closes and the active layer's opacity remains
  whatever value was last set

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

### Requirement: Reference image rendering mode
The reference image layer SHALL support two rendering modes for its
on-screen display: **Pixelated** (the image is fit/downscaled onto the
canvas's fixed pixel grid, smoothed or nearest-neighbor per the sub-choice
below) and **Original** (the image renders at its own native source
resolution, not downscaled to the canvas's fixed grid). The mode is a
per-reference-layer setting. While in Pixelated mode, the user SHALL be
able to further toggle whether the downscale is smoothed (averaged/
blended) or unsmoothed (nearest-neighbor, blockier — see
fitImageToCanvas's `smooth` parameter in design.md); toggling re-fits the
currently-stored source image at the new setting, replacing the layer's
pixel content in place. Switching between Pixelated and Original modes,
and toggling the smoothed/unsmoothed sub-choice, SHALL both be undoable,
consistent with other layer changes. In Original mode, the reference
image SHALL still render at the correct visual position in the Layers
panel's stacking order relative to drawing layers (above or below, per
the layer's position — see "Reference image layer is reorderable"), and
SHALL stay aligned with the canvas through pan and zoom.

Original mode is on-screen rendering only. Export and thumbnails SHALL
continue to unconditionally exclude the reference image layer entirely,
in either mode, per the `export` capability's existing exclusion
requirement.

A newly uploaded reference image SHALL default to Original mode.
(Superseded 2026-08-23 from this requirement's original form as
"Reference image smoothing toggle" — added 2026-08-18 as a Pixelated-only
smoothed/unsmoothed choice, defaulting new uploads to smoothed — once live
user feedback showed that downscale filtering alone couldn't restore
detail lost to the fixed pixel grid, prompting the Original mode
decoupling. The Pixelated sub-choice's own smoothed/unsmoothed behavior
and the "disabled without a held source image" rule are unchanged from
the original requirement.)

#### Scenario: A new upload defaults to Original mode
- **WHEN** the user uploads a new reference image (no previous reference
  layer existed, or a previous one was deleted first)
- **THEN** the reference layer initially renders at its original,
  un-downscaled resolution

#### Scenario: Switching to Pixelated mode downscales to the canvas grid
- **WHEN** the user toggles the reference layer from Original to
  Pixelated mode
- **THEN** the layer's on-screen rendering switches to the fit-to-canvas
  downscaled behavior (smoothed or unsmoothed, per the sub-choice above)

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

#### Scenario: Toggle is disabled without a held source image
- **WHEN** no source image is held in memory for the current reference
  layer (e.g. after a page reload) and Pixelated mode's smoothed/
  unsmoothed sub-choice is being toggled
- **THEN** the sub-choice's toggle control is disabled

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
