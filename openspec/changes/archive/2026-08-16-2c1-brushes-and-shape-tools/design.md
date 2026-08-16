## Context

See proposal.md for motivation. Building on `js/engine.js` (`PixelEngine`:
`setPixel`, `strokeFreehand`, `floodFill`, unchanged in this slice),
`js/layers.js` (`LayerStack`/`Layer`), and `js/workspace.js`'s existing
tool-handling pattern: `canvas-view.js` emits a generic
`onDrawStart`/`onDrawMove`/`onDrawEnd`/`onDrawCancel` grid-point stream;
`workspace.js` interprets it per active tool, using a "backup the active
layer's buffer, redraw fresh from backup on every move, commit on release"
pattern already established for pencil's pixel-perfect mode.

## Goals / Non-Goals

**Goals:**
- Brushes: one shipped shape (Heart), but adding a second shape later is
  purely a data addition.
- Line/Rectangle: live preview while dragging, reusing existing engine
  primitives wherever possible.
- Selection: clips every tool uniformly, without modifying `engine.js`'s
  already-tested `strokeFreehand`/`floodFill`.

**Non-Goals:**
- Moving, cutting, or copying a selection's contents.
- Brush rotation, flipping, or resizing; more than one shipped brush.
- Any change to `engine.js`'s public API.

## Decisions

**Brushes are a plain pattern registry, no engine changes.**
`js/brushes.js` exports a list of `{ id, name, width, height, pixels }`,
where `pixels` is an array of `[dx, dy]` offsets (relative to the pattern's
top-left) that are "on". Heart is defined as a fixed bitmap (9 wide × 8
tall — an approximation of the reference image's proportions, easy to
retune):

```
.XX...XX.
XXXX.XXXX
XXXXXXXXX
XXXXXXXXX
.XXXXXXX.
..XXXXX..
...XXX...
....X....
```

Placement (`placeBrush(engine, centerX, centerY, brush, rgba)`): top-left =
`(centerX - floor(width/2), centerY - floor(height/2))`; for every "on"
offset, `engine.setPixel(topLeftX + dx, topLeftY + dy, rgba)` —
`setPixel`'s existing bounds check silently drops out-of-canvas pixels, so
edge placement needs no special-casing.

**Line reuses `strokeFreehand` directly, no new geometry code.** A Line
tool drag is just `engine.strokeFreehand([start, end], rgba, pixelPerfect)`
— the same Bresenham interpolation and pixel-perfect corner removal pencil
already uses. No changes to `engine.js`.

**Rectangle is new, small, DOM-free logic in `js/shape-tools.js`.**
`drawRectangle(engine, x0, y0, x1, y1, rgba, filled)`: normalizes corners,
then either sets every pixel in the bounding box (filled) or just the four
edges (outline, via `setPixel` per perimeter pixel — simple enough not to
need `strokeFreehand`).

**Selection clips every tool by post-processing, not by changing
`engine.js`.** A selection is `{ x, y, width, height }` in grid coords,
held in `workspace.js`'s module state only — per the spec, making/clearing
a selection is not itself a canvas edit and isn't part of undo history.
Every committed draw operation (stroke end, bucket fill, brush placement,
line, rectangle) already has (or gains) a full pre-operation backup of the
active layer's buffer — pencil/eraser already capture one for the
pixel-perfect live-redraw; bucket/brush/line/rectangle gain the same. After
the operation writes its pixels, one new step runs if a selection is
active: `clipToSelection(engine, backup, selection)` — for every pixel
*outside* the selection rect, copy that pixel's value back from `backup`,
undoing anything the operation wrote there. This is uniform across every
tool, requires zero changes to `engine.js`'s tested methods, and reuses
infrastructure that already exists (the backup buffer) rather than adding
per-tool clipping logic. Bucket fill spreading beyond the selection and
then getting clipped back is an accepted, simple side effect — the net
result (fill confined to the selection) matches the spec either way.

**Selection's visual overlay lives in `canvas-view.js`.** A new
`setSelectionRect(rect | null)` method shows/hides/positions a sibling
`<div>` over the canvas: sized `rect.width * baseScale` ×
`rect.height * baseScale` (matching the canvas's own pre-zoom pixel-to-CSS-px
scale), positioned at `rect.x * baseScale, rect.y * baseScale`, and given
the exact same `transform: translate(panX, panY) scale(scale)` as the
canvas element — since it's a sibling at the same origin, this keeps it
perfectly aligned through pan/zoom with no separate coordinate math.
`#applyTransform()` updates both elements together.

