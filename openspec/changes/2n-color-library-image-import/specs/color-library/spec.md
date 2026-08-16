## MODIFIED Requirements

### Requirement: Named palettes
Colors SHALL be organized into named palettes, not a single flat list.
Exactly one palette is active at a time, selected via a dropdown. When
more than one palette exists, the dropdown SHALL list them sorted
alphabetically by name. A new palette SHALL be creatable two ways: the
existing empty-and-named "+ New Palette" flow, or by importing an image -
opening a file picker (`image/*`), extracting a set of representative
colors from the chosen image (see the "Import palette from image"
requirement below), and naming/saving the result the same way.

#### Scenario: A fresh install starts with one default palette
- **WHEN** the user opens the Workspace for the first time (no palettes
  created yet)
- **THEN** one palette (named "Material", seeded with the full Material
  Design color system) exists and is active — see the "Default palette
  is seeded, not empty" requirement below

## ADDED Requirements

### Requirement: Import palette from image
The Color Library panel SHALL offer an "Import" control that opens a
file picker (`image/*`); choosing an image decodes it, downsamples it to
a small fixed internal grid (a color-extraction step only, not shown to
the user), and extracts a set of representative colors via clustering
(grouping similar shades together and taking one representative color
per group, e.g. median-cut) rather than raw most-frequent-exact-color
counting. The number of colors to extract SHALL be adjustable by the
user. Extracted colors SHALL be shown as a live preview - adjusting the
color count re-extracts and updates the preview - before anything is
saved. Saving the preview SHALL create a new named palette (prompting for
a name the same way "+ New Palette" does) containing exactly those
colors; canceling discards the preview without creating a palette. Once
saved, an imported palette is a normal palette - addable to, deletable,
switchable - indistinguishable from one built by hand.

#### Scenario: Importing an image creates a palette with adjustable color count
- **WHEN** the user imports an image and sets the color count to 8
- **THEN** the live preview shows 8 extracted swatches, clustered from
  the image's colors rather than its 8 most frequent exact pixel values

#### Scenario: Adjusting color count re-extracts the preview
- **WHEN** the user changes the color count from 8 to 16 while the import
  preview is open
- **THEN** the preview updates to show 16 newly extracted swatches,
  without requiring the image to be re-imported

#### Scenario: Similar shades are grouped, not duplicated
- **WHEN** the user imports an image containing a smooth gradient or
  anti-aliased edges between two colors
- **THEN** the extracted palette reflects genuinely distinct colors from
  across the image rather than being dominated by many near-identical
  shades from the gradient/edge pixels

#### Scenario: Saving the import preview creates a normal palette
- **WHEN** the user names and saves the import preview
- **THEN** a new palette with that name and the previewed colors appears
  in the palette dropdown (in alphabetical position), becomes active, and
  behaves identically to a hand-built palette (colors can be added,
  removed via palette deletion, or switched away from)

#### Scenario: Canceling an import discards the preview
- **WHEN** the user opens the import preview and cancels instead of
  saving
- **THEN** no new palette is created and the previously active palette
  remains active
