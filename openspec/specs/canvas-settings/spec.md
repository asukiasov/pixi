# canvas-settings Specification

## Purpose

Lets a user change an existing project's name, canvas dimensions, or
orientation after creation, instead of being locked into what they picked
in New Canvas.

## Requirements

### Requirement: Rename project
The user SHALL be able to change the current project's name.

#### Scenario: Renaming a project
- **WHEN** the user sets a new name in Canvas Settings
- **THEN** the project's name updates and is reflected in the Gallery

### Requirement: Resize (crop/pad) canvas
The user SHALL be able to change the current project's width and height
(1–256, same bounds as New Canvas), anchored at the top-left corner: making
a dimension smaller crops pixel content beyond the new bound; making a
dimension larger pads the new space as transparent. This applies uniformly
to every layer.

#### Scenario: Shrinking crops content
- **WHEN** the user resizes a project to smaller dimensions
- **THEN** pixel content beyond the new width/height is discarded on every
  layer, and content within the new bounds is unchanged

#### Scenario: Growing pads with transparency
- **WHEN** the user resizes a project to larger dimensions
- **THEN** the new area is fully transparent on every layer, and existing
  content keeps its original position relative to the top-left corner

### Requirement: Rotate canvas
The user SHALL be able to rotate the current project 90° clockwise or 90°
counter-clockwise, applied to every layer; width and height swap when the
canvas isn't square.

#### Scenario: Rotating a non-square canvas
- **WHEN** the user rotates a 32×16 project 90° clockwise
- **THEN** the project becomes 16×32, with every layer's content rotated to
  match

### Requirement: Canvas settings changes are undoable
Resize and rotate SHALL be undoable/redoable the same way other committed
actions are, and SHALL trigger the same auto-save as any other committed
action.

#### Scenario: Undoing a resize
- **WHEN** the user resizes a project and then taps Undo
- **THEN** the canvas returns to its previous dimensions and content

### Requirement: Canvas Settings is a popover, not a docked panel
Canvas Settings SHALL open as a popover anchored to the gear icon in the
top bar, positioned below it (flipping above if that would overflow the
bottom of the viewport) and clamped to the viewport horizontally, rather
than as a panel docked in the Workspace's normal layout flow. It SHALL be
closable via an explicit close button, clicking outside the popover, the
Escape key, or re-clicking the gear icon - and SHALL start closed on
every freshly opened project.

#### Scenario: Opening never shifts the layout
- **WHEN** the user clicks the gear icon to open Canvas Settings
- **THEN** the popover appears floating over the canvas area; the canvas,
  palette row, and bottom bar do not move or resize

#### Scenario: Closing via the close button
- **WHEN** Canvas Settings is open and the user clicks its close button
- **THEN** it closes

#### Scenario: Closing via outside click or Escape
- **WHEN** Canvas Settings is open and the user clicks anywhere outside
  it, or presses Escape
- **THEN** it closes

#### Scenario: Re-clicking the gear icon toggles it closed
- **WHEN** Canvas Settings is open and the user clicks the gear icon again
- **THEN** it closes (does not reposition and stay open)

#### Scenario: A freshly opened project starts with it closed
- **WHEN** the user opens a project while Canvas Settings was left open
  on a previously open project
- **THEN** the newly opened project's Workspace starts with Canvas
  Settings closed
