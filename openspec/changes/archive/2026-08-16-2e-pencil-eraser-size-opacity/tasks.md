## 1. Engine: blended pixel operations

- [x] 1.1 `js/engine.js`: `PixelEngine#setPixelBlended(x, y, rgba, opacity)`
      — standard source-over alpha compositing of `rgba` (scaled by
      `opacity`) onto the existing pixel
- [x] 1.2 `js/engine.js`: `PixelEngine#erasePixelBlended(x, y, opacity)` —
      `newAlpha = existingAlpha * (1 - opacity)`, RGB untouched
- [x] 1.3 Unit tests (`node --test`): `setPixelBlended` at opacity 1 matches
      `setPixel`; at opacity 0.5 over an opaque pixel produces the
      expected midpoint color/alpha; over a transparent pixel produces
      the source color at reduced alpha. `erasePixelBlended` at opacity 1
      matches full erase; at opacity 0.5 halves existing alpha and leaves
      RGB unchanged; repeated calls approach (but per-call never reach)
      zero alpha

## 2. Engine: thick-stroke path with per-stroke dedup

- [x] 2.1 `js/engine.js`: `circleOffsets(size)` — returns cached `[dx,dy]`
      offsets within a filled circle of the given diameter, membership by
      `dx*dx + dy*dy <= (size/2)**2`. **Bug found during testing**: the
      naive loop start `-half` produces `-0` when `half` is 0 (Size 1),
      which `assert.deepEqual`/`Object.is` treat as distinct from `0`
      even though `===` doesn't - normalized at push time
      (`dx === 0 ? 0 : dx`)
- [x] 2.2 `js/engine.js`: `strokeFreehandThick(points, size, pixelPerfect,
      applyPixel)` — same path interpolation `strokeFreehand` already
      does (extracted into a shared `interpolatePath` helper both now
      call; corner-removed only when `size === 1 && pixelPerfect`),
      stamps every path point's circle offsets into a `touched` Set
      first, then calls `applyPixel(x, y)` exactly once per unique pixel
      (see design.md on why dedup happens before, not during, blending)
- [x] 2.3 Unit tests: at size 1 with a simple path, `strokeFreehandThick`
      calls `applyPixel` for exactly the same pixels `strokeFreehand`
      would touch; at size > 1, a dense/overlapping path still calls
      `applyPixel` exactly once per unique pixel (assert call count via a
      spy), not once per stamp placement; size-5 `circleOffsets` verified
      to reproduce the same shape as `brushes.js`'s built-in Circle
      pattern (a useful cross-check on the formula, not a hard
      requirement)

## 3. Workspace wiring

- [x] 3.1 `js/workspace.js`: `state.pencilSize` (default 1),
      `state.pencilOpacity` (default 1.0, i.e. 100%) — shared by Pencil
      and Eraser
- [x] 3.2 `js/workspace.js`: pencil/eraser stroke handling
      (`onDrawStart`/`onDrawMove`) switches from `engine.strokeFreehand`
      to `strokeFreehandThick` with an `applyPixel` closure via a shared
      `pencilOrEraserApplyPixel(engine)` helper — blends
      `state.currentColor` at `state.pencilOpacity` for Pencil,
      `erasePixelBlended` at `state.pencilOpacity` for Eraser
- [x] 3.3 `js/workspace.js`: reset `pencilSize`/`pencilOpacity` to
      defaults in `initWorkspace()`'s per-project reset block, matching
      every other per-tool setting already reset there

## 4. UI: vertical sliders in the tools sidebar

- [x] 4.1 `index.html`: a `#pencil-options` block in `#tools-sidebar`
      (Size and Opacity vertical range inputs, plus a small live-size
      preview swatch, per the reference mockup), hidden by default
- [x] 4.2 `style.css`: vertical slider styling via `writing-mode:
      vertical-lr; direction: rtl;` (the modern standards-based approach,
      supported in current Firefox/Chrome/Safari, over the older WebKit-
      only `-webkit-appearance: slider-vertical`), sized to fit the
      existing 2.6rem-wide tools sidebar
- [x] 4.3 `js/workspace.js`: tool-button click handler shows/hides
      `#pencil-options` based on `currentTool === 'pencil' || currentTool
      === 'eraser'` (same tool-scoped-visibility pattern the Brushes
      panel already uses); slider `input` handlers update
      `state.pencilSize`/`state.pencilOpacity`, their live readouts, and
      the preview swatch's size

## 5. Verification

- [x] 5.1 Re-run full `node --test` suite — 96/96 passing (12 new tests:
      `setPixelBlended`, `erasePixelBlended`, `circleOffsets`,
      `strokeFreehandThick`). **Bug found by the new tests**:
      `circleOffsets`'s loop start `-half` produced `-0` at Size 1 (half
      = 0), which `assert.deepEqual` treats as distinct from `0` even
      though `===` doesn't - fixed by normalizing at push time.
- [x] 5.2 Playwright smoke pass: Size 1/Opacity 100% stroke pixel-sampled
      as pure `[0,0,0,255]` with an untouched white neighbor (matches
      prior single-pixel behavior exactly); Size 7 produces a visibly
      wide, round stroke (pixel 3px from center still black, 5px away
      still white); Opacity 50% over opaque white produces the expected
      `[128,128,128,255]` blend; scrubbing back and forth over the same
      area in one continuous drag at 50% opacity sampled the exact same
      `[128,128,128,255]` afterward (confirms the per-stroke dedup
      prevents compounding); sliders hidden on Bucket, shown on Eraser as
      well as Pencil. Zero console errors throughout.

## 6. Revised per feedback: slider styling looked dated

- [x] 6.1 `style.css`: replaced the OS-native-styled `.vertical-slider`
      (`accent-color` on an otherwise-default range input) with a fully
      custom track + thumb (`appearance: none` plus
      `::-webkit-slider-runnable-track`/`::-webkit-slider-thumb` and the
      Firefox `::-moz-range-track`/`::-moz-range-progress`/
      `::-moz-range-thumb` equivalents) — thin 3px track, small circular
      thumb, matching the app's flat dark theme instead of each browser's
      default OS widget
- [x] 6.2 Playwright: confirmed sliders still function identically after
      the restyle (Size/Opacity `input` events still update
      `state.pencilSize`/`pencilOpacity` and their readouts)

## 7. Revised per feedback: reposition panel, remove resizing preview

- [x] 7.1 Moved `#pencil-options` out of `#tools-sidebar`'s in-flow
      column into `#workspace-canvas-container` as a `position: absolute`
      overlay (top: 0.6rem; left: 0.6rem), floating over the canvas's
      top-left corner instead of being buried at the bottom of the narrow
      sidebar. Its own background/border/shadow added since it's no
      longer visually part of the sidebar. Visibility toggling logic
      (`js/workspace.js`) unchanged - only its CSS position moved.
- [x] 7.2 Removed `#pencil-size-preview` (the growing/shrinking size-
      preview dot) entirely, per explicit dislike of that animation - the
      "Npx" text readout already conveys the current Size
- [x] 7.3 Playwright: confirmed the panel now renders over the canvas
      area (not inside the tools-sidebar's x-range) near its top-left
      corner; confirmed no `#pencil-size-preview` element remains
