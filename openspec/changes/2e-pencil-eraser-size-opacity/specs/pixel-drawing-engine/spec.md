## MODIFIED Requirements

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
