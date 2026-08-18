## Context

Read `openspec/changes/reference-image-layer/design.md` in full before this
document — this extends it, not replaces it. Two facts from that design
are load-bearing here:

1. **The reference layer is currently a normal `Layer`** in
   `LayerStack.#layers`: a `PixelEngine` buffer sized exactly to the
   canvas's own `width`/`height`, with `isReferenceImage = true`. Every
   other layer (drawing layers, Background) is the same shape. This
   uniformity is what makes reordering, undo/redo (`snapshot`/`restore`),
   and persistence (`toProjectRecord`/`fromProjectRecord`) all "just work"
   for the reference layer today, with zero special-casing beyond a
   handful of `isReferenceImage` boolean checks.
2. **The "Smoothing toggle" decision explicitly deferred** decoupling the
   reference layer from this fixed-size-buffer model, calling it "a much
   larger change to the compositing/export/persistence model." This
   change is that deferred work, now back in scope per the user's
   explicit request: *"toggle was doing something. but not unpixelating.
   so when pixelating is off - image should look original."*

**The rendering pipeline this must fit into**, read fresh for this change:

- `LayerStack.composite()` (`js/layers.js`) returns one `ImageData`,
  exactly `width x height` (the canvas's fixed pixel dimensions), produced
  by `#compositeToCanvas()` → `#compositeSubset()`, which draws every
  visible layer in stack order onto one offscreen `<canvas>` via
  `putImageData`/`drawImage` with `globalAlpha`/`globalCompositeOperation`
  per layer.
- `CanvasView.render()` (`js/canvas-view.js`) does exactly one thing with
  that result: `this.#ctx.putImageData(this.#layerStack.composite(), 0,
  0)` onto a single `<canvas>` element whose **drawing buffer** (`.width`/
  `.height` attributes) is set to the layer stack's own `width`/`height`
  in `resetView()` — i.e. 16, 32, 64, or 128 device pixels, never more.
  Pan/zoom is applied entirely via a CSS `transform: translate(...)
  scale(...)` on that canvas element (`#applyTransform`), which also
  scales up its already-tiny pixel buffer with the browser's own (crisp,
  presumably `image-rendering: pixelated`) upscaling.
- This is the crux of why "just render the reference layer more smoothly
  into the same buffer" (the smoothing toggle's approach) cannot solve
  "looks original": **any** content written into that `width x height`
  buffer is irreversibly quantized to 16–128 pixels before the CSS
  transform ever touches it. There is no downscale filter that avoids
  this — the buffer itself is the bottleneck, not the filter. Showing a
  reference image at genuine original resolution requires it to bypass
  this buffer entirely for on-screen rendering.
- One existing precedent already does exactly this kind of bypass: the
  selection overlay (`#selectionOverlayEl`, a sibling `<div>` to the main
  canvas) is positioned/scaled with the *same* `#applyTransform` call as
  the canvas, so it tracks pan/zoom in lockstep without going through the
  pixel buffer at all. This change's design leans on that precedent.

## Goals / Non-Goals

**Goals:**
- A reference layer in "Original" mode renders on-screen at its true
  source resolution — no forced downscale to the canvas's fixed grid —
  while still visually respecting its position in the Layers panel's
  stacking order relative to drawing layers.
- Original-mode rendering stays aligned with the canvas through pan/zoom.
- Both modes (Pixelated, Original) remain available as a per-layer toggle,
  re-deriving from the same stored source image, matching the existing
  smoothing toggle's re-fit-in-place pattern.
- Export, thumbnails, non-drawability, deletion, and the Background
  position-lock rule are unaffected — all already correct today and
  orthogonal to this change.
- Mode switching is undoable.
- Decide and record: default mode for a new upload; persistence scope for
  the original-resolution source; interaction with merge (confirm only).

**Non-Goals:**
- Editing the reference image after upload (crop/reposition/etc.) —
  unchanged from `reference-image-layer`'s existing non-goal.
- Multiple reference layers per canvas — unchanged, still capped at one.
- Including the reference layer in export/thumbnails in either mode —
  explicitly still excluded, unconditionally, in both modes.
- General "vector layer" or non-raster layer support beyond this one
  special-cased layer kind.
- A pixel-perfect guarantee that Original-mode rendering is pixel-
  identical across every browser's canvas-scaling implementation — "looks
  original" is a visual-fidelity goal, not a byte-exact one (no export
  path exists for Original mode anyway, so byte-exactness has no
  observable consequence).

