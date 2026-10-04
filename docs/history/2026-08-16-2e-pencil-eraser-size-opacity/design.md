## Context

`PixelEngine.setPixel(x, y, rgba)` (`js/engine.js`) fully overwrites a
pixel's RGBA — no blending. `strokeFreehand(points, rgba, pixelPerfect)`
interpolates the dragged path via `bresenhamLine` between consecutive
points, optionally removes redundant diagonal corners, then calls
`setPixel` once per resulting path point — always exactly 1px wide.
`js/workspace.js`'s pencil/eraser handling already follows the
established "redraw the whole stroke from a clean backup on every
pointer move" pattern (see `onDrawMove`'s pencil/eraser branch) — the
same pattern `redrawBrushPath()` and `drawShapePreview()` use for Brush
and Line/Rectangle, so a full in-progress stroke is always recomputed
from `state.strokeBackup`, never incrementally painted onto
already-modified data.

## Goals / Non-Goals

**Goals:**
- Size and Opacity behave predictably regardless of stroke speed/density
  — a slow, dense drag (many overlapping stamps) must look the same as a
  fast, sparse one at the same Size/Opacity.
- Size 1 / Opacity 100% (the defaults) must be pixel-identical to today's
  behavior — zero risk of regressing the existing pencil/eraser tests.

**Non-Goals:**
- No brush-tip shape options (square, textured, etc.) — a filled circle
  only, matching the mockup and standard pencil-tool conventions.
- No Size/Opacity for Bucket, Brush, Line, Rectangle, or Selection.
- No "Flow" concept (a separate, lower-level per-dab opacity distinct
  from overall stroke opacity, the way some paint programs distinguish
  the two) — Opacity here is the simpler, single concept most pixel-art
  tools expose.

## Decisions

**A circular stamp, generated procedurally by distance-from-center, not
a stored pattern.** Reuses the same centering math `placeBrush` already
uses (`topLeft = center - floor(size/2)`), but computes membership via
`dx*dx + dy*dy <= (size/2)^2` instead of a fixed pixel-art pattern array
— Size is a continuous 1-N range a user drags a slider through, not a
fixed small set of predefined shapes, so a lookup table doesn't fit the
way it does for Brush's Heart/Circle/custom patterns. Offsets for a given
Size are computed once and cached (Size changes rarely mid-stroke;
recomputing per stroke, not per point, is cheap enough).

**Opacity is applied once per pixel per stroke-redraw, not once per stamp
placement — dedup via a `touched` Set.** The core risk: if a slow drag
places many overlapping circular stamps along a dense path, and each
stamp independently alpha-blends onto whatever's already there,
overlapping regions get progressively darker/more opaque than a single
pass at the configured Opacity — surprising and inconsistent with how a
fast drag (fewer, more spread-out stamps) would look. Fixed by computing
the *union* of every stamp's pixel offsets across the whole path first,
then blending each unique pixel exactly once against the pristine
`strokeBackup` (not against progressively-modified data). This composes
naturally with the existing "redraw whole stroke from backup every move"
architecture — the thick-stroke function already receives the full path
and a clean backup on every call, so accumulating a `touched` Set across
one such call is a local, self-contained change.

**Pencil blending uses standard "source-over" alpha compositing; Eraser
uses direct alpha reduction — two different pixel operations, not one
"blend toward a color" op reused for both.** Pencil: treat the draw
color's alpha (normally 255) scaled by Opacity as the effective source
alpha, composite over the destination pixel with the standard over
formula (`outA = srcA + dstA*(1-srcA)`, `outRGB` a premultiplied blend of
src/dst weighted accordingly). Eraser: `newAlpha = existingAlpha * (1 -
opacity)`, RGB channels untouched — erasing is fading out existing
content, not blending toward a transparent *color* (blending toward
`[0,0,0,0]` via the same over-formula would barely affect a mostly-opaque
pixel at low source alpha, which is not what "50% erase" should mean).
Two small, separate engine functions, both operating on already-known
inputs (existing pixel, target color or none, opacity), no shared
abstraction forced between them.

**Pixel-perfect corner removal only runs at Size 1.** Corner removal
operates on a 1px-wide rasterized path (`removeRedundantCorners` in
`engine.js`); its notion of "redundant corner pixel" doesn't generalize
to a multi-pixel-wide stroke. At Size > 1, the thick-stroke path skips
that step entirely regardless of the pixel-perfect toggle's state (per
the spec's new scenario) — simpler than trying to make corner-removal
Size-aware.

**UI: vertical sliders in the tools sidebar, tool-scoped visibility.**
Matches the reference mockup and the existing tool-scoped-panel
precedent (Brushes panel shows only for the Brush tool). Lives in
`#tools-sidebar` itself (not the right-side panel column) since the
mockup places it there and it's conceptually tied to the tool buttons
directly above it, not a separate data panel like Layers/Brushes.

## Risks / Trade-offs

- **A circular stamp at small even Sizes (2, 4, ...) can look
  slightly asymmetric** (no exact center pixel) → accepted, same
  limitation every pixel-art tool with even-diameter round tips has;
  Size defaults to 1 (odd) and most users gravitate to odd sizes for
  exactly this reason.
- **`touched`-Set dedup means a stroke's total blended coverage is capped
  at one pass, so there's no way to "build up" opacity by scrubbing back
  and forth within a single drag** → this is the intended, spec'd
  behavior (see the "reduced Opacity" scenario), not an accidental
  limitation - flagged here so it isn't "fixed" later without
  re-reading why it's deliberate.
- **Two separate blending code paths (Pencil over-compositing vs. Eraser
  alpha-reduction)** → slightly more code than a single shared function,
  but forcing them into one abstraction would obscure that they're
  answering different questions ("what color/alpha should this become"
  vs. "how much of this alpha should remain").
