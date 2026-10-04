## ADDED Requirements

### Requirement: Undo a single-color removal
Removing a single color in edit-colors mode SHALL show an informational
toast naming the removed color, with an "Undo" action. Activating Undo
SHALL put the color back at its original position in the palette it was
removed from, persisted, even if the user has since switched palettes.
Only the most recent removal SHALL be undoable: a new removal SHALL
dismiss the previous removal's Undo toast. If restoring fails, an error
toast SHALL say so.

#### Scenario: Undoing a removal
- **WHEN** the user removes a color and then activates "Undo" on the
  toast
- **THEN** the color reappears in the same position in that palette and
  survives a reload

#### Scenario: Only the latest removal offers Undo
- **WHEN** the user removes two colors in a row
- **THEN** only the second removal's Undo toast is shown, and using it
  restores that color to its exact position
