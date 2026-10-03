# floating-workspace Specification

## Purpose
Defines the floating Workspace layout: a full-screen canvas with every
other workspace region floating over it as a card, the shared card look,
and how the canvas fits into the area those cards leave clear.

## Requirements

### Requirement: Layout switch
The Workspace SHALL render in the floating layout only when the page is
opened with the `layout=floating` query parameter. Without that parameter,
or with any other value, the Workspace SHALL render in the existing docked
layout with no visible change. The choice SHALL apply for the whole page
session and SHALL NOT be persisted. An editor embedded through
`Pixi.mount()` SHALL always use the docked layout.

#### Scenario: Default stays docked
- **WHEN** the user opens a project without a `layout` query parameter
- **THEN** the Workspace looks and behaves exactly as before this change

#### Scenario: Opting in
- **WHEN** the user opens `?layout=floating#/project/<id>`
- **THEN** the Workspace renders in the floating layout

#### Scenario: Unknown value
- **WHEN** the page is opened with `?layout=anything-else`
- **THEN** the Workspace renders in the docked layout

#### Scenario: Navigating between screens keeps the choice
- **WHEN** the floating layout is active and the user goes to the Gallery
  and opens another project
- **THEN** the Workspace still renders in the floating layout

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

### Requirement: Glass card look
Floating cards SHALL share one look in both light and dark themes: a
semi-transparent, blurred backdrop over the canvas, rounded corners, and
a soft shadow, with text and icons meeting the same contrast as the
docked layout. When the user has requested reduced transparency, or the
browser cannot blur what is behind an element, cards SHALL use an opaque
surface instead, with the same shape and shadow. A browser that does not
report the reduced-transparency preference SHALL get the glass look if it
can blur. Popovers that open from controls inside a card SHALL be
positioned and drawn exactly as in the docked layout, not clipped by the
card.

#### Scenario: Glass over artwork
- **WHEN** a card floats over colourful artwork in a supporting browser
- **THEN** the artwork shows through blurred and the card's controls
  stay readable

#### Scenario: Reduced transparency
- **WHEN** the operating system's reduce-transparency setting is on
- **THEN** every floating card is drawn opaque

#### Scenario: Popover inside a card
- **WHEN** the user opens the colour picker from the tool rail in the
  floating layout
- **THEN** the popover appears fully on screen, not clipped by the rail

#### Scenario: Theme switch
- **WHEN** the user switches between light and dark theme in the
  floating layout
- **THEN** the cards switch to that theme's glass tint

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

### Requirement: Project title in the top bar
In the floating layout the top bar SHALL show the current project's name
as plain, non-editable text. A name too long for the space SHALL be
truncated with an ellipsis, and the full name SHALL still be available to
assistive technology and as a tooltip. When the project is renamed, the
title SHALL update right away.

#### Scenario: Title shows the project name
- **WHEN** the user opens a project named "Forest tiles" in the floating
  layout
- **THEN** the top bar shows "Forest tiles"

#### Scenario: Rename updates the title
- **WHEN** the user renames the project in Canvas Settings
- **THEN** the top bar title shows the new name without reopening the
  project

#### Scenario: Long name
- **WHEN** the project name is longer than the space available in the
  top bar
- **THEN** the title is cut off with an ellipsis and the other top bar
  controls keep their size and position

### Requirement: Zoom pill
In the floating layout the top bar SHALL show a zoom pill displaying the
current zoom percentage, updated whenever the zoom changes by any means.
Activating the pill SHALL open a menu with 100%, Fit, Fill, Zoom out and
Zoom in, each doing the same as the matching existing zoom control. The
100%, Fit and Fill items SHALL close the menu, and the Zoom out and Zoom
in items SHALL leave it open so they can be repeated. In the floating
layout the separate bottom zoom bar SHALL NOT be shown. Keyboard zoom
shortcuts, pinch zoom and wheel zoom SHALL keep working unchanged.

#### Scenario: Pill shows current zoom
- **WHEN** the user zooms with Ctrl/Cmd + or a pinch gesture
- **THEN** the pill's percentage changes to match the new zoom

#### Scenario: Choosing Fit from the pill
- **WHEN** the user opens the zoom pill menu and chooses Fit
- **THEN** the canvas fits the clear area exactly as the existing Fit
  preset does, and the menu closes

