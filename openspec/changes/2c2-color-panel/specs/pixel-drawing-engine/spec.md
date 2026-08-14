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
