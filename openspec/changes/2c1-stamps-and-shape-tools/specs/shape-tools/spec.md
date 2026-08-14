## Purpose

Adds procedural shape-drawing tools (line, rectangle) and a rectangular
selection that scopes where any tool is allowed to draw — the next tier of
tools beyond Phase 1's freehand pencil/eraser/bucket.

## ADDED Requirements

### Requirement: Line tool
The user SHALL be able to draw a straight 1px line by dragging from a
start point to an end point on the active layer, in the current draw
color, previewed live while dragging and committed on release.

#### Scenario: Drawing a line
- **WHEN** the user drags from one point to another with the Line tool
- **THEN** a 1px line connecting the two points is drawn on the active
  layer once the drag ends

#### Scenario: Live preview while dragging
- **WHEN** the user is mid-drag with the Line tool
- **THEN** the line's current end-to-end path is shown on the canvas but
  not yet committed to the layer

### Requirement: Rectangle tool
The user SHALL be able to draw a rectangle by dragging to define opposite
corners, in the current draw color, with a toggle between outline and
filled, previewed live while dragging and committed on release.

#### Scenario: Drawing an outline rectangle
- **WHEN** the user drags to define a rectangle with the outline mode
  selected
- **THEN** a 1px rectangular outline is drawn between the two corners

#### Scenario: Drawing a filled rectangle
- **WHEN** the user drags to define a rectangle with the filled mode
  selected
- **THEN** every pixel within the rectangle's bounds is set to the current
  draw color

### Requirement: Rectangular selection
The user SHALL be able to define a rectangular selection by dragging on
the active layer. A selection persists across tool switches until cleared.

#### Scenario: Making a selection
- **WHEN** the user drags with the Selection tool
- **THEN** the dragged rectangle becomes the active selection, visibly
  marked on the canvas

#### Scenario: Clearing a selection
- **WHEN** the user clears the selection
- **THEN** no selection remains and other tools can draw anywhere on the
  canvas again

### Requirement: Drawing is clipped to an active selection
While a selection is active, pencil, eraser, bucket, stamp, line, and
rectangle SHALL only affect pixels within the selection; attempts to draw
outside it SHALL have no effect.

#### Scenario: Drawing outside an active selection
- **WHEN** a selection is active and the user draws with any tool at a
  point outside it
- **THEN** no pixels change

#### Scenario: Drawing inside an active selection
- **WHEN** a selection is active and the user draws with any tool within
  it
- **THEN** drawing behaves exactly as it would with no selection active,
  for the portion inside the selection

### Requirement: Delete selected pixels
While a selection is active, the user SHALL be able to clear every pixel
within it on the active layer to fully transparent.

#### Scenario: Deleting a selection's contents
- **WHEN** the user deletes the contents of an active selection
- **THEN** every pixel within the selection on the active layer becomes
  fully transparent, and the action is undoable

### Requirement: Shape and selection actions are undoable
Line, rectangle, and delete-selection SHALL be undoable/redoable the same
way a stroke or fill is, and SHALL auto-save the same way. Making or
clearing a selection itself is not a canvas edit and is NOT part of the
undo history.

#### Scenario: Undoing a rectangle
- **WHEN** the user draws a rectangle and then taps Undo
- **THEN** the layer reverts to its state before that rectangle was drawn
