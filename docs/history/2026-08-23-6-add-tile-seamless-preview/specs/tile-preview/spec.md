## Purpose

Lets a user check whether their pixel art tiles seamlessly by previewing
the canvas repeated in a 3×3 grid, live, without leaving the Workspace or
exporting the image to test it elsewhere.

## ADDED Requirements

### Requirement: Tile-preview toggle
The Workspace SHALL offer a tile-preview toggle. When off (the default),
the canvas area renders only the single canvas, as today. When on, the
canvas area renders the canvas content repeated in a 3×3 grid — the real,
editable canvas in the center cell, with 8 read-only copies surrounding
it, tiled edge-to-edge with no gap or border between cells.

#### Scenario: Turning tile preview on
- **WHEN** the user activates the tile-preview toggle
- **THEN** the canvas area shows the current canvas content repeated in a
  3×3 grid, edge-to-edge

#### Scenario: Turning tile preview off
- **WHEN** the user deactivates the tile-preview toggle
- **THEN** the canvas area returns to showing only the single canvas

#### Scenario: Toggle state is session-only
- **WHEN** the user turns tile preview on, then reloads the app or
  reopens the project later
- **THEN** tile preview starts back off, matching the existing
  pixel-perfect toggle's session-only behavior

### Requirement: Live-updating surrounding copies
While tile preview is on, the system SHALL keep the 8 surrounding copies
visually in sync with the center canvas as it changes — no separate
"refresh" action is needed.

#### Scenario: Drawing updates all copies
- **WHEN** tile preview is on and the user draws a stroke on the center
  (real) canvas
- **THEN** the same content change appears in all 8 surrounding copies
  without requiring the user to toggle preview off and on again

### Requirement: Only the center canvas is editable
While tile preview is on, drawing, erasing, filling, and all other
tool interactions SHALL continue to apply only to the real canvas (the
center cell); the 8 surrounding copies are display-only and do not accept
input.

#### Scenario: Drawing on a surrounding copy has no special effect
- **WHEN** tile preview is on and the user attempts to draw where a
  surrounding copy is rendered (outside the center cell's canvas bounds)
- **THEN** no drawing occurs there — the interaction is treated as
  outside the canvas, exactly as it is today with tile preview off

### Requirement: Compatible with existing zoom/pan
Tile preview SHALL compose with the existing zoom and pan behavior
(`canvas-navigation`) rather than replacing it — zooming and panning act
on the full 3×3 composed view the same way they act on the single canvas
when preview is off.

#### Scenario: Zooming with tile preview on
- **WHEN** tile preview is on and the user zooms in or out
- **THEN** the 3×3 composed view zooms together, keeping the same
  relative layout, with no change to the zoom controls' existing
  behavior
