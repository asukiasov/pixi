## ADDED Requirements

### Requirement: Panel mini-rail
In the floating layout the Workspace SHALL show a panel mini-rail: a
floating card against the right edge that starts just below the top bar
and is only as tall as its contents. It SHALL hold three buttons, in this
order from top to bottom: Colors, Brushes and Layers. Activating a button
SHALL open its panel card if it is closed, and close it if it is open.
Each button SHALL show whether its card is open. The Brushes button SHALL
be unavailable while any tool other than Brush is active, and SHALL say
that it is for the Brush tool. The mini-rail SHALL be hidden with the
rest of the interface while the interface is hidden.

#### Scenario: Mini-rail contents
- **WHEN** a project opens in the floating layout
- **THEN** a mini-rail against the right edge, below the top bar, shows
  Colors, Brushes and Layers buttons in that order, and ends just after
  the Layers button

#### Scenario: Closing and reopening Layers
- **WHEN** the Layers card is open and the user activates the Layers
  button in the mini-rail, then activates it again
- **THEN** the Layers card closes and the button shows it as closed, then
  the card opens again and the button shows it as open

#### Scenario: Brushes button with another tool
- **WHEN** the Pencil tool is active and the user activates the Brushes
  button
- **THEN** no card opens or closes, and the button indicates that it is
  for the Brush tool

#### Scenario: Hidden interface
- **WHEN** the user hides the interface
- **THEN** the mini-rail and every panel card are hidden, and come back
  with the rest of the interface in the same open or closed state

### Requirement: Panel cards
In the floating layout Color Library, Brushes and Layers SHALL each be
shown as its own floating card, never all three in one card. A card SHALL
be either open (shown in full) or closed (not shown at all). Cards SHALL
NOT collapse to their header in the floating layout. Each card's header
SHALL have a close button, and activating it SHALL close that card. A
card SHALL keep its existing controls and behaviour while open.

Open cards SHALL stack in one column beside the mini-rail, on the side
that faces the canvas, starting just below the top bar. They SHALL keep
this order from top to bottom, skipping closed cards: Colors, Brushes,
Layers. They SHALL have the usual gap between floating cards. The column
SHALL end above the bottom screen edge. When the open cards are taller
than the space available, they SHALL share that height. Each card SHALL
then scroll its own contents, and every open card's header SHALL stay
visible.

Opening, closing or resizing a card SHALL NOT move or re-fit the canvas.
Closing a card SHALL also close any popover or editor that was opened
from it (palette import preview, ramp preview, layer opacity, brush
editor).

#### Scenario: Cards stack in order
- **WHEN** Colors and Layers are open with the Pencil tool, and the user
  selects the Brush tool
- **THEN** the Brushes card appears between Colors and Layers, and the
  artwork stays at the same position and zoom on screen

#### Scenario: Closing from the header
- **WHEN** the user activates the close button in the Color Library
  card's header
- **THEN** the Color Library card is no longer shown, Layers moves up to
  take its place below the top bar, the Colors button in the mini-rail
  shows the card as closed, and the artwork does not move

#### Scenario: Too tall for the screen
- **WHEN** Colors, Brushes and Layers are all open and the project has
  more layers than fit on screen
- **THEN** the column stops above the bottom screen edge, each card's
  header is visible, and the layer list scrolls within the Layers card

#### Scenario: Closing Colors with the import preview open
- **WHEN** the palette import preview is open and the user closes the
  Color Library card
- **THEN** the import preview closes as if cancelled, and no palette is
  saved

#### Scenario: Popover from a card
- **WHEN** the user opens the layer opacity popover from the Layers card
- **THEN** the popover appears fully on screen, not clipped by the card

### Requirement: Brushes card follows the Brush tool
In the floating layout the Brushes card SHALL be shown only while the
Brush tool is active and the card is open. Switching from the Brush tool
to another tool SHALL hide the card without changing whether it is open.
If the user closes the Brushes card, it SHALL stay closed when they
switch to another tool and back to Brush, until they open it from the
mini-rail or a project is opened. The Brushes card SHALL hold the brush
grid, the add and delete brush buttons, and the brush editor. It SHALL
NOT hold Spacing or Rotation, which are in the tool-options bar.

#### Scenario: Brush tool shows the card
- **WHEN** a project has just opened and the user selects the Brush tool
- **THEN** the Brushes card is shown with the brush grid, and the
  Brushes button shows it as open

#### Scenario: Closed Brushes stays closed
- **WHEN** the Brush tool is active and the user closes the Brushes card,
  then selects the Pencil and then the Brush tool again
- **THEN** the Brushes card is not shown, and the Brushes button shows it
  as closed

#### Scenario: Leaving the Brush tool
- **WHEN** the Brushes card is open and the user selects the Eraser
- **THEN** the Brushes card is hidden, and selecting Brush again shows it

### Requirement: Panel cards on project open
In the floating layout, whenever a project is opened the Colors and
Layers cards SHALL be open and the Brushes card SHALL be open (and so
shown while the Brush tool is active). Which cards are open SHALL NOT be
remembered across project opens or page reloads.

#### Scenario: Defaults on open
- **WHEN** the user closes the Colors and Layers cards and then opens
  another project
- **THEN** the Colors and Layers cards are open again

#### Scenario: Reload
- **WHEN** the user closes the Layers card and reloads the page
- **THEN** the project opens with the Layers card open

