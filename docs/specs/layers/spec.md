---
title: "layers specification"
description: "Multiple stacked layers that can be drawn, hidden, reordered, and blended independently."
type: spec
status: active
---

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

### Requirement: Duplicate layer
The user SHALL be able to duplicate the active layer from the Layers panel
(a Duplicate layer button) or with Cmd/Ctrl+J. The copy SHALL be inserted
directly above the source and become active, with the source's pixels,
opacity, blend mode and visibility, named "<name> copy" ("<name> copy 2",
"copy 3"… when that name is taken; a copy of a copy is numbered, not
named "copy copy"). Duplicating is one undoable step.

#### Scenario: Duplicating a layer
- **WHEN** the user duplicates "Layer 1"
- **THEN** "Layer 1 copy" appears directly above it with identical pixels,
  opacity, blend mode and visibility, and becomes the active layer

#### Scenario: Duplicating the Background layer
- **WHEN** the user duplicates the Background layer
- **THEN** the copy is an ordinary, reorderable layer, not a second
  Background layer

#### Scenario: Duplicate is unavailable
- **WHEN** the canvas has 8 layers, or the active layer is the reference
  image layer
- **THEN** the Duplicate layer button is disabled and Cmd/Ctrl+J does nothing

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
The user SHALL be able to move a layer up or down in the stack - from the
row's ⋯ menu (Move Up / Move Down), or by dragging the row's grip and
dropping it between other rows; a line SHALL show where it will land.

#### Scenario: Moving a layer up
- **WHEN** the user moves a non-topmost, ungrouped layer up whose
  neighbour above is ungrouped
- **THEN** it swaps position with the layer directly above it, and the
  visual stacking order (and therefore compositing order) updates to match

#### Scenario: Dragging a layer
- **WHEN** the user drags Layer 1's grip and drops it above Layer 3
- **THEN** Layer 1 sits directly above Layer 3 in the stack, as one
  undoable step

#### Scenario: Background stays put
- **WHEN** the user tries to drag a layer below the Background layer, or
  drag the Background layer
- **THEN** nothing moves (the Background row has no grip)

### Requirement: Rename layer
The user SHALL be able to rename a layer. A layer's name SHALL be shown in
the Layers panel as plain, non-editable text; renaming SHALL start only
from an explicit action - a double-click (mouse), a double-tap (touch,
including iPad), or Enter/F2 while the name has keyboard focus. A single
click or tap on the name SHALL behave exactly like a click or tap anywhere
else on the row (select the layer, or mark it with Cmd/Ctrl/Shift) and
SHALL NOT start editing.

#### Scenario: Renaming a layer
- **WHEN** the user sets a new name for a layer
- **THEN** the layer's name updates and is shown in the Layers panel

#### Scenario: Single click or tap on the name selects, not edits
- **WHEN** the user single-clicks or single-taps a layer's name
- **THEN** that layer becomes the active layer
- **AND** no text field is shown and (on touch devices) no on-screen
  keyboard opens

#### Scenario: Double-click or double-tap enters rename mode
- **WHEN** the user double-clicks or double-taps a layer's name
- **THEN** the name is replaced by a focused text field containing the
  current name, fully selected

#### Scenario: Keyboard entry into rename mode
- **WHEN** a layer's name has keyboard focus and the user presses Enter
  or F2
- **THEN** rename mode starts for that layer

#### Scenario: Committing a rename
- **WHEN** the user is in rename mode and presses Enter or moves focus
  away
- **THEN** the trimmed new name is saved, shown as plain text again, and
  the rename is undoable like other layer operations

#### Scenario: Cancelling a rename
- **WHEN** the user is in rename mode and presses Escape
- **THEN** the original name is kept and shown as plain text again

#### Scenario: Empty or unchanged name
- **WHEN** the user commits rename mode with an empty (or whitespace-only)
  name, or with the name unchanged
- **THEN** the original name is kept and no undo history entry is added

### Requirement: Layer visibility
The user SHALL be able to toggle a layer's visibility with a round checkbox
on its row (checked = shown; groups have the same checkbox). Hidden layers
are excluded from compositing (on-screen render and export) but keep their
pixel data.

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
The Layers panel SHALL be the only panel on the right side of the
Workspace (since 2026-10-12: colours moved to the bottom colour bar,
brushes to the brush palette popover).

#### Scenario: Layers alone on the right
- **WHEN** the Workspace screen is open
- **THEN** the right side shows only the Layers card (and its mini-rail
  button)

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

