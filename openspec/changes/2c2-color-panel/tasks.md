## 1. Color picker UI

- [x] 1.1 `index.html`: color-picker control in the palette row area —
      native `<input type="color">`, a hex text `<input>`, three RGB
      number `<input>`s (0-255), and an "Add to palette" button
- [x] 1.2 `style.css`: style the picker consistent with existing
      palette-row/panel styling (dark theme, compact)

## 2. Cross-synced color state

- [x] 2.1 `js/workspace.js`: `input` handler on the native color input —
      parses its hex value, sets `state.foregroundColor` (via the
      existing `hexToRgba`), updates the hex field and RGB fields to
      match, deselects Rainbow (same as a preset swatch click) — all via
      a shared `setForegroundColor()`/`updateColorPickerInputs()` pair
- [x] 2.2 `js/workspace.js`: `change` handler on the hex text field —
      validates via a `normalizeHex()` helper (`#rgb` or `#rrggbb`, with
      or without the leading `#`), sets `state.foregroundColor`, updates
      the native color input and RGB fields to match; malformed input is
      ignored and the field resyncs to the last valid color rather than
      crashing or leaving a stale value
- [x] 2.3 `js/workspace.js`: `change` handlers on the three RGB number
      inputs (clamped 0-255) — recompute `state.foregroundColor`, update
      the native color input and hex field to match

## 3. Add to palette

