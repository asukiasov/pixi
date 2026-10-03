## ADDED Requirements

### Requirement: Selection action bar
In the floating layout the Workspace SHALL show a selection action bar: a
floating card holding Clear selection and Delete, in that order. Each
SHALL have exactly the effect of the existing control it replaces: Clear
selection removes the selection, and Delete makes the selected pixels of
the active layer transparent and keeps the selection. The bar SHALL be
shown whenever a selection exists, whichever tool is active, and SHALL NOT
be shown when there is none, however the selection was removed (Clear
selection, Escape, Cmd/Ctrl+D, a tap outside the selection with the
Select tool, or opening a project). While a selection is being drawn with
the Select tool, or dragged with the Move tool, the bar SHALL be hidden,
and SHALL reappear when the gesture ends or is cancelled if a selection
then exists. The bar SHALL be hidden along with the rest of the interface
while the interface is hidden. In the floating layout Clear selection and
Delete SHALL NOT be shown anywhere else, including the palette card.
Showing, moving or hiding the bar SHALL NOT move or re-fit the canvas.

#### Scenario: Making a selection
- **WHEN** the Select tool is active in the floating layout and the user
  drags out a selection and releases
- **THEN** the selection action bar appears next to the selection with
  Clear selection and Delete, and the palette card shows no selection
  controls

#### Scenario: Hidden while drawing the selection
- **WHEN** the user is dragging out a selection with the Select tool
- **THEN** no selection action bar is shown until the pointer is
  released

#### Scenario: Delete keeps the bar
- **WHEN** a selection exists and the user activates Delete in the bar
- **THEN** the selected pixels on the active layer become transparent,
  the selection remains, and the bar stays shown

#### Scenario: Clearing removes the bar
- **WHEN** a selection exists and the user presses Escape
- **THEN** the selection is removed and the bar is no longer shown, and
  the artwork stays at the same position and zoom on screen

#### Scenario: Other tools keep the bar
- **WHEN** a selection exists and the user switches to the Pencil tool
- **THEN** the bar stays shown next to the selection

#### Scenario: Hidden interface
- **WHEN** a selection exists and the user hides the interface
- **THEN** the bar is hidden with the rest of the interface, and comes
  back with it while the selection still exists

### Requirement: Selection action bar placement
In the floating layout the selection action bar SHALL be centred
horizontally on the selection as it appears on screen, and SHALL sit
above the selection with the usual gap between floating cards. When there
is not enough room above the selection, it SHALL sit below it. The bar
SHALL always stay fully on screen and inside the area left clear by the
other visible floating cards (top bar, tool rail, panel mini-rail, open
panel cards, and bottom cards), shifted sideways as needed. When neither
above nor below has room, or the selection is partly or fully outside
that clear area, the bar SHALL be held at the nearest edge of the clear
area. Only when the clear area is too small to hold the bar MAY it
overlap another card, and it SHALL still stay fully on screen and clear
of device safe areas.

The bar SHALL follow the selection as it appears on screen: when the
canvas is panned or zoomed by any means, when the selection changes or is
moved, and when the clear area changes because a card opens, closes,
appears or changes size, or the window is resized. The bar SHALL NOT
count toward the clear area used by Fit or the initial view.

#### Scenario: Above the selection
- **WHEN** the user makes a selection in the middle of the canvas
- **THEN** the bar is centred above the selection, with the usual gap
  between it and the selection

#### Scenario: Flips below near the top bar
- **WHEN** the user makes a selection whose top edge is just below the
  top bar
- **THEN** the bar sits centred below the selection instead, and does
  not cover the top bar

#### Scenario: Selection near a side card
- **WHEN** the user makes a selection right next to the tool rail
- **THEN** the bar is shifted toward the canvas so that it does not
  cover the tool rail, and stays as close to the selection's centre as
  it can

#### Scenario: Selection fills the view
- **WHEN** the user zooms in until the selection covers the whole clear
  area
- **THEN** the bar stays at the top of the clear area, fully on screen,
  over the selection

#### Scenario: Following a pan
- **WHEN** a selection exists and the user pans the canvas with the Hand
  tool
- **THEN** the bar moves with the selection during the pan, without
  disappearing

#### Scenario: Selection panned out of view
- **WHEN** the user pans the canvas until the selection is entirely off
  screen
- **THEN** the bar stays fully on screen at the edge of the clear area
  nearest the selection

#### Scenario: Moving the selection
- **WHEN** a selection exists and the user drags it with the Move tool
- **THEN** the bar is hidden during the drag and reappears next to the
  selection's new position on release

#### Scenario: Opening a card
- **WHEN** the bar sits near the right edge and the user opens the Layers
  card over that spot
- **THEN** the bar moves so that it does not overlap the Layers card, and
  the artwork does not move

