## MODIFIED Requirements

### Requirement: Rename layer
The user SHALL be able to rename a layer. A layer's name SHALL be shown in
the Layers panel as plain, non-editable text; renaming SHALL start only
from an explicit action - a double-click (mouse), a double-tap (touch,
including iPad), or Enter/F2 while the name has keyboard focus. A single
click or tap on the name SHALL behave exactly like a click or tap anywhere
else on the row (select the layer, or mark it with Cmd/Ctrl/Shift) and
SHALL NOT start editing.

#### Scenario: Renaming a layer
- **WHEN** the user sets a new name for a layer
- **THEN** the layer's name updates and is shown in the Layers panel

#### Scenario: Single click or tap on the name selects, not edits
- **WHEN** the user single-clicks or single-taps a layer's name
- **THEN** that layer becomes the active layer
- **AND** no text field is shown and (on touch devices) no on-screen
  keyboard opens

#### Scenario: Double-click or double-tap enters rename mode
- **WHEN** the user double-clicks or double-taps a layer's name
- **THEN** the name is replaced by a focused text field containing the
  current name, fully selected

#### Scenario: Keyboard entry into rename mode
- **WHEN** a layer's name has keyboard focus and the user presses Enter
  or F2
- **THEN** rename mode starts for that layer

#### Scenario: Committing a rename
- **WHEN** the user is in rename mode and presses Enter or moves focus
  away
- **THEN** the trimmed new name is saved, shown as plain text again, and
  the rename is undoable like other layer operations

#### Scenario: Cancelling a rename
- **WHEN** the user is in rename mode and presses Escape
- **THEN** the original name is kept and shown as plain text again

#### Scenario: Empty or unchanged name
- **WHEN** the user commits rename mode with an empty (or whitespace-only)
  name, or with the name unchanged
- **THEN** the original name is kept and no undo history entry is added
