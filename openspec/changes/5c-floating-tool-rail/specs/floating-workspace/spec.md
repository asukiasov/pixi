## ADDED Requirements

### Requirement: Floating tool rail layout
In the floating layout the tool rail SHALL start just below the top bar
and SHALL be only as tall as its contents, up to the space left above
the bottom screen edge. From top to bottom it SHALL hold:
- the tool buttons, in their existing order
- any tool-scoped toggles currently shown for the active tool
  (Rectangle Filled, 1:1 proportion, Color Library sequence)
- the foreground/background swatches with Swap and Reset, at the foot

When the rail does not fit in the available height, only the tool
buttons SHALL scroll. Any tool-scoped toggles and the swatches with Swap
and Reset SHALL stay fully visible below them. Choosing a tool that
shows or hides a tool-scoped toggle SHALL NOT move or re-fit the canvas.

#### Scenario: Rail hugs its contents
- **WHEN** a project opens in the floating layout on a screen tall
  enough for the whole rail
- **THEN** the rail starts below the top bar, ends just after the Swap
  and Reset controls, and the canvas shows below it

#### Scenario: Swatches at the foot
- **WHEN** the user selects the Rectangle tool in the floating layout
- **THEN** the Filled and 1:1 toggles appear above the colour swatches,
  and the swatches remain the last thing in the rail

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