#### Scenario: Repeated zoom in
- **WHEN** the user opens the zoom pill menu and chooses Zoom in twice
- **THEN** the zoom steps up twice and the menu stays open after each
  step

#### Scenario: No bottom zoom bar
- **WHEN** the floating layout is active
- **THEN** no zoom bar is shown along the bottom of the Workspace

### Requirement: More menu
In the floating layout the More button SHALL open a menu with these
items, in this order: Canvas settings, Export, Record timelapse, Tile
preview, Theme, and Hide interface.
- Canvas settings and Export SHALL open their existing popovers,
  positioned against the More button, with unchanged contents and
  behaviour.
- Record timelapse and Tile preview SHALL be on/off items that show
  their current state and toggle exactly like their existing controls.
  Stopping a recording that captured frames SHALL open the timelapse
  review popover, positioned against the More button.
- Theme SHALL offer Light, Dark and System as a single-choice group
  showing the current preference. Choosing one SHALL apply and save
  that preference the same way the existing theme control does.
- Hide interface SHALL hide the interface exactly like the existing
  control. The existing way back and the Tab shortcut SHALL be
  unchanged.

When Record timelapse is unsupported by the browser, its item SHALL be
shown disabled with the same explanation the existing control gives.
Choosing any item other than Theme SHALL close the menu.

#### Scenario: Export from More
- **WHEN** the user opens More and chooses Export
- **THEN** the menu closes and the Export popover opens next to the More
  button, fully on screen

#### Scenario: Toggling tile preview
- **WHEN** the user opens More and chooses Tile preview while it is off
- **THEN** the tile preview turns on, and the next time More opens the
  Tile preview item shows as on

#### Scenario: Picking a theme
- **WHEN** the user opens More and chooses Dark under Theme
- **THEN** the Workspace switches to the dark theme, Dark shows as the
  selected theme, and the choice is still in effect after a reload

#### Scenario: Stopping a recording
- **WHEN** a timelapse is recording with captured frames and the user
  chooses Record timelapse from More
- **THEN** recording stops and the review popover opens next to the More
  button

### Requirement: Recording indicator on More
While a timelapse is recording in the floating layout, the More button
SHALL show a red dot, and its accessible name SHALL say that recording is
in progress. The dot SHALL follow the same reduced-motion rule as the
existing recording indicator. When recording stops, the dot and the
extra wording SHALL go away.

#### Scenario: Dot while recording
- **WHEN** the user starts a recording from More and the menu closes
- **THEN** the More button shows a red dot

#### Scenario: Dot clears on stop
- **WHEN** the user stops the recording
- **THEN** the More button no longer shows the red dot

### Requirement: Top bar menus are accessible
The zoom pill and More button SHALL each be announced as a button that
opens a menu, and SHALL report whether the menu is open. When a menu
opens, focus SHALL move to its first enabled item. Arrow keys SHALL move
between items, Home and End SHALL jump to the first and last items, and
Enter or Space SHALL activate the focused item. Escape SHALL close the
menu and return focus to the button that opened it. A pointer press
outside the menu SHALL close it. Only one top bar menu SHALL be open at
a time. Every menu item SHALL be at least as large a touch target as the
top bar buttons.

#### Scenario: Keyboard use of More
- **WHEN** the user focuses More, presses Enter, then presses Down Arrow
  and Enter
- **THEN** the menu opens with Canvas settings focused, focus moves to
  Export, and Export is activated

#### Scenario: Escape returns focus
- **WHEN** a top bar menu is open and the user presses Escape
- **THEN** the menu closes and focus is back on the button that opened it

#### Scenario: Opening one menu closes the other
- **WHEN** the zoom pill menu is open and the user activates More
- **THEN** the zoom menu closes and the More menu opens

### Requirement: Floating tool rail layout
In the floating layout the tool rail SHALL start just below the top bar
and SHALL be only as tall as its contents, up to the space left above
the bottom screen edge. From top to bottom it SHALL hold:
- the tool buttons, in their existing order
- the foreground/background swatches with Swap and Reset, at the foot

The rail SHALL NOT hold any tool-scoped toggles; those SHALL be reached
from the tool-options bar instead. When the rail does not fit in the
available height, only the tool buttons SHALL scroll. The swatches with
Swap and Reset SHALL stay fully visible below them. Choosing a tool
SHALL NOT change the rail's size.

