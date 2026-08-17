## Context

Colors are stored and added to a palette as hex strings via
`addColorToPalette(paletteId, hex)` (`js/workspace.js`), the same path the
color picker's "Add to palette" button and image import both already use.
See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Produce a ramp that reads as pixel-art-shading-appropriate (not just a
  flat lightness interpolation that looks washed out at the extremes).
- Reuse the existing add-to-palette path so ramp colors are ordinary
  swatches with no new data shape.

**Non-Goals:**
- Editing/regenerating a ramp already saved to a palette (this change only
  covers generation-time preview and one-shot add; adjusting an existing
  ramp is manual swatch editing, same as any other saved color today).
- A dedicated "ramp" grouping/label in the palette UI — added swatches are
  indistinguishable from manually-added ones, per proposal.md.

## Decisions

- **Generate in HSL space, with a hue/saturation shift at the extremes.**
  Convert the source color to HSL, then produce N steps varying lightness
  from low to high; at the darkest and lightest 1-2 steps, shift hue
  slightly toward blue (shadows) or yellow (highlights) and reduce
  saturation slightly less than a pure lightness interpolation would —
  the standard pixel-art "shading ramp" technique that keeps ramp
  endpoints from reading as flat black/white. Convert back to hex for
  each step.
  - Alternative considered: pure lightness interpolation in HSL with hue/
    saturation held constant. Rejected — this is what the proposal's
    "Why" explicitly calls out as looking flatly desaturated at the ends;
    it's also trivial for a user to already do by hand in the RGB/hex
    fields, so it wouldn't save real effort.
- **Preview-then-confirm, not generate-and-add directly.** Matches the
  existing import-palette flow's shape (`#import-preview-row`:
  extract → preview → save/cancel) so the interaction pattern is already
  familiar rather than introducing a new one.

## Risks / Trade-offs

- [Hue/saturation-shift constants (how much shift, which steps get it)
  are a design/taste choice, not a hard spec] → left to implementation to
  tune visually against a few source colors during the verification pass;
  the spec only requires the ramp not read as flatly desaturated at the
  extremes, not an exact formula.
