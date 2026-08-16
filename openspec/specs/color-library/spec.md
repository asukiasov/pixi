# color-library Specification

## Purpose

Lets a user build and reuse their own named collections of colors,
persisted locally, beyond the fixed 16-swatch preset row and beyond a
single session — the "saved palettes" half of custom color support that
`2c2-color-panel` deferred.

## Requirements

### Requirement: Color Library panel
The Workspace SHALL offer a "Color Library" panel in the right-sidebar,
alongside Layers and Brushes, showing the active palette's colors as a
scrollable swatch grid.

#### Scenario: Panel shows the active palette's colors
- **WHEN** the Color Library panel is open
- **THEN** every color in the currently active palette is shown as a
  swatch, scrollable if there are more than fit the visible area

#### Scenario: Clicking a library swatch sets the foreground color
- **WHEN** the user taps a swatch in the Color Library panel
- **THEN** that color becomes the current foreground draw color, the same
  as tapping a preset palette swatch

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

### Requirement: Default palette is seeded, not empty
The auto-created first-ever palette ("Material") SHALL start populated
with a fixed, built-in list of colors (the Material Design color system —
primary colors plus their tint/shade rows, the grayscale row, and
black/white) rather than empty. Revised from this change's original
Default-palette design, which started empty; requested directly once the
empty starting state shipped and felt like a dead end with nothing to
pick from.

#### Scenario: First-ever load shows a populated palette
- **WHEN** the user opens the Workspace for the first time
- **THEN** the "Material" palette's swatch grid already shows its full
  built-in color set, immediately selectable — not an empty-state message


#### Scenario: Creating a new palette
- **WHEN** the user creates a new palette and names it
- **THEN** it appears in the dropdown (in alphabetical position among
  existing palettes) and becomes the active palette

#### Scenario: Switching the active palette
- **WHEN** the user selects a different palette from the dropdown
- **THEN** the swatch grid updates to show that palette's colors, and
  subsequent "add color" actions add to it instead of the previous one

### Requirement: Add color to the active palette
The color-picker popover (from `2c2-color-panel`) SHALL offer an "add to
palette" action that adds its current color to the active named palette.

#### Scenario: Adding a color
- **WHEN** the user picks a color in the popover and adds it to the
  palette
- **THEN** a new swatch for that exact color appears in the active
  palette's grid, immediately selectable

### Requirement: Palettes persist across sessions and projects
Palettes (and their colors) SHALL be stored in IndexedDB, available in
every project and surviving a page reload — unlike `2c2`'s prior
session-only `customSwatches`.

#### Scenario: Palette survives a reload
- **WHEN** the user adds a color to a palette, reloads the page, and
  opens any project
- **THEN** that palette and its added color are still present

#### Scenario: Palette is not scoped to one project
- **WHEN** the user adds a color to a palette while project A is open,
  then opens project B
- **THEN** the same palette (with that color) is available in project B

### Requirement: Deleting a palette requires confirmation and protects the default
Deleting a palette SHALL show a confirmation dialog before removing it
(asking "are you sure?", not deleting on the first click) and SHALL be
unavailable both when it is the only remaining palette and when it is the
built-in default ("Material") palette, regardless of how many other
palettes exist — there must always be at least one populated, undeletable
palette to fall back to. Added directly: the delete control originally
had neither protection, so the built-in default (and, before this
requirement, any palette) could be removed with a single accidental
click and no way to undo it.

#### Scenario: Deleting a palette asks for confirmation
- **WHEN** the user clicks delete on a non-default palette that isn't the
  only one
- **THEN** a confirmation dialog appears before anything is deleted;
  confirming deletes it, canceling leaves it untouched

#### Scenario: The default palette can never be deleted
- **WHEN** the built-in "Material" palette is active, even if other
  palettes exist
- **THEN** its delete control is disabled

#### Scenario: The only remaining palette can never be deleted
- **WHEN** exactly one palette exists (default or otherwise)
- **THEN** its delete control is disabled

### Requirement: Add the current color from anywhere
The Color Library panel SHALL offer a button that adds the current
Foreground color to the active palette, independent of the color-picker
popover's own "Add to palette" button - a second, always-available path
to the same action, on every platform, not gated behind opening the
popover first.

#### Scenario: Adding the current color on any platform
- **WHEN** the user clicks the Color Library panel's "add current color"
  button
- **THEN** the current Foreground color is added to the active palette,
  the same as the popover's "Add to palette" button would do

### Requirement: Color Library panel position in the right sidebar
The Color Library panel SHALL be the topmost section of the right
sidebar, above the Brushes panel (when shown) and the Layers panel.

#### Scenario: Color Library renders above Brushes and Layers
- **WHEN** the Workspace screen is open
- **THEN** the Color Library panel appears above the Layers panel in the
  right sidebar, and above the Brushes panel whenever Brushes is also
  visible

### Requirement: Color Library panel has a bounded height
The Color Library panel's swatch grid area SHALL have a fixed maximum
height, independent of the window's height, rather than stretching to
fill all remaining vertical space in the sidebar. Swatches SHALL render
small enough that multiple rows are visible within that bounded height.
Content beyond the visible area SHALL scroll within the panel.

#### Scenario: Panel height stays bounded on a tall window
- **WHEN** the Workspace is open in a tall browser window with few
  colors in the active palette
- **THEN** the Color Library panel does not grow to fill the extra
  vertical space; the Layers panel below it uses that space instead

#### Scenario: Extra colors scroll within the panel
- **WHEN** the active palette has more colors than fit within the
  panel's bounded height
- **THEN** the swatch grid scrolls independently to reveal them, without
  growing the panel itself taller

### Requirement: Color Library panel collapse
The user SHALL be able to collapse the Color Library panel down to just
its header row (hiding the palette controls and swatch grid, but not the
header itself) by clicking the panel header, and expand it again the
same way.

#### Scenario: Collapsing via the panel header
- **WHEN** the user clicks the Color Library panel header
- **THEN** the palette controls and swatch grid disappear, only the
  header row remains, and the Layers panel below grows to use the freed
  vertical space

#### Scenario: Expanding via the panel header
- **WHEN** the user clicks the header of a collapsed Color Library panel
- **THEN** the palette controls and swatch grid reappear showing the
  active palette, unaffected by having been collapsed
