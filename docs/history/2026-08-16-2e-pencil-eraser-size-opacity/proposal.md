## Why

Pencil and Eraser are currently fixed at a single hard pixel, full
opacity — every stroke is either "one pixel, fully opaque" or nothing.
For anything beyond the finest detail work (blocking in shapes, soft
shading, broad erasing) this forces either many repeated strokes or
switching to the Brush tool's fixed predefined patterns, which aren't a
substitute for a plain variable-width pencil/eraser. Requested directly,
with a reference mockup showing vertical Size/Opacity sliders in the
tools sidebar.

## What Changes

- Pencil and Eraser gain two shared controls: **Size** (stroke width, in
  pixels, a filled circular stamp centered on the stroke path — same
  concept as a traditional round pencil tip) and **Opacity** (how
  strongly the stroke covers what's underneath, 1-100%).
- Controls are presented as vertical sliders in the tools sidebar,
  visible only while Pencil or Eraser is the active tool (matching the
  existing tool-scoped-panel pattern the Brushes panel already
  established).
- At Size 1, behavior is pixel-for-pixel identical to today (1px,
  opaque) — this is purely additive to the existing default.
- Pixel-perfect corner removal continues to apply only at Size 1 (it has
  no meaning for a multi-pixel-wide stroke).

## Capabilities

### Modified Capabilities
- `pixel-drawing-engine`: the Pencil requirement (currently implicitly
  1px/opaque via `strokeFreehand`) gains Size and Opacity; the Eraser
  tool (drawing fully-transparent pixels) gains the same two controls,
  with Opacity meaning "how much of the existing alpha to remove" rather
  than color blending, since there's no color to blend toward.

## Impact

- `js/engine.js`: new alpha-compositing pixel operations (a blended
  "paint" for Pencil, a distinct alpha-reduction "erase" for Eraser) and
  a thick-stroke path function that stamps a circular area per path
  point, deduplicated per pixel within one stroke redraw so overlapping
  stamps along a slow/dense drag don't compound Opacity beyond the
  intended single-pass strength (see design.md).
- `js/workspace.js`: `state.pencilSize`/`state.pencilOpacity` (shared by
  Pencil and Eraser); tool-scoped sidebar panel visibility (same pattern
  as Brushes/Layers panels); Pencil/Eraser stroke handling switches from
  `engine.strokeFreehand` to the new thick-stroke path when Size > 1 or
  Opacity < 100%.
- `index.html` / `style.css`: vertical Size/Opacity sliders in the tools
  sidebar.
- No change to Bucket, Brush, Line, Rectangle, or Selection — Size/
  Opacity are Pencil/Eraser-only in this slice.
