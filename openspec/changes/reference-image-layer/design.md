## Context

`js/layers.js`'s `Layer` class already has one boolean lock flag,
`isBackground`, set only at construction and read in three places:
`moveLayerUp`/`moveLayerDown` (reorder lock), `#compositeToCanvas`'s
`skipBackground` option (export-time opt-out), and `js/workspace.js`'s
Eraser special-case. Critically, `isBackground` does **not** make a layer
non-drawable — the Background layer is a fully normal drawing target
today; only its eraser behavior differs. This change needs a *new*,
stricter lock (non-drawable) that `isBackground` doesn't provide, so it
can't simply reuse `isBackground` as-is. See proposal.md for the "why";
this covers "how".

`js/image-import.js`'s `decodeImageFile(file)` already handles decode
(with an `<img>` fallback for formats `createImageBitmap` rejects, e.g.
SVG) and is shared by Brush Import (2m) and Color Library Import (2n).
Both existing consumers call `downsampleToImageData` afterward; this
change is the first consumer that must skip that step and use the
decoded image at native resolution instead.

## Goals / Non-Goals

**Goals:**
- Represent a locked layer *kind* distinct from the Background layer:
  non-drawable, unconditionally export-excluded, and (unlike Background)
  freely reorderable rather than position-locked - see "Position lock"
  below, revised 2026-08-18 after launch.
- Reuse `decodeImageFile` for decode; do not touch its downsample path.
- Keep the change additive to `js/layers.js`'s existing lock pattern
  rather than replacing `isBackground`.

**Non-Goals:**
- Tier gating (Standard/Pro) — explicitly out of scope, per proposal.md;
  no such mechanism exists in the codebase yet.
- Any editing of the reference image after upload beyond the smoothing
  toggle (crop, reposition, opacity-only-via-layer-opacity is fine since
  that's the existing Layer opacity mechanism, but no dedicated pan/zoom/
  re-fit UI is in scope here).
- Restoring resolution/detail lost to the fixed canvas size — the
  smoothing toggle (added 2026-08-18) changes how that loss looks, not
  how much of it there is; see its own decision section for the fuller
  fix that was considered and deferred.
- Supporting more than one reference image layer per canvas.
- Changing Brush Import (2m) or Color Library Import (2n) in any way.

## Decisions

### A new `layerKind`-style flag, not a reuse of `isBackground`
Add a second boolean, `isReferenceImage`, to `Layer` (parallel to
`isBackground`, not replacing it — a layer is never both). Two independent
booleans (rather than a single `kind: 'normal' | 'background' |
'reference'` enum) is a deliberate minimal-diff choice: every existing
`isBackground` check stays untouched (Background layer behavior is
unchanged by this proposal), and the new checks are additive call sites.
**Alternative considered**: a `kind` enum — cleaner long-term if a third
locked kind ever appears, but touches every existing `isBackground` call
site to switch on the enum instead of a plain boolean, for no behavioral
benefit today. Rejected in favor of the smaller diff; revisit if a third
kind is ever proposed.

### Non-drawable enforcement: refuse at `setActiveLayer`, not per-tool
`LayerStack.setActiveLayer(index)` refuses (no-ops, like today's
out-of-range check) when `this.#layers[index].isReferenceImage` is true.
Because every drawing tool already resolves its target through
`getActiveLayer()`, refusing activation is a single choke point that
makes per-tool checks unnecessary — a reference layer can simply never
become `#activeIndex`, so `pencilOrEraserApplyPixel` and friends never see
it. **Alternative considered**: leave activation alone and instead check
`isReferenceImage` inside every draw op (mirroring the Eraser's
`isBackground` check) — rejected as more call sites for the same
guarantee, and it would leave a confusing state where the Layers panel
shows a layer as "active" while nothing you draw affects it.

