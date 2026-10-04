## 1. Generalize the magnetic-hover module

- [x] 1.1 Change `initMagneticHover` in `js/magnetic-hover.js` to accept
      multiple elements (a `NodeList`/array) instead of a single element.
- [x] 1.2 Move the `document`-level `pointermove`/`pointerleave` listener
      setup to run once, looping over all registered elements per move to
      compute each one's own distance/pull independently.
- [x] 1.3 Skip a button entirely (no pull/scale, clear `.magnetic-active`
      if set) when `el.disabled` is true, checked fresh on every move so
      a button that becomes enabled while the pointer is already nearby
      picks up the effect on the next move without re-entering the
      radius.

## 2. Wire up the top bar

- [x] 2.1 In `index.html`, add the `magnetic-hover` class to the 7
      remaining `.workspace-topbar` buttons (Gallery, Pixel-perfect,
      Layers, Canvas Settings, Undo, Redo, Right panel toggle) - Export
      already has it.
- [x] 2.2 In `js/app.js`, replace the single
      `initMagneticHover(document.getElementById('export-button'))` call
      with one call passing `document.querySelectorAll('.workspace-topbar
      button')` (or equivalent selector covering all 8 buttons).

## 3. Verify

- [x] 3.1 Run the existing test suite (`npm test`) - no regressions
      expected since this is UI-only and untested by the current suite.
      150/150 passed.
- [x] 3.2 Manually verify (e.g. via a local static server + Playwright,
      as used for the original trial) that: each of the 8 top bar buttons
      reacts to proximity from any direction; Undo/Redo do not react
      while disabled and start reacting once enabled; no glow/halo
      renders anywhere in the top bar. All confirmed via Playwright
      script + screenshot.
- [x] 3.3 Update this change's status and prepare for archive once
      manually confirmed working.

## 4. Refine scale + exclusivity (post-rollout feedback)

- [x] 4.1 In `js/magnetic-hover.js`, replace the flat `scale(1.03)` with
      a distance-based scale reusing the existing `pull` ratio:
      `scale = 1 + 0.05 * (1 - pull)`, set via a new `--pull-scale`
      custom property.
- [x] 4.2 Update `.magnetic-hover.magnetic-active`'s `transform` in
      `style.css` to consume `var(--pull-scale, 1)` instead of the
      hardcoded `1.03`.
- [x] 4.3 In `js/magnetic-hover.js`, change the `pointermove` handler to
      a two-pass loop: first find the in-range button with the smallest
      distance to the pointer (if any), then apply pull/scale and
      `.magnetic-active` only to that button while clearing
      `.magnetic-active` on every other registered button.
- [x] 4.4 Run `npm test` - no regressions expected. 150/150 passed.
- [x] 4.5 Manually verify via Playwright: scale grows smoothly from 1.0x
      to 1.05x as the pointer approaches a button's center; moving from
      one button to an adjacent one immediately clears the first
      button's `.magnetic-active` even when both are technically in
      range at once. Confirmed: scale 1.0337 near the 45px edge, 1.0492
      near dead-center; a point 20px from Gallery's center and 28px from
      Pixel-perfect's (within both radii) activates only Gallery.
