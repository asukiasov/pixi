## ADDED Requirements

### Requirement: Layers panel placement
The Layers panel SHALL be presented as a right-side sidebar (alongside
the Brushes panel), not stacked below the canvas in the main workspace
column.

#### Scenario: Layers panel renders on the right
- **WHEN** the Workspace screen is open
- **THEN** the Layers panel appears as a right-side column, not below the
  canvas/Canvas Settings area

### Requirement: Layers panel visibility toggle
The user SHALL be able to show or hide the entire Layers panel via a
toggle control, independent of the Brushes panel's own (tool-scoped)
visibility — hiding Layers does not affect Brushes and vice versa.

#### Scenario: Hiding the Layers panel
- **WHEN** the user toggles the Layers panel closed
- **THEN** the panel disappears and the toggle control indicates it can be
  reopened

#### Scenario: Showing the Layers panel again
- **WHEN** the user toggles a hidden Layers panel back open
- **THEN** the panel reappears showing the current layer stack, unaffected
  by having been hidden

#### Scenario: Independent of the Brushes panel
- **WHEN** the user hides the Layers panel while the Brush tool is active
  (Brushes panel visible)
- **THEN** the Brushes panel remains visible, unaffected by the Layers
  panel's visibility toggle
