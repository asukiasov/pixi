## REMOVED Requirements

### Requirement: Return to New Canvas from Workspace
**Reason**: Replaced — the Workspace's back control now returns to the
Gallery (which becomes the app's home in this slice) instead of New Canvas,
and the confirmation prompt is dropped since every action now auto-saves
(see the `local-persistence` capability), so there's nothing to lose by
navigating away.
**Migration**: See the new "Return to Gallery from Workspace" requirement
below.

## ADDED Requirements

### Requirement: Return to Gallery from Workspace
The Workspace screen SHALL offer a way back to the Gallery so the user can
open a different project or start a new one. Since every action auto-saves
(see the `local-persistence` capability), leaving the current canvas SHALL
NOT require confirmation — there is nothing to lose.

#### Scenario: User navigates back to the Gallery
- **WHEN** the user taps the Workspace's back control
- **THEN** the app displays the Gallery, and the previous project's current
  state remains saved exactly as it was

#### Scenario: Opening a different project after returning
- **WHEN** the user returns to the Gallery and opens a different project
- **THEN** the Workspace behaves identically to the first project (drawing,
  undo/redo, palette, layers, and export all work correctly, with no
  leftover state or duplicated event handling from the previous project)
