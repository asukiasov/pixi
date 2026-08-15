## Purpose

Lets a user control what part of the canvas they're looking at and at
what magnification — zoom in to work on fine detail, zoom out or fit to
see the whole piece, and pan around when the canvas doesn't fit the
container at the current zoom.

## ADDED Requirements

### Requirement: Zoom in/out controls
The Workspace SHALL offer `+` and `-` zoom controls (buttons) that step
the zoom level up or down by a fixed increment, within the existing
zoom range the canvas viewport already supports. Zooming SHALL keep the
same point of the canvas under the center of the container (or the
current pan focus) rather than jumping the view to a different part of
the canvas.

#### Scenario: Zooming in with the + button
- **WHEN** the user clicks the `+` zoom button
- **THEN** the zoom level increases by one step and the canvas grows
  around its current visual center, without panning to a different area

#### Scenario: Zooming out with the - button
- **WHEN** the user clicks the `-` zoom button
- **THEN** the zoom level decreases by one step and the canvas shrinks
  around its current visual center

#### Scenario: Zoom is clamped
- **WHEN** the user zooms in or out repeatedly past the viewport's
  supported range
- **THEN** the zoom level stops changing at the existing minimum/maximum
  bound instead of exceeding it

### Requirement: Zoom keyboard shortcuts
Cmd/Ctrl `+` (`=`) and Cmd/Ctrl `-` SHALL zoom in and out respectively,
identically to clicking the `+`/`-` buttons, while the Workspace screen
is visible.

#### Scenario: Zooming in with a keyboard shortcut
- **WHEN** the user presses Cmd/Ctrl `+` while the Workspace is open
- **THEN** the zoom level increases by one step, the same as clicking `+`

#### Scenario: Zoom shortcuts don't fire outside the Workspace
- **WHEN** the user presses Cmd/Ctrl `+`/`-` while the Gallery or New
  Canvas screen is showing
- **THEN** no zoom change occurs

### Requirement: Zoom presets
The Workspace SHALL offer three zoom preset controls:
- **100%**: sets the zoom so one canvas pixel renders as exactly one CSS
  pixel, regardless of container size.
- **Fit Screen**: fits the whole canvas within the container and centers
  it (the existing default view a freshly opened project starts at).
- **Fill Screen**: scales the canvas up to cover the entire container
  (the shorter dimension fills exactly), cropping whatever overflows in
  the other dimension, rather than leaving empty space around it.

#### Scenario: 100% preset
- **WHEN** the user clicks the 100% preset
- **THEN** the canvas renders at exactly one CSS pixel per canvas pixel

#### Scenario: Fit Screen preset
- **WHEN** the user clicks Fit Screen
- **THEN** the whole canvas becomes visible, centered, at the largest
  scale that still fits entirely within the container

#### Scenario: Fill Screen preset
- **WHEN** the user clicks Fill Screen
- **THEN** the canvas scales up to cover the full container, with any
  overflow beyond the container's edges cropped from view (not visible,
  not exported — a viewport-only crop)

### Requirement: Zoom percentage readout
The Workspace SHALL display the current effective zoom level as a
percentage in the bottom-left of the screen, updating live whenever the
zoom changes — via buttons, keyboard shortcuts, presets, or touch pinch.

#### Scenario: Readout reflects the current zoom
- **WHEN** the user zooms the canvas to 200% by any method
- **THEN** the bottom-left readout shows "200%"

#### Scenario: Readout updates on pinch zoom
- **WHEN** the user changes zoom via a two-finger touch pinch
- **THEN** the readout updates to match, the same as any other zoom
  method

### Requirement: Hand tool
The tools sidebar SHALL offer a Hand tool. While active, dragging on the
canvas pans the view (moves which part of the canvas is visible) instead
of drawing, usable at any zoom level and most useful once the canvas is
larger than the container.

#### Scenario: Panning with the Hand tool
- **WHEN** the Hand tool is active and the user drags across the canvas
- **THEN** the visible area shifts to follow the drag, and no pixels are
  drawn, erased, or otherwise modified

#### Scenario: Other tools are unaffected
- **WHEN** the user switches away from the Hand tool to any drawing tool
- **THEN** dragging on the canvas resumes that tool's normal drawing
  behavior instead of panning

#### Scenario: Touch pinch-pan still works alongside the Hand tool
- **WHEN** the user pans via a two-finger touch gesture while a different
  tool (not Hand) is selected
- **THEN** the view pans the same way it already does today, unaffected
  by which single-pointer tool is currently selected

### Requirement: Hand tool cursor reflects pan state
The canvas SHALL show a custom paw-print cursor while the Hand tool is
active and idle, and a distinct "picked up" paw cursor while a pan drag
is actually in progress — a themed replacement for the OS-native
open/closed-hand cursor, in the same spirit as this app's other playful
touches, distinct from every other tool's cursor. Revised from this
requirement's original OS-native grab/grabbing design, once custom paw
artwork was supplied directly.

#### Scenario: Idle Hand tool shows the paw cursor
- **WHEN** the Hand tool is selected and the user is not currently
  dragging
- **THEN** the cursor over the canvas is the custom paw-print cursor
  (`assets/cursors/pets.svg`, Google's Material Symbols "pets" glyph)

#### Scenario: Dragging with the Hand tool shows the picked-up paw
- **WHEN** the user presses and drags with the Hand tool active
- **THEN** the cursor changes to the "picked up" paw cursor
  (`assets/cursors/pets-picked.svg`) for the duration of the drag,
  reverting to the idle paw cursor on release

#### Scenario: Other tools never show the paw cursor
- **WHEN** any tool other than Hand is active
- **THEN** the canvas cursor is that tool's own cursor (e.g. crosshair for
  Pencil), never either paw cursor

### Requirement: Only the canvas pinch-zooms
Native browser pinch-zoom of the whole page SHALL be disabled everywhere
except the canvas itself, which handles pinch-zoom entirely through its
own pointer-event-driven logic (see the "Zoom controls" requirement).
Pinching anywhere else in the Workspace (the tools sidebar, right
sidebar, top bar, bottom bar) SHALL NOT zoom the page. Bug fix: pinching
over the right sidebar on iPad previously zoomed the entire app UI
(text, icons, layout) via the browser's native pinch-zoom, not the
canvas.

#### Scenario: Pinching outside the canvas does nothing
- **WHEN** the user pinches with two fingers anywhere in the Workspace
  other than the canvas (e.g. the right sidebar)
- **THEN** nothing zooms - the page layout and text size are unaffected

#### Scenario: Pinching on the canvas still zooms it
- **WHEN** the user pinches with two fingers on the canvas itself
- **THEN** the canvas zooms exactly as before, unaffected by this
  requirement

#### Scenario: Normal scrolling still works
- **WHEN** the user scrolls (not pinches) a scrollable area, such as the
  Gallery grid or a sidebar with overflow
- **THEN** scrolling works exactly as before - only pinch-zoom is
  disabled, not panning/scrolling gestures generally