## The core decision: how an Original-mode reference layer is represented and rendered

### Approach A — Reference layer exits `LayerStack`'s uniform-buffer model, becomes a parallel top-level concept

`LayerStack` drops the reference layer from `#layers` entirely. In its
place, `LayerStack` holds a single nullable `#referenceImage` object
(`{ image, mode, visible, opacity, blendMode, name, positionIndex }`),
where `positionIndex` is a conceptual insertion point among the drawing
layers (0..layers.length), maintained independently.

To make this render/reorder/persist correctly, every list-shaped operation
that today iterates `#layers` needs a second, parallel implementation (or
a merge step) for the reference object: the Layers panel's row list
(`getLayers()` today returns exactly `#layers`), `moveLayerUp`/
`moveLayerDown`'s swap logic (now needs to handle "swap across the
reference's positionIndex" as an index adjustment, not an array splice),
`snapshot`/`restore` (a new top-level field, not "one more layer entry"),
and `toProjectRecord`/`fromProjectRecord` (same). Compositing generalizes
naturally, though: stack order becomes "layers before positionIndex,
composited; the reference (if Original mode) rendered as a native-res
overlay; layers from positionIndex onward, composited" — the same
below/overlay/above split Approach B also needs (see below).

**Rejected.** This is exactly the shape of change `reference-image-layer/
design.md` called out and deferred as too large — not because the
rendering math is harder (it isn't; both approaches need the same split,
see below), but because it pays a broad tax of duplicating list/reorder/
undo/persistence machinery that today already works correctly for the
reference layer *because* it is just a `Layer` with two boolean flags.
Every one of those existing, tested code paths (position-lock swap
guards, snapshot/restore, `toProjectRecord`/`fromProjectRecord`, the
8-layer cap, the "only one reference layer" cap) would need a parallel
reference-aware branch instead of continuing to work unmodified. That tax
buys nothing here: the actual new capability (rendering at native
resolution) lives entirely in the render path, not in list/reorder/
persistence, so a design that also disturbs list/reorder/persistence is
solving problems that don't need solving.

### Approach B — Reference layer stays a `Layer` in `LayerStack`; only the render *output* becomes mode-aware (recommended)

Keep the reference layer exactly where it is today: `#layers[i]`, an
ordinary array element, reorderable/deletable/undoable/persistable through
every existing code path unchanged. Add:

- `Layer.referenceMode: 'pixelated' | 'original'` (meaningful only when
  `isReferenceImage`; irrelevant/unused otherwise). Default `'pixelated'`
  on the `Layer` class itself (matches every other layer's implicit
  default of "nothing special"), but see "Default mode" below for what
  the *upload flow* actually sets on a fresh reference layer.
- `Layer.originalImage: ImageBitmap | null` — the decoded, full-resolution
  source, held on the `Layer` object itself (not module-scope in
  `workspace.js`, unlike today's `referenceImageSourceImage` — see
  "Persistence" for why this needs to survive the object, not just the
  session).
- `Layer.engine` (the existing fixed-size pixel buffer) **keeps being
  populated via the existing `fitImageToCanvas` pixelated-fit path,
  unconditionally, regardless of `referenceMode`.** This is a deliberate
  choice, not dead weight: it's the existing render output already
  excluded from export (so its content is never observably wrong in
  Original mode — export excludes the reference layer either way), it's
  what `snapshot`/`restore` and `toProjectRecord`/`fromProjectRecord`
  already move around with zero changes to those methods' logic, and it
  serves as an instant-paint fallback while the true original decodes
  (see "Persistence"/"Loading" below) or if the original is ever
  unavailable (e.g. a corrupted/oversized stored Blob). In short: the
  engine buffer's job changes from "the only representation" to "the
  fallback/undo/persistence representation"; nothing about how it's
  produced changes.

**Rendering.** `LayerStack.composite()`'s single-`ImageData` contract
cannot express "an overlay sandwiched between two rasters," so on-screen
rendering needs a new method, `LayerStack.getRenderPlan()`, returning an
ordered array of segments instead of one `ImageData`:

