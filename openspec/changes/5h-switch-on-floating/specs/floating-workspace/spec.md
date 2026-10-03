## ADDED Requirements

### Requirement: Narrow windows
The floating layout SHALL be used at every window width, with no separate
narrow layout. In windows at least 320 CSS pixels wide, every control in
the top bar, tool rail, panel mini-rail, open panel cards, tool-options
bar and palette card SHALL be fully reachable on screen, either directly
or by scrolling within its own card. No control SHALL be cut off by its
card's edge or the screen edge. The panel cards SHALL NOT cover the tool
rail or the panel mini-rail: when the space between them is narrower than
the cards' usual width, the cards SHALL narrow to fit it. The tool-options
bar SHALL keep all of the active tool's controls inside the bar, wrapping
onto more rows if needed. The palette row SHALL scroll within its card
when its swatches do not fit.

#### Scenario: Phone-width options bar
- **WHEN** a project opens at 390×844 with the Pencil tool
- **THEN** Size, Opacity, Pixel-perfect, Symmetry and Color Library
  sequence are all fully inside the tool-options bar and on screen, and
  each can be operated

#### Scenario: Cards beside the rail
- **WHEN** the user opens the Layers card at 390×844
- **THEN** the Layers card sits between the tool rail and the panel
  mini-rail without covering either, and every layer row control in it
  can be reached

#### Scenario: Palette row
- **WHEN** the palette has more swatches than fit across the palette
  card at 390×844
- **THEN** the palette row scrolls sideways inside its card, and no
  swatch is drawn past the card's edge

## MODIFIED Requirements

### Requirement: Layout switch
The standalone app SHALL always render the Workspace in the floating
layout. The `layout` query parameter SHALL have no effect: with
`layout=floating`, `layout=docked`, any other value, or none, the
Workspace SHALL render in the floating layout. The standalone app SHALL
offer no control to switch layout. An editor embedded through
`Pixi.mount()` SHALL always use the docked layout, whatever the host
page's URL. Where another capability describes a Workspace control in its
docked placement (for example a top bar button or a collapsible sidebar
section), the requirements of this capability SHALL take precedence in
the floating layout. The other capability SHALL still describe the docked
layout used by embeds.

#### Scenario: Default stays docked
- **WHEN** the user opens a project in the standalone app without a
  `layout` query parameter
- **THEN** the Workspace renders in the floating layout (the default is
  no longer docked)

#### Scenario: Opting in
- **WHEN** the user opens an old `?layout=floating#/project/<id>` link
- **THEN** the project opens in the floating layout, exactly as without
  the parameter

#### Scenario: Unknown value
- **WHEN** the page is opened with `?layout=docked` or
  `?layout=anything-else`
- **THEN** the Workspace renders in the floating layout

#### Scenario: Navigating between screens keeps the choice
- **WHEN** the user goes from a project to the Gallery and opens another
  project
- **THEN** the Workspace still renders in the floating layout

#### Scenario: Embeds stay docked
- **WHEN** a host page mounts the editor with `Pixi.mount()`, including
  on a page whose URL has `?layout=floating`
- **THEN** the embedded editor renders in the docked layout, exactly as
  before this change

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
docked layout's top bar, used by `Pixi.mount()` embeds, SHALL NOT change.

#### Scenario: Floating top bar contents
- **WHEN** a project opens in the floating layout
- **THEN** the top bar shows, in order, Back, the project title, the
  zoom pill, Undo, Redo and More, and no separate Layers, right sidebar,
  Pixel-perfect, Symmetry, Canvas Settings, Export, Record, Tile
  preview, Theme or Hide interface buttons

#### Scenario: Docked top bar unchanged
- **WHEN** an editor embedded through `Pixi.mount()` opens with its top
  bar shown
- **THEN** the top bar shows exactly the buttons the docked top bar
  showed before the floating layout existed, including the Layers and
  right-sidebar toggles, and no title, zoom pill or More button

### Requirement: Panel cards on project open
In the floating layout, whenever a project is opened in a window at least
600 CSS pixels wide, the Colors and Layers cards SHALL be open and the
Brushes card SHALL be open (and so shown while the Brush tool is active).
Whenever a project is opened in a narrower window, all three cards SHALL
be closed, and the user SHALL open them from the panel mini-rail. The
window's width when the project opens decides this. Resizing the window
afterwards SHALL NOT open or close cards. The initial view SHALL be
fitted after these defaults are applied, beside the cards that are then
open. Which cards are open SHALL NOT be remembered across project opens
or page reloads.

#### Scenario: Defaults on open
- **WHEN** the user closes the Colors and Layers cards in a 1180×820
  window and then opens another project
- **THEN** the Colors and Layers cards are open again, and the canvas is
  fitted beside them

#### Scenario: Reload
- **WHEN** the user closes the Layers card in a 1180×820 window and
  reloads the page
- **THEN** the project opens with the Layers card open

#### Scenario: Narrow window
- **WHEN** a project opens at 390×844
- **THEN** the Colors, Brushes and Layers cards are closed, the mini-rail
  shows them as closed, and the whole canvas is visible between the tool
  rail and the mini-rail

#### Scenario: Opening a card on a narrow window
- **WHEN** a project has opened at 390×844 and the user activates Layers
  in the mini-rail
- **THEN** the Layers card opens, and the artwork stays at the same
  position and zoom on screen

#### Scenario: Resizing does not toggle cards
- **WHEN** a project opened at 1180×820 and the window is then narrowed
  to 390 pixels wide
- **THEN** the cards that were open stay open
