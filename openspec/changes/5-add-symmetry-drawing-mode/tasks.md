## 1. Mirroring core

- [ ] 1.1 Add a `mirrorApplyPixel(x, y, baseApplyPixel, mode, width, height)`
      helper (see design.md) that computes mirrored coordinates for
      off/horizontal/vertical/both, dedupes coincident coordinates, and
      calls `baseApplyPixel` for each resulting pixel.
- [ ] 1.2 Unit-test the helper directly: horizontal/vertical/both on even
      and odd width/height, including the center-column/row self-mirror
      case and the dedup-on-center-line case (no double-apply).

## 2. Wiring into Pencil/Eraser/Brush

- [ ] 2.1 Add `state.symmetryMode` (`'off' | 'horizontal' | 'vertical' |
      'both'`), defaulting to `'off'`, alongside the existing
      `state.pixelPerfect` flag in `js/workspace.js`.
- [ ] 2.2 Wrap the `applyPixel` passed to `strokeFreehandThick` for
      Pencil/Eraser with `mirrorApplyPixel` when `state.symmetryMode !==
      'off'`.
- [ ] 2.3 Apply the same wrapping to Brush's stroke path in
      `js/brushes.js`.
- [ ] 2.4 Confirm Bucket, Line, Rectangle, Selection, and Move call sites
      are untouched (no wrapping applied there).

## 3. UI toggle

- [ ] 3.1 Add the symmetry toggle button to the left tools sidebar in
      `index.html`, near `#pixel-perfect-toggle`, cycling through the 4
      states on click.
- [ ] 3.2 Style the toggle's active/state-indicator appearance in `css/*`,
      consistent with `#pixel-perfect-toggle`'s on/off styling.
- [ ] 3.3 Wire the button's click handler in `js/workspace.js` to advance
      `state.symmetryMode` and update the button's visual state.

## 4. Verification

- [ ] 4.1 Serve the app locally and manually verify each spec scenario:
      cycling states, horizontal/vertical/both mirroring for Pencil,
      Eraser, and Brush, single-undo-step behavior, odd-size canvas
      center-line behavior, and that Bucket/Line/Rectangle/
      Selection/Move remain unaffected.
- [ ] 4.2 Verify symmetry state resets to off on reload (session-only,
      matching pixel-perfect).
- [ ] 4.3 Update `docs/ui-reference.md` with the new toggle's id and
      behavior once implemented (per that doc's own "update when a
      control is added" rule).