- If there is no reference layer, or its `referenceMode` is `'pixelated'`,
  the plan is `[{ type: 'raster', imageData: <same as composite() today> }]`
  — a single segment, so this is the exact same output as today for every
  canvas that has no reference layer or has one still in Pixelated mode.
  `composite()` itself is kept as a thin wrapper (`getRenderPlan()[0]
  .imageData` for the single-segment case) so nothing else that calls
  `composite()` today (e.g. any test, or `js/workspace.js`'s merge-mark
  preview) needs to change.
- If the reference layer is in `'original'` mode, the plan splits into up
  to three segments in stack order: `{ type: 'raster', imageData }` for
  the visible layers below the reference's stack index (skipped entirely
  if there are none), `{ type: 'reference-original', image, opacity,
  blendMode }` for the reference layer itself (skipped if hidden — the
  visibility toggle still works exactly as today), and another `{ type:
  'raster', imageData }` for the layers above it. This reuses
  `#compositeSubset(indices)` twice (once per raster segment, over the
  index ranges below/above the reference) — no new compositing math, just
  calling the existing private method with two different index ranges
  instead of one.

**`CanvasView` changes.** `render()` stops assuming exactly one canvas
layer. It maintains a small pool of sibling elements layered via DOM
order/`z-index` — a `<canvas>` per `raster` segment (same fixed-size
buffer + `putImageData` as today, reused/resized only if the plan's
segment count changes) and a plain `<canvas>` (or `<img>`) per
`reference-original` segment, **sized to the element's own natural/
original dimensions and positioned via CSS, not written to at engine
resolution** — its content comes from a single `drawImage(originalImage,
0, 0)` at 1:1, so the browser's own image data is never downsampled by
Pixi at all; scaling to on-screen size happens later, in the same CSS
transform step every other layer already goes through, so the browser's
own smooth bitmap scaling (not Pixi's `imageSmoothingEnabled`/nearest-
neighbor choice) produces the final on-screen size. `#applyTransform`
already generalizes to "apply the same `translate/scale` to every sibling
element that needs to track the viewport" (it already does this for the
selection overlay); this change just adds the reference-original
element(s) to that same loop. Because the reference element sits in DOM
order between the below-raster canvas and the above-raster canvas (when
both exist), stacking order is correct by construction — no z-index
arithmetic needed beyond "append in plan order."

One wrinkle: the reference-original element's on-screen *size* must equal
the visual size of the drawing canvas at the current zoom (`width *
baseScale * scale` CSS pixels, matching `resetView()`'s existing
`canvasEl.style.width` math), not the *image's* natural pixel size — the
image is centered/contained within that box (same "contain" fit
`fitImageToCanvas` already uses for Pixelated mode, just expressed in CSS
box terms instead of a downscaled buffer, e.g. `object-fit: contain` on
an `<img>`, or equivalent `drawImage` math on a `<canvas>`). This is what
makes the two modes visually comparable (same footprint on the canvas)
while only Original mode skips the resolution loss.

**Recommendation: Approach B.** It confines every new concept (mode flag,
original-resolution source, multi-segment render plan) to the one place
that actually needs to change — on-screen rendering — while leaving
reorder, undo/redo, deletion, the 8-layer cap, the one-reference-layer
cap, and persistence's existing per-layer record shape completely
unmodified (they already treat the reference layer as "a `Layer` with
flags," and continue to). Approach A's extra generality (a true first-
class non-layer concept) buys nothing here since every list operation
Approach A would need to re-implement in parallel, Approach B gets for
free by staying inside the array.

## Decisions

