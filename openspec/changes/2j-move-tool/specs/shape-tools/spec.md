## Purpose

Adds a Move tool that relocates pixel content on the active layer,
building on the rectangular Selection tool `2c1-brushes-and-shape-tools`
already added — closing the "moving/copying selected content is out of
scope" gap that slice's proposal explicitly deferred.

## ADDED Requirements

### Requirement: Move tool
The user SHALL be able to drag pixel content on the active layer to a new
position with the Move tool (shortcut `V`). With an active selection, only
the selected rectangle's content moves and the selection rect moves with
it. With no active selection, the entire active layer's content moves.
The area the content moved away from becomes fully transparent. The move
is previewed live while dragging and committed as a single undo step on
release.

#### Scenario: Moving with no active selection
- **WHEN** the user drags with the Move tool and no selection is active
- **THEN** the entire active layer's pixel content shifts by the drag's
  offset, and the area it moved away from becomes fully transparent

#### Scenario: Moving with an active selection
- **WHEN** the user drags with the Move tool while a selection is active
- **THEN** only the pixel content within the selection's rectangle moves
  by the drag's offset, pixels on the same layer outside the selection's
  original bounds are unaffected except where the moved content now
  overlaps them, and the selection rectangle itself relocates to match

#### Scenario: A drag starting outside the current selection still moves it
- **WHEN** a selection is active and the user starts a Move drag from a
  point outside the selection's bounds
- **THEN** the selection's content still moves by the drag's offset, the
  same as a drag starting inside it

#### Scenario: Live preview while dragging
- **WHEN** the user is mid-drag with the Move tool
- **THEN** the moved content's current position is shown on the canvas
  but not yet committed to the layer

#### Scenario: Undo reverts a move in one step
- **WHEN** the user completes a Move drag and then triggers Undo
- **THEN** the moved content and the source area both revert to their
  pre-move state in a single step

#### Scenario: Moving affects only the active layer
- **WHEN** the user performs a Move drag
- **THEN** no layer other than the active layer's pixel content changes
