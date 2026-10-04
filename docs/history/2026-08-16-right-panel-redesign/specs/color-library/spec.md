## Purpose

Covers how the Color Library panel is positioned, sized, and collapsed
within the right sidebar - as opposed to `2f-color-library-panel`'s
capability (not yet archived), which covers what the panel does
(palettes, swatches, persistence). This delta targets the same
`color-library` capability path and is expected to merge with it at
archive time.

## ADDED Requirements

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