### Requirement: Header blend and opacity
The Layers panel SHALL show the active layer's blend mode and opacity in a
row under its title: a Blend mode selector, an Opacity slider (0-100) and
a percentage readout. Changing the blend mode SHALL commit one undo step;
dragging the slider SHALL update the canvas live and commit one undo step
when released. Both controls SHALL be disabled while the reference image
layer is active. Layer ⋯ menus SHALL NOT offer a separate "Opacity &
Blend…" item.

#### Scenario: Changing a layer's opacity
- **WHEN** Layer 2 is active and the user drags the header's Opacity
  slider to 40 and releases
- **THEN** Layer 2 composites at 40%, its row's detail line reads
  "Normal · 40%", and one Undo restores 100%

#### Scenario: Reference image active
- **WHEN** the reference image layer is the active layer
- **THEN** the header's Blend selector and Opacity slider are disabled

### Requirement: Group opacity
A group's ⋯ menu SHALL open an Opacity popover titled with the group's
name, holding an Opacity slider with a numeric field (0-100), applied to
the whole group when compositing. Dragging SHALL update the canvas live
and commit one undo step when released. Groups have no blend mode.

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

### Requirement: Layer marking (multi-select) in the Layers panel
The Layers panel SHALL support marking multiple layers, distinct from the
single active layer (where new strokes go). Cmd/Ctrl+click on a layer row
SHALL toggle that layer in or out of the marked set without changing the
active layer. Shift+click on a layer row SHALL mark every layer between the
most recently clicked row and the clicked row (inclusive), replacing any
prior marks. A plain click (no modifier) on a layer row SHALL clear all
marks and set that layer as the active layer, exactly as it does today. The
Background layer (if present) SHALL NOT be markable. Marked layers SHALL be
shown with a visual treatment distinct from the active-layer highlight.

#### Scenario: Cmd/Ctrl+click toggles a layer's marked state
- **WHEN** the user Cmd/Ctrl+clicks an unmarked layer row
- **THEN** that layer becomes marked, the active layer is unchanged, and any
  other already-marked layers remain marked

#### Scenario: Cmd/Ctrl+click again unmarks a layer
- **WHEN** the user Cmd/Ctrl+clicks an already-marked layer row
- **THEN** that layer becomes unmarked, and the active layer and other marks
  are unchanged

#### Scenario: Shift+click marks a contiguous range
- **WHEN** the user clicks a layer row, then Shift+clicks a different layer
  row
- **THEN** every layer between the two rows (inclusive) becomes marked,
  replacing whatever was marked before

#### Scenario: Plain click clears marks
- **WHEN** the user clicks a layer row without holding Cmd/Ctrl or Shift
- **THEN** all marks are cleared and that layer becomes the active layer,
  same as today's single-selection behavior

#### Scenario: Background layer cannot be marked
- **WHEN** the user Cmd/Ctrl+clicks or Shift+clicks the Background layer's
  row
- **THEN** the Background layer does not become marked

### Requirement: Merge layers keyboard shortcut
While the Workspace screen is visible, Cmd/Ctrl+E SHALL trigger a merge:
merging the marked set if 2 or more layers are marked, otherwise merging the
active layer down into the layer directly below it.

#### Scenario: Shortcut merges the marked set
- **WHEN** 2 or more layers are marked and the user presses Cmd/Ctrl+E
- **THEN** exactly the marked layers are merged into one, per the "Merge
  marked layers" requirement

#### Scenario: Shortcut merges down when nothing extra is marked
- **WHEN** fewer than 2 layers are marked and the user presses Cmd/Ctrl+E
- **THEN** the active layer is merged into the layer directly below it, per
  the "Merge active layer down" requirement

#### Scenario: Shortcut is scoped to the Workspace screen
- **WHEN** a screen other than Workspace is visible and the user presses
  Cmd/Ctrl+E
- **THEN** no merge occurs

### Requirement: Merge without a keyboard
Merging SHALL be reachable on touch devices: the active row's ⋯ menu SHALL
offer Merge Down (disabled when it would be refused), and Select mode's
Merge SHALL merge the selected layers (2 or more). The Layers header SHALL
also have a Merge button, before Add layer, that does what Cmd/Ctrl+E
does: it merges the marked layers when 2 or more are marked, else merges
the active layer down. Its label and tooltip SHALL read "Merge down" or
"Merge N layers" (with "(⌘E)" in the tooltip), and it SHALL be disabled
when that merge would be refused.

#### Scenario: Merge button in the header
- **WHEN** the active layer is above another ordinary layer and the user
  clicks the Layers header's Merge button
- **THEN** the active layer is merged into the layer below as one undo
  step, and on the bottom layer the button is disabled

