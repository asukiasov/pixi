## 1. Ramp generation

- [ ] 1.1 Implement a `generateColorRamp(hex, stepCount)` function: convert
      to HSL, step lightness from dark to light across `stepCount`
      colors, apply the hue/saturation shift at the extremes (see
      design.md), convert each step back to hex.
- [ ] 1.2 Unit-test the function: step counts 3-9, ordering dark-to-light,
      that extreme steps differ in hue/saturation from a pure lightness
      interpolation, and round-trip stability (hex in, valid hex out).

## 2. Preview UI

- [ ] 2.1 Add a "Generate ramp" control to `#color-picker-popover` and a
      matching one in the Color Library panel header, in `index.html`.
- [ ] 2.2 Build the preview row (structurally similar to
      `#import-preview-row`) with a step-count input (3-9, default 5)
      that regenerates the preview live on change.
- [ ] 2.3 Wire Confirm to call `addColorToPalette` for each generated
      color against the active palette, then refresh the Color Library
      panel; wire Cancel to discard the preview with no palette changes.
- [ ] 2.4 Style the new control and preview row in `css/*`, consistent
      with `#import-preview-row`'s pattern.

## 3. Verification

- [ ] 3.1 Serve the app locally and manually verify each spec scenario:
      preview before save, confirm adds all colors, cancel adds none,
      live step-count changes, and dark-to-light ordering across a few
      different source hues.
- [ ] 3.2 Update `docs/ui-reference.md` with the new control's id and
      behavior once implemented.