- [x] 3.1 `js/workspace.js`: module-level `customSwatches` array
      (mirrors `allBrushes`'s "session-wide, not per-project" pattern) -
      "Add to palette" pushes the current picker color (as hex) and calls
      `renderPaletteRow()`
- [x] 3.2 `js/workspace.js`: extracted palette-row rendering (was inline
      in `bindDomOnce`) into `renderPaletteRow()`, building swatches from
      `[...PALETTE, ...customSwatches]` plus the Rainbow swatch last; each
      swatch stores its hex in `dataset.hex` (needed since reading
      `el.style.background` back gives a browser-normalized `rgb(...)`
      string, not the original hex, so it can't be used for comparison);
      called from `bindDomOnce` and after every "Add to palette"
- [x] 3.3 `js/workspace.js`: per-project reset block calls
      `updateColorPickerInputs`/`updateFgBgSwatches`/`syncActiveSwatch` to
      re-mark the first preset active (existing behavior, unchanged) -
      confirmed custom swatches added in a prior project are still
      present and selectable after switching projects

## 4. Foreground/Background color model

- [x] 4.1 `js/workspace.js`: renamed `state.currentColor` to
      `state.foregroundColor` at every call site (Pencil/Eraser via
      `pencilOrEraserApplyPixel`, Bucket, Brush's non-Rainbow path, Line,
      Rectangle); added `state.backgroundColor` (default white)
- [x] 4.2 `index.html`/`style.css`: Foreground/Background swatch-pair
      control near the palette row — two overlapping swatches
      (`restart_alt` reset icon, `swap_horiz` swap icon)
- [x] 4.3 `js/workspace.js`: swap control exchanges
      `foregroundColor`/`backgroundColor`; reset control sets them to
      black/white; every existing color-pick action (swatch, custom
      picker, Rainbow-adjacent picks, Eyedropper) continues to set only
      `foregroundColor` via the shared `setForegroundColor()`
- [x] 4.4 `js/workspace.js`: per-project reset block resyncs the picker/
      swatch UI to `state.foregroundColor`/`backgroundColor`'s fresh
      defaults (black/white), matching every other per-tool/per-color
      setting already reset there

## 5. Eyedropper tool

- [x] 5.1 `index.html`: Eyedropper tool button in `#tools-sidebar`
      (Material Symbols `colorize`), `data-tooltip`/`data-shortcut="I"`
      like every other tool button; added to the `icon_names` subsetting
      list (along with `restart_alt`/`swap_horiz` for task 4.2)
- [x] 5.2 `js/workspace.js`: `onDrawStart` branch for `tool ===
      'eyedropper'` — reads the composited pixel at the tapped point from
      `layerStack.composite()`, sets `state.foregroundColor` to it via
      `setForegroundColor()`, does NOT call `commit()` (no pixel data
      changed, nothing to undo)
- [x] 5.3 Confirmed Eyedropper doesn't interact with the selection clip -
      sampling is a read, not a write, so `isPointInSelection`/
      `clipToSelection` don't apply (no bounds restriction on where you
      can sample from) - no code path even touches them for this tool

## 6. Verification

- [x] 6.1 Re-run full `node --test` suite — 96/96 passing, unchanged (no
      engine logic touched by this change)
- [x] 6.2 Playwright smoke pass: hex field entry (`#3a7bd5`) correctly
      synced the native input and all three RGB fields (58/123/213);
      drawing with that color landed the exact RGB on the canvas; editing
      RGB fields (200/50/10) correctly synced the hex field (`#c8320a`);
      "Add to palette" appended a new swatch (17→18), selectable and
      correctly marked active by hex afterward; Eyedropper sampled a
      black pixel without modifying it, and the foreground swatch and a
      subsequent Pencil stroke both picked up the exact sampled color;
      swap exchanged foreground/background (white became foreground);
      reset restored black/white; picking Rainbow then a custom hex color
      correctly deselected Rainbow; switching to a brand-new project kept
      the custom swatch in the palette (18 swatches) while resetting the
      *active* selection to the first preset (black) — confirming the
      session-wide-list-but-per-project-selection pattern works exactly
      like it does for custom brushes. Zero console errors throughout.

## 7. Revised per feedback: swatch tooltips, click-to-open picker, copy hex

- [x] 7.1 Foreground/Background swatches lacked a proper styled tooltip
      (only a native `title`) — converted from `<div>` to `<button>` with
      `data-tooltip="Foreground color"`/`"Background color"`, picked up
      automatically by the existing `bindTooltips()` (it queries all
      `[data-tooltip]` elements, not just tool buttons)
- [x] 7.2 **Behavior change**: the custom picker is no longer an
      always-visible inline row — it's a popover (`#color-picker-popover`)
      opened by clicking either the Foreground or Background swatch,
      closed via an explicit close button, Escape, or an outside click.
      This also directly fixes "no option to change background color":
      clicking the Background swatch opens the same picker targeting
      `state.backgroundColor` instead of `state.foregroundColor`, tracked
      via a module-level `colorPickerTarget`. `setForegroundColor`/new
      `setBackgroundColor` are both routed through a single
      `applyPickedColor(rgba)` so the native/hex/RGB input handlers don't
      need to know which target is active.
- [x] 7.3 Double-click the hex field to copy it to the clipboard
      (`navigator.clipboard.writeText`), with a brief "Copied!" message
      next to the field that fades after ~1.2s. Single-click/typing in
      the field is unaffected.
- [x] 7.4 Playwright smoke pass: clicking Foreground/Background opens the
      popover with the correct title and targets the right state field
      (edited Background via hex while Foreground stayed unchanged,
      verified by sampling both swatches' computed background-color);
      close button and outside-click both hide the popover; double-click
      on the hex field copies the exact value to the clipboard and shows
      the confirmation message. Zero console errors. Full `node --test`
      suite unaffected (96/96 — no engine logic touched).

## 8. Bug fix + relocation, per feedback with a screenshot

- [x] 8.1 **Bug**: the popover was positioned with no viewport clamping -
      on a narrow/short window it could render partly or fully off-screen
      (confirmed via the user's screenshot: cut off against the right
      edge and overlapping a mobile taskbar). Fixed in `openColorPicker()`
      - unhide first to measure the popover's real box, then clamp both
      `left` and `top` to stay within `window.innerWidth`/`innerHeight`
      minus an 8px margin, flipping to the anchor's left side first if
      the preferred right-side position would overflow.
- [x] 8.2 Moved `.fg-bg-swatches` (reset/swatch-stack/swap) from the
      bottom `#color-panel-row` into `#tools-sidebar`, below the tool
      buttons - always visible (unlike the tool-scoped Pencil options
      below it), restyled from a horizontal row to a vertical stack to
      fit the narrow sidebar. The now-empty `#color-panel-row` wrapper
      was removed.
- [x] 8.3 Playwright: confirmed the popover fits fully within a 440x400
      viewport (the scenario from the bug report) after the clamp fix;
      confirmed the Foreground/Background control renders inside
      `#tools-sidebar`'s x-range. Zero console errors.

## 9. iOS: native color picker, no middleware popover

- [x] 9.1 New `js/workspace.js` helper `isIOS()` - UA regex
      (`iPad|iPhone|iPod`) plus the `platform === 'MacIntel' &&
      maxTouchPoints > 1` check for iPadOS 13+ (which reports as a Mac
      in its UA string)
- [x] 9.2 New `#fg-bg-native-picker` (`index.html`): a standalone
      `<input type="color">`, not nested inside `#color-picker-popover`
      - a `display: none` ancestor (the popover, when closed) blocks a
      scripted `.click()` from opening the input's native picker UI, so
      this needed its own always-non-`display:none` element, hidden
      instead via a new `.visually-hidden-native-input` class
      (`position: fixed`, 1x1px, `opacity: 0`, `pointer-events: none`)
- [x] 9.3 `openColorPicker()`: on iOS, sets `#fg-bg-native-picker`'s
      value to the current Foreground/Background color and calls
      `.click()` on it, returning before any of the popover's own
      unhide/positioning logic runs; non-iOS behavior unchanged
- [x] 9.4 `#fg-bg-native-picker`'s `input` event routes through the same
      `applyPickedColor` every other color-pick path already uses
- [x] 9.5 Playwright (spoofed iOS UA + touch context): confirmed
      `#color-picker-popover` never becomes visible when clicking a swatch
      on iOS; confirmed `#fg-bg-native-picker` receives the current
      color as its value; confirmed a real (non-iOS) desktop UA still
      opens the popover exactly as before. Zero console errors on
      either path.
