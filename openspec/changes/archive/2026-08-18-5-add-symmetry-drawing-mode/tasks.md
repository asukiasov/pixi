## 1. Mirroring core

- [x] 1.1 Add a `mirrorApplyPixel(x, y, baseApplyPixel, mode, width, height)`
      helper (see design.md) that computes mirrored coordinates for
      off/horizontal/vertical/both, dedupes coincident coordinates, and
      calls `baseApplyPixel` for each resulting pixel.
- [x] 1.2 Unit-test the helper directly: horizontal/vertical/both on even
      and odd width/height, including the center-column/row self-mirror
      case and the dedup-on-center-line case (no double-apply).

## 2. Wiring into Pencil/Eraser/Brush

- [x] 2.1 Add `state.symmetryMode` (`'off' | 'horizontal' | 'vertical' |
      'both'`), defaulting to `'off'`, alongside the existing
      `state.pixelPerfect` flag in `js/workspace.js`.
- [x] 2.2 Wrap the `applyPixel` passed to `strokeFreehandThick` for
      Pencil/Eraser with `mirrorApplyPixel` when `state.symmetryMode !==
      'off'`.
- [x] 2.3 Apply the same wrapping to Brush's stroke path in
      `js/brushes.js`.
- [x] 2.4 Confirm Bucket, Line, Rectangle, Selection, and Move call sites
      are untouched (no wrapping applied there).

## 3. UI toggle

- [x] 3.1 Add the symmetry toggle button to the left tools sidebar in
      `index.html`, near `#pixel-perfect-toggle`, cycling through the 4
      states on click.
      **Deviation**: `#pixel-perfect-toggle` actually lives in the
      `.workspace-topbar` (see `docs/ui-reference.md`'s "Top bar" section),
      not the left tools sidebar (`#tools-sidebar`, the vertical
      tool-select rail) - proposal.md's citation of the doc section was
      stale. Placed `#symmetry-toggle` directly beside
      `#pixel-perfect-toggle` in the topbar instead, matching "alongside
      the existing pixel-perfect toggle" and "not a new tool, no
      tool-scoped option panel" from proposal.md/spec.md, which is the
      part that affects behavior.
- [x] 3.2 Style the toggle's active/state-indicator appearance in `css/*`,
      consistent with `#pixel-perfect-toggle`'s on/off styling.
      Implemented in `style.css` (no `css/` directory in this repo -
      styles live in the single top-level `style.css`): reuses
      `.tool-button.active`'s accent styling plus a small H/V/4 letter
      badge (`#symmetry-toggle[data-symmetry-mode]::after`) so the three
      "on" states are visually distinguishable from each other, not just
      from off.
- [x] 3.3 Wire the button's click handler in `js/workspace.js` to advance
      `state.symmetryMode` and update the button's visual state.

## 4. Verification

- [x] 4.1 Serve the app locally and manually verify each spec scenario:
      cycling states, horizontal/vertical/both mirroring for Pencil,
      Eraser, and Brush, single-undo-step behavior, odd-size canvas
      center-line behavior, and that Bucket/Line/Rectangle/
      Selection/Move remain unaffected.
      Verified via Playwright against `python3 -m http.server`: toggle
      cycles off→horizontal→vertical→both→off with aria-label/active class
      updating each step; Pencil with `both` active painted 4 mirrored
      pixels and a single Undo removed all 4; Brush and Eraser both mirror
      under `horizontal`; Bucket fill with symmetry active only touched
      the clicked side (unaffected, as required). Odd-size center-line
      self-mirror behavior is covered by `test/symmetry.test.js`'s unit
      tests against the exact same `mirrorApplyPixel` runtime code path
      (odd width/height, ADD to width 17/height 17 cases) - not
      separately re-verified through the UI, since there's no odd-size
      canvas preset (16/32/64/128 only) and typing a custom 17x17 exercises
      no code beyond what those unit tests already cover directly.
- [x] 4.2 Verify symmetry state resets to off on reload (session-only,
      matching pixel-perfect).
      Verified via Playwright: set to horizontal, reload, router reopens
      the same project's workspace directly (not the gallery), and
      `#symmetry-toggle`'s `data-symmetry-mode` reads back `off`.
- [x] 4.3 Update `docs/ui-reference.md` with the new toggle's id and
      behavior once implemented (per that doc's own "update when a
      control is added" rule).
