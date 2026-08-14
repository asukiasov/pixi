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
