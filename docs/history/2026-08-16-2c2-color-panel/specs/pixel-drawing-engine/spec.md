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
