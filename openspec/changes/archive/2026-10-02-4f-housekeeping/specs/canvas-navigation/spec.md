## MODIFIED Requirements

### Requirement: Whole right sidebar visibility toggle
The Workspace top bar SHALL offer a single control that shows or hides
the entire right sidebar (Color Library, Brushes, and Layers together),
independent of each panel's own collapsed/expanded state. Hiding the
sidebar SHALL let the canvas area expand into the freed width. Showing
or hiding SHALL slide (the sidebar's width animates over a short
duration, with the canvas area growing or shrinking alongside it), and
SHALL switch instantly instead when the user prefers reduced motion.
While hidden, the sidebar's controls SHALL NOT be reachable by keyboard
focus or assistive technology.

#### Scenario: Hiding the whole sidebar
- **WHEN** the user clicks the right-sidebar visibility toggle while the
  sidebar is shown
- **THEN** the entire right sidebar slides closed and the canvas area
  expands to use the freed width

#### Scenario: Showing the whole sidebar again
- **WHEN** the user clicks the toggle while the sidebar is hidden
- **THEN** the right sidebar slides back open with each panel's prior
  collapsed/expanded state unchanged, and the canvas area shrinks back

#### Scenario: Independent of per-panel collapse state
- **WHEN** the user hides the whole sidebar while the Layers panel was
  individually collapsed to its header
- **THEN** re-showing the sidebar restores the Layers panel still
  collapsed to its header, rather than resetting it to expanded

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and they toggle the
  sidebar
- **THEN** it shows or hides immediately, with no slide

#### Scenario: Hidden sidebar is out of the focus order
- **WHEN** the sidebar is hidden and the user presses Tab through the
  Workspace
- **THEN** focus never lands on a control inside the hidden sidebar
