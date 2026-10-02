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
The top bar, tool rail, right sidebar, palette row, selection controls,
zoom bar, and Pencil/Eraser options SHALL be shown over the canvas as floating cards, each keeping its current
controls and behaviour, and none SHALL change the size or position of the
canvas area when shown, hidden, collapsed, or expanded. Floating cards
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
options), `panels` (right sidebar), or `options` (palette row, selection
controls, and zoom bar). Only the slots SHALL
determine which screen edge a region sits against. By default `tools` sits
against the left edge and `panels` against the right edge.

#### Scenario: Default sides
- **WHEN** the floating layout is active
- **THEN** the tool rail floats against the left edge, the right sidebar
  against the right edge, the top bar along the top, and the palette row
  and zoom bar along the bottom

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
rail, right sidebar if shown, and bottom cards), not within the full
Workspace. Cards that appear or disappear afterwards SHALL NOT re-fit or
move the canvas. Fill and
100% SHALL keep their existing meaning, centred in the same clear area.
Panning and zooming SHALL still allow moving the canvas underneath any
card.

#### Scenario: Opening a project
- **WHEN** a project opens in the floating layout
- **THEN** the whole canvas is visible, centred between the floating
  cards, with none of it covered by them

#### Scenario: Fit with the right sidebar hidden
- **WHEN** the right sidebar is hidden and the user chooses Fit
- **THEN** the canvas is fitted into the wider clear area that includes
  the space the sidebar would have used

#### Scenario: Panning under a card
- **WHEN** the user pans the canvas toward a floating card
- **THEN** the canvas moves underneath the card without being stopped
