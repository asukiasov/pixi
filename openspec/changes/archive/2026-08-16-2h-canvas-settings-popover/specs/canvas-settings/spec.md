## ADDED Requirements

### Requirement: Canvas Settings is a popover, not a docked panel
Canvas Settings SHALL open as a popover anchored to the gear icon in the
top bar, positioned below it (flipping above if that would overflow the
bottom of the viewport) and clamped to the viewport horizontally, rather
than as a panel docked in the Workspace's normal layout flow. It SHALL be
closable via an explicit close button, clicking outside the popover, the
Escape key, or re-clicking the gear icon - and SHALL start closed on
every freshly opened project.

#### Scenario: Opening never shifts the layout
- **WHEN** the user clicks the gear icon to open Canvas Settings
- **THEN** the popover appears floating over the canvas area; the canvas,
  palette row, and bottom bar do not move or resize

#### Scenario: Closing via the close button
- **WHEN** Canvas Settings is open and the user clicks its close button
- **THEN** it closes

#### Scenario: Closing via outside click or Escape
- **WHEN** Canvas Settings is open and the user clicks anywhere outside
  it, or presses Escape
- **THEN** it closes

#### Scenario: Re-clicking the gear icon toggles it closed
- **WHEN** Canvas Settings is open and the user clicks the gear icon again
- **THEN** it closes (does not reposition and stay open)

#### Scenario: A freshly opened project starts with it closed
- **WHEN** the user opens a project while Canvas Settings was left open
  on a previously open project
- **THEN** the newly opened project's Workspace starts with Canvas
  Settings closed
