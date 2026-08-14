## Context

`js/canvas-view.js` already owns zoom/pan state internally: `#baseScale`
(the CSS-px-per-canvas-px established by `resetView()`'s fit-to-container
math, an integer ≥ 1) and `#scale` (a multiplier on top of that, currently
only ever changed by two-finger pinch, clamped to `MIN_SCALE`/`MAX_SCALE`
= 0.25/8). Effective zoom is always `#baseScale * #scale`. `resetView()`
recomputes `#baseScale`, resets `#scale` to 1, and centers the canvas —
this is exactly "Fit Screen". None of this is reachable except by touch;
there's no public zoom API, no pan mode, and nothing reports the current
zoom back to a caller. Single-pointer drag today always means "draw"
(routed straight to `onDrawStart`/`onDrawMove`/`onDrawEnd`).

The Layers panel currently lives in `workspace-main`'s vertical stack
(`index.html`, between Canvas Settings and the palette row). The Brushes
panel already made the same move in a prior change (2c1) — right-side
`<aside>` sibling of `workspace-main`, tool-scoped visibility via the
existing `.hidden` utility class — so Layers reuses that pattern, minus
the tool-scoping (Layers is always relevant, just optionally collapsed).

## Goals / Non-Goals

**Goals:**
- Reach every zoom operation from mouse + keyboard, not just touch.
- Keep pinch-zoom exactly as it behaves today (same state, same clamp) —
  buttons/shortcuts/presets are additional entry points into the same
  `#scale`/`#baseScale` state, not a parallel system.
- Report zoom as a percentage meaningful to a pixel artist: 100% means one
  canvas pixel is one screen pixel, not "the initial view."

**Non-Goals:**
- No space-bar-hold temporary pan (Photoshop-style) — only an explicit
  Hand tool, per the proposal.
- No change to `engine.js`/`layers.js`/pixel data — this is viewport
  presentation only.
- No persistence of zoom/pan state across project switches or reloads —
  every opened project starts at Fit Screen, same as today.

## Decisions

**Zoom API lives on `CanvasView`, not `workspace.js`.** `CanvasView`
already owns `#scale`/`#baseScale`/`#panX`/`#panY`/`#applyTransform()`;
adding `zoomStep(direction)`, `setZoomPreset('100' | 'fit' | 'fill')`, and
`getZoomPercent()` there keeps all viewport math in one place, and
`workspace.js` stays a thin caller (same division of responsibility the
file header already documents: CanvasView "knows nothing about tools,
colors, layers, or the undo stack").

**Button/keyboard zoom anchors on the container center**, using the same
anchor-preserving math `#updatePinch()` already uses for pinch (convert
the anchor point to canvas-space before changing `#scale`, then solve for
the `#panX`/`#panY` that keeps it under the same screen point after).
Pinch keeps anchoring on the pinch midpoint, unchanged.

**Presets bypass the step clamp; manual +/- stepping and pinch keep it.**
`MIN_SCALE`/`MAX_SCALE` (0.25/8) exist to keep incremental gestures from
running away. But 100%/Fill Screen are exact targets a small canvas can
legitimately need a `#scale` outside that range to reach (e.g. an 8×
`#baseScale` from Fit Screen on a 16×16 canvas in a large container means
100% needs `#scale` = 0.125, below `MIN_SCALE`). Presets compute and set
`#scale` directly rather than going through the clamped step path, so
they always land exactly on their target. A subsequent `+`/`-` press
after a preset still clamps from wherever that landed — the clamp only
guards incremental change, not absolute jumps.

**Zoom percentage = `baseScale * scale * 100`.** This matches how
pixel-art tools (Aseprite etc.) report zoom: 100% is native resolution,
and a small canvas's Fit Screen view legitimately reads as e.g. "800%"
because that's how much it's actually being upscaled to fill the
container. `getZoomPercent()` is one method; `workspace.js` calls it
after every zoom-changing action (buttons, shortcuts, presets) and also
needs it invoked after pinch, so `CanvasView` gains an `onZoomChange`
handler (same pattern as the existing `handlers` object passed to
`setHandlers`) fired at the end of `#updatePinch()` and every new zoom
method, rather than `workspace.js` polling.

**Fill Screen computes its own scale, not reusing `resetView()`'s fit
math.** Fit uses `Math.floor(Math.min(w/width, h/height))` — floors to
keep an integer px-per-pixel ratio and takes the smaller ratio so nothing
overflows. Fill needs the larger ratio (so the shorter container
dimension is fully covered) and must NOT floor: flooring the cover ratio
could under-cover and leave a gap in the larger dimension, contradicting
"fill" (crop, don't letterbox). Accepted trade-off: Fill Screen can end
up at a fractional px-per-pixel ratio, where the transparency checkerboard
background (sized in whole CSS px per `resetView()`) may not perfectly
align to canvas pixel boundaries. Cosmetic only — the composited canvas
image itself (`image-rendering: pixelated`) still renders each canvas
pixel as a crisp (if fractionally-sized) block; only the checkerboard
grid lines can look very slightly off at that one zoom level. Not worth
the complexity of a second checkerboard-sizing scheme for one preset.

**Hand tool panning happens inside `CanvasView`, not by repurposing
`onDrawMove`'s grid-coordinate points.** `onDrawMove` reports floored grid
coordinates — fine for drawing, useless for smooth sub-pixel panning
deltas. Instead, `CanvasView` gains `setPanMode(enabled)`. While enabled,
single-pointer drag adjusts `#panX`/`#panY` directly from raw client-pixel
deltas (mirroring what `#updatePinch()` already does for two-finger pan)
and never calls `onDrawStart`/`onDrawMove`/`onDrawEnd` — so no drawing
tool's handler runs while panning, and no tool-dispatch changes are
needed in `workspace.js` beyond calling `canvasView.setPanMode(tool ===
'hand')` wherever it already toggles `currentTool` (the tool-button click
handler, plus the per-project reset block, mirroring exactly how the
Brushes-panel visibility toggle already piggybacks on that same click
handler). Two-finger touch pan/pinch is untouched either way — it's
handled at `#pointers.size === 2`, a separate branch from the
single-pointer path `setPanMode` affects.

**Layers panel reuses the Brushes-panel pattern, not a new one.** Same
right-side `<aside>` placement, same `.hidden` utility class for the
show/hide toggle. The only difference: Brushes panel visibility is driven
by tool selection (workspace.js already computes it from `currentTool`);
Layers panel visibility is its own independent boolean
(`state.layersPanelVisible`) toggled by a dedicated button, reset to
visible (`true`) in the same per-project reset block that already handles
Brushes-panel visibility — consistent with "every freshly opened project
starts from the same defaults" established for every other per-project
UI reset in that file.

## Risks / Trade-offs

- **Fill Screen's fractional scale vs. the checkerboard grid** → accepted
  cosmetic-only trade-off, documented above; the actual canvas pixels
  still render crisply.
- **Adding a `handlers.onZoomChange` callback pattern parallel to
  `onDraw*`** → mirrors an existing, already-understood pattern in the
  same class rather than introducing a new callback style, keeping
  `CanvasView`'s public surface consistent.
- **Hand tool's `setPanMode` must be reset correctly on every tool switch
  and every project open** → same class of stale-DOM/stale-state bug this
  codebase has hit before (documented in `js/workspace.js`'s per-project
  reset comments for tool/palette/brush state); mitigated by putting the
  `setPanMode` call in the exact same two places (tool-click handler,
  per-project reset block) every other per-tool UI reset already lives,
  not a new code path to remember separately.
