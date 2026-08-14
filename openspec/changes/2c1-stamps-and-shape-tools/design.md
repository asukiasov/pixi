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
- Stamps: one shipped shape (Heart), but adding a second shape later is
  purely a data addition.
- Line/Rectangle: live preview while dragging, reusing existing engine
  primitives wherever possible.
- Selection: clips every tool uniformly, without modifying `engine.js`'s
  already-tested `strokeFreehand`/`floodFill`.

**Non-Goals:**
- Moving, cutting, or copying a selection's contents.
- Stamp rotation, flipping, or resizing; more than one shipped stamp.
- Any change to `engine.js`'s public API.

## Decisions

**Stamps are a plain pattern registry, no engine changes.**
`js/stamps.js` exports a list of `{ id, name, width, height, pixels }`,
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

Placement (`placeStamp(engine, centerX, centerY, stamp, rgba)`): top-left =
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
Every committed draw operation (stroke end, bucket fill, stamp placement,
line, rectangle) already has (or gains) a full pre-operation backup of the
active layer's buffer — pencil/eraser already capture one for the
pixel-perfect live-redraw; bucket/stamp/line/rectangle gain the same. After
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

**Stamp tool ignores `onDrawMove`/`onDrawEnd`.** Like bucket, a stamp
places on `onDrawStart` only; dragging with the Stamps tool active has no
effect (no live preview in this slice — noted as a nice-to-have, not
required by the spec).

## Risks / Trade-offs

- [Selection-clip-by-restoring-outside-pixels means bucket fill still
  *computes* the full flood fill before being clipped back] → Negligible
  cost at these canvas sizes (≤256×256); simpler and more robust than
  teaching `floodFill` about a bounds predicate.
- [Heart's exact pixel shape is an approximation of the reference image,
  not a pixel-for-pixel trace] → Acceptable; easy to retune the bitmap
  later since it's just data in `stamps.js`.
- [No live preview for stamp placement] → Consistent with bucket's existing
  no-preview behavior; can be added later without restructuring.

## Testing

- `js/stamps.js`: DOM-free, tested with `node --test` — placement math
  (centering, edge clipping), pattern registry shape.
- `js/shape-tools.js`: DOM-free — rectangle (outline/filled) pixel
  correctness, selection-clip logic (`clipToSelection`).
- Line needs no new tests beyond what `engine.strokeFreehand` already has,
  since it's a direct reuse.
- Playwright smoke pass (as used for 2a/2b): place a stamp near an edge;
  draw a line and a filled/outline rectangle; make a selection and confirm
  pencil/bucket/stamp are clipped to it; delete a selection's contents;
  undo each action type.
