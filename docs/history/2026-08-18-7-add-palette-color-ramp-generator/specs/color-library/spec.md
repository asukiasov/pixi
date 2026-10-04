## ADDED Requirements

### Requirement: Generate color ramp
The system SHALL offer a "Generate ramp" action that takes a source color
and a step count (3-9, default 5) and produces that many colors stepped
from dark to light through the source hue, previewed before being added
to the active palette. The action is available both from the color
picker popover (for the color currently being edited) and from the
Color Library panel header (for the current foreground color).

#### Scenario: Generating a ramp shows a preview before saving
- **WHEN** the user picks a source color and step count and triggers
  "Generate ramp"
- **THEN** a preview row of that many colors is shown before anything is
  added to the active palette

#### Scenario: Confirming adds all ramp colors to the active palette
- **WHEN** the user confirms a generated ramp preview
- **THEN** every color in the ramp is added to the active palette as an
  ordinary swatch, and the Color Library panel refreshes to show them

#### Scenario: Canceling discards the preview
- **WHEN** the user cancels a generated ramp preview instead of confirming
- **THEN** no colors are added to the active palette

#### Scenario: Step count changes the preview live
- **WHEN** the user changes the step count while a ramp preview is open
- **THEN** the preview regenerates to show the new number of steps from
  the same source color, without needing to reopen the action

#### Scenario: Ramp is ordered dark to light
- **WHEN** a ramp is generated
- **THEN** the resulting colors are ordered from darkest to lightest, with
  the source color's hue recognizable across the sequence rather than the
  ramp desaturating to flat gray at either extreme
