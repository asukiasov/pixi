## 1. Color picker UI

- [ ] 1.1 `index.html`: color-picker control in the palette row area —
      native `<input type="color">`, a hex text `<input>`, three RGB
      number `<input>`s (0-255), and an "Add to palette" button
- [ ] 1.2 `style.css`: style the picker consistent with existing
      palette-row/panel styling (dark theme, compact)

## 2. Cross-synced color state

- [ ] 2.1 `js/workspace.js`: `input`/`change` handler on the native color
      input — parses its hex value, sets `state.foregroundColor` (via the
      existing `hexToRgba`), updates the hex field and RGB fields to
      match, deselects Rainbow (same as a preset swatch click)
- [ ] 2.2 `js/workspace.js`: `change` handler on the hex text field —
      validates it's a well-formed hex color, sets `state.foregroundColor`,
      updates the native color input and RGB fields to match; ignores
      malformed input rather than crashing (leaves prior state intact)
- [ ] 2.3 `js/workspace.js`: `change` handlers on the three RGB number
      inputs (clamped 0-255) — recompute `state.foregroundColor`, update the
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

## 4. Foreground/Background color model

- [ ] 4.1 `js/workspace.js`: rename `state.currentColor` to
      `state.foregroundColor` at every call site (Pencil, Bucket, Brush's
      non-Rainbow path via `colorForCurrentTool()`, Line, Rectangle); add
      `state.backgroundColor` (default white)
- [ ] 4.2 `index.html`/`style.css`: Foreground/Background swatch-pair
      control near the palette row — two overlapping swatches, a swap
      icon, a reset-to-black/white icon (Material Symbols; pick icons for
      swap and reset, add to the `icon_names` subsetting list)
- [ ] 4.3 `js/workspace.js`: swap control exchanges
      `foregroundColor`/`backgroundColor`; reset control sets them to
      black/white; every existing color-pick action (swatch, custom
      picker, Rainbow) continues to set only `foregroundColor`
- [ ] 4.4 `js/workspace.js`: per-project reset block resets
      `foregroundColor`/`backgroundColor` to black/white, matching every
      other per-tool/per-color setting already reset there

## 5. Eyedropper tool

- [ ] 5.1 `index.html`: Eyedropper tool button in `#tools-sidebar`
      (Material Symbols `colorize`), with `data-tooltip`/`data-shortcut`
      like every other tool button (pick a free letter shortcut); add to
      the `icon_names` subsetting list
- [ ] 5.2 `js/workspace.js`: `onDrawStart` branch for `tool ===
      'eyedropper'` — reads the composited pixel at the tapped point from
      `layerStack.composite()`, sets `state.foregroundColor` to it, does
      NOT call `commit()` (no pixel data changed, nothing to undo)
- [ ] 5.3 Confirm Eyedropper doesn't interact with the selection clip -
      sampling is a read, not a write, so `isPointInSelection`/
      `clipToSelection` don't apply (no bounds restriction on where you
      can sample from)

## 6. Verification

- [ ] 6.1 Re-run full `node --test` suite — no engine logic changed, stays
      green
- [ ] 6.2 Playwright smoke pass: pick a color via the native input, hex
      field, and RGB fields individually, confirming each updates
      `state.foregroundColor` and keeps the other two in sync; draw a
      pixel with a custom color and confirm the exact RGB lands on the
      canvas; "Add to palette" appends a new swatch, reselectable after
      clicking elsewhere; switch projects and confirm the custom swatch
      is still present; confirm picking a custom color deselects
      Rainbow; sample a canvas pixel with the Eyedropper and confirm the
      Foreground swatch updates and Pencil then draws with that exact
      color; confirm sampling doesn't modify any pixel; swap
      Foreground/Background and confirm drawing uses the new Foreground;
      reset and confirm both return to black/white; confirm Eraser still
      always erases to transparent regardless of Background; zero
      console errors throughout
