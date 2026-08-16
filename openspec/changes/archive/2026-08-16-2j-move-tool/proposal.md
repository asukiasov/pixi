## Why

Requested directly: "I think we need to bring new tool - mouse (v) as it
is in photoshop and illustrator" — a Move tool (Photoshop's Move /
Illustrator's Selection tool, both bound to `V`) that drags pixel content
around instead of drawing it. `2c1-brushes-and-shape-tools` shipped a
rectangular Selection tool with Clear/Delete, but explicitly scoped
moving/copying a selection's contents out ("Moving/copying selected
content is out of scope for this slice"). This closes that gap.

## What Changes

- Add a **Move** tool (`data-tool="move"`, shortcut `V`, icon
  `arrow_selector_tool`): drag on the canvas to shift pixel content on the active
  layer.
  - **With an active selection**: only the selected rectangle's content
    moves. The selection rect itself moves with it (so a second drag
    continues moving the same content), regardless of where inside the
    canvas the drag starts — see design.md for why "always operates on
    the active selection once one exists" was chosen over requiring the
    drag to start inside it.
  - **With no active selection**: the drag moves the entire active
    layer's pixel content (matches Photoshop's actual behavior for Move
    with nothing selected) — still only that one layer, every other
    layer is untouched.
  - The source area left behind becomes fully transparent, same
    "clear to transparent" idea `2c1`'s selection Delete already uses,
    combined with re-stamping the extracted pixels at the drag's offset.
  - Live-previewed while dragging (smooth per-pointer-move redraw from a
    pre-drag backup), matching Line/Rectangle's existing feel.
  - One full drag (press to release) is a single undo step.
  - Cursor: standard CSS `cursor: move` while the tool is active — no new
    cursor artwork.
- Adds two small, composable `PixelEngine` helpers (`extractRegion`,
  `clearRegion`, `stampRegion`) that the Move tool is built from; nothing
  else changes about `engine.js`'s existing, already-tested methods.

Out of scope for this slice: moving content across layers, copying
(Alt/Option-drag duplicate) instead of moving, arrow-key nudging, and any
non-rectangular selection shape (selections are still rectangle-only, per
`2c1`).

## Capabilities

### Modified Capabilities
- `shape-tools`: gains a Move tool requirement, alongside the existing
  Line/Rectangle/Selection requirements. `shape-tools` itself is still an
  in-flight, unarchived capability (`2c1-brushes-and-shape-tools` hasn't
  been archived yet) — this change's delta stacks on top of `2c1`'s, the
  same "second delta on an unmerged capability" situation
  `2g-background-layer`'s proposal.md already called out for a different
  capability. Move belongs here rather than a new `move-tool` capability
  because its behavior is defined entirely in terms of the Selection
  tool's existing `state.selection` model — there's no meaningful way to
  describe Move without referencing Select's rect, so splitting them into
  separate capabilities would just cross-reference back and forth.

## Impact

- `js/engine.js`: three new `PixelEngine` methods — `extractRegion(x, y,
  width, height)`, `clearRegion(x, y, width, height, rgba?)`,
  `stampRegion(x, y, width, height, buffer)` — generic pixel-region
  copy/clear/stamp primitives, unit-tested the same way as
  `setPixelBlended`/`erasePixelBlended`. No changes to any existing
  method.
- `js/workspace.js`: new `move` tool branch in `onDrawStart`/
  `onDrawMove`/`onDrawEnd`/`onDrawCancel`, reusing the existing
  backup-redraw-commit pattern already used by Line/Rectangle/Brush; a
  `redrawMovePreview()` helper alongside the existing
  `drawShapePreview()`/`redrawBrushPath()`; on `onDrawEnd`, if a
  selection was active, `state.selection` is translated by the drag's
  offset and the selection overlay updated to match.
- `js/canvas-view.js`: a `setMoveMode(enabled)` method, mirroring
  `setPanMode`, toggling a `.move-mode` class on the canvas element for
  the CSS cursor.
- `index.html`: new tool button (`data-tool="move"`, `data-shortcut="V"`,
  `arrow_selector_tool` icon); `arrow_selector_tool` added to the Material Symbols
  `icon_names` subsetting list.
- `style.css`: `#workspace-canvas.move-mode { cursor: move; }`.
- New tests in `test/engine.test.js` for `extractRegion`/`clearRegion`/
  `stampRegion`.