#### Scenario: Rail hugs its contents
- **WHEN** a project opens in the floating layout on a screen tall
  enough for the whole rail
- **THEN** the rail starts below the top bar, ends just after the Swap
  and Reset controls, and the canvas shows below it

#### Scenario: Swatches at the foot
- **WHEN** the user selects the Rectangle tool in the floating layout
- **THEN** no Filled or 1:1 toggle appears in the rail, the rail keeps
  its size, and the swatches remain the last thing in the rail

#### Scenario: Short screen
- **WHEN** the floating layout is shown in a window too short for the
  whole rail
- **THEN** the tools can be scrolled within the rail, and the foreground
  and background swatches, Swap and Reset stay visible and usable
  without scrolling

### Requirement: Tool rail touch targets
In the floating layout every tool button SHALL be at least 44×44 CSS
pixels. Swap and Reset SHALL keep their small corner icons on the swatch
pair, and each SHALL respond to presses across an area of at least
24×24 CSS pixels. Neither area SHALL cover the visible face of the
foreground or background swatch, so a press on a swatch face always
opens that swatch's colour picker. The foreground and background swatch
faces SHALL each remain at least as large as in the docked layout.

#### Scenario: Tapping a tool
- **WHEN** the floating layout is active
- **THEN** each tool button measures at least 44×44 CSS pixels

#### Scenario: Tapping beside the Swap icon
- **WHEN** the user taps within the Swap control's touch area but just
  outside its drawn icon
- **THEN** the foreground and background colours swap

#### Scenario: Tapping a swatch face
- **WHEN** the user taps anywhere on the visible foreground swatch
- **THEN** the colour picker opens for the foreground colour, and the
  colours are not swapped or reset

### Requirement: Tool rail opens toward the canvas
In the floating layout, tooltips for tool rail controls and the colour
picker opened from the swatches SHALL open on the side of the rail that
faces the canvas, worked out from where the rail is on screen at that
moment, and SHALL NOT cover the rail. If there is not enough room on
that side, they SHALL stay fully on screen. The docked layout's tooltip
and colour picker placement SHALL NOT change.

#### Scenario: Rail on the left
- **WHEN** the rail sits against the left edge and the user hovers the
  Pencil button or opens the foreground colour picker
- **THEN** the tooltip or picker opens to the right of the rail

#### Scenario: Rail on the right
- **WHEN** the rail sits against the right edge and the user hovers the
  Pencil button or opens the foreground colour picker
- **THEN** the tooltip or picker opens to the left of the rail, fully on
  screen

