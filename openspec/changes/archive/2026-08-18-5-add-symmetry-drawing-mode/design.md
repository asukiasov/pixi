## Context

Pencil/Eraser/Brush strokes go through a shared `applyPixel(x, y)` callback
pattern (`js/engine.js`'s `strokeFreehandThick`, `js/workspace.js`'s
`pencilOrEraserApplyPixel`) that the stroke path calls once per pixel. This
is the same seam `state.pixelPerfect` already hooks into for corner
removal, and it's the natural seam for mirroring too — see proposal.md for
motivation.

## Goals / Non-Goals

**Goals:**
- Mirror Pencil/Eraser/Brush pixel writes across a fixed center axis
  (horizontal/vertical/both), live, as one undo step.
- Reuse the existing `applyPixel` callback seam rather than duplicating
  each tool's stroke-tracing logic.

**Non-Goals:**
- Draggable/offset mirror axis (fixed at canvas center only).
- Mirroring for Bucket, Line, Rectangle, Selection, or Move.
- Persisting symmetry state with the project.

## Decisions

- **Wrap `applyPixel`, don't fork the stroke tracer.** A `mirrorApplyPixel(x,
  y, baseApplyPixel, mode, width, height)` helper computes the 1-3
  additional mirrored coordinates for the active mode and calls
  `baseApplyPixel` for each (including the original), deduplicating
  coordinates that coincide with the original or each other (e.g. a pixel
  exactly on the vertical center line under horizontal mirror). Each tool's
  call site passes its existing `applyPixel` through this wrapper when
  symmetry is active, instead of a symmetry-aware rewrite of
  `strokeFreehandThick` itself.
  - Alternative considered: teach `strokeFreehandThick` about symmetry
    directly. Rejected — it would couple a generic stroke tracer to a
    drawing-mode concern, and Brush's stroke path (`js/brushes.js`) would
    need the same logic duplicated or extracted anyway; a wrapper works for
    both call sites with one implementation.
- **Dedup mirrored coordinates before calling `applyPixel`, not after.**
  Prevents double-blending under the Pencil's Opacity setting when a
  stroke crosses a center line (calling `applyPixel` twice on the same
  pixel would double-blend, same class of bug the Opacity scenario in
  `pixel-drawing-engine` already guards against for overlapping strokes).
- **One undo/redo step per stroke, unchanged.** Mirrored pixels are written
  within the same `commit()` call as the original stroke (see
  `js/workspace.js`'s `commit()`), so no new undo-stack entry type is
  needed — this falls out of doing the mirroring inside the existing
  per-stroke pixel-application loop rather than as a separate post-stroke
  pass.
- **Axis fixed at floor(width/2)/floor(height/2), matching odd-size
  clipping in the spec.** Simple integer reflection (`mirroredX =
  width - 1 - x`), same formula for both axes independently, composed for
  4-way. Odd sizes naturally leave a center column/row that reflects to
  itself under this formula, satisfying the spec's odd-canvas scenario
  without special-casing it.

## Risks / Trade-offs

- [Brush tool's stroke path lives in a separate file (`js/brushes.js`) from
  Pencil/Eraser's (`js/workspace.js`)] → the `mirrorApplyPixel` helper is
  written once (likely in `js/engine.js` alongside `strokeFreehandThick`,
  or a small new `js/symmetry.js`) and imported by both, rather than
  reimplemented per file.
- [4-way symmetry near the center on very small canvases (16px) could make
  mirrored copies visually overlap/crowd] → acceptable for a first pass;
  no special handling beyond the dedup already required for correctness.

## Open Questions

- Exact toggle UI for a 4-state control (off/horizontal/vertical/both) —
  single button that cycles through 4 states vs. a small popover with 3
  checkable options. Left to implementation to match the existing
  `#pixel-perfect-toggle` (single button) visual weight; doesn't affect
  the spec's behavior requirements either way.