**Tool interaction reuses the existing point-stream handlers as-is.**
Line/Rectangle/Selection all follow: `onDrawStart` captures the start
point + backs up the active layer; `onDrawMove` restores the backup and
redraws the current preview shape (line/rectangle) or updates the
selection overlay only (selection doesn't touch pixels while dragging);
`onDrawEnd` commits the final shape (applying the selection clip if one is
active) and calls `commit()`. This is exactly pencil's existing
backup-restore-redraw pattern, generalized to different "what to draw"
logic per tool — no `canvas-view.js` changes needed for the drag mechanics
themselves.

**Revised: Brush tool now handles `onDrawMove`/`onDrawEnd` too, for
continuous placement.** Originally brush only placed on `onDrawStart`
(bucket-like, single tap). It now accumulates a path of brush-center points
across the whole drag (`onDrawStart` seeds it with the first point;
`onDrawMove` appends the new point plus every intermediate pixel between it
and the last recorded one, via `engine.js`'s existing Bresenham line
helper — now exported as `bresenhamLine`, reused rather than duplicated —
so a fast drag that jumps several pixels between move events doesn't skip
any brushes). Each move redraws the *entire* accumulated path from the
pre-drag backup (same pattern as pencil's live redraw), placing one brush
per path point; `onDrawEnd` commits the whole trail as a single undo step.

**Rainbow color cycling is per-placement, tracked by an index into the
path, not global mutable state.** `redrawBrushPath()` walks
`state.brushPath` and computes each brush's color as
`state.brushRainbow ? rainbowColor(i * RAINBOW_HUE_STEP) : state.currentColor`
(`i` = the point's index in the path). Because the whole path is redrawn
from a clean backup on every move (not incrementally advanced), a fixed
per-index hue step naturally satisfies "each new drag restarts the
sequence" — there's no persistent hue counter to reset. `rainbowColor(hue)`
(`js/brushes.js`) converts an HSL(hue, 100%, 50%) color to the engine's RGBA
array format; `RAINBOW_HUE_STEP = 20` degrees per brush (18-ish visibly
distinct steps around the wheel before repeating).

**Circle brush is a second hand-authored bitmap, same format as Heart.**
5×5, filled:
```
.XXX.
XXXXX
XXXXX
XXXXX
.XXX.
```

**Brushes panel replaces the bare `brushes-row`, styled after Photoshop's
Brushes panel** (per a reference screenshot): a titled panel with a
thumbnail grid (not a single-row horizontal scroll) and a bottom toolbar
holding Add (+) and Delete (🗑) icon buttons — reusing the Material Symbols
icons already added for tools/undo/redo, not new text buttons. A Spacing
number input sits above the grid, mirroring Photoshop's "Size: N px" row.

**Custom brush creation is a fixed 9×9 grid of plain `<button>` cells, not
a canvas.** Matches Heart's width, simple enough that DOM buttons (click to
toggle, drag to paint) avoid building a second mini pixel-editor rendering
path alongside the real one. On Save, the grid's on/off cell state converts
to the same `pixels: [[x,y], ...]` format built-in brushes use via a new
`pixelsFromGrid(grid)` helper in `js/brushes.js` — so a custom brush is
indistinguishable from a built-in one everywhere else in the code (picker,
placement, undo).

**Custom brushes persist via a new Dexie table, `customBrushes`, forward-
compatible with future per-user ownership.** Record shape:
```js
{ id, name, width, height, pixels, userId: null, createdAt }
```
`userId` is always `null` today (no auth exists yet — Phase 3 adds
Supabase Auth per `openspec/roadmap.md`); reserving the field now means
"a brush becomes owned by the signed-in user" later is a matter of setting
it and syncing, not a schema change. Dexie version bumps from 1 to 2
(`projects` unchanged, `customBrushes: 'id, createdAt'` added) — Dexie
requires restating unchanged stores in a new version block, not just the
diff. Built-in brushes (Heart, Circle) are never in this table, so
"can't delete a built-in brush" falls out naturally: the delete control is
only enabled for a selected brush that has a matching `customBrushes`
record.

**Spacing is index-based subsampling of the already-interpolated path, not
distance accumulation.** `redrawBrushPath()` places a brush only at path
points where `index % state.brushSpacing === 0` — since the path is
already a dense pixel-by-pixel Bresenham interpolation (~1 unit apart
regardless of drag direction), index-stepping approximates "every N
pixels" well enough without tracking cumulative Euclidean distance. Index 0
(the tap/drag-start point) always satisfies the modulo check, so a
stationary tap still always places exactly one brush regardless of
Spacing. Rainbow's hue-per-placement counter increments only on points that
actually get placed (not skipped ones), so increasing Spacing doesn't
change the rainbow's visual cycle rate along the trail, just how many
brushes appear per unit length.

## Risks / Trade-offs

- [Selection-clip-by-restoring-outside-pixels means bucket fill still
  *computes* the full flood fill before being clipped back] → Negligible
  cost at these canvas sizes (≤256×256); simpler and more robust than
  teaching `floodFill` about a bounds predicate.
- [Heart's exact pixel shape is an approximation of the reference image,
  not a pixel-for-pixel trace] → Acceptable; easy to retune the bitmap
  later since it's just data in `brushes.js`.
- [No live preview for brush placement] → Superseded: brush now has a live
  preview by construction, since the whole dragged path redraws every move.
- [Redrawing the whole accumulated brush path from backup on every move is
  O(path length) per move, not O(1)] → Fine at these canvas sizes and
  typical drag lengths; matches the cost profile pencil's live redraw
  already has for pixel-perfect mode.

## Testing

- `js/brushes.js`: DOM-free, tested with `node --test` — placement math
  (centering, edge clipping), pattern registry shape, Circle's shape,
  `pixelsFromGrid()`.
- `js/persistence.js`: `createCustomBrush`/`listCustomBrushes`/
  `deleteCustomBrush`, tested the same way as project CRUD (`fake-indexeddb`).
- `js/shape-tools.js`: DOM-free — rectangle (outline/filled) pixel
  correctness, selection-clip logic (`clipToSelection`).
- Line needs no new tests beyond what `engine.strokeFreehand` already has,
  since it's a direct reuse.
- Playwright smoke pass (as used for 2a/2b): place a brush near an edge;
  draw a line and a filled/outline rectangle; make a selection and confirm
  pencil/bucket/brush are clipped to it; delete a selection's contents;
  undo each action type.
