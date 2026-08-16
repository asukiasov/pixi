# layers Specification

## Purpose

Lets a user build a drawing out of multiple stacked, independently
controllable layers instead of one flat buffer, so separate elements
(sketch, lineart, shading, etc.) can be drawn, hidden, reordered, and blended
without affecting each other.

## Requirements

### Requirement: Starting layer
Creating a new canvas SHALL produce a layer stack with exactly one layer,
filled with the chosen background (transparent or white), which becomes the
active layer.

#### Scenario: New canvas has one layer
- **WHEN** the user creates a new canvas
- **THEN** the Workspace shows a layer stack containing exactly one layer,
  matching the chosen background, and it is the active layer

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
