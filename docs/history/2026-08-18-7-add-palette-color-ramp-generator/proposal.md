## Why

The Color Library (`color-library` spec) only stores flat swatch lists,
built manually via the color picker's "Add to palette" or via image
import. Pixel art shading conventions lean heavily on ramps — a base hue
stepped through several shades and tints — and today producing one means
manually tweaking hex values in `#color-picker-popover` one swatch at a
time. A ramp generator removes that manual step.

## What Changes

- Add a "Generate ramp" action, available from the color picker popover
  (`#color-picker-popover`) for the color currently being edited, and from
  the Color Library panel header for the current foreground color.
- Generating a ramp takes the source color and a step count (3-9 steps,
  default 5) and produces that many colors stepped from dark to light
  through the source hue (adjusting lightness, with a slight hue/saturation
  shift at the extremes so ramps don't look flatly desaturated at the
  ends — a standard pixel-art ramp technique).
- A confirmation step shows the generated ramp as a preview row before
  committing (consistent with the existing import-palette preview flow's
  "extract, preview, then save" shape), then adds all generated colors to
  the active palette in one action via the existing
  `addColorToPalette`/`loadColorPalettes` path.
- No new persisted data structure — ramp colors become ordinary swatches
  in the active palette, indistinguishable from manually-added ones once
  saved.

## Capabilities

### Modified Capabilities
- `color-library`: adds a new way to populate a palette (generated ramp)
  alongside the existing manual add and image-import paths; no change to
  how palettes are stored, selected, or rendered.

## Impact

- `js/workspace.js` / `js/color-library.js`: new ramp-generation function
  (source color + step count → array of hex colors) and a preview-then-add
  UI flow reusing `addColorToPalette`.
- `index.html`: new "Generate ramp" control in the color picker popover
  and/or Color Library panel header, plus a preview row (structurally
  similar to `#import-preview-row`).
- `css/*`: styling for the new control and preview row.
- No persistence/schema changes.
