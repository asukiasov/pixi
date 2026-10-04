## MODIFIED Requirements

### Requirement: Import palette from image
The Color Library panel SHALL offer an "Import" control that opens a
file picker (`image/*`); choosing an image decodes it, downsamples it to
a small fixed internal grid (a color-extraction step only, not shown to
the user), and extracts a set of representative colors via clustering
(grouping similar shades together and taking one representative color
per group, e.g. median-cut) rather than raw most-frequent-exact-color
counting. The number of colors to extract SHALL be adjustable by the
user. Extracted colors and controls SHALL be shown in a popover anchored
to the Import control - the same anchored-popover behavior as Canvas
Settings/Export (positioned below the control, flipping above if that
would overflow the viewport, clamped horizontally, closable via an
explicit close button, clicking outside, or Escape) - as a live preview:
adjusting the color count re-extracts and updates the preview before
anything is saved. Saving the preview SHALL create a new named palette
(prompting for a name the same way "+ New Palette" does) containing
exactly those colors and close the popover; canceling discards the
preview and closes the popover without creating a palette. Once saved,
an imported palette is a normal palette - addable to, deletable,
switchable - indistinguishable from one built by hand.

#### Scenario: Opening the import popover
- **WHEN** the user clicks the Import control and picks an image
- **THEN** the import popover opens showing the live swatch preview and
  color-count control, with no palette created yet

#### Scenario: Closing without importing
- **WHEN** the import popover is open and the user presses Escape,
  clicks outside it, or clicks its close button
- **THEN** the popover closes and no palette is created

#### Scenario: Importing an image creates a palette with adjustable color count
- **WHEN** the user imports an image and sets the color count to 8
- **THEN** the live preview shows 8 extracted swatches, clustered from
  the image's colors rather than its 8 most frequent exact pixel values

#### Scenario: Adjusting color count re-extracts the preview
- **WHEN** the user changes the color count from 8 to 16 while the import
  popover is open
- **THEN** the preview updates to show 16 newly extracted swatches,
  without requiring the image to be re-imported, and without shifting
  the position of the color-count control itself (the popover is a
  fixed-position surface, not in-flow content)

#### Scenario: Similar shades are grouped, not duplicated
- **WHEN** the user imports an image containing a smooth gradient or
  anti-aliased edges between two colors
- **THEN** the extracted palette reflects genuinely distinct colors from
  across the image rather than being dominated by many near-identical
  shades from the gradient/edge pixels

#### Scenario: Saving the import preview creates a normal palette
- **WHEN** the user names and saves the import preview
- **THEN** a new palette with that name and the previewed colors appears
  in the palette dropdown (in alphabetical position), becomes active,
  the popover closes, and the palette behaves identically to a hand-built
  one (colors can be added, removed via palette deletion, or switched
  away from)

#### Scenario: Canceling an import discards the preview
- **WHEN** the user opens the import popover and cancels instead of
  saving
- **THEN** the popover closes, no new palette is created, and the
  previously active palette remains active
