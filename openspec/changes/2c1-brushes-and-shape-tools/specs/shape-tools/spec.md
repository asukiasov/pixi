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

#### Scenario: Constraining to a square with Shift
- **WHEN** the user holds Shift while dragging with the Rectangle tool
- **THEN** the drawn rectangle is constrained to equal width and height (a
  square), following whichever of the two the drag's larger delta implies,
  in the drag's current direction

#### Scenario: Releasing Shift mid-drag returns to free-form
- **WHEN** the user releases Shift while still dragging
- **THEN** the rectangle immediately goes back to following the pointer
  freely, no longer constrained to a square

### Requirement: 1:1 proportion toggle (Rectangle and Selection)
A persistent "1:1 proportion" toggle SHALL be available for the
Rectangle and Selection tools, constraining drags to a square exactly
like holding Shift does, for as long as it stays on - not just while
physically held. Requested directly: touchscreens (iPad, etc.) have no
Shift key, so Shift's square constraint (see the Rectangle tool
requirement above) was unreachable there. Shift and the toggle are
independent triggers for the same constraint - either being active is
enough, and the toggle does not require Shift to also be held. Applies
identically to both tools, not Rectangle only, since Selection's
rectangular drag has the exact same "square vs. free-form" shape
question.

#### Scenario: Toggling it on constrains drags to a square
- **WHEN** the "1:1 proportion" toggle is on and the user drags with the
  Rectangle or Selection tool
- **THEN** the result is constrained to a square, the same as holding
  Shift would produce

#### Scenario: It stays on across multiple drags
- **WHEN** the toggle is on and the user completes a drag, then starts
  another
- **THEN** the new drag is also square-constrained - the toggle does not
  reset itself after one use

#### Scenario: Shift still works independently
- **WHEN** the toggle is off and the user holds Shift while dragging
- **THEN** the drag is square-constrained exactly as before, unaffected
  by the toggle's state

#### Scenario: Visible only for Rectangle and Selection
- **WHEN** any tool other than Rectangle or Selection is active
- **THEN** the toggle is hidden

### Requirement: Rectangular selection
The user SHALL be able to define a rectangular selection by dragging on
the active layer. A selection persists across tool switches until cleared.
Besides the existing explicit "Clear selection" control, the user SHALL
also be able to clear the active selection by clicking outside it with
the Selection tool active, by pressing Escape, or by pressing Cmd/Ctrl+D
— all while the Workspace screen is open, all equivalent to clicking
"Clear selection".

#### Scenario: Making a selection
- **WHEN** the user drags with the Selection tool
- **THEN** the dragged rectangle becomes the active selection, visibly
  marked on the canvas

#### Scenario: Clearing a selection
- **WHEN** the user clears the selection
- **THEN** no selection remains and other tools can draw anywhere on the
  canvas again

#### Scenario: Clicking outside the selection clears it
- **WHEN** a selection is active, the Selection tool is active, and the
  user clicks (without dragging) at a point outside the current selection
- **THEN** the selection is cleared, the same as clicking "Clear
  selection"

#### Scenario: Clicking inside the selection starts a new one, not a clear
- **WHEN** a selection is active and the user drags starting from a point
  inside it with the Selection tool
- **THEN** the drag defines a new selection (replacing the old one) rather
  than clearing it

#### Scenario: Escape clears the selection
- **WHEN** a selection is active and the user presses Escape while the
  Workspace screen is open
- **THEN** the selection is cleared, regardless of which tool is
  currently active

#### Scenario: Cmd/Ctrl+D clears the selection
- **WHEN** a selection is active and the user presses Cmd/Ctrl+D while
  the Workspace screen is open
- **THEN** the selection is cleared, regardless of which tool is
  currently active, and the browser's default action for that shortcut
  (bookmarking the page) does not occur

### Requirement: Drawing is clipped to an active selection
While a selection is active, pencil, eraser, bucket, brush, line, and
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
