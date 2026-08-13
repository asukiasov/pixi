# pixel-drawing-engine Specification

## Purpose

Lets a user draw, erase, fill, undo/redo, and export a pixel-art canvas by
touch or mouse, with pixel-accurate results at native resolution.

## Requirements

### Requirement: Pencil drawing
The system SHALL let the user draw freehand strokes in the current color using
a fixed 1px brush.

#### Scenario: Single stroke
- **WHEN** the user drags one finger (or the mouse) across the canvas with the
  pencil tool active
- **THEN** the pixels along the path are set to the current draw color

### Requirement: Pixel-perfect mode
The system SHALL offer a pixel-perfect toggle that, when on, removes redundant
corner pixels from diagonal strokes so diagonals render as a 1px-thin line;
when off, diagonal strokes may render jagged (both pixels of a corner kept).
This applies identically to the pencil and eraser tools.

#### Scenario: Pixel-perfect on
- **WHEN** the user draws a diagonal stroke with pixel-perfect mode on
- **THEN** the resulting line is 1px thin with no doubled corner pixels

#### Scenario: Pixel-perfect off
- **WHEN** the user draws a diagonal stroke with pixel-perfect mode off
- **THEN** the resulting line keeps both pixels at each corner

### Requirement: Eraser
The system SHALL let the user erase by writing fully transparent pixels along
the stroke path, regardless of the canvas's background setting.

#### Scenario: Erasing on a white-background canvas
- **WHEN** the user drags across a white-background canvas with the eraser tool
- **THEN** the erased pixels become fully transparent, not white

### Requirement: Bucket fill
The system SHALL let the user flood-fill a contiguous, 4-directionally
connected region of matching color with the current draw color.

#### Scenario: Fill an enclosed region
- **WHEN** the user taps inside a region of uniform color with the bucket tool
- **THEN** every 4-directionally connected pixel of that same original color is
  set to the current draw color

#### Scenario: Fill target color equals fill color
- **WHEN** the user taps a pixel whose color already equals the current draw
  color
- **THEN** the canvas is unchanged

#### Scenario: Fill a fully uniform canvas
- **WHEN** the user taps the bucket tool on a canvas that is entirely one color
- **THEN** every pixel on the canvas is set to the current draw color

### Requirement: Color palette
The system SHALL offer a fixed palette of approximately 16 preset colors to
choose the current draw color from; no custom color input is provided.

#### Scenario: Selecting a color
- **WHEN** the user taps a palette swatch
- **THEN** that color becomes the current draw color for the pencil and bucket
  tools

### Requirement: Touch and pointer interaction
The system SHALL support drawing with a one-finger (or mouse) drag, panning
with a two-finger drag, and zooming with a pinch gesture, without the browser
intercepting these as native page gestures.

#### Scenario: One-finger draw
- **WHEN** the user drags one finger across the canvas
- **THEN** the active tool is applied along the drag path

#### Scenario: Two-finger pan
- **WHEN** the user drags two fingers across the canvas
- **THEN** the canvas view pans without drawing

#### Scenario: Pinch zoom
- **WHEN** the user pinches with two fingers on the canvas
- **THEN** the canvas view zooms in or out without drawing

### Requirement: Undo and redo
The system SHALL let the user undo and redo completed drawing actions (strokes
and fills) via visible buttons, keeping up to the last 50 actions.

#### Scenario: Undo a stroke
- **WHEN** the user completes a stroke and then taps Undo
- **THEN** the canvas reverts to its state before that stroke

#### Scenario: Redo after undo
- **WHEN** the user taps Undo and then taps Redo without drawing in between
- **THEN** the canvas returns to the state before the undo

#### Scenario: New action after undo discards redo history
- **WHEN** the user taps Undo and then performs a new stroke or fill
- **THEN** the previously available redo state is discarded and Redo is no
  longer available for it

#### Scenario: Undo history limit
- **WHEN** more than 50 actions have been completed
- **THEN** only the most recent 50 remain available to undo

### Requirement: PNG export
The system SHALL let the user export the current canvas as a PNG file at its
native pixel resolution via a single export action.

#### Scenario: Export current drawing
- **WHEN** the user taps "Export PNG"
- **THEN** a PNG file matching the canvas's exact pixel dimensions and content
  is downloaded