### Requirement: Mini-rail and panel cards are accessible
Each mini-rail button SHALL have an accessible name naming its panel, and
SHALL report to assistive technology whether its card is expanded. The
unavailable Brushes button SHALL report that it is unavailable while
staying reachable by keyboard, so its explanation can be read. Each
card's close button SHALL have an accessible name that names its panel.
When a card is closed from its own close button, focus SHALL move to that
card's mini-rail button. Every mini-rail button and close button SHALL be
at least 44×44 CSS pixels. Tooltips for mini-rail buttons SHALL open on
the side of the rail that faces the canvas, and SHALL stay fully on
screen.

#### Scenario: Expanded state announced
- **WHEN** a screen reader user moves focus to the Layers button while
  the Layers card is open
- **THEN** it is announced as Layers, expanded

#### Scenario: Focus after closing
- **WHEN** a keyboard user activates the close button in the Layers card
- **THEN** the Layers card closes and focus is on the Layers button in
  the mini-rail

#### Scenario: Mini-rail tooltip
- **WHEN** the user hovers the Colors button in the mini-rail against the
  right edge
- **THEN** the tooltip opens to the left of the rail, fully on screen

## MODIFIED Requirements

### Requirement: Full-screen canvas with floating regions
In the floating layout the canvas area SHALL fill the entire Workspace.
The top bar, tool rail, panel mini-rail, panel cards, palette row,
selection controls, and tool-options bar SHALL be shown over the canvas
as floating cards, each keeping its current controls and behaviour except
where another requirement of this capability changes them, and none SHALL
change the size or position of the canvas area when shown, hidden,
opened, closed, collapsed, or expanded. The zoom controls SHALL be
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
mini-rail and panel cards), or `options` (tool-options bar, palette row
and selection controls). Only the slots SHALL determine which screen edge
a region sits against. By default `tools` sits against the left edge and
`panels` against the right edge. Within the `panels` slot the mini-rail
SHALL sit against the edge and the panel cards SHALL sit beside it,
toward the canvas.

#### Scenario: Default sides
- **WHEN** the floating layout is active
- **THEN** the tool rail floats against the left edge, the panel
  mini-rail against the right edge with the panel cards just to its
  left, the top bar along the top, and the palette row and tool-options
  bar along the bottom

### Requirement: Fit to the clear area
In the floating layout, the Fit zoom preset and the initial view when a
project opens SHALL size and centre the canvas within the area left clear
by the floating cards visible at that moment (inside the top bar, tool
rail, panel mini-rail, any open panel cards, and bottom cards), not
within the full Workspace. Cards that appear or disappear afterwards
SHALL NOT re-fit or move the canvas. Fill and 100% SHALL keep their
existing meaning, centred in the same clear area. Panning and zooming
SHALL still allow moving the canvas underneath any card.

#### Scenario: Opening a project
- **WHEN** a project opens in the floating layout
- **THEN** the whole canvas is visible, centred between the floating
  cards, with none of it covered by them

#### Scenario: Fit with the right sidebar hidden
- **WHEN** every panel card is closed (the floating layout's equivalent
  of hiding the right sidebar) and the user chooses Fit
- **THEN** the canvas is fitted into the wider clear area that reaches
  the panel mini-rail, including the space the cards would have used

#### Scenario: Panning under a card
- **WHEN** the user pans the canvas toward a floating card
- **THEN** the canvas moves underneath the card without being stopped

### Requirement: Slim top bar
In the floating layout the top bar SHALL start with Back to Gallery, the
project title and the zoom pill, and SHALL end with a More button, with
Undo and Redo toward the end. Canvas Settings, Export, Record timelapse,
Tile preview, Theme and Hide interface SHALL NOT appear as their own top
bar buttons in the floating layout; they SHALL be reached from the More
menu instead. Pixel-perfect and Symmetry SHALL NOT appear in the top bar
in the floating layout; they SHALL be reached from the tool-options bar
instead. The Layers panel toggle and the right-sidebar toggle SHALL NOT
appear in the top bar in the floating layout; each panel card SHALL be
opened and closed from the panel mini-rail instead, and there SHALL be no
control that hides all panel cards at once other than Hide interface. The
docked layout's top bar SHALL NOT change.

#### Scenario: Floating top bar contents
- **WHEN** a project opens in the floating layout
- **THEN** the top bar shows, in order, Back, the project title, the
  zoom pill, Undo, Redo and More, and no separate Layers, right sidebar,
  Pixel-perfect, Symmetry, Canvas Settings, Export, Record, Tile
  preview, Theme or Hide interface buttons

#### Scenario: Docked top bar unchanged
- **WHEN** a project opens without `?layout=floating`
- **THEN** the top bar shows exactly the buttons it showed before this
  change, including the Layers and right-sidebar toggles, and no title,
  zoom pill or More button

### Requirement: Tool-options bar sits above the palette card
In the floating layout the palette row SHALL be shown in its own
bottom-centre card, together with the selection controls while a
selection exists. When the tool-options bar is shown, it SHALL sit
directly above that card, also centred, with the usual gap between
floating cards and no overlap. When the bar is hidden, the palette card
SHALL stay where it is. Both cards SHALL stay clear of the tool rail, the
panel mini-rail and the panel cards at their default sizes and with the
cards open by default.

#### Scenario: Stacked bottom cards
- **WHEN** the Rectangle tool is active in the floating layout
- **THEN** the tool-options bar shows above the palette card, both
  centred, and neither covers the other

#### Scenario: Selection controls with the bar
- **WHEN** the Select tool is active and the user makes a selection
- **THEN** Clear selection and Delete appear in the palette card, and
  the tool-options bar with 1:1 proportion stays above the palette card
  without overlapping it

#### Scenario: Bottom cards clear of the panel cards
- **WHEN** a project with a few layers opens in the floating layout at
  768×1024 with the Brush tool active
- **THEN** neither the tool-options bar nor the palette card overlaps the
  panel mini-rail or any open panel card