Layers panel row click handler (`buildLayerRow` in `js/workspace.js`):
clicking a reference image layer's row is a no-op for active-layer
purposes (selection state doesn't change), consistent with
`setActiveLayer` refusing it. The row still shows its visibility toggle,
lock icon, and delete control — those aren't activation.

### Position lock: Background only, not the reference layer (revised 2026-08-18)
**Superseded decision, kept for history:** the original design reorder-
locked the reference layer the same way as Background, extending
`moveLayerUp`/`moveLayerDown`'s existing `isBackground` OR-guard to also
check `isReferenceImage`. Live testing immediately after launch showed
this was wrong in practice: `addReferenceImageLayer` always inserts at
the top of the stack, and with no way to move it, it permanently sat
above every drawing layer at full opacity — the user could draw, but
could never see the result underneath it. An opacity-based fix (default
the reference layer to ~50% opacity) was considered and explicitly
rejected in favor of letting the user reorder it instead, since that
solves the problem directly (draw on a layer positioned above the
reference, exactly the trace-over workflow this feature is for) without
an automatic opacity change nobody asked for.

**Current decision:** split the single `#isLocked` concept into two:
- `#isPositionLocked(layer)` → `layer.isBackground` only. Used by
  `moveLayerUp`/`moveLayerDown` (and the matching UI disabled-state logic
  in `buildLayerRow`) — the reference layer is excluded from this check,
  so it moves like a regular layer, including swapping with regular
  layers on either side. The only remaining restriction is Background's:
  a swap that would relocate Background out of its slot is still refused,
  same rationale as before (a swap moves both layers, so a regular layer
  or the reference layer swapping into Background's slot would relocate
  it just as much as moving it directly would).
- `#isLocked(layer)` → unchanged, still `isBackground || isReferenceImage`.
  Still used by `setActiveLayer` (indirectly, via its own
  `isReferenceImage` check), `mergeLayers`/`mergeDown`, and
  `computeLayerMarkState` (`js/workspace.js`) — the reference layer stays
  non-drawable, non-mergeable, and non-markable regardless of where it
  sits in the stack. Only its *position* lock was removed.

`addReferenceImageLayer` still inserts at the top of the stack by
default (unchanged) — the fix is that the user can now move it from
there, not a change to where it starts.

### Export exclusion: unconditional, not an opt-in override
`#compositeToCanvas` gets a new, unconditional filter step —
`if (layer.isReferenceImage) continue;` — applied regardless of the
`skipBackground` option's value, before or after that check (order
doesn't matter since they target different layers). This differs from
`skipBackground`, which is an opt-in override the Export popover's toggle
controls; there is no equivalent toggle for reference layers because
proposal.md requires unconditional exclusion. Visibility (`layer.visible`)
is still honored for on-screen rendering (a separate, non-export
compositing call site — confirm whether `#compositeToCanvas` is shared
between on-screen render and export, or whether on-screen rendering has
its own path; if shared, the on-screen path must NOT apply the new
reference-image filter, only the export path should — see Open Questions).

### Seeding pixel data from a decoded image: draw-and-read, not per-pixel copy
Add a new `Layer` construction path (e.g. a factory function
`createReferenceImageLayer(image, width, height)` alongside the `Layer`
class, or a static method) that:
1. Creates a `Layer` sized to the canvas's own `width`/`height` (matching
   every other layer's engine buffer size — layers must stay uniform for
   compositing to work) with `isReferenceImage = true`.
2. Draws the decoded image (from `decodeImageFile`) onto an offscreen
   canvas sized to the *layer's* width/height, using the same
   `drawImage`-based approach `downsampleToImageData` already uses, but
   **only when the source image is larger than the canvas** — if it's
   smaller or equal, draw it at 1:1 (no smoothing/scaling) so "full
   fidelity" isn't violated by unnecessary interpolation. When the source
   exceeds the canvas dimensions, scale it down to fit (contain, not
   crop, centered) with image smoothing on — some scaling is unavoidable
   since the reference must fit within the fixed canvas dimensions
   (16/32/64/128px) to composite alongside other layers, but this is
   still categorically different from Brush/Color-Library's *intentional*
   pixelation/quantization: it is fit-to-canvas only, not palette or
   resolution reduction beyond what's needed to fit.
