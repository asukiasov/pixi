# pixel-drawing-engine Specification

## Purpose

Lets a user draw, erase, fill, undo/redo, and export a pixel-art canvas by
touch or mouse, with pixel-accurate results at native resolution.

## Requirements

### Requirement: Pencil drawing
The system SHALL let the user draw freehand strokes in the current color
using a configurable circular brush tip. The tip's diameter is controlled
by a Size setting (in pixels, minimum 1, default 1); at Size 1 this is
pixel-for-pixel identical to a fixed 1px brush. An Opacity setting (1-100%,
default 100%) controls how strongly the stroke's color covers whatever is
already on the layer - at 100% it fully replaces the covered pixels' color,
as today; below 100% it blends with them.

#### Scenario: Single stroke
- **WHEN** the user drags one finger (or the mouse) across the canvas with the
  pencil tool active
- **THEN** the pixels along the path are set to the current draw color

#### Scenario: Drawing with a larger Size
- **WHEN** the user sets Size to 5 and draws a stroke
- **THEN** the stroke is approximately 5 pixels wide, centered on the
  dragged path, instead of 1 pixel wide

#### Scenario: Drawing with reduced Opacity
- **WHEN** the user sets Opacity to 50% and draws a stroke over existing
  opaque content
- **THEN** the stroke's color blends evenly with the existing content
  rather than fully replacing it, and re-tracing the same stroke path
  again in one continuous drag does not blend more strongly than a single
  pass at that Opacity (see design.md on avoiding overlap compounding)

#### Scenario: Size 1 is unchanged from prior behavior
- **WHEN** Size is 1 (the default) and Opacity is 100% (the default)
- **THEN** drawing behaves exactly as it did before Size/Opacity existed

### Requirement: Pixel-perfect mode
The system SHALL offer a pixel-perfect toggle that, when on, removes redundant
corner pixels from diagonal strokes so diagonals render as a 1px-thin line;
when off, diagonal strokes may render jagged (both pixels of a corner kept).
This applies identically to the pencil and eraser tools, and only when
their Size is 1 - corner removal has no meaning for a multi-pixel-wide
stroke.

#### Scenario: Pixel-perfect on
- **WHEN** the user draws a diagonal stroke with pixel-perfect mode on
- **THEN** the resulting line is 1px thin with no doubled corner pixels

#### Scenario: Pixel-perfect off
- **WHEN** the user draws a diagonal stroke with pixel-perfect mode off
- **THEN** the resulting line keeps both pixels at each corner

#### Scenario: Pixel-perfect has no effect above Size 1
- **WHEN** pixel-perfect mode is on and the Pencil or Eraser's Size is
  greater than 1
- **THEN** the stroke renders at its full Size with no corner-removal
  applied

### Requirement: Eraser
The system SHALL let the user erase by writing fully transparent pixels along
the stroke path, regardless of the canvas's background setting. The Eraser
shares the same Size control as Pencil (a configurable circular tip,
default 1px). Its Opacity control (1-100%, default 100%) governs how much
of the existing pixels' alpha is removed per pass rather than color
blending - at 100% erased pixels become fully transparent, as today; below
100%, existing alpha is reduced proportionally rather than zeroed, so
several partial-opacity passes are needed to fully erase.

#### Scenario: Erasing on a white-background canvas
- **WHEN** the user drags across a white-background canvas with the eraser tool
- **THEN** the erased pixels become fully transparent, not white

#### Scenario: Erasing with a larger Size
- **WHEN** the user sets the Eraser's Size to 5 and drags across the canvas
- **THEN** an approximately 5-pixel-wide area along the dragged path
  becomes fully transparent

#### Scenario: Erasing with reduced Opacity
- **WHEN** the user sets the Eraser's Opacity to 50% and erases over a
  fully opaque pixel
- **THEN** that pixel's alpha is reduced by roughly half rather than
  becoming fully transparent in one pass

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
The system SHALL offer a fixed palette of approximately 16 preset colors,
plus a custom color picker for choosing any color by RGB or hex value.
Picking a custom color SHALL make it the current draw color immediately,
the same as tapping a preset swatch. The user SHALL be able to add the
currently-picked custom color to the palette row as a new swatch,
reselectable with one tap for the rest of the session.

#### Scenario: Selecting a color
- **WHEN** the user taps a palette swatch
- **THEN** that color becomes the current draw color for the pencil and bucket
  tools

#### Scenario: Picking a custom color by hex
- **WHEN** the user types a hex value (e.g. `#3a7bd5`) into the color
  picker's hex field
- **THEN** the current draw color updates to match that hex value

#### Scenario: Picking a custom color by RGB
- **WHEN** the user sets R, G, and B values individually in the color
  picker
- **THEN** the current draw color updates to match those RGB values, and
  the picker's hex field updates to the equivalent hex value

#### Scenario: Adding a custom color to the palette
- **WHEN** the user picks a custom color and taps "Add to palette"
- **THEN** a new swatch for that exact color appears in the palette row
  and can be reselected with a single tap like any preset color

