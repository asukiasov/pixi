## 1. Engine primitives

- [x] 1.1 `js/engine.js`: `PixelEngine#extractRegion(x, y, width,
      height)` — returns a `width*height*4` `Uint8ClampedArray` copy of
      the region, out-of-canvas source pixels read as `[0,0,0,0]`
- [x] 1.2 `js/engine.js`: `PixelEngine#clearRegion(x, y, width, height,
      rgba = [0,0,0,0])` — sets every pixel in the region (bounds-checked
      via the existing `setPixel`)
- [x] 1.3 `js/engine.js`: `PixelEngine#stampRegion(x, y, width, height,
      buffer)` — writes a `width*height*4` buffer at the given offset
      (bounds-checked via `setPixel`, silently clipping any part that
      lands outside the canvas)
- [x] 1.4 Unit tests in `test/engine.test.js`: `extractRegion` (in-bounds
      copy is pixel-correct, out-of-canvas portion reads transparent,
      buffer layout matches `(dy*width+dx)*4` indexing), `clearRegion`
      (default transparent fill, explicit color fill, out-of-bounds
      region doesn't throw), `stampRegion` (writes at the given offset,
      clips silently at canvas edges, round-trips with `extractRegion`
      for an in-bounds region)

## 2. Move tool wiring

- [x] 2.1 `index.html`: new tool button (`data-tool="move"`,
      `data-shortcut="V"`, `open_with` icon, tooltip "Move"), placed in
      the tools sidebar; `open_with` added to the Material Symbols
      `icon_names=` subsetting list
- [x] 2.2 `js/canvas-view.js`: `setMoveMode(enabled)` mirroring
      `setPanMode` — toggles a `.move-mode` class on the canvas element
- [x] 2.3 `style.css`: `#workspace-canvas.move-mode { cursor: move; }`
- [x] 2.4 `js/workspace.js`: tool-button click handler calls
      `state.canvasView.setMoveMode(state.currentTool === 'move')`
      alongside the existing `setPanMode` call
- [x] 2.5 `js/workspace.js`: `redrawMovePreview()` helper — resets
      `state.strokeEngine.data` from `state.strokeBackup`, clears
      `state.moveRegion`'s original footprint via `clearRegion`, stamps
      `state.moveContent` at the region's position offset by
      `(dragCurrent - dragStart)` via `stampRegion`; does **not** call
      `clipToSelection` (see design.md)
- [x] 2.6 `js/workspace.js` `onDrawStart`: `move` branch — captures
      `dragStart`/`dragCurrent`, backs up the active layer
      (`strokeEngine`/`strokeBackup`), sets `state.moveRegion` to the
      active selection if one exists, else the full active-layer bounds,
      extracts `state.moveContent` once via `extractRegion`, calls
      `redrawMovePreview()` and renders
- [x] 2.7 `js/workspace.js` `onDrawMove`: `move` branch — updates
      `dragCurrent`, calls `redrawMovePreview()`, renders
- [x] 2.8 `js/workspace.js` `onDrawEnd`: `move` branch — if a selection
      was active, translates `state.selection` by the drag's final
      offset and calls `canvasView.setSelectionRect()` to match; clears
      `strokeEngine`/`strokeBackup`/`moveRegion`/`moveContent`/
      `dragStart`/`dragCurrent`; calls `commit()`
- [x] 2.9 `js/workspace.js` `onDrawCancel`: confirm the existing generic
      backup-restore branch correctly reverts a cancelled Move (no
      selection-translation applied, since nothing was committed)

## 3. Verification

- [x] 3.1 `npx openspec validate 2j-move-tool --strict`
- [x] 3.2 Re-run full `node --test` suite, confirm it stays green
- [x] 3.3 Playwright smoke pass: draw with Pencil; switch to Move by
      clicking the tool button, confirm pressing `V` also selects it;
      drag with no selection active — sample pixels via `getImageData`
      before/after to confirm content moved and the source area is
      transparent; confirm Undo reverts the move in one step; make a
      selection, drag with Move — confirm only the selected region's
      content moved and pixels outside it on the same layer are
      untouched; zero console errors throughout