3. Reads the resulting `ImageData` and writes it into the new layer's
   `PixelEngine` buffer directly (`putImageData`-equivalent), not through
   `setPixelBlended` per pixel — same performance rationale as
   `downsampleToImageData`.

This resolves an internal tension in the proposal: "kept at original
fidelity... no downsampling" cannot be taken completely literally for a
source image larger than the fixed canvas size, since every layer must
match the canvas's exact pixel dimensions. The design's reading of
"fidelity" is: *no pixelation/quantization for stylistic reasons* (unlike
2m/2n's deliberate low-res/low-color output), while still fitting-to-frame
when the source is larger — this is the same "no unnecessary loss"
standard, not zero scaling ever. Recorded here as a resolved assumption,
not left open, since it changes acceptance criteria; see Open Questions
below for the one piece still genuinely deferrable (upload UI details).

### Smoothing toggle (added 2026-08-18, post-launch follow-up)
Live testing surfaced that the "fit-to-canvas" tension above has a real
visible cost the original design underestimated: on a 16-128px canvas,
smoothing a detailed source image down to fit averages away nearly all
of its detail into flat color regions, which the user described as the
result looking "vectorized." This doesn't restore lost resolution (still
out of scope — see below), but gives the user a choice in how that loss
looks, which was judged worth the small added surface.

**Two approaches were considered:**
- **Decouple the reference layer from the pixel grid entirely** (keep it
  at original resolution, rendered as a smooth overlay independent of
  `LayerStack`'s fixed-size buffer, closer to how Aseprite/Procreate's
  reference layers work) — the more complete fix, since it would actually
  restore detail rather than just changing how the loss looks. **Rejected
  for this change**: it stops the reference layer from being a normal
  `LayerStack` layer, a much larger change to the compositing/export/
  persistence model this proposal already established. Left as a
  possible future change if the smaller fix here proves insufficient.
