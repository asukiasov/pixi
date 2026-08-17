## Purpose

Lets a user draw symmetric pixel art faster by mirroring Pencil, Eraser,
and Brush strokes live across a horizontal and/or vertical axis centered
on the canvas, instead of drawing and matching both halves by hand.

## ADDED Requirements

### Requirement: Symmetry mode toggle
The system SHALL offer a symmetry drawing control in the Workspace with
three states: off, horizontal mirror, vertical mirror, and both (4-way).
The control is a toggle in the left tools sidebar, not a separate tool,
and does not open a tool-scoped option panel. The mirror axis is fixed at
the canvas's horizontal and/or vertical center; there is no draggable or
offset axis in this requirement.

#### Scenario: Cycling symmetry state
- **WHEN** the user activates the symmetry control repeatedly
- **THEN** it cycles through off, horizontal, vertical, and both, and the
  control visibly reflects the current state

#### Scenario: Symmetry state does not persist across sessions
- **WHEN** the user sets symmetry to horizontal, then reloads the app or
  reopens the project later
- **THEN** symmetry starts back at off, matching the existing pixel-perfect
  toggle's session-only behavior

### Requirement: Mirrored strokes for Pencil, Eraser, and Brush
While a symmetry mode is active, the system SHALL mirror every pixel
written by the Pencil, Eraser, or Brush tool across the active axis/axes,
applied to the same layer and committed as part of the same undo/redo
step as the originating stroke. Bucket fill, Line, Rectangle, Selection,
and Move are unaffected by symmetry mode.

#### Scenario: Horizontal mirror
- **WHEN** symmetry is set to horizontal and the user draws a Pencil
  stroke on the left half of the canvas
- **THEN** the mirrored pixels appear on the right half, at the same
  vertical position and equal horizontal distance from the canvas's
  vertical center line

#### Scenario: Vertical mirror
- **WHEN** symmetry is set to vertical and the user draws a Brush stroke
  in the top half of the canvas
- **THEN** the mirrored pixels appear in the bottom half, at the same
  horizontal position and equal vertical distance from the canvas's
  horizontal center line

#### Scenario: Both axes (4-way)
- **WHEN** symmetry is set to both and the user draws a single Pencil
  stroke off-center
- **THEN** up to four mirrored copies of the stroke appear, one in each
  quadrant reflection of the original (fewer than four where the stroke
  crosses a center line, since a mirrored pixel landing on the same
  location as another is not duplicated)

#### Scenario: Single undo step
- **WHEN** the user draws one stroke with symmetry active and then
  presses Undo once
- **THEN** the original stroke and all its mirrored pixels are removed
  together, not one axis at a time

#### Scenario: Eraser respects symmetry
- **WHEN** symmetry is active and the user erases pixels with the Eraser
  tool
- **THEN** the mirrored positions are erased as well, following the same
  axis rules as drawing

#### Scenario: Tools outside the mirrored set are unaffected
- **WHEN** symmetry is active and the user uses Bucket, Line, Rectangle,
  Selection, or Move
- **THEN** no mirroring occurs — those tools behave exactly as they do
  with symmetry off

### Requirement: Symmetry axis clipping at odd canvas sizes
The system SHALL define the mirror axis at the canvas's midpoint
regardless of whether the canvas width/height is even or odd, and SHALL
NOT write outside the canvas bounds when a mirrored pixel would fall
off-canvas.

#### Scenario: Odd-width canvas
- **WHEN** the canvas width is odd (e.g. 17px) and horizontal symmetry is
  active
- **THEN** the center column mirrors to itself (drawing on it does not
  produce a visibly separate mirrored pixel), and columns on either side
  mirror to their corresponding column on the opposite side