#### Scenario: Merge Down from the row menu
- **WHEN** no layers are selected, the active layer is above another
  ordinary layer, and the user chooses Merge Down from its ⋯ menu
- **THEN** the active layer is merged into the layer below it

### Requirement: Merge marked layers
When 2 or more non-Background layers are marked and a merge is triggered,
the system SHALL composite those layers' pixel content - honoring each
layer's own opacity and blend mode, in their existing stacking order,
exactly as they already composite for on-screen rendering and export - into
one new layer. The source layers SHALL be removed from the stack and
replaced by the merged layer at the position of the bottom-most merged
layer. The merged layer SHALL take the name of the topmost marked layer,
use blend mode Normal, and use 100% opacity. The merged layer SHALL become
the active layer, and all marks SHALL be cleared.

#### Scenario: Merging three marked layers
- **WHEN** three marked layers (with a mix of opacity and blend mode
  settings) are merged
- **THEN** the resulting single layer's pixel content matches how those
  three layers already looked when composited together on-screen, the
  layer sits at the bottom-most of the three layers' former position, is
  named after the topmost of the three, uses Normal blend mode at 100%
  opacity, and is the active layer

#### Scenario: Marks are cleared after merging
- **WHEN** a marked-set merge completes
- **THEN** no layer remains marked

#### Scenario: Non-adjacent marked layers still merge into one
- **WHEN** the marked layers are not directly adjacent in the stack (other
  unmarked layers sit between them)
- **THEN** the merge still combines only the marked layers into one layer at
  the bottom-most marked position, and the unmarked layers in between keep
  their own positions relative to the remaining stack

### Requirement: Merge active layer down
When fewer than 2 non-Background layers are marked and a merge is
triggered, the system SHALL merge the active layer into the layer directly
below it, using the same compositing, naming (top layer of the pair, i.e.
the active layer, wins the name), blend mode, and opacity rules as the
"Merge marked layers" requirement. If the active layer is the bottom-most
layer, or is the only layer, the merge SHALL be a no-op.

#### Scenario: Merging the active layer into the layer below
- **WHEN** the active layer is not the bottom-most layer and a merge-down is
  triggered
- **THEN** the active layer and the layer directly below it are combined
  into one layer at the lower layer's former position, named after the
  (former) active layer, using Normal blend mode at 100% opacity, and that
  merged layer becomes active

#### Scenario: No-op when the active layer is already at the bottom
- **WHEN** the active layer is the bottom-most layer in the stack and a
  merge-down is triggered
- **THEN** no layers are merged and the stack is unchanged

#### Scenario: No-op when the canvas has only one layer
- **WHEN** the canvas has exactly one layer and a merge-down is triggered
- **THEN** no merge occurs

### Requirement: Background layer excluded from merging
The Background layer SHALL never be merged, whether as part of a marked-set
merge or as the source or target of a merge-down. A marked set SHALL never
include the Background layer (per the marking requirement). Merge-down
SHALL treat the Background layer as an invalid merge target: if the active
layer sits directly above the Background layer, merge-down is a no-op
exactly as if the active layer had no layer below it.

#### Scenario: Merge-down does not merge into the Background layer
- **WHEN** the active layer sits directly above the Background layer and a
  merge-down is triggered
- **THEN** no merge occurs and the Background layer is unchanged

### Requirement: Merging layers is undoable
Merging layers (marked-set merge or merge-down) SHALL be undoable/redoable
the same way other layer operations (add/delete/reorder/rename/visibility/
opacity/blend mode) are.

#### Scenario: Undoing a merge
- **WHEN** the user merges layers and then triggers Undo
- **THEN** the merged layers are removed, the original source layers
  reappear in their prior positions with their original content, opacity,
  blend mode, and names, and the previously active layer is active again

### Requirement: Layers panel rows
The Layers panel SHALL list layers top to bottom as rounded row cards
(after Pixelmator Pro for iPad): a drag grip (none for the Background
layer), a live thumbnail, the name over a detail line ("Background",
"Reference · Original"/"Pixelated", or the blend mode and opacity, e.g.
"Normal · 100%"), the reference image layer's own toggles, and a
round visibility checkbox named "Show <layer>". A user-locked layer's
detail line SHALL start with a lock glyph, read out as "Locked". The
active row SHALL be highlighted and show a ⋯ button whose menu (after
Pixelmator Pro for iPad) offers, in order: a capsule strip of Cut, Copy
and Paste (icon over label; see the clipboard spec); Duplicate (⌘J), Lock
or Unlock, and Rename; a separator and Select Content; a separator and
Merge Down (⌘E), Group (⌘G) or Remove from Group, Move Up and Move Down; a
separator and Delete Layer (confirmed; undoable). The header SHALL offer
⋯ (Select Layers, Add Reference Image…), the Layers title, Add layer and
Close, with the active layer's blend and opacity in a row beneath (see
"Header blend and opacity").

