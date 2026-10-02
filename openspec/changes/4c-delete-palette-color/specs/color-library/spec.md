## ADDED Requirements

### Requirement: Remove a single color from a palette
The Color Library panel SHALL offer an "Edit colors" toggle that switches
the swatch grid into an edit mode. In edit mode every swatch SHALL show a
visible remove cue and SHALL be labelled as a remove action for assistive
technology, and activating a swatch (click, tap, Apple Pencil tap, or
keyboard) SHALL remove exactly that one occurrence of the color from the
active palette, persisted the same way added colors are, instead of
setting it as the Foreground color. Edit mode SHALL end when the toggle
is activated again, when Escape is pressed, when the active palette
changes, or when the workspace is reset. The built-in default
("Material") palette SHALL never lose its last remaining color.

#### Scenario: Removing a color
- **WHEN** the user turns on edit mode and taps a swatch
- **THEN** that color disappears from the active palette's grid, the
  Foreground color is unchanged, and the removal survives a page reload

#### Scenario: Picking a color outside edit mode is unchanged
- **WHEN** edit mode is off and the user taps a swatch
- **THEN** that color becomes the Foreground color and nothing is
  removed

#### Scenario: Duplicates are removed one at a time
- **WHEN** a palette contains the same color twice and the user removes
  one of those swatches in edit mode
- **THEN** exactly one swatch of that color remains

#### Scenario: Leaving edit mode
- **WHEN** edit mode is on and the user activates the toggle again,
  presses Escape, or switches to a different palette
- **THEN** edit mode ends and tapping a swatch picks it again

#### Scenario: The default palette keeps at least one color
- **WHEN** edit mode is on for the built-in "Material" palette and only
  one color remains
- **THEN** that swatch can't be removed

#### Scenario: A user palette can be emptied
- **WHEN** the user removes the last color of a non-default palette
- **THEN** the palette remains and shows its existing empty-state message
