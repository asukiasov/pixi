## ADDED Requirements

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
bottom-centre card, together with the selection controls while a
selection exists. When the tool-options bar is shown, it SHALL sit
directly above that card, also centred, with the usual gap between
floating cards and no overlap. When the bar is hidden, the palette card
SHALL stay where it is. Both cards SHALL stay clear of the tool rail and
the right sidebar at their default sizes.

#### Scenario: Stacked bottom cards
- **WHEN** the Rectangle tool is active in the floating layout
- **THEN** the tool-options bar shows above the palette card, both
  centred, and neither covers the other

#### Scenario: Selection controls with the bar
- **WHEN** the Select tool is active and the user makes a selection
- **THEN** Clear selection and Delete appear in the palette card, and
  the tool-options bar with 1:1 proportion stays above the palette card
  without overlapping it

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

## MODIFIED Requirements

### Requirement: Full-screen canvas with floating regions
In the floating layout the canvas area SHALL fill the entire Workspace.
The top bar, tool rail, right sidebar, palette row, selection controls,
and tool-options bar SHALL be shown over the canvas as floating
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
named slot: `top` (top bar), `tools` (tool rail), `panels` (right
sidebar), or `options` (tool-options bar, palette row and selection
controls). Only the slots SHALL determine which screen edge a region
sits against. By default `tools` sits against the left edge and
`panels` against the right edge.

#### Scenario: Default sides
- **WHEN** the floating layout is active
- **THEN** the tool rail floats against the left edge, the right sidebar
  against the right edge, the top bar along the top, and the palette row
  and tool-options bar along the bottom

### Requirement: Slim top bar
In the floating layout the top bar SHALL start with Back to Gallery, the
project title and the zoom pill, and SHALL end with a More button, with
Undo and Redo toward the end. Canvas Settings, Export, Record timelapse,
Tile preview, Theme and Hide interface SHALL NOT appear as their own top
bar buttons in the floating layout; they SHALL be reached from the More
menu instead. Pixel-perfect and Symmetry SHALL NOT appear in the top bar
in the floating layout; they SHALL be reached from the tool-options bar
instead. Until a later change gives them new homes, the Layers panel and
right-sidebar toggles SHALL remain in the top bar in their current
order, with their current behaviour. The docked layout's top bar SHALL
NOT change.

#### Scenario: Floating top bar contents
- **WHEN** a project opens in the floating layout
- **THEN** the top bar shows, in order, Back, the project title, the
  zoom pill, Layers, Undo, Redo, right sidebar and More, and no separate
  Pixel-perfect, Symmetry, Canvas Settings, Export, Record, Tile
  preview, Theme or Hide interface buttons

#### Scenario: Docked top bar unchanged
- **WHEN** a project opens without `?layout=floating`
- **THEN** the top bar shows exactly the buttons it showed before this
  change, and no title, zoom pill or More button

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
