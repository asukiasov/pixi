## 1. CanvasView zoom API

- [ ] 1.1 `js/canvas-view.js`: `zoomStep(direction)` (`1` or `-1`) — steps
      `#scale` by a fixed increment, anchored on the container center
      (reuse the anchor-preserving math `#updatePinch()` already does),
      clamped to `MIN_SCALE`/`MAX_SCALE`
- [ ] 1.2 `js/canvas-view.js`: `setZoomPreset(preset)` for `'100'`,
      `'fit'`, `'fill'` — `'fit'` calls the existing `resetView()`;
      `'100'` sets `#scale = 1 / #baseScale` and re-centers; `'fill'`
      computes the cover ratio (`Math.max` of width/height ratios, not
      floored) and re-centers, allowing overflow to extend past the
      container edges (clipped by the container's existing `overflow:
      hidden`). Both bypass the `MIN_SCALE`/`MAX_SCALE` clamp (see
      design.md)
- [ ] 1.3 `js/canvas-view.js`: `getZoomPercent()` returns
      `Math.round(#baseScale * #scale * 100)`
- [ ] 1.4 `js/canvas-view.js`: fire `handlers.onZoomChange?.(percent)` at
      the end of `#updatePinch()`, `zoomStep()`, `setZoomPreset()`, and
      `resetView()` — one call site pattern, so every zoom-changing path
      (including touch pinch and the initial Fit Screen on open) keeps a
      caller's percentage readout in sync without polling

## 2. CanvasView pan mode (Hand tool)

- [ ] 2.1 `js/canvas-view.js`: `setPanMode(enabled)` sets an internal
      flag; while enabled, the single-pointer path in `#onPointerDown`/
      `#onPointerMove`/`#onPointerUp` adjusts `#panX`/`#panY` directly
      from client-pixel deltas and calls `#applyTransform()`, instead of
      invoking `onDrawStart`/`onDrawMove`/`onDrawEnd`
- [ ] 2.2 Confirm the existing two-finger pinch/pan path (`#pointers.size
      === 2` branch) is untouched by `setPanMode` — it's a separate
      branch already

## 3. Zoom UI: buttons, shortcuts, presets, readout

- [ ] 3.1 `index.html`: `+`/`-` zoom buttons, 100%/Fit Screen/Fill Screen
      preset buttons, and a zoom-percentage readout element, in the
      bottom bar (bottom-left per the spec) alongside the existing
      Undo/Redo group
- [ ] 3.2 `style.css`: style the new zoom controls consistent with the
      existing bottom-bar button groups
- [ ] 3.3 `js/workspace.js`: wire the `+`/`-` buttons to
      `canvasView.zoomStep(...)`, the three preset buttons to
      `canvasView.setZoomPreset(...)`, and register `onZoomChange` (via
      `canvasView.setHandlers`) to update the readout text
- [ ] 3.4 `js/workspace.js`: Cmd/Ctrl `+`/`-` (`=`/`-` keys) keydown
      handler calling the same `zoomStep` methods, gated on the Workspace
      screen being visible (same guard the existing undo/redo shortcut
      handler already uses)
- [ ] 3.5 Ensure the readout shows the correct value immediately when a
      project opens (Fit Screen's initial `onZoomChange` firing covers
      this per task 1.4 — verify it does)

## 4. Hand tool

- [ ] 4.1 `index.html`: add a Hand tool button to `#tools-sidebar`
      (Material Symbols `back_hand` or `pan_tool`, matching the existing
      icon-button style), update the Google Fonts `icon_names` subsetting
      parameter to include it
- [ ] 4.2 `js/workspace.js`: extend the existing tool-button click handler
      (where Brushes-panel visibility already gets toggled from
      `currentTool`) to also call `canvasView.setPanMode(currentTool ===
      'hand')`
- [ ] 4.3 `js/workspace.js`: in the per-project reset block in
      `initWorkspace()`, call `canvasView.setPanMode(false)` (default tool
      is Pencil), mirroring how Brushes-panel visibility is reset there

## 5. Layers panel → right-side sidebar with a hide toggle

- [ ] 5.1 `index.html`: move `#layers-panel` out of `.workspace-main`'s
      vertical stack into the same right-side sidebar area as the
      Brushes panel (its own `<aside>`, or a shared sidebar container —
      follow whichever keeps Brushes' existing markup/behavior
      unchanged); add a Layers show/hide toggle button (in the bottom bar
      or the panel's own header, consistent with existing toggle button
      styling like `#pixel-perfect-toggle`)
- [ ] 5.2 `style.css`: `.layers-panel` styled as a fixed-width right-side
      sidebar (reuse `.brushes-panel`'s width/border/background pattern
      rather than inventing a new one)
- [ ] 5.3 `js/workspace.js`: `state.layersPanelVisible` (default `true`);
      toggle button flips it and toggles `.hidden` on the panel element;
      reset to `true` in `initWorkspace()`'s per-project reset block
- [ ] 5.4 Confirm Layers panel visibility is fully independent of Brushes
      panel visibility (toggling one never touches the other's `.hidden`
      state) — both via code review and the Playwright pass below

## 6. Verification

- [ ] 6.1 Re-run full `node --test` suite — no engine/layers/persistence
      logic changed, so this should stay green throughout; confirms no
      accidental regression
- [ ] 6.2 Playwright smoke pass: `+`/`-` buttons and Cmd/Ctrl `+`/`-`
      shortcuts change zoom and the readout; 100%/Fit Screen/Fill Screen
      presets each produce the expected `getZoomPercent()` value; Hand
      tool drag pans without drawing on the active layer (pixel data
      unchanged); switching to a drawing tool after Hand resumes normal
      drawing; Layers panel renders on the right and its hide toggle
      works independently of the Brushes panel; opening a second project
      resets zoom to Fit Screen, Hand tool off, and Layers panel visible;
      zero console errors throughout
