## Why

The palette is currently a fixed set of ~16 preset swatches with, per the
original Phase 1 spec, explicitly "no custom color input" — a real
limitation once a user wants a color that isn't one of those 16 (a
specific skin tone, a brand color, a shade picked from a reference image).
Phase 2c's roadmap entry already anticipated this ("full color/palette
panel, custom color picker, saved palettes"); this change delivers the
custom-picker half of that (RGB/hex entry, add to the palette). Symmetry
& grid tools, also mentioned under the same roadmap line, are not part of
this slice — not requested, and unrelated in implementation.

## What Changes

- A custom color picker, reachable from the palette row, offering both a
  visual picker and direct RGB/hex entry.
- Picking a custom color makes it the current draw color immediately
  (same as tapping any existing swatch).
- An explicit "add to palette" action appends the currently-picked custom
  color as a new swatch in the palette row, so it can be reselected with
  one tap like any preset color, for the rest of the session.
- **BREAKING** (spec-level only, not a runtime break): supersedes Phase
  1's "no custom color input is provided" constraint in the Color palette
  requirement.

## Capabilities

### Modified Capabilities
- `pixel-drawing-engine`: the "Color palette" requirement changes from
  "fixed palette only, no custom color input" to "fixed palette plus a
  custom color picker with RGB/hex entry and the ability to add a picked
  color to the palette."

## Impact

- `js/workspace.js`: palette-row gains a custom-color picker control;
  `state.currentColor` can now be set from picker input, not just a
  preset swatch click; a new in-memory list of user-added custom swatches
  (rendered alongside the fixed 16 + Rainbow).
- `index.html` / `style.css`: new picker UI (native color input +
  RGB/hex text fields + "Add to palette" button), palette row grows to
  accommodate custom swatches.
- No `js/engine.js` changes — this only affects how `currentColor` gets
  set, not how it's drawn.
- No persistence changes in this slice: custom swatches added to the
  palette live for the current session only (like every other
  tool/color selection in this app), not saved to IndexedDB. Full "saved
  palettes" (the other half of the original roadmap line) is a possible
  future increment, not built here.