### Requirement: Selected tool is announced
In both layouts, each tool button SHALL report to assistive technology
whether it is the selected tool. Exactly one enabled tool button SHALL
report as selected at a time. The report SHALL stay in sync however the
tool is chosen (pointer, keyboard shortcut, or a project being opened or
an embed's tool restriction being applied). This SHALL NOT change how
either layout looks.

#### Scenario: Choosing a tool
- **WHEN** the user selects the Brush tool by clicking it
- **THEN** the Brush button reports as pressed and every other tool
  button reports as not pressed

#### Scenario: Keyboard shortcut
- **WHEN** the user presses E
- **THEN** the Eraser button reports as pressed and the previously
  selected tool's button reports as not pressed

### Requirement: Tool-options bar
In the floating layout the Workspace SHALL show a tool-options bar: one
floating card, centred horizontally near the bottom edge, whose contents
follow the active tool. It SHALL hold exactly these controls, in this
order, for each tool:

| Tool | Controls |
|---|---|
| Pencil | Size, Opacity, Pixel-perfect, Symmetry, Color Library sequence |
| Eraser | Size, Opacity, Pixel-perfect, Symmetry |
| Brush | Spacing, Rotation, Symmetry, Color Library sequence |
| Rectangle | Filled, 1:1 proportion |
| Select | 1:1 proportion |

For Move, Bucket, Line, Hand and Eyedropper the bar SHALL NOT be shown.
The bar SHALL update as soon as the active tool changes, however the
tool is chosen (pointer, keyboard shortcut, a project being opened, or
an embed's tool restriction). Showing, changing or hiding the bar SHALL
NOT move or re-fit the canvas. The bar SHALL be hidden along with the
rest of the interface while the interface is hidden.

#### Scenario: Pencil options
- **WHEN** the user selects the Pencil tool in the floating layout
- **THEN** the bar shows Size, Opacity, Pixel-perfect, Symmetry and
  Color Library sequence, in that order, and nothing else

#### Scenario: Brush options
- **WHEN** the user selects the Brush tool
- **THEN** the bar shows Spacing, Rotation, Symmetry and Color Library
  sequence, and no Size, Opacity or Pixel-perfect control

#### Scenario: Tool with no options
- **WHEN** the user presses G to select the Bucket tool
- **THEN** the bar is not shown, and the canvas stays at the same
  position and zoom on screen

#### Scenario: Switching tools does not move the canvas
- **WHEN** the user switches from Pencil to Rectangle to Hand
- **THEN** the bar's contents change and then the bar disappears, and
  the artwork stays at the same position and zoom on screen

#### Scenario: Hidden interface
- **WHEN** the Pencil tool is active and the user hides the interface
- **THEN** the bar is hidden with the rest of the interface, and comes
  back with it

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

### Requirement: Tool-options bar controls
Each control in the tool-options bar SHALL have the same effect, range
and starting value as the control it replaces, and SHALL share its
state. A change made in the bar SHALL apply to the next stroke in the
same way as before. A value or on/off state that the Workspace resets
when a project is opened SHALL show its reset value in the bar.
- Size, Opacity, Spacing and Rotation SHALL be horizontal sliders, each
  with a visible readout of the current value and its unit: Size in
  pixels (1–20), Opacity in percent (1–100), Spacing in pixels (1–20),
  and Rotation in degrees (0–359). Dragging a slider SHALL apply the
  value while dragging. The mouse wheel over Size or Opacity SHALL step
  the value as it does today.
- Pixel-perfect, Filled, 1:1 proportion and Color Library sequence SHALL
  be on/off buttons that show their current state.
- Symmetry SHALL be one button that cycles off, horizontal, vertical,
  both, and shows which mode is active.
- Pixel-perfect, Symmetry and Color Library sequence SHALL keep their
  state when the user switches to a tool that doesn't show them and
  back.
- Choosing the Rainbow swatch in the palette card SHALL turn the Color
  Library sequence button off, as it does today.

#### Scenario: Changing Size
- **WHEN** the user drags the Size slider in the bar to 4 and draws with
  the Pencil
- **THEN** the readout shows 4px and the stroke is 4 pixels wide

#### Scenario: Brush spacing as a slider
- **WHEN** the Brush tool is active and the user drags Spacing to 5
- **THEN** the readout shows 5px and the next dragged brush trail places
  a brush every 5 pixels

#### Scenario: Symmetry cycle
- **WHEN** Symmetry is off and the user presses the Symmetry button
  twice
- **THEN** symmetry is vertical, and the button shows the vertical mode

#### Scenario: State carries across tools
- **WHEN** the user turns Pixel-perfect on with the Pencil, switches to
  Rectangle, then back to Pencil
- **THEN** Pixel-perfect still shows as on and still applies to the next
  stroke

#### Scenario: Reset on project open
- **WHEN** Size is 6 and the user opens another project with the Pencil
  tool
- **THEN** the bar's Size slider and readout show 1px

### Requirement: Tool-options bar is accessible
The tool-options bar SHALL be announced as a labelled group of tool
options. Each slider SHALL have an accessible name and SHALL report its
value with its unit. Each on/off button SHALL report whether it is on.
The Symmetry button's accessible name SHALL include the current mode.
Every button in the bar SHALL be at least 44×44 CSS pixels, and each
slider SHALL respond to presses across a height of at least 44 CSS
pixels. Tab order SHALL follow the bar's visual order. Tooltips for bar
controls SHALL open above the bar and stay fully on screen.

#### Scenario: Slider announced with unit
- **WHEN** a screen reader user moves focus to the Opacity slider set to
  80
- **THEN** it is announced as Opacity with the value 80%

#### Scenario: Toggle state announced
- **WHEN** a screen reader user moves focus to Filled while Filled is on
- **THEN** it is announced as a pressed button

#### Scenario: Keyboard slider adjustment
- **WHEN** the Size slider has focus and the user presses Right Arrow
- **THEN** Size increases by 1 pixel and the readout updates

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
