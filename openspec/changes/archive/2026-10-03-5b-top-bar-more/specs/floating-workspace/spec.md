## ADDED Requirements

### Requirement: Slim top bar
In the floating layout the top bar SHALL start with Back to Gallery, the
project title and the zoom pill, and SHALL end with a More button, with
Undo and Redo toward the end. Canvas Settings, Export, Record timelapse,
Tile preview, Theme and Hide interface SHALL NOT appear as their own top
bar buttons in the floating layout; they SHALL be reached from the More
menu instead. Until later changes give them new homes, the Pixel-perfect,
Symmetry, Layers panel and right-sidebar toggles SHALL remain in the top
bar in their current order, with their current behaviour. The docked
layout's top bar SHALL NOT change.

#### Scenario: Floating top bar contents
- **WHEN** a project opens in the floating layout
- **THEN** the top bar shows, in order, Back, the project title, the
  zoom pill, Pixel-perfect, Symmetry, Layers, Undo, Redo, right sidebar
  and More, and no separate Canvas Settings, Export, Record, Tile
  preview, Theme or Hide interface buttons

#### Scenario: Docked top bar unchanged
- **WHEN** a project opens without `?layout=floating`
- **THEN** the top bar shows exactly the buttons it showed before this
  change, and no title, zoom pill or More button

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

## MODIFIED Requirements

### Requirement: Full-screen canvas with floating regions
In the floating layout the canvas area SHALL fill the entire Workspace.
The top bar, tool rail, right sidebar, palette row, selection controls,
and Pencil/Eraser options SHALL be shown over the canvas as floating
cards, each keeping its current controls and behaviour except where
another requirement of this capability changes them, and none SHALL
change the size or position of the canvas area when shown, hidden,
collapsed, or expanded. The zoom controls SHALL be reached from the top
bar's zoom pill rather than a separate floating card. Floating cards
SHALL stay clear of device safe areas. Pointer input on a card SHALL go
to the card, and pointer input anywhere else SHALL go to the canvas.

#### Scenario: Canvas fills the Workspace
- **WHEN** the floating layout is active
- **THEN** the canvas area spans the full width and height of the
  Workspace, and the regions float above it

#### Scenario: Collapsing the right sidebar does not move the canvas
- **WHEN** the floating layout is active and the user hides the right
  sidebar
- **THEN** the sidebar card disappears and the artwork stays at the same
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
named slot: `top` (top bar), `tools` (tool rail and Pencil/Eraser
options), `panels` (right sidebar), or `options` (palette row and
selection controls). Only the slots SHALL determine which screen edge a
region sits against. By default `tools` sits against the left edge and
`panels` against the right edge.

#### Scenario: Default sides
- **WHEN** the floating layout is active
- **THEN** the tool rail floats against the left edge, the right sidebar
  against the right edge, the top bar along the top, and the palette row
  along the bottom