#### Scenario: Custom swatches don't persist across a reload
- **WHEN** the user adds a custom color to the palette and then reloads
  the page (or opens a different project)
- **THEN** only the original preset palette (plus Rainbow) remains - the
  custom swatch is not restored

### Requirement: Eyedropper tool
The tools sidebar SHALL offer an Eyedropper tool. Tapping the canvas with
it active SHALL sample the composited color at that point (as currently
rendered on screen, accounting for all visible layers) and set it as the
current foreground draw color, without modifying any pixel data.

#### Scenario: Sampling a color from the canvas
- **WHEN** the user taps a point on the canvas with the Eyedropper tool
  active
- **THEN** the foreground color becomes the composited color at that
  point, and no pixels on any layer change

#### Scenario: Sampling from a transparent point
- **WHEN** the user taps a fully transparent point with the Eyedropper
  tool
- **THEN** the foreground color becomes fully transparent, the same as
  the sampled pixel

#### Scenario: Sampled color is usable immediately
- **WHEN** the user samples a color with the Eyedropper and then switches
  to the Pencil tool
- **THEN** the Pencil draws with the sampled color

### Requirement: Foreground and background colors
The system SHALL maintain two selectable colors, Foreground and
Background (Photoshop-style), shown as two overlapping swatches. Every
existing color-selection action (palette swatch, custom picker, Rainbow,
Eyedropper) SHALL set the Foreground color, exactly as "the current draw
color" already worked before this requirement existed - Background is an
additional, independently held color, not a new target for those
actions. The user SHALL be able to swap Foreground and Background with
one action, and reset both to their defaults (Foreground black,
Background white) with one action. Only Foreground is used for drawing
in this slice - Background does not change any tool's behavior (notably,
Eraser continues to always erase to full transparency, per its existing
requirement, regardless of the Background color).

#### Scenario: Picking a color sets the foreground
- **WHEN** the user picks any color via a palette swatch, the custom
  picker, or the Eyedropper
- **THEN** the Foreground color updates to match; the Background color is
  unchanged

#### Scenario: Swapping foreground and background
- **WHEN** the user activates the swap control
- **THEN** the Foreground and Background colors exchange places, and
  subsequent drawing uses what was previously the Background color

#### Scenario: Resetting to defaults
- **WHEN** the user activates the reset control
- **THEN** Foreground becomes black and Background becomes white,
  regardless of what they were set to before

#### Scenario: Background does not affect drawing tools
- **WHEN** a non-default Background color is set and the user draws with
  Pencil, Bucket, Brush, Line, or Rectangle
- **THEN** those tools draw using the Foreground color only, exactly as
  if Background did not exist

#### Scenario: Background does not affect the Eraser
- **WHEN** a non-default Background color is set and the user erases
- **THEN** erased pixels become fully transparent, not the Background
  color

### Requirement: The color-picker popover opens on every platform, including iOS
Clicking the Foreground or Background swatch SHALL open this app's own
popover (per the "Color palette" requirement above) on every platform,
including iOS/iPadOS. Revised from an attempt earlier in this change to
skip the popover on iOS and jump straight to the OS's native color
picker via a scripted click on a hidden `<input type="color">` - two
different hiding techniques for that hidden input both failed on real
iOS Safari hardware (the picker didn't open at all), so that path was
reverted rather than shipping a third unverified guess. The popover's
own native `<input type="color">` swatch (`#color-picker-native`) is a
real, visibly-tappable element once the popover is open - tapping it
directly (a genuine tap, not a scripted click) still reliably opens
iOS's native color picker, just one tap deeper than the reverted
approach aimed for.

#### Scenario: iOS opens the same popover as every other platform
- **WHEN** the user is on iOS/iPadOS and clicks the Foreground or
  Background swatch
- **THEN** this app's own popover opens, exactly as it does on desktop
  or Android

#### Scenario: The popover's native input still opens iOS's real picker
- **WHEN** the user is on iOS/iPadOS, the popover is open, and the user
  taps its native color swatch (`#color-picker-native`)
- **THEN** iOS's native color picker opens, since that's a real tap on a
  real native `<input type="color">`, not a scripted click

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
and fills) via visible buttons or the Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z /
Ctrl+Y (redo) keyboard shortcuts, keeping up to the last 20 actions.

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
- **WHEN** more than 20 actions have been completed
- **THEN** only the most recent 20 remain available to undo

#### Scenario: Undo/redo via keyboard
- **WHEN** the user presses Cmd/Ctrl+Z (or Cmd/Ctrl+Shift+Z / Ctrl+Y) while
  the Workspace is visible
- **THEN** it undoes (or redoes) the same way tapping the Undo/Redo button
  would

### Requirement: PNG export
The system SHALL let the user export the current canvas as a PNG file at its
native pixel resolution via a single export action.

#### Scenario: Export current drawing
- **WHEN** the user taps "Export PNG"
- **THEN** a PNG file matching the canvas's exact pixel dimensions and content
  is downloaded
