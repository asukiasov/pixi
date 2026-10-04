## 1. Wire up the tool rail

- [x] 1.1 In `index.html`, add the `magnetic-hover` class to the 10
      tool-selection buttons in `.tools-sidebar` (Move, Pencil, Eraser,
      Bucket, Brush, Line, Rectangle, Selection, Hand, Eyedropper).
- [x] 1.2 In `js/app.js`, combine `.workspace-topbar button` and
      `.tools-sidebar [data-tool]` into a single element set passed to
      one `initMagneticHover(...)` call, replacing the current
      top-bar-only call.

## 2. Verify

- [x] 2.1 Run the existing test suite (`npm test`) - no regressions
      expected since this is UI-only and untested by the current suite.
      150/150 passed.
- [x] 2.2 Manually verify (local static server + Playwright) that: each
      of the 10 tool rail buttons reacts to proximity the same way top
      bar buttons do (translate + 1.0x-1.05x scale, no glow); the FG/BG
      swatches, Filled toggle, and 1:1 toggle do NOT react (out of
      scope); a pointer position within range of both a top bar button
      and a tool rail button activates only the nearer one. All
      confirmed: 10/10 tool buttons react; square-constraint-toggle and
      foreground-swatch stay inert; a point 20px from the topbar Gallery
      button and 37px from the tool rail Move button (both in range)
      activates only Gallery.
- [x] 2.3 Update this change's status and prepare for archive once
      manually confirmed working.
