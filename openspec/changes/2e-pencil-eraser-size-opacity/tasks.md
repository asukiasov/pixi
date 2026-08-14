## 1. Engine: blended pixel operations

- [ ] 1.1 `js/engine.js`: `PixelEngine#setPixelBlended(x, y, rgba, opacity)`
      — standard source-over alpha compositing of `rgba` (scaled by
      `opacity`) onto the existing pixel
- [ ] 1.2 `js/engine.js`: `PixelEngine#erasePixelBlended(x, y, opacity)` —
      `newAlpha = existingAlpha * (1 - opacity)`, RGB untouched
- [ ] 1.3 Unit tests (`node --test`): `setPixelBlended` at opacity 1 matches
      `setPixel`; at opacity 0.5 over an opaque pixel produces the
      expected midpoint color/alpha; over a transparent pixel produces
      the source color at reduced alpha. `erasePixelBlended` at opacity 1
      matches full erase; at opacity 0.5 halves existing alpha and leaves
      RGB unchanged; repeated calls approach (but per-call never reach)
      zero alpha

## 2. Engine: thick-stroke path with per-stroke dedup

- [ ] 2.1 `js/engine.js`: `circleOffsets(size)` — returns cached `[dx,dy]`
      offsets within a filled circle of the given diameter, membership by
      `dx*dx + dy*dy <= (size/2)**2`
- [ ] 2.2 `js/engine.js`: `strokeFreehandThick(points, size, pixelPerfect,
      applyPixel)` — same path interpolation `strokeFreehand` already
      does (bresenham-chained, corner-removed only when `size === 1 &&
      pixelPerfect`), stamps every path point's circle offsets into a
      `touched` Set first, then calls `applyPixel(x, y)` exactly once per
      unique pixel (see design.md on why dedup happens before, not
      during, blending)
- [ ] 2.3 Unit tests: at size 1 with a simple path, `strokeFreehandThick`
      calls `applyPixel` for exactly the same pixels `strokeFreehand`
      would touch; at size > 1, a dense/overlapping path still calls
      `applyPixel` exactly once per unique pixel (assert call count via a
      spy), not once per stamp placement

## 3. Workspace wiring

- [ ] 3.1 `js/workspace.js`: `state.pencilSize` (default 1),
      `state.pencilOpacity` (default 1.0, i.e. 100%) — shared by Pencil
      and Eraser
- [ ] 3.2 `js/workspace.js`: pencil/eraser stroke handling
      (`onDrawStart`/`onDrawMove`) switches from `engine.strokeFreehand`
      to `engine.strokeFreehandThick` with an `applyPixel` closure —
      `(x,y) => engine.setPixelBlended(x, y, colorForCurrentTool(),
      state.pencilOpacity)` for Pencil, `(x,y) =>
      engine.erasePixelBlended(x, y, state.pencilOpacity)` for Eraser
- [ ] 3.3 `js/workspace.js`: reset `pencilSize`/`pencilOpacity` to
      defaults in `initWorkspace()`'s per-project reset block, matching
      every other per-tool setting already reset there

## 4. UI: vertical sliders in the tools sidebar

- [ ] 4.1 `index.html`: a `#pencil-options` block in `#tools-sidebar`
      (Size and Opacity vertical range inputs, plus a small live-size
      preview swatch, per the reference mockup), hidden by default
- [ ] 4.2 `style.css`: vertical slider styling (`writing-mode` or
      `appearance` vertical orientation depending on browser support;
      confirm the target browsers' vertical range-input behavior before
      committing to one approach), sized to fit the existing 2.6rem-wide
      tools sidebar
- [ ] 4.3 `js/workspace.js`: tool-button click handler shows/hides
      `#pencil-options` based on `currentTool === 'pencil' || currentTool
      === 'eraser'` (same tool-scoped-visibility pattern the Brushes
      panel already uses); slider `input`/`change` handlers update
      `state.pencilSize`/`state.pencilOpacity` and the preview swatch

## 5. Verification

- [ ] 5.1 Re-run full `node --test` suite
- [ ] 5.2 Playwright smoke pass: Size 1/Opacity 100% stroke is pixel-
      identical to before (screenshot or pixel-sample comparison); Size 5
      produces a visibly wide stroke; Opacity 50% over opaque content
      produces visibly blended (not fully opaque) color, and tracing the
      same path back and forth in one continuous drag does not darken
      further than a single pass; Eraser at Opacity 50% over an opaque
      pixel roughly halves its alpha rather than fully clearing it;
      pixel-perfect has no visible effect when Size > 1; sliders show
      only while Pencil/Eraser is active; zero console errors
