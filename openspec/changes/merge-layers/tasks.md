## 1. LayerStack: compositing helper and merge methods (`js/layers.js`)

- [x] 1.1 Extract a private `#compositeSubset(indices)` helper from
      `#compositeToCanvas`'s per-layer draw loop, restricted to the given
      stack indices (kept in bottom-to-top order), returning pixel data
      suitable for a new `Layer`'s `engine.data`.
- [x] 1.2 Add `mergeLayers(indices)`: validates 2+ indices, none
      `isBackground`, all in range; composites via `#compositeSubset`;
      creates a new `Layer` named after the topmost (highest-index) source
      layer, blend mode `'normal'`, opacity `1`; splices out the source
      layers and inserts the merged layer at the bottom-most source index;
      sets `#activeIndex` to the merged layer; returns `true`/`false`.
- [x] 1.3 Add `mergeDown(index)`: refuses when `index` is 0, out of range,
      the stack has 1 layer, or either `layers[index]`/`layers[index - 1]`
      is `isBackground`; otherwise delegates to
      `mergeLayers([index - 1, index])`.
- [x] 1.4 Unit-test `mergeLayers`/`mergeDown` (per `test/` conventions
      already used for `LayerStack`). NOTE (judgment call made during
      implementation): the successful-merge path composites via a `<canvas>`
      (`#compositeSubset`), which this repo's Node test harness has no DOM
      for - the same boundary that already leaves `composite()`/
      `toPNGBlob()` untested here (see `js/layers.js`'s header comment).
      Unit tests cover every validation/refusal path (fewer than 2 indices,
      out-of-range indices, Background-layer indices, merge-down's 0-index/
      out-of-range/single-layer/Background-neighbor no-ops) instead of
      asserting composited pixel output; the successful-merge pixel result
      is covered by manual browser verification (task 4.2), consistent with
      how composite correctness is already verified in this codebase.

## 2. Layers panel: marking UI (`js/workspace.js`)

- [x] 2.1 Add a module-level marked-layer-ids `Set` (parallel to existing
      UI-only state like `shiftHeld`).
- [x] 2.2 Update `renderLayersPanel` to compute `isMarked` per row from the
      `Set` and pass it into `buildLayerRow`.
- [x] 2.3 Update `buildLayerRow(layer, index, isActive, isMarked, layers)`:
      add a marked-row visual treatment distinct from `.active`; branch the
      row's click handler on `e.metaKey || e.ctrlKey` (toggle this layer's
      id in the Set), `e.shiftKey` (mark the contiguous range between the
      last plain-clicked/shift-anchor row and this one), and neither
      (existing behavior: clear the Set, `setActiveLayer(index)`); skip
      marking entirely when `layer.isBackground`. Implemented as a pure
      `computeLayerMarkState()` helper (unit-tested, see
      test/workspace.test.js) called from the click handler, following the
      same pure-predicate-extracted-for-testability pattern as
      `librarySequenceToggleVisibleForTool`.
- [x] 2.4 Clear the marked-ids Set whenever the layer count changes
      (`addLayerButton` handler, `deleteButton` handler) and on
      `performUndo`/`performRedo`.

## 3. Merge trigger and keyboard shortcut (`js/workspace.js`)

- [x] 3.1 Add a `mergeMarkedOrActiveDown()` function: reads the current
      marked-ids Set resolved to stack indices; if 2+ resolve, calls
      `state.layerStack.mergeLayers(indices)`; otherwise calls
      `state.layerStack.mergeDown(state.layerStack.getActiveIndex())`;
      on success, clears marks, re-renders canvas + Layers panel, and
      calls `commit()`; no-op paths do nothing (no `commit()`, no stale
      re-render side effects).
- [x] 3.2 Add an `else if (key === 'e')` branch to the existing delegated
      Cmd/Ctrl+Z/Y/+/-/D keydown handler (~workspace.js:2051), gated the
      same way (`e.preventDefault()`, Workspace-screen-visible check
      already covers this branch), calling `mergeMarkedOrActiveDown()`.

## 4. Verification

- [x] 4.1 Run the existing test suite (`test/` - check `package.json` for
      the exact command) and confirm it passes with the new `LayerStack`
      methods and their unit tests included. `npm test` -> 220/220 passing
      (was 209 before this change; +11 new tests across layers.test.js and
      workspace.test.js).
- [x] 4.2 Manually exercise, in the running app: Cmd/Ctrl+click marking and
      unmarking, Shift+click range marking, plain click clearing marks,
      Cmd/Ctrl+E with 2+ marked layers (including non-adjacent marks),
      Cmd/Ctrl+E with nothing marked (merge-down), merge-down at the
      bottom-most layer (no-op), merge-down on a single-layer canvas
      (no-op), attempting to mark the Background layer (refused),
      merge-down into the Background layer (no-op), and Undo after each
      successful merge restores the original layers exactly. Done via a
      headless-Playwright script driving a local static server (all
      scenarios passed, 0 console errors); caught and fixed two real bugs
      in the process (see PR/report): (1) a plain click on the Background
      row failed to clear existing marks, (2) a CSS specificity bug made
      an active+marked row fall back to the marked style's lighter
      background, leaving the active white text unreadable.
- [x] 4.3 Run `web-design-guidelines` review on the changed Layers panel
      markup/interaction (marked-row styling, click/keyboard affordances),
      per CLAUDE.md's rule that it's required before code review for any
      change touching a tool's DOM/interaction code. No blocking
      violations. One pre-existing, non-blocking gap noted for a future
      polish pass: layer rows (`<div class="layer-row">`) have no
      keyboard-accessible path to marking (Cmd/Ctrl+click/Shift+click) -
      the row was already mouse-only for plain-click selection before this
      change; marking extends that same gap rather than introducing a new
      one, and fixing it would mean redesigning row semantics
      (focusable/`role="option"`-style), out of scope here.
