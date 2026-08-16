# export Specification

## Purpose

Lets a user export the current project as an image at a chosen scale and
format, and optionally with a transparent background regardless of how the
canvas itself was set up, instead of always downloading a single
native-resolution PNG with a fixed name and the canvas's own background
baked in.

## Requirements

### Requirement: Export popover
Export SHALL open as a popover anchored to the Export control in the top
bar, using the same anchored-popover behavior as Canvas Settings
(positioned below the control, flipping above if that would overflow the
viewport, clamped horizontally, closable via an explicit close button,
clicking outside, Escape, or re-clicking the Export control) rather than
downloading immediately on click.

#### Scenario: Opening the Export popover
- **WHEN** the user clicks the Export control in the top bar
- **THEN** the Export popover opens showing the scale multiplier, format
  selector, and transparent-background controls, with no file downloaded
  yet

#### Scenario: Closing without exporting
- **WHEN** the Export popover is open and the user presses Escape, clicks
  outside it, or clicks its close button
- **THEN** the popover closes and no file is downloaded

### Requirement: Scale multiplier
The Export popover SHALL offer a choice of 1x, 2x, 4x, or 8x scale, default
1x. The exported PNG's pixel dimensions SHALL be the canvas's native width
and height multiplied by the chosen scale, with each source pixel rendered
as a solid block of scale×scale output pixels (nearest-neighbor, no
smoothing/interpolation).

#### Scenario: Exporting at native resolution
- **WHEN** the user exports a 32×32 canvas at the default 1x scale
- **THEN** the downloaded PNG is 32×32 pixels

#### Scenario: Exporting upscaled
- **WHEN** the user selects 4x and exports a 32×32 canvas
- **THEN** the downloaded PNG is 128×128 pixels, with every source pixel
  reproduced as a sharp-edged 4×4 block of solid color (no blurring between
  adjacent source pixels)

### Requirement: Transparent-background override
The Export popover SHALL offer a "Transparent background" toggle, off by
default. When on, the Background layer (see the `layers` capability, if the
project has one) SHALL be composited as fully transparent for this export
only, instead of filling with its background color. When off, export SHALL
composite exactly as the canvas currently renders on-screen, including any
opaque Background layer. This toggle SHALL NOT alter the project's saved
layer data, its Background layer's color, or its on-screen rendering — it
affects only the exported file.

The toggle SHALL be disabled (visibly greyed out and non-interactive) and
forced off whenever JPG is the selected format, since JPG has no alpha
channel — see the Format selector requirement. Selecting PNG or WebP
re-enables it, without restoring whatever the toggle's on/off value was
before JPG was selected (it stays off until the user turns it on again).

#### Scenario: Overriding a white-background canvas to transparent
- **WHEN** the user exports a project whose Background layer is opaque
  white with "Transparent background" on
- **THEN** the downloaded PNG has a fully transparent background in place
  of the Background layer's fill, with all other layers composited on top
  unchanged, and the project's own layer data and rendering are unaffected

#### Scenario: Default export matches on-screen rendering
- **WHEN** the user exports a project with "Transparent background" off
- **THEN** the downloaded PNG matches exactly what compositing all visible
  layers produces on-screen, including an opaque Background layer if
  present

#### Scenario: Transparent-canvas project is unaffected by the toggle
- **WHEN** the user exports a project that has no Background layer (created
  with a transparent background) regardless of the toggle's state
- **THEN** the downloaded PNG is identical either way, since there is no
  opaque Background layer to override

#### Scenario: Selecting JPG disables the toggle
- **WHEN** the user has "Transparent background" checked and then selects
  JPG as the format
- **THEN** the toggle becomes disabled and unchecked, and the export
  composites the opaque Background layer (or flattens onto white — see
  Format selector) regardless of its prior state

### Requirement: Format selector
The Export popover SHALL offer a choice of PNG (default), WebP, or JPG.
PNG and WebP preserve the alpha channel from compositing (including any
transparency from the "Transparent background" toggle or a
transparent-background canvas). JPG has no alpha channel: exporting as JPG
SHALL flatten any transparent or removed-background area onto an opaque
white backdrop before encoding, rather than leaving that undefined (browser
default JPEG encoding of transparent canvas pixels renders as black, which
this requirement avoids).

#### Scenario: Exporting as WebP
- **WHEN** the user selects WebP and exports a project with transparency
- **THEN** the downloaded file is a `.webp` image with transparency
  preserved

#### Scenario: Exporting as JPG flattens transparency to white
- **WHEN** the user selects JPG and exports a transparent-background
  project (or a white-background project with "Transparent background"
  forced off per the disabled-toggle behavior)
- **THEN** the downloaded `.jpg` file has an opaque white background in
  place of any transparency, with all layer content composited on top
  unchanged

### Requirement: Export filename
The downloaded file SHALL be named from the project's current name (as set
in Canvas Settings, default "Untitled"), the chosen scale, and the chosen
format's extension, following the pattern
`<sanitized-project-name>@<scale>x.<ext>` (e.g. `My Sprite@4x.png`).
Characters not safe in a filename (`/ \ : * ? " < > |`) SHALL be replaced
with `-`; a name that sanitizes to empty SHALL fall back to `untitled`.
`<ext>` SHALL be `png`, `webp`, or `jpg` matching the selected format.

#### Scenario: Default filename
- **WHEN** a project named "My Sprite" is exported at the default 1x scale
  in PNG format
- **THEN** the downloaded file is named `My Sprite@1x.png`

#### Scenario: Filename reflects scale and format
- **WHEN** the same project is exported at 4x scale in WebP format
- **THEN** the downloaded file is named `My Sprite@4x.webp`

#### Scenario: Unsafe characters are sanitized
- **WHEN** a project is named `Sword/Shield: v2` and exported
- **THEN** the downloaded filename replaces `/` and `:` with `-` (e.g.
  `Sword-Shield- v2@1x.png`)

### Requirement: Export composites visible layers
Exporting SHALL include only the layers marked visible, composited in
stacking order with their blend modes and opacities applied — the same
compositing rules used for on-screen rendering, before the scale, format,
and transparent-background options are applied.

#### Scenario: Hidden layers are excluded
- **WHEN** the user exports a project with one layer hidden
- **THEN** the downloaded file does not include that layer's content
