## MODIFIED Requirements

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

## ADDED Requirements

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
