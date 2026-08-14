## Purpose

Lets a user place predefined pixel-art patterns (like a heart) with a
single click, filled with their current draw color, instead of drawing
them freehand every time.

## ADDED Requirements

### Requirement: Brush picker
The Brush tool SHALL offer a picker of available brush shapes; selecting
one makes it the current brush. The system ships with one shape (Heart).

#### Scenario: Selecting a brush
- **WHEN** the user selects the Heart brush from the picker
- **THEN** Heart becomes the current brush for subsequent placements

### Requirement: Place a brush
Tapping the canvas with the Brush tool active SHALL place the current
brush's pattern on the active layer, centered on the tapped point, with
every "on" pixel of the pattern set to the current draw color and every
"off" pixel left untouched.

#### Scenario: Placing the Heart brush
- **WHEN** the user taps the canvas with the Heart brush and a color
  selected
- **THEN** the heart pattern appears on the active layer at that location,
  in the selected color, and pixels not part of the pattern are unchanged

#### Scenario: Placement near a canvas edge
- **WHEN** the user places a brush close enough to a canvas edge that part
  of the pattern would fall outside the canvas
- **THEN** the in-bounds portion of the pattern is drawn and the
  out-of-bounds portion is discarded, without error

### Requirement: Brush placement is undoable
Placing a brush SHALL be undoable/redoable the same way a stroke or fill
is, and SHALL auto-save the same way. A drag that places a trail of brushes
(see "Continuous brush placement while dragging") counts as one action for
undo purposes — one Undo reverts the whole drag, not brush-by-brush.

#### Scenario: Undoing a brush placement
- **WHEN** the user places a brush and then taps Undo
- **THEN** the layer reverts to its state before that brush was placed

#### Scenario: Undoing a dragged trail of brushes
- **WHEN** the user drags the Brush tool across the canvas and then taps
  Undo
- **THEN** the layer reverts to its state before the drag started, not to
  an intermediate point within the trail

### Requirement: Continuous brush placement while dragging
Dragging with the Brush tool active SHALL place the current brush
repeatedly along the drag path, roughly once per pixel of movement (using
the same line-interpolation the Line tool uses, so fast drags don't skip
gaps), instead of only placing once per tap.

#### Scenario: Dragging places a trail of brushes
- **WHEN** the user drags the Brush tool across the canvas
- **THEN** the brush pattern is placed repeatedly along the dragged path,
  roughly one brush per pixel moved

#### Scenario: A stationary tap still places exactly one brush
- **WHEN** the user taps without dragging
- **THEN** exactly one brush is placed, matching prior single-tap behavior

### Requirement: Rainbow color mode
"Rainbow" SHALL be selectable as one entry in the same color palette used
to pick a regular draw color — not a separate toggle — and is mutually
exclusive with picking a regular color, the same way picking one palette
color deselects the previous one. While Rainbow is the selected color,
each brush placed (whether from a single tap or a dragged trail) SHALL use
the next color in a cycling rainbow sequence instead of a fixed color; the
sequence advances by a fixed hue step per brush placed and wraps around.
Rainbow only affects the Brush tool: other tools (pencil, bucket, line,
rectangle) SHALL keep using the last regular color that was selected,
regardless of whether Rainbow is currently selected.

#### Scenario: Placing brushes with Rainbow selected
- **WHEN** Rainbow is the selected color and the user drags the Brush tool
- **THEN** consecutive brushes along the trail have different, cyclically
  progressing colors

#### Scenario: A regular color is selected instead
- **WHEN** the user selects a regular palette color (deselecting Rainbow)
- **THEN** every brush placed (single tap or dragged trail) uses that
  color, as before

#### Scenario: Rainbow selected has no effect on other tools
- **WHEN** Rainbow is the selected color and the user draws with pencil,
  eraser, bucket, line, or rectangle
- **THEN** that tool uses the last regular color that was selected, not a
  rainbow-cycling color

#### Scenario: Each new drag restarts the rainbow sequence
- **WHEN** the user starts a new Brush drag while Rainbow is selected
- **THEN** the color sequence restarts from the same starting hue as any
  other drag, rather than continuing from where the previous drag left off
