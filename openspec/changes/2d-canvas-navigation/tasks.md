## 1. CanvasView zoom API

- [x] 1.1 `js/canvas-view.js`: `zoomStep(direction)` (`1` or `-1`) — steps
      `#scale` by a fixed increment, anchored on the container center
      (reuse the anchor-preserving math `#updatePinch()` already does),
      clamped to `MIN_SCALE`/`MAX_SCALE`
- [x] 1.2 `js/canvas-view.js`: `setZoomPreset(preset)` for `'100'`,
      `'fit'`, `'fill'` — `'fit'` calls the existing `resetView()`;
      `'100'` sets `#scale = 1 / #baseScale` and re-centers; `'fill'`
      computes the cover ratio (`Math.max` of width/height ratios, not
      floored) and re-centers, allowing overflow to extend past the
      container edges (clipped by the container's existing `overflow:
      hidden`). Both bypass the `MIN_SCALE`/`MAX_SCALE` clamp (see
      design.md)
- [x] 1.3 `js/canvas-view.js`: `getZoomPercent()` returns
      `Math.round(#baseScale * #scale * 100)`
- [x] 1.4 `js/canvas-view.js`: fire `handlers.onZoomChange?.(percent)` at
      the end of `#updatePinch()`, `zoomStep()`, `setZoomPreset()`, and
      `resetView()` — one call site pattern, so every zoom-changing path
      (including touch pinch and the initial Fit Screen on open) keeps a
      caller's percentage readout in sync without polling

## 2. CanvasView pan mode (Hand tool)

- [x] 2.1 `js/canvas-view.js`: `setPanMode(enabled)` sets an internal
      flag; while enabled, the single-pointer path in `#onPointerDown`/
      `#onPointerMove`/`#onPointerUp` adjusts `#panX`/`#panY` directly
      from client-pixel deltas and calls `#applyTransform()`, instead of
      invoking `onDrawStart`/`onDrawMove`/`onDrawEnd`
- [x] 2.2 Confirm the existing two-finger pinch/pan path (`#pointers.size
      === 2` branch) is untouched by `setPanMode` — it's a separate
      branch already

## 3. Zoom UI: buttons, shortcuts, presets, readout

- [x] 3.1 `index.html`: `+`/`-` zoom buttons, 100%/Fit Screen/Fill Screen
      preset buttons, and a zoom-percentage readout element, in the
      bottom bar (bottom-left per the spec) alongside the existing
      Undo/Redo group
- [x] 3.2 `style.css`: style the new zoom controls consistent with the
      existing bottom-bar button groups
- [x] 3.3 `js/workspace.js`: wire the `+`/`-` buttons to
      `canvasView.zoomStep(...)`, the three preset buttons to
      `canvasView.setZoomPreset(...)`, and register `onZoomChange` (via
      `canvasView.setHandlers`) to update the readout text
- [x] 3.4 `js/workspace.js`: Cmd/Ctrl `+`/`-` (`=`/`-` keys) keydown
      handler calling the same `zoomStep` methods, gated on the Workspace
      screen being visible (same guard the existing undo/redo shortcut
      handler already uses)
- [x] 3.5 Ensure the readout shows the correct value immediately when a
      project opens (Fit Screen's initial `onZoomChange` firing covers
      this per task 1.4 — verify it does). **Bug found during
      verification**: the very first project opened in a session could
      show a zoom percentage one fitScale step off (e.g. 1900% instead of
      1800%), because the CanvasView constructor's initial `resetView()`
      (in `js/app.js`) can measure the container before web-font loading
      finishes settling the Workspace screen's layout. Fixed with a
      one-shot follow-up `resetView()` on the next animation frame after
      the very first project's initial view, guarded to only the
      `!canvasView` (first-ever) branch — harmless no-op if nothing
      shifted, corrects it when something did.

## 4. Hand tool

- [x] 4.1 `index.html`: add a Hand tool button to `#tools-sidebar`
      (Material Symbols `back_hand` or `pan_tool`, matching the existing
      icon-button style), update the Google Fonts `icon_names` subsetting
      parameter to include it
- [x] 4.2 `js/workspace.js`: extend the existing tool-button click handler
      (where Brushes-panel visibility already gets toggled from
      `currentTool`) to also call `canvasView.setPanMode(currentTool ===
      'hand')`
- [x] 4.3 `js/workspace.js`: in the per-project reset block in
      `initWorkspace()`, call `canvasView.setPanMode(false)` (default tool
      is Pencil), mirroring how Brushes-panel visibility is reset there

## 5. Layers panel → right-side sidebar with a hide toggle

- [x] 5.1 `index.html`: move `#layers-panel` out of `.workspace-main`'s
      vertical stack into the same right-side sidebar area as the
      Brushes panel (its own `<aside>`, or a shared sidebar container —
      follow whichever keeps Brushes' existing markup/behavior
      unchanged); add a Layers show/hide toggle button (in the bottom bar
      or the panel's own header, consistent with existing toggle button
      styling like `#pixel-perfect-toggle`). Implemented as a shared
      `#right-sidebar` `<aside>` wrapping both `#layers-panel` and
      `#brushes-panel` (Layers on top, Brushes below), each independently
      shown/hidden; toggle lives in the bottom bar next to Pixel-perfect.
- [x] 5.2 `style.css`: `.layers-panel` styled as a fixed-width right-side
      sidebar (reuse `.brushes-panel`'s width/border/background pattern
      rather than inventing a new one). **Adjustment found during
      implementation**: the old bottom-docked `.layer-row` packed
      visibility/name/opacity/blend/reorder/delete into one flat row,
      sized for the old full-width panel - doesn't fit a 13rem sidebar.
      Restructured into two sub-rows (`.layer-row-top`/`.layer-row-bottom`)
      in both CSS and `buildLayerRow()`'s markup.
- [x] 5.3 `js/workspace.js`: `state.layersPanelVisible` (default `true`);
      toggle button flips it and toggles `.hidden` on the panel element;
      reset to `true` in `initWorkspace()`'s per-project reset block
- [x] 5.4 Confirm Layers panel visibility is fully independent of Brushes
      panel visibility (toggling one never touches the other's `.hidden`
      state) — both via code review and the Playwright pass below

## 6. Verification

- [x] 6.1 Re-run full `node --test` suite — no engine/layers/persistence
      logic changed, so this should stay green throughout; confirms no
      accidental regression. 84/84 passing.
- [x] 6.2 Playwright smoke pass: `+`/`-` buttons and Cmd/Ctrl `+`/`-`
      shortcuts change zoom and the readout; 100%/Fit Screen/Fill Screen
      presets each produce the expected `getZoomPercent()` value
      (including a preset correctly exceeding the MIN_SCALE/MAX_SCALE
      step-clamp range, confirming the bypass); Hand tool drag pans
      (confirmed via the canvas's CSS transform shifting by exactly the
      drag delta) without drawing on the active layer (sampled pixel data
      via `getImageData` - unchanged); switching to a drawing tool after
      Hand resumes normal drawing; Layers panel renders on the right and
      its hide toggle works independently of the Brushes panel (both
      visible together, hiding one leaves the other untouched); opening a
      second project resets zoom to a fresh Fit Screen percentage, Hand
      tool deselected (pencil draws normally again), and Layers panel
      visible with its toggle active; zero console errors throughout.

## 7. Post-ship bug: Fit Screen visually cleared the artwork

- [x] 7.1 **Bug found via user report**: clicking the Fit Screen preset
      made all drawn content disappear from view; drawing again made it
      reappear. Root cause: `resetView()` assigns `canvasEl.width`/
      `height`, which the browser always treats as clearing the canvas's
      drawing buffer, even when assigned the same numeric value. Every
      other caller of `resetView()` (the initial view in `js/app.js`,
      `onResize`/`onRotate` in `js/workspace.js`, `setLayerStack()`
      internally) already follows it with a `render()` call to repaint
      from the layer data - `setZoomPreset('fit')` (task 1.2) was the one
      path that didn't. Fixed by adding the missing `render()` call.
- [x] 7.2 Playwright verification: draw on the canvas, click Fit Screen,
      sample canvas pixel data immediately after (no further interaction)
      and confirm the drawn content is still visibly present, not
      requiring a subsequent stroke to reappear; re-run full `node --test`
      suite

## 8. Revised per feedback: move Gallery/Pixel-perfect/Layers/Settings/Export to a top bar

- [x] 8.1 `index.html`: new `<header class="workspace-topbar">` above the
      tool rail/canvas/panels row, containing icon-only versions of the
      five buttons (Gallery=`home`, Pixel-perfect=`grid_on`,
      Layers=`layers`, Canvas Settings=`settings`, Export=`download`) —
      moved out of the bottom bar's "Additional" group (which is now just
      Zoom + Undo/Redo). IDs unchanged, so no JS lookup needed updating.
- [x] 8.2 `style.css`: `#screen-workspace` restructured from a single row
      (tools/canvas/panels) into a column (`.workspace-topbar` then a new
      `.workspace-body` row wrapper) - `.workspace-screen`'s old
      row-direction override moved onto `.workspace-body`
- [x] 8.3 Playwright: confirmed the Layers toggle's active state and
      Pixel-perfect toggle still work correctly from their new top-bar
      buttons (same IDs, same JS); full workspace layout (tools sidebar,
      canvas, right sidebar) unaffected by the restructure

## 9. Revised per feedback: Undo/Redo moved to top bar, tooltip direction

- [x] 9.1 `index.html`: Undo/Redo moved from the bottom bar's second
      group into `.workspace-topbar` (right-aligned via a new
      `.workspace-topbar-spacer` flex:1 element between the left icon
      group and Undo/Redo) - IDs unchanged, no JS lookup changes needed
- [x] 9.2 **Bug**: top-bar tooltips used the same "show to the right"
      positioning as the vertical tools sidebar, but top-bar buttons sit
      close together horizontally - a tooltip to the right covered the
      next button. `bindTooltips()`'s `show()` now detects
      `target.closest('.workspace-topbar')` and positions those tooltips
      below the button instead (arrow flipped to point up via a new
      `.tool-tooltip.below` class), leaving the tools-sidebar's
      to-the-right positioning unchanged.
- [x] 9.3 Playwright: confirmed Undo/Redo render inside
      `.workspace-topbar` and function identically; confirmed a top-bar
      tooltip carries the `below` class and no longer overlaps the
      neighboring button

## 10. Hand tool cursor states

- [x] 10.1 `js/canvas-view.js`: `CanvasView#setPanMode` toggles a
      `pan-mode` class on the canvas element; `#onPointerDown` adds a
      `panning` class when a pan drag starts (Hand tool + single
      pointer), `#onPointerUp` removes it when the drag ends
- [x] 10.2 `style.css`: `#workspace-canvas` gets a default `cursor:
      crosshair`; `.pan-mode` overrides it to `cursor: grab`;
      `.pan-mode.panning` overrides further to `cursor: grabbing`
- [x] 10.3 Playwright: confirmed computed cursor is `grab` on the Hand
      tool while idle, `grabbing` mid-drag, back to `grab` on release,
      and `crosshair` after switching to Pencil

## 11. Revised per feedback: custom paw cursors, not the OS grab/grabbing

- [x] 11.1 New `assets/cursors/pets.svg` - Google's actual Material
      Symbols "pets" outline glyph (fetched from
      `fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/
      pets/default/24px.svg`, not hand-approximated), 24x24, used for the
      idle Hand-tool cursor
- [x] 11.2 New `assets/cursors/pets-picked.svg` - user-supplied "picked
      up paw" artwork, given an explicit `width`/`height` matching its
      viewBox (the source file had neither, which would have defaulted
      to the CSS-replaced-element default of 300x150 as a cursor image),
      metadata/Illustrator cruft stripped; used for the dragging
      Hand-tool cursor. Replaced once with a re-exported 24x24 (square)
      version of the same artwork, superseding the original's 18.2x14.4
      viewBox - `width`/`height` and the CSS hotspot below were updated
      to match
- [x] 11.3 `style.css`: `.pan-mode`/`.pan-mode.panning` now set `cursor:
      url('assets/cursors/pets.svg') 12 12, grab` /
      `url('assets/cursors/pets-picked.svg') 12 12, grabbing` -
      `grab`/`grabbing` kept as the fallback if the SVG cursor image ever
      fails to load, not removed
- [x] 11.4 Playwright: confirmed `getComputedStyle(canvas).cursor`
      resolves to each `url(...) x y, grab(bing)` value at the right
      pan-drag state; rendered both SVGs standalone to confirm they draw
      as paw prints, not blank/broken images

## 12. Bug fix: pinching outside the canvas zoomed the whole page

- [x] 12.1 `index.html`'s viewport meta gains `maximum-scale=1,
      user-scalable=no` - a defense-in-depth no-op on modern iOS Safari
      (which ignores it for accessibility since iOS 10), but still
      effective on other browsers/older versions
- [x] 12.2 `style.css`: `html, body` gains `touch-action: pan-x pan-y` -
      the actual fix on iOS Safari, which respects `touch-action` even
      though it ignores the viewport meta's `user-scalable`. `pan-x
      pan-y` (not `none`) so normal scrolling keeps working everywhere;
      the canvas/canvas-container's existing stricter `touch-action:
      none` is unaffected and still handles pinch-zoom itself
- [x] 12.3 Playwright: confirmed `getComputedStyle(document.body).
      touchAction` is `pan-x pan-y` and the canvas's is still `none`;
      full manual-pinch-gesture behavior isn't Playwright-testable
      (no real touch hardware in headless Chromium), so this is a
      computed-style check, not a simulated pinch
