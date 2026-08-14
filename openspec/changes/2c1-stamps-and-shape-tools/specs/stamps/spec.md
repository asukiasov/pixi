## Purpose

Lets a user place predefined pixel-art patterns (like a heart) with a
single click, filled with their current draw color, instead of drawing
them freehand every time.

## ADDED Requirements

### Requirement: Stamp picker
The Stamps tool SHALL offer a picker of available stamp shapes; selecting
one makes it the current stamp. The system ships with one shape (Heart).

#### Scenario: Selecting a stamp
- **WHEN** the user selects the Heart stamp from the picker
- **THEN** Heart becomes the current stamp for subsequent placements

### Requirement: Place a stamp
Tapping the canvas with the Stamps tool active SHALL place the current
stamp's pattern on the active layer, centered on the tapped point, with
every "on" pixel of the pattern set to the current draw color and every
"off" pixel left untouched.

#### Scenario: Placing the Heart stamp
- **WHEN** the user taps the canvas with the Heart stamp and a color
  selected
- **THEN** the heart pattern appears on the active layer at that location,
  in the selected color, and pixels not part of the pattern are unchanged

#### Scenario: Placement near a canvas edge
- **WHEN** the user places a stamp close enough to a canvas edge that part
  of the pattern would fall outside the canvas
- **THEN** the in-bounds portion of the pattern is drawn and the
  out-of-bounds portion is discarded, without error

### Requirement: Stamp placement is undoable
Placing a stamp SHALL be undoable/redoable the same way a stroke or fill
is, and SHALL auto-save the same way.

#### Scenario: Undoing a stamp placement
- **WHEN** the user places a stamp and then taps Undo
- **THEN** the layer reverts to its state before that stamp was placed
