## Why

The Color Library can add colors to a palette and delete a whole
palette, but it can't remove one color. A mis-added swatch, a duplicate,
or a color trimmed from an imported palette can only be removed by
deleting and rebuilding the entire palette.

## What Changes

- A new "Edit colors" toggle button in the Color Library header.
- While edit mode is on, every swatch shows a remove cue, and a
  tap/click on a swatch removes that one color from the active palette
  instead of picking it as the Foreground color.
- Edit mode ends when the toggle is pressed again, when Escape is
  pressed, when the active palette changes, or when the workspace
  resets.
- The built-in default ("Material") palette can be trimmed but never
  emptied: its last remaining color can't be removed.
- Duplicate colors are removed one occurrence at a time: the tapped
  swatch, not every swatch with the same hex.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `color-library`: adds a "Remove a single color from a palette"
  requirement.

## Impact

- `js/persistence.js`: new `removeColorFromPalette(id, index)`.
- `js/color-library-ui.js`: edit-mode state, swatch click branching,
  and exit triggers.
- `index.html`: new header button (the `edit` icon is already in the
  Material Symbols subset).
- `style.css`: edit-mode swatch styling.
- Tests: `test/color-library-persistence.test.js`.
