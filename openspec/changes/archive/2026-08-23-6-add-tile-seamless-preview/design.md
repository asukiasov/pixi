## Context

`CanvasView.render()` (`js/canvas-view.js`) repaints `#workspace-canvas` by
calling `putImageData(layerStack.composite(), 0, 0)` — the single source of
truth for what's on screen. Pan/zoom is a CSS `transform` on the canvas
element itself (`#applyTransform()`), and pointer coordinates map to grid
coordinates via `#toGridPoint()`, which divides by the canvas element's own
`getBoundingClientRect()`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Show 8 read-only copies around the real canvas without adding a second
  editable surface or a second coordinate system for tool input.
- Keep the existing pan/zoom transform and pointer-to-grid mapping working
  unmodified for the center (real) canvas.

**Non-Goals:**
- Editing directly on a surrounding copy (proposal.md already excludes
  this; input outside the center canvas element is simply out of bounds,
  same as today).
- A live "wrap-around" brush that lets a stroke continue from one edge of
  the real canvas onto the opposite edge in a single drag — this is a
  visual preview only, not a change to how strokes are computed on the
  real canvas.

## Decisions

- **Render the 8 copies as sibling `<canvas>` elements around the real
  one, not a single large composited bitmap.** A wrapper element holds a
  3×3 CSS grid; the center cell is the existing `#workspace-canvas`
  (unchanged, still the only element `CanvasView` targets), and the 8
  surrounding cells are new plain `<canvas>` elements that each get the
  same `ImageData` blitted onto them right after the center canvas
  renders. This means `CanvasView.render()` needs one small addition
  (repaint the 8 copies too, when tile-preview is on) rather than a
  rewrite of how compositing or the real canvas paints.
  - Alternative considered: render one oversized canvas element with the
    pattern drawn 3×3 into it, and make the "real" canvas a
    sub-rectangle of that. Rejected — it would require rewriting
    `#toGridPoint()`'s coordinate mapping and every existing tool's
    pointer-handling assumption that the canvas element's bounds equal
    the drawable grid; the sibling-elements approach touches none of
    that.
- **Existing pan/zoom transform applies to the 3×3 wrapper as a whole,
  not per-cell.** The wrapper element (not `#workspace-canvas`
  individually) receives `#applyTransform()`'s translate/scale, so
  panning and zooming move all 9 cells together with no change to the
  transform math itself.
- **Repaint copies from `render()`, not from a separate observer.**
  `CanvasView.render()` is already called after every commit (per its own
  doc comment); adding "if tile-preview is on, blit the same ImageData
  into the 8 copy canvases too" there means no new render trigger or
  dirty-tracking is needed — it reuses the existing call sites for free.

## Risks / Trade-offs

- [8 extra canvas elements at 128×128 max size, repainted on every commit]
  → negligible cost: `putImageData` on a small canvas is cheap, and this
  only happens while tile-preview is on (checked once per `render()`
  call).
- [Selection overlay (`#selectionOverlayEl`) and drag-preview elements are
  currently positioned only relative to the single canvas] → unaffected,
  since those only need to align with the center (real) canvas, which
  keeps its existing element and position within the 3×3 grid.

## Open Questions

None — the render/coordinate seams above resolve the only real ambiguity
(how to add copies without disturbing tool input), so nothing here needs
to stay open into implementation.