- **Keep it a `LayerStack` layer, add a smoothing on/off toggle** —
  chosen. `js/image-import.js`'s `fitImageToCanvas(image, width, height,
  smooth = true)` gains a `smooth` parameter controlling
  `ctx.imageSmoothingEnabled` during the downscale (only relevant when
  the source is larger than the canvas — at 1:1 there's nothing to
  smooth either way). `off` nearest-neighbor-samples instead of
  averaging: blockier, no blending, but loses exactly the same amount of
  real detail to the tiny target resolution — this changes how the loss
  looks, not how much there is.

**Implementation:**
- `LayerStack.updateReferenceImageData(pixelData)`: overwrites the
  existing reference layer's pixel buffer in place (position, name, id
  untouched) — used to re-fit without re-adding the layer.
- `js/workspace.js` keeps the decoded source image at module scope
  (`referenceImageSourceImage`) alongside the current setting
  (`referenceImageSmoothing`, default `true`), the same "keep the source
  around so a later setting change can re-derive from it" pattern
  `brushEditorSourceImage` already uses for the Brush editor's W/H
  changes. A toggle button in the reference layer's row (`buildLayerRow`)
  flips the setting, re-runs `fitImageToCanvas` from the stored source,
  and calls `updateReferenceImageData`. Disabled when no source is held
  (page reload, or after the reference layer was deleted) since there's
  nothing to re-fit from without re-uploading — matching the Brush
  editor's same limitation, not a new one.
- Both module-level variables reset to `null`/`true` in `initWorkspace`
  (new/switched project) and whenever the reference layer is deleted (a
  later fresh upload shouldn't silently inherit a deleted layer's source
  or setting).
- `index.html`'s Material Symbols `icon_names` subset gets `blur_on`/
  `blur_off` added (alphabetical, per its own comment) — the toggle's
  icon. Missing icon names previously broke rendering entirely (see
  `openspec/roadmap.md`'s UI-polish-pass history on the `image` icon), so
  this was checked proactively rather than discovered as a second bug.

### Upload entry point
"Add reference image" is a new button in the Layers panel toolbar
(alongside the existing Add/Delete controls), opening a hidden
`<input type="file" accept="image/*">` — the same pattern Brush Import
and Color Library Import already use for file pickers. Disabled once a
reference image layer already exists on the canvas (see the "Only one
reference image layer per canvas" scenario) — chosen over a
replace-existing flow because it's simpler and matches this change's
scope; a "replace reference image" affordance can be a later, separate
enhancement if requested.

### Thumbnails also exclude the reference layer (post-review addendum)
`toPNGBlob`'s reference-layer exclusion (see "Export exclusion" above) is
unconditional on the method itself, not scoped to the Export popover's
call site — so gallery/project thumbnails (`js/workspace.js`'s
`autoSave`, `js/new-canvas.js`), which also call `toPNGBlob()` with no
options, never show the reference layer either. This is a deliberate
side effect, confirmed during code review: a thumbnail is a preview of
the finished artwork, closer in spirit to an export than to the live
on-screen canvas (which still shows a visible reference layer via
`composite()`), so this is the more useful default even though the
`export` capability spec's own scenarios only constrain actual
downloaded export files, not thumbnails.

### Persistence
`toProjectRecord`/`fromProjectRecord` and the snapshot/restore paths
(`js/layers.js` lines ~160–270) already serialize each layer's full pixel
buffer plus `isBackground`; add `isReferenceImage` to the same serialized
fields and the same reconstruction call sites (mirroring every existing
`isBackground` line in those methods). No schema versioning concern since
a missing field on load simply defaults falsy, same as `isBackground`
already does per its own code comment.

## Risks / Trade-offs

- [Two independent lock booleans could drift if a third locked-layer kind
  is ever added, each requiring its own OR-clause at every call site] →
  Acceptable at 2 kinds; revisit as a `kind` enum refactor if a third
  appears (see Decisions).
- [Fit-to-canvas scaling for oversized source images is a form of
  resolution loss, which could read as contradicting "kept at original
  fidelity" in the roadmap/proposal wording] → Mitigated by scoping
  "fidelity" precisely in this doc (no pixelation/quantization, scaling
  only to fit the fixed canvas) and calling out the distinction from
  2m/2n explicitly in both the proposal and the spec's scenario language.
  **Materialized in practice** (2026-08-18): a detailed source image on a
  small canvas visibly reads as "vectorized" after the smoothed downscale
  - confirmed by live testing, not just a theoretical risk. Partially
  addressed by the smoothing toggle (see its own decision section); full
  resolution restoration remains out of scope (Non-Goals).
- [Large source images decoded via `decodeViaImgElement`'s SVG fallback
  path have no explicit intrinsic size (150×150 default) if the SVG lacks
  width/height/viewBox] → Same known limitation `image-import.js` already
  documents for 2m/2n; this change inherits it, unchanged, no new
  mitigation needed since every consumer already accepts it.
- [Reference-locking the layer to the top of the stack with no way to
  move it made it permanently occlude the canvas at full opacity] →
  **Materialized in practice** (2026-08-18): confirmed by live testing
  immediately after launch. Fixed by making the reference layer
  reorderable (see "Position lock" decision) rather than adjusting
  opacity automatically.

## Open Questions

- Does `#compositeToCanvas` (or an equivalent) serve both on-screen
  rendering and export, or are they already separate call sites in
  `js/workspace.js` vs. `js/layers.js`? If shared, the implementation
  needs a second filter parameter (e.g. `excludeReferenceImage`) so
  on-screen rendering still shows a visible reference layer while export
  never does — this doesn't change the spec's observable behavior, just
  which existing method needs a new parameter vs. a new method. Safe to
  resolve during implementation without revisiting specs/tasks.
- Exact wording/placement of the "Add reference image" control and
  whether it's disabled or hidden once a reference layer exists (both
  satisfy the spec's "Only one reference image layer" scenario) — a UI
  polish detail, not a behavioral one.
