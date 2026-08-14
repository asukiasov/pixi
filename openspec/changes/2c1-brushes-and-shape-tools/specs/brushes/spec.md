## Purpose

Lets a user place predefined (or their own custom-drawn) pixel-art
patterns with a single click, filled with their current draw color,
instead of drawing them freehand every time.

## ADDED Requirements

### Requirement: Brush picker
The Brush tool SHALL offer a picker of available brush shapes, presented
as a titled panel (a thumbnail grid, similar in layout to the Layers
panel) rather than a bare unlabeled row; selecting one makes it the
current brush. The system ships with two built-in shapes (Heart, Circle).
The Brushes panel SHALL be visible only while the Brush tool is the
current tool, the same way the Canvas Settings panel is scoped to its own
toggle — other tools don't need it taking up space.

#### Scenario: Selecting a brush
- **WHEN** the user selects the Heart brush from the picker
- **THEN** Heart becomes the current brush for subsequent placements

#### Scenario: Panel visibility follows tool selection
- **WHEN** the user switches to a tool other than Brush
- **THEN** the Brushes panel is hidden, and it reappears when the Brush
  tool is selected again

### Requirement: Brush thumbnails show the pattern, not the name
Each entry in the Brush picker SHALL show a black-on-white pixel preview
of the brush's own pattern (scaled up, crisp/unblurred) rather than its
name as text. The name remains available as a tooltip/title.

#### Scenario: Picker shows pattern previews
- **WHEN** the Brushes panel is open
- **THEN** each brush entry displays a small black-and-white rendering of
  its pixel pattern instead of its name

### Requirement: Circle brush
The system SHALL ship a built-in Circle brush, a filled 5×5 circular
pattern, alongside Heart.

#### Scenario: Placing the Circle brush
- **WHEN** the user places the Circle brush
- **THEN** a filled 5×5 circular pattern appears on the active layer,
  centered on the placed point, in the current draw color

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
repeatedly along the drag path (using the same line-interpolation the Line
tool uses, so fast drags don't skip gaps), spaced according to the current
Spacing setting, instead of only placing once per tap.

#### Scenario: Dragging places a trail of brushes
- **WHEN** the user drags the Brush tool across the canvas with Spacing at
  its default (1px)
- **THEN** the brush pattern is placed repeatedly along the dragged path,
  roughly one brush per pixel moved

#### Scenario: A stationary tap still places exactly one brush
- **WHEN** the user taps without dragging
- **THEN** exactly one brush is placed, matching prior single-tap behavior,
  regardless of the Spacing setting

### Requirement: Brush spacing
The Brushes panel SHALL offer a Spacing control (in pixels, minimum 1)
governing how far apart consecutive placements are along a drag — e.g.
Spacing 1 places on every pixel of the path, Spacing 4 places roughly every
4th pixel. Spacing applies only to dragged placement; a single tap always
places exactly one brush regardless of Spacing.

#### Scenario: Increasing spacing produces a sparser trail
- **WHEN** the user sets Spacing to 4 and drags the Brush tool
- **THEN** the placements along the trail are spaced roughly 4 pixels apart
  instead of touching every pixel

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

### Requirement: Custom brush creation
The Brushes panel SHALL offer an "add brush" control that opens a
pixel-grid editor (a grid the user clicks or drags across to toggle cells
on/off, independent of any project's canvas). Before drawing, the editor
SHALL let the user choose the grid's width and height, each independently
constrained to a minimum of 3 and a maximum of the current project's
canvas width/height respectively (so a brush can never be larger than the
canvas it would be used on); changing the size re-grids from a blank
pattern. Saving with a name adds it to the brush picker as a new brush,
usable exactly like a built-in one. Canceling discards it.

#### Scenario: Creating a custom brush
- **WHEN** the user opens the brush editor, toggles a pattern of cells on,
  names it, and saves
- **THEN** a new brush with that pattern and name appears in the picker and
  can be placed like Heart or Circle

#### Scenario: Choosing a custom brush size
- **WHEN** the user opens the brush editor on a 32×32 canvas and sets the
  size to 5×12
- **THEN** the editor grid becomes 5 cells wide and 12 cells tall, and the
  saved brush uses that same size

#### Scenario: Size is bounded by the canvas
- **WHEN** the user attempts to set a dimension below 3 or above the
  current canvas's matching dimension
- **THEN** the value is clamped to the nearest valid size (3 at the low
  end, the canvas's width/height at the high end)

#### Scenario: Canceling brush creation
- **WHEN** the user opens the brush editor and cancels instead of saving
- **THEN** no new brush is added

### Requirement: Custom brushes persist across projects
A saved custom brush SHALL be stored locally (IndexedDB) and available in
every project, not just the one open when it was created — the same way
built-in brushes are available everywhere. Deleting a custom brush SHALL
remove it from the picker in every project going forward. Built-in brushes
(Heart, Circle) cannot be deleted.

#### Scenario: A custom brush is available in a different project
- **WHEN** the user creates a custom brush while project A is open, then
  opens project B
- **THEN** the custom brush appears in project B's picker too

#### Scenario: Deleting a custom brush
- **WHEN** the user deletes a custom brush from the picker
- **THEN** it no longer appears in any project's picker, and existing
  brush strokes already placed with it are unaffected (only the picker
  entry is removed, not past canvas content)
