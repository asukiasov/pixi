## MODIFIED Requirements

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

## ADDED Requirements

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

### Requirement: Foreground/Background color picker is native on iOS
On iOS/iPadOS, clicking the Foreground or Background swatch SHALL open
the operating system's native color picker directly, instead of this
app's own popover (Grid-style native input, hex field, RGB fields, "Add
to palette"). Picked colors route through the same
Foreground/Background assignment as every other platform. On every
other platform, the existing custom popover (per the "Color palette"
requirement above) is unaffected. Requested directly, to match how
other iOS apps present a Foreground/Background-style picker rather than
opening a middleware window first. The popover's own "Add to palette"
button is not reachable through this path on iOS - see the
`color-library` capability's "Add the current color from anywhere"
requirement for how that gap is closed instead.

#### Scenario: Clicking a swatch on iOS opens the native picker
- **WHEN** the user is on iOS/iPadOS and clicks the Foreground or
  Background swatch
- **THEN** the OS's native color picker opens directly; this app's own
  popover (Grid, hex/RGB fields, Add to palette) never appears

#### Scenario: A color picked natively updates Foreground/Background
- **WHEN** the user picks a color in the native picker
- **THEN** whichever swatch was clicked (Foreground or Background)
  updates to that color, the same as picking via the popover on other
  platforms

#### Scenario: Non-iOS platforms are unaffected
- **WHEN** the user is on any platform other than iOS/iPadOS and clicks
  the Foreground or Background swatch
- **THEN** this app's own popover opens, exactly as before