#### Scenario: Hiding with the checkbox
- **WHEN** the user unchecks Layer 2's visibility checkbox
- **THEN** Layer 2 no longer composites, as one undoable step

### Requirement: Layer lock
The user SHALL be able to lock any layer except the reference image layer
from its ⋯ menu (Lock; Unlock once locked), as one undoable step. A lock
SHALL protect the layer's pixels only: every drawing tool, Move, the
Align and Rotate popovers' actions, selection Delete, Cut, and merging into or
from the layer SHALL be refused, with the toast "Layer is locked. Unlock
it from the layer's ⋯ menu." once per refused gesture and no undo step.
Reordering, grouping, visibility, opacity, blend mode, Rename, Duplicate,
Copy, Delete and canvas-wide resize, rotate and flip SHALL still work. The
lock SHALL be saved with the project and kept by undo/redo; a duplicate of
a locked layer SHALL start unlocked. It is separate from the Background
layer's reorder lock.

#### Scenario: Drawing on a locked layer
- **WHEN** the active layer is locked and the user draws a pencil stroke
- **THEN** the layer's pixels are unchanged, no undo step is added, and the
  lock toast is shown once

#### Scenario: Merge refused
- **WHEN** the layer directly below the active one is locked
- **THEN** Merge Down is disabled and ⌘E does nothing

### Requirement: Select Content
The layer ⋯ menu SHALL offer Select Content, which sets the selection to
exactly the layer's non-transparent pixels. It SHALL be disabled on an
empty layer and is not an undo step.

#### Scenario: Selecting a sprite
- **WHEN** the active layer's only pixels fill x 2–4, y 3–4 and the user
  chooses Select Content
- **THEN** exactly those 6 pixels are selected

### Requirement: Layer groups
The user SHALL be able to put layers in groups, one level deep: from a
row's ⋯ menu (Group), Select mode's Group, or Cmd/Ctrl+G (the selected
layers, else the active one). Grouped layers SHALL be gathered, in order,
at the topmost one's position. A group SHALL be listed as its own row
above its members - a chevron to collapse or expand it, a folder, its
name over "Group · N layers" (and its opacity when below 100%), ⋯ and a
visibility checkbox - with its members indented beneath it and hidden
while it's collapsed. The group's ⋯ menu SHALL offer Rename, Opacity…,
Ungroup, Move Group Up, Move Group Down and Delete Group (the group and
its layers; confirmed; undoable). A hidden group SHALL hide its members;
its opacity SHALL multiply theirs. Moving a group's top member up, or its
bottom member down, SHALL take it out of the group without moving it; an
ungrouped layer moved up into a group's bottom, or down into its top,
SHALL join it. Dropping a dragged layer under a group's header or between
two members SHALL put it in the group; above the header or under the last
member, outside it. The Background and reference image layers SHALL NOT
be grouped. Groups SHALL be saved with the project and restored by
undo/redo; projects from before groups open ungrouped.

#### Scenario: Grouping two layers
- **WHEN** the user selects Layer 2 and Layer 3 in Select mode and taps
  Group
- **THEN** a "Group 1" row appears above them, both are indented under it,
  and the canvas is unchanged

#### Scenario: Hiding a group
- **WHEN** the user unchecks a group's visibility checkbox
- **THEN** none of its layers composite, while their own checkboxes stay
  checked

#### Scenario: Group opacity
- **WHEN** a group holding one opaque black pixel is set to 50% opacity
- **THEN** that pixel composites at half opacity, and the group row reads
  "Group · 1 layer · 50%"

#### Scenario: Dragging into a group
- **WHEN** the user drops Layer 4 between two members of a group
- **THEN** Layer 4 is in the group, between them

### Requirement: Select mode
The header's ⋯ menu SHALL offer Select Layers, which shows a checkbox on
each row (disabled for the Background and reference image layers) and a
bar with the number selected, Group, Merge and Done. A tap on a row SHALL
toggle its selection instead of activating it. Group SHALL be available
when at least one ungrouped layer is selected; Merge when two or more are.
Group, Merge and Done SHALL leave Select mode. Cmd/Ctrl- and Shift-click
marking SHALL keep working outside Select mode.

#### Scenario: Merging two layers on a touch device
- **WHEN** the user chooses Select Layers, checks Layer 1 and Layer 2 and
  taps Merge
- **THEN** the two are merged into one layer and Select mode ends
