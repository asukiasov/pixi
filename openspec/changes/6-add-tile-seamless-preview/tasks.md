## 1. Markup and layout

- [ ] 1.1 Add a 3×3 CSS grid wrapper around `#workspace-canvas` in
      `index.html`, with 8 new plain `<canvas>` elements for the
      surrounding copies, hidden by default.
- [ ] 1.2 Move `#applyTransform()`'s translate/scale target in
      `js/canvas-view.js` from `#workspace-canvas` to the new wrapper
      element so pan/zoom moves all 9 cells together; confirm the
      selection overlay's transform (kept in sync with the same
      transform today) still tracks correctly.

## 2. Rendering

- [ ] 2.1 In `CanvasView.render()`, after painting `#workspace-canvas`,
      blit the same `ImageData` onto the 8 copy canvases when
      tile-preview is on (skip entirely when off, for the cost noted in
      design.md).
- [ ] 2.2 Confirm `#toGridPoint()` and all existing pointer-handling
      continue to use `#workspace-canvas`'s own bounds only — no changes
      needed there per design.md, but verify by testing drawing near the
      edges with preview on.

## 3. Toggle UI

- [ ] 3.1 Add the tile-preview toggle button to the top bar /
      canvas-area controls in `index.html`, near the existing
      `#pixel-perfect-toggle`.
- [ ] 3.2 Style active/inactive states in `css/*`, consistent with
      `#pixel-perfect-toggle`.
- [ ] 3.3 Wire the toggle's click handler in `js/workspace.js` to
      show/hide the wrapper's surrounding-copy cells and update
      `CanvasView`'s tile-preview flag.

## 4. Verification

- [ ] 4.1 Serve the app locally and manually verify each spec scenario:
      toggling on/off, live updates while drawing, only-center-editable
      behavior, and zoom/pan continuing to work with preview on.
- [ ] 4.2 Verify tile-preview state resets to off on reload (session-only,
      matching pixel-perfect).
- [ ] 4.3 Update `docs/ui-reference.md` with the new toggle's id and
      behavior once implemented.