### Default mode for a new upload: Original (changed from today's implicit Pixelated)
Today's upload flow has no explicit mode — it always pixelates. This
change makes the mode explicit and flips the default to Original.
Reasoning: the entire motivation for this change is that pixelated mode
was, per direct user feedback, not serving the trace-guide use case
("should look original"); a trace guide is the primary reason a user
uploads a reference image at all (this feature exists for the tracing
workflow specifically — see `reference-image-layer/proposal.md`'s "Why"),
and Original mode is now cheap to view (no meaningful visual downside).
Pixelated mode remains one toggle click away for a user who specifically
wants to preview how their source would look forced onto the grid, or who
is on a very large image / storage-constrained project (see "Persistence"
scope note below) and wants to avoid retaining a full-resolution Blob.

### Mode toggle UI: replaces the existing smoothing toggle button, doesn't add a second control
The existing single icon button (`blur_on`/`blur_off`, toggling
`referenceImageSmoothing`) becomes a mode selector with three effective
states reachable via two controls to avoid a confusing tri-state single
button:
- A primary toggle: **Pixelated / Original** (the mode itself).
- A secondary control, visible/enabled only while mode is Pixelated: the
  existing smoothed/unsmoothed choice, unchanged in every respect
  (reuses `fitImageToCanvas`'s existing `smooth` parameter, unchanged
  code).
This mirrors how the smoothing toggle was itself a sub-choice under "the
image had to be downscaled somehow" — Original mode makes that whole
question moot for as long as it's active, so hiding (not just disabling)
the smoothed/unsmoothed control while in Original mode avoids exposing a
setting with no observable effect.

### Persistence: store the original-resolution Blob, decode lazily on load
An Original-mode reference layer's fidelity depends on holding the actual
decoded source, not just its pixelated-fit buffer — and unlike a
same-size pixel buffer (already stored via `toProjectRecord`'s existing
`data` field for every layer, uncompressed RGBA at the canvas's tiny
fixed size), a full-resolution source image can be real storage weight
(a multi-megapixel photo import, for a feature capped at one such layer
per canvas). This is a genuine new persistence cost prior reference-layer
work didn't have.

**Decision:** `toProjectRecord()` gets a new, conditional field —
`referenceImageOriginal: Blob | null` — populated only when the layer's
`referenceMode` is `'original'` (a Pixelated-mode reference layer, or a
canvas with none, adds nothing new to the stored record, preserving
today's footprint for the common/unaffected case). The Blob is the
already-decoded-once source re-encoded losslessly, or — simpler and
avoiding a re-encode step — the *original uploaded `File`* itself is kept
as `Layer.originalSourceBlob` alongside `originalImage` (an `ImageBitmap`
can't be stored directly in IndexedDB/Dexie in a portable way, but the
`File`/`Blob` it was decoded from can). Dexie supports storing `Blob`
values directly in IndexedDB records, so no encoding step is needed here
beyond what the file input already produced.

`fromProjectRecord` is synchronous today; decoding a stored Blob back into
an `ImageBitmap` is inherently async (`createImageBitmap(blob)`). Rather
than making `fromProjectRecord` itself async (which would ripple into
every caller's control flow), the reconstructed `Layer` starts with
`originalImage: null` and its existing pixelated-fit `engine` buffer
intact (unconditionally populated per Approach B above, so there's always
something correct to show immediately). A new async
`LayerStack.hydrateReferenceOriginal()` — called once, right after
`fromProjectRecord`, by whatever code path already awaits the project
load (`js/persistence.js`/`js/workspace.js`'s project-open flow) — decodes
the stored Blob and attaches it to the reference layer's `originalImage`,
then triggers one re-render. Net effect: opening a saved project with an
Original-mode reference layer shows the Pixelated-fit fallback for one
frame, then swaps to true original resolution once decode resolves
(typically well under a video frame in practice, not a perceptible
flicker for realistic image sizes) — the same "instant paint, then
refine" pattern already implicit in the browser's own progressive image
decode, not a new UX pattern being introduced.

**Explicit scope limit:** no size cap or compression is added on the
stored Blob in this change — a user importing a very large source image
(e.g. tens of megabytes) stores it at that size in IndexedDB, same as the
browser's `File` object it came from. This is accepted as a known
limitation, not solved here, because: the feature is already capped to
one reference layer per canvas (bounding worst-case footprint to one
image, not N), IndexedDB's practical storage ceiling is large relative to
a single photo (browser-dependent, generally hundreds of MB to GB-scale
before user-visible quota prompts), and Pixelated mode remains available
as a zero-extra-storage fallback for a user who hits a real limit. A
future change can add a warning threshold or downscale-before-store
compromise if this proves insufficient in practice — not designed here.

### Undo/redo: mode toggle is undoable, same mechanism as the existing smoothing toggle
`LayerStack.setReferenceMode(mode)` (new method, parallel to
`updateReferenceImageData`) flips `referenceMode` on the reference layer
in place — position, name, opacity, visibility untouched — and
`js/workspace.js`'s mode-toggle button calls the same `commit()` helper
the existing smoothing toggle already calls after
`updateReferenceImageData`, pushing an undo snapshot. `snapshot()`/
`restore()` need `referenceMode` added to their per-layer serialized
fields, mirroring every existing `isBackground`/`isReferenceImage` line
in those methods (`originalImage`/`originalSourceBlob` are **not** part
of the in-memory undo snapshot — undo only needs to restore which mode
was active and the already-current `engine` buffer/held source, not
re-decode anything; toggling mode via undo re-uses whatever
`originalImage` is already held, same object, no re-fetch).

### Merge-layers interaction: unaffected, still excluded
`mergeLayers`/`mergeDown` already refuse whenever any target index is
`#isLocked` (`isBackground || isReferenceImage`), independent of any
render mode. This change adds no new field that check needs to consider
— a reference layer is excluded from merge in both Pixelated and Original
mode, unchanged. No design change needed here; noted per the task
instructions to confirm rather than silently assume.

### Export/thumbnail exclusion: unaffected, still unconditional
`toPNGBlob()`'s `excludeReferenceImage: true` filter in
`#compositeToCanvas` already drops any `isReferenceImage` layer
regardless of visibility; this change adds no branch there. Original
mode's `originalImage`/render-plan machinery is on-screen-only
(`getRenderPlan()`/`CanvasView`), never consulted by `toPNGBlob()`, so
there is no path by which Original-mode content could leak into an
export or thumbnail. Confirmed, not re-designed.

## Risks / Trade-offs

- [`CanvasView.render()` moves from "one canvas, one `putImageData`" to a
  variable-length pool of sibling elements, adding real complexity to a
  file whose whole design center today is a single small canvas + one CSS
  transform] → Mitigated by the segment count being small and bounded (at
  most 3: below-raster, reference, above-raster) and by reusing the exact
  transform logic (`#applyTransform`) already proven correct for the
  selection overlay sibling — this is one more sibling kind, not a new
  transform system.
- [Storing a full-resolution Blob per project with an Original-mode
  reference layer is unbounded storage growth with no cap in this change]
  → Accepted as a known, explicitly documented limitation (see
  "Persistence" above), bounded by the existing one-reference-layer-per-
  canvas cap; revisit if real usage shows it's a problem.
- [Flipping the default to Original changes behavior for every future
  upload, not just this feature's new capability — a user who liked
  today's implicit pixelated default gets a different first impression] →
  Mitigated by Pixelated remaining one toggle click away and by the
  default choice being directly responsive to the concrete user feedback
  that motivated this whole change (see "Default mode" above).
- [`fromProjectRecord`'s async hydration step means a reopened project's
  reference layer visibly changes appearance shortly after load (fallback
  → true original), a new "settling" visual behavior nothing else in the
  app currently has] → Accepted as the necessary consequence of keeping
  `fromProjectRecord` synchronous rather than an app-wide async-load
  refactor; scoped narrowly to this one field, and the fallback frame is
  never a blank/broken state (it's the correct Pixelated-fit rendering,
  just not yet Original).

## Open Questions

- Exact DOM/CSS mechanism for the reference-original element (a `<canvas>`
  drawn once via `drawImage`, vs. a plain `<img src="blob:...">` with
  `object-fit: contain`) — both satisfy this design's contract
  (positioned/scaled via the same `#applyTransform`, sized to the
  drawing-canvas's visual box, centered/contained); an `<img>` is simpler
  (no manual `drawImage` sizing math, browser handles `object-fit`
  natively) but a `<canvas>` keeps every layer-rendering code path in one
  primitive. Safe to resolve during implementation without revisiting
  specs/tasks.
- Whether `getRenderPlan()`'s raster segments should still apply
  `image-rendering: pixelated`-equivalent crisp scaling (yes, unchanged
  from today) while the reference-original element explicitly must NOT
  (smooth scaling is the entire point) — confirm the CSS rule that
  currently makes the main canvas crisp is scoped to a class/selector
  that naturally excludes the new sibling element, not applied via a
  blanket `canvas { image-rendering: pixelated }` that would need an
  explicit override. Implementation-detail, not a behavioral question.
- Precise wording of the mode-toggle control's disabled/hidden states
  (e.g. Original mode with no `originalImage` held after a reload, before
  `hydrateReferenceOriginal()` resolves — should the toggle be briefly
  disabled during that window, or is showing the Pixelated fallback with
  an already-"Original"-selected toggle acceptable?) — a UI polish detail
  resolvable during implementation.
