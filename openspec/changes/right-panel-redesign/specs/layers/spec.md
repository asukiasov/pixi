## ADDED Requirements

### Requirement: Layers panel position in the right sidebar
The Layers panel SHALL be the bottom-most section of the right sidebar,
below the Color Library panel and the Brushes panel (when Brushes is
shown), rather than the topmost section.

#### Scenario: Layers renders below Color Library and Brushes
- **WHEN** the Workspace screen is open
- **THEN** the Layers panel appears below the Color Library panel in the
  right sidebar, and below the Brushes panel whenever Brushes is also
  visible

### Requirement: Layers panel collapse
The user SHALL be able to collapse the Layers panel down to just its
header row (hiding the toolbar and layer list, but not the header
itself) by clicking the panel header, and expand it again the same way.
The existing bottom-bar Layers toggle button SHALL drive and reflect
this same collapsed state, so either control collapses or expands the
panel identically.

#### Scenario: Collapsing via the panel header
- **WHEN** the user clicks the Layers panel header
- **THEN** the toolbar and layer list disappear, only the header row
  remains, and the Color Library panel above grows to use the freed
  vertical space

#### Scenario: Expanding via the panel header
- **WHEN** the user clicks the header of a collapsed Layers panel
- **THEN** the toolbar and layer list reappear showing the current layer
  stack, unaffected by having been collapsed

#### Scenario: Bottom-bar toggle and header stay in sync
- **WHEN** the user collapses the Layers panel via the bottom-bar Layers
  button
- **THEN** the panel header shows the collapsed state (e.g. its chevron
  points the collapsed direction), and clicking the header then expands
  it; the reverse also holds when collapsing via the header first

### Requirement: Layers toolbar one-line Blend mode and Opacity controls
The Layers panel's shared Blend mode and Opacity controls (editing
whichever layer is active) SHALL fit on a single row: the Blend mode
selector sized to its own content rather than the full row width, and
Opacity presented as a directly-editable numeric field (0-100) rather
than an always-visible slider. Clicking the Opacity field SHALL open a
slider in a small popover for drag-to-set; typing a value directly in
the field SHALL also work without opening the popover.

#### Scenario: Blend mode and Opacity share one row
- **WHEN** the Layers panel toolbar is visible
- **THEN** the Blend mode selector and the Opacity control both appear
  on the same row, without wrapping to a second line at the sidebar's
  normal width

#### Scenario: Typing an opacity value directly
- **WHEN** the user types a number into the Opacity field and confirms
  it
- **THEN** the active layer's opacity updates to that value, the same as
  dragging the slider would

#### Scenario: Adjusting opacity via the popover slider
- **WHEN** the user clicks the Opacity field and drags the slider that
  appears in the popover
- **THEN** the active layer's opacity updates live as the slider moves,
  and the numeric field reflects the current value

#### Scenario: Popover closes without committing an in-progress edit incorrectly
- **WHEN** the user clicks outside the open Opacity popover, or presses
  Escape
- **THEN** the popover closes and the active layer's opacity remains
  whatever value was last set
