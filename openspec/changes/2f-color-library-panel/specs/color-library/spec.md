## Purpose

Lets a user build and reuse their own named collections of colors,
persisted locally, beyond the fixed 16-swatch preset row and beyond a
single session — the "saved palettes" half of custom color support that
`2c2-color-panel` deferred.

## ADDED Requirements

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
alphabetically by name.

#### Scenario: A fresh install starts with one default palette
- **WHEN** the user opens the Workspace for the first time (no palettes
  created yet)
- **THEN** one palette (named "Material", seeded with the full Material
  Design color system) exists and is active — see the "Default palette
  is seeded, not empty" requirement below

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
