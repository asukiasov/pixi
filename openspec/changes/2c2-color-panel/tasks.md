## 1. Color picker UI

- [ ] 1.1 `index.html`: color-picker control in the palette row area —
      native `<input type="color">`, a hex text `<input>`, three RGB
      number `<input>`s (0-255), and an "Add to palette" button
- [ ] 1.2 `style.css`: style the picker consistent with existing
      palette-row/panel styling (dark theme, compact)

## 2. Cross-synced color state

- [ ] 2.1 `js/workspace.js`: `input`/`change` handler on the native color
      input — parses its hex value, sets `state.currentColor` (via the
      existing `hexToRgba`), updates the hex field and RGB fields to
      match, deselects Rainbow (same as a preset swatch click)
- [ ] 2.2 `js/workspace.js`: `change` handler on the hex text field —
      validates it's a well-formed hex color, sets `state.currentColor`,
      updates the native color input and RGB fields to match; ignores
      malformed input rather than crashing (leaves prior state intact)
- [ ] 2.3 `js/workspace.js`: `change` handlers on the three RGB number
      inputs (clamped 0-255) — recompute `state.currentColor`, update the
      native color input and hex field to match

## 3. Add to palette

- [ ] 3.1 `js/workspace.js`: module-level `customSwatches` array
      (mirrors `allBrushes`'s "session-wide, not per-project" pattern) -
      "Add to palette" pushes the current picker color and calls a
      `renderPaletteRow()`-style rebuild
- [ ] 3.2 `js/workspace.js`: extract palette-row rendering (currently
      inline in `bindDomOnce`) into a `renderPaletteRow()` function that
      builds swatches from `[...PALETTE, ...customSwatches]` plus the
      Rainbow swatch last, wires each swatch's click handler the same way
      the existing preset swatches are wired; call it from `bindDomOnce`
      and after every "Add to palette"
- [ ] 3.3 `js/workspace.js`: per-project reset block in `initWorkspace()`
      re-marks the first preset swatch active (existing behavior,
      unchanged) - confirm custom swatches added in a prior project are
      still present and selectable after switching projects

## 4. Verification

- [ ] 4.1 Re-run full `node --test` suite — no engine logic changed, stays
      green
- [ ] 4.2 Playwright smoke pass: pick a color via the native input, hex
      field, and RGB fields individually, confirming each updates
      `state.currentColor` and keeps the other two in sync; draw a pixel
      with a custom color and confirm the exact RGB lands on the canvas;
      "Add to palette" appends a new swatch, reselectable after clicking
      elsewhere; switch projects and confirm the custom swatch is still
      present; confirm picking a custom color deselects Rainbow; zero
      console errors throughout
