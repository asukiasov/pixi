## Purpose

Covers reclaiming canvas viewport space by hiding the right sidebar as a
whole - as opposed to `2d-canvas-navigation`'s capability (not yet
archived), which covers zoom and panning. This delta targets the same
`canvas-navigation` capability path and is expected to merge with it at
archive time.

## ADDED Requirements

### Requirement: Whole right sidebar visibility toggle
The Workspace top bar SHALL offer a single control that shows or hides
the entire right sidebar (Color Library, Brushes, and Layers together),
independent of each panel's own collapsed/expanded state. Hiding the
sidebar SHALL let the canvas area expand into the freed width.

#### Scenario: Hiding the whole sidebar
- **WHEN** the user clicks the right-sidebar visibility toggle while the
  sidebar is shown
- **THEN** the entire right sidebar disappears and the canvas area
  expands to use the freed width

#### Scenario: Showing the whole sidebar again
- **WHEN** the user clicks the toggle while the sidebar is hidden
- **THEN** the right sidebar reappears with each panel's prior
  collapsed/expanded state unchanged, and the canvas area shrinks back

#### Scenario: Independent of per-panel collapse state
- **WHEN** the user hides the whole sidebar while the Layers panel was
  individually collapsed to its header
- **THEN** re-showing the sidebar restores the Layers panel still
  collapsed to its header, rather than resetting it to expanded
