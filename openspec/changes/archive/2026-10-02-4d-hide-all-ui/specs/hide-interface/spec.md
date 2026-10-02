## Purpose

Lets the user hide all workspace interface chrome so only the canvas is
visible, and bring it back with a control that stays reachable while
hidden, on touch and keyboard alike.

## ADDED Requirements

### Requirement: Hide all workspace interface
The workspace SHALL offer a "Hide interface" control in its top bar.
Activating it SHALL hide the top bar, the tool rail, the right sidebar,
the palette row, the bottom zoom bar, and the selection controls, leaving
only the canvas, which SHALL expand into the freed space without moving
on screen. Drawing, panning, pinch-zoom, keyboard tool shortcuts, and
undo/redo SHALL keep working while the interface is hidden.

#### Scenario: Hiding the interface
- **WHEN** the user activates the "Hide interface" button
- **THEN** every workspace interface region is hidden, only the canvas
  remains, and the drawing stays at the same position on screen

#### Scenario: Drawing while hidden
- **WHEN** the interface is hidden and the user draws, pans, or zooms
- **THEN** those interactions behave exactly as they do with the
  interface visible

### Requirement: A way back that stays reachable
While the interface is hidden, a "Show interface" button SHALL remain
visible and operable in a screen corner (respecting device safe areas),
and activating it SHALL restore every hidden region. Escape SHALL also
restore the interface.

#### Scenario: Restoring by touch
- **WHEN** the interface is hidden and the user taps "Show interface"
- **THEN** every region that was hidden is shown again

#### Scenario: Restoring with Escape
- **WHEN** the interface is hidden and the user presses Escape
- **THEN** the interface is shown again

### Requirement: Tab shortcut toggles the interface
Pressing Tab with no modifier keys SHALL toggle the interface when no
interactive control has keyboard focus and either the interface is
hidden or the user's most recent pointer press was on the canvas. In
every other case - a control (button, field, or other focusable element)
has focus, or the user has not pressed on the canvas since last
interacting elsewhere - Tab SHALL keep its normal focus-navigation
behavior and SHALL NOT toggle the interface. A press on the canvas SHALL
release keyboard focus from whatever control held it, the same as
clicking any other non-focusable area. Escape that restores the interface
SHALL NOT also clear the active selection.

#### Scenario: Tab toggles while drawing
- **WHEN** the user has just drawn on the canvas (even right after
  clicking a tool button) and presses Tab
- **THEN** the interface hides, and pressing Tab again shows it

#### Scenario: Tab still navigates focus
- **WHEN** a button or text field has keyboard focus and the user
  presses Tab or Shift+Tab
- **THEN** focus moves to the next/previous control and the interface's
  visibility does not change

#### Scenario: Keyboard user arriving in the workspace
- **WHEN** the user opens a project from the keyboard, without pressing
  on the canvas, and presses Tab
- **THEN** focus moves into the workspace controls and the interface
  stays visible

#### Scenario: Escape restores without dropping the selection
- **WHEN** the interface is hidden with an active selection and the user
  presses Escape
- **THEN** the interface is shown and the selection remains

### Requirement: Hidden state is session-only
The hidden state SHALL NOT persist: opening or switching projects SHALL
start with the interface visible.

#### Scenario: Opening a project resets visibility
- **WHEN** the interface is hidden and the user opens a different
  project (or reloads the page)
- **THEN** the workspace opens with the interface visible