### Requirement: Selection action bar is accessible
The selection action bar SHALL be announced as a labelled group of
selection actions. Each button SHALL have a visible text label that is
also its accessible name. Every button SHALL be at least 44×44 CSS
pixels. Tab order SHALL follow the bar's visual order. Showing the bar
SHALL NOT move keyboard focus. When the bar hides while one of its
buttons has keyboard focus, focus SHALL move to the active tool's button
in the tool rail.

#### Scenario: Group announced
- **WHEN** a screen reader user moves focus into the bar
- **THEN** it is announced as a group named for selection actions, and
  the focused button by its text label

#### Scenario: Focus after clearing from the keyboard
- **WHEN** the Select tool is active and a keyboard user activates Clear
  selection in the bar
- **THEN** the selection is removed, the bar hides, and focus is on the
  Select tool's button in the tool rail

#### Scenario: Touch targets
- **WHEN** the bar is shown
- **THEN** Clear selection and Delete each measure at least 44×44 CSS
  pixels

## MODIFIED Requirements

### Requirement: Full-screen canvas with floating regions
In the floating layout the canvas area SHALL fill the entire Workspace.
The top bar, tool rail, panel mini-rail, panel cards, palette row,
selection action bar, and tool-options bar SHALL be shown over the canvas
as floating cards, each keeping its current controls and behaviour except
where another requirement of this capability changes them, and none SHALL
change the size or position of the canvas area when shown, hidden,
opened, closed, collapsed, expanded, or moved. The zoom controls SHALL be
reached from the top bar's zoom pill rather than a separate floating
card. Floating cards SHALL stay clear of device safe areas. Pointer input
on a card SHALL go to the card, and pointer input anywhere else,
including the gaps between stacked cards, SHALL go to the canvas.

#### Scenario: Canvas fills the Workspace
- **WHEN** the floating layout is active
- **THEN** the canvas area spans the full width and height of the
  Workspace, and the regions float above it

#### Scenario: Collapsing the right sidebar does not move the canvas
- **WHEN** the floating layout is active and the user closes the Layers
  card (the floating layout has no whole-sidebar toggle; closing cards
  replaces it)
- **THEN** the card disappears and the artwork stays at the same
  position and zoom on screen

#### Scenario: Drawing next to a card
- **WHEN** the user draws on canvas pixels that are visible between or
  beside floating cards
- **THEN** the stroke is drawn exactly as in the docked layout

#### Scenario: Safe areas respected
- **WHEN** the floating layout is shown on a device with safe-area insets
- **THEN** no floating card is placed inside those insets

### Requirement: Placement slots
In the floating layout every floating region SHALL be assigned to one
named slot: `top` (top bar), `tools` (tool rail), `panels` (panel
mini-rail and panel cards), or `options` (tool-options bar and palette
row), except the selection action bar, which SHALL belong to no slot and
SHALL be placed by the selection instead. Only the slots SHALL determine
which screen edge a region sits against. By default `tools` sits against
the left edge and `panels` against the right edge. Within the `panels`
slot the mini-rail SHALL sit against the edge and the panel cards SHALL
sit beside it, toward the canvas.

#### Scenario: Default sides
- **WHEN** the floating layout is active
- **THEN** the tool rail floats against the left edge, the panel
  mini-rail against the right edge with the panel cards just to its
  left, the top bar along the top, and the palette row and tool-options
  bar along the bottom

#### Scenario: Selection action bar is not in a slot
- **WHEN** the floating layout is active and a selection exists
- **THEN** the selection action bar is placed next to the selection,
  not against a screen edge, and the bottom cards are unchanged

### Requirement: Tool-options bar sits above the palette card
In the floating layout the palette row SHALL be shown in its own
bottom-centre card. When the tool-options bar is shown, it SHALL sit
directly above that card, also centred, with the usual gap between
floating cards and no overlap. When the bar is hidden, the palette card
SHALL stay where it is. The palette card SHALL NOT change size when a
selection is made or removed. Both cards SHALL stay clear of the tool
rail, the panel mini-rail and the panel cards at their default sizes and
with the cards open by default.

#### Scenario: Stacked bottom cards
- **WHEN** the Rectangle tool is active in the floating layout
- **THEN** the tool-options bar shows above the palette card, both
  centred, and neither covers the other

#### Scenario: Selection controls with the bar
- **WHEN** the Select tool is active and the user makes a selection
- **THEN** the palette card shows no Clear selection or Delete and keeps
  its size, and the tool-options bar with 1:1 proportion stays above it
  without overlapping it

#### Scenario: Bottom cards clear of the panel cards
- **WHEN** a project with a few layers opens in the floating layout at
  768×1024 with the Brush tool active
- **THEN** neither the tool-options bar nor the palette card overlaps the
  panel mini-rail or any open panel card
