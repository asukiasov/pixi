## 1. Layer model (`js/layers.js`)

- [x] 1.1 Add `referenceMode: 'pixelated' | 'original'` to `Layer`
      (meaningful only when `isReferenceImage`); add `originalSourceBlob`
      (`Blob | null`) — **deviation from design.md**: no separate
      `originalImage: ImageBitmap` field was added. On-screen rendering
      (see 3.2) renders via an `<img>` sourced from a `blob:` object URL
      derived directly from `originalSourceBlob`, so an `ImageBitmap`
      was never needed for rendering purposes; this also removed the
      need for 1.9/2.2's async hydration step (see there).
- [x] 1.2 Keep the existing `engine` pixel buffer populated via the
      current `fitImageToCanvas` pixelated-fit path unconditionally,
      regardless of `referenceMode` — it remains the export/thumbnail/
      undo/persistence fallback representation (no behavior change to
      how it's produced)
- [x] 1.3 `LayerStack.getRenderPlan()`: new method returning an ordered
      array of `{ type: 'raster', imageData }` / `{ type:
      'reference-original', layer }` segments per design.md's
      "Rendering" section — single-segment output when there is no
      reference layer, it's in Pixelated mode, it's hidden, or (per code
      review) it has no `originalSourceBlob` to render from; up to three
      segments (below-raster / reference / above-raster) when it's
      visible, in Original mode, and has a source, reusing
      `#compositeSubset` over split index ranges
- [x] 1.4 `LayerStack.composite()` — **deviation from design.md**: left
      completely untouched (not turned into a wrapper around
      `getRenderPlan()`). `getRenderPlan()`'s non-split path calls
      `composite()` instead, the reverse of what design.md proposed —
      functionally equivalent (every existing caller of `composite()` is
      provably unaffected since the method itself never changed) and a
      smaller diff.
- [x] 1.5 `LayerStack.setReferenceMode(mode)`: new method, flips
      `referenceMode` on the reference layer in place (position, name,
      opacity, visibility untouched); refuses (no-op) if there is no
      reference layer or `mode` is invalid
- [x] 1.6 `snapshot()`/`restore()`: add `referenceMode` **and
      `originalSourceBlob`** to the serialized per-layer fields —
      **deviation from design.md**, which said the Blob should NOT be
      part of the undo snapshot. In practice `restore()` rebuilds fresh
      `Layer` instances discarding anything not captured in the
      snapshot, so omitting it would silently lose Original-mode
      rendering on every undo/redo step touching that layer. Included it
      (a cheap reference copy, not a clone) so undo/redo actually
      preserves rendering, matching the "mode toggle is undoable"
      requirement in practice, not just for the mode flag alone.
- [x] 1.7 `toProjectRecord()`: add `referenceMode` and
      `originalSourceBlob` to the per-layer record (per-layer, not a
      separate top-level field — simpler, mirrors every other per-layer
      field) — `null` for a Pixelated-mode layer, so it adds no extra
      stored data vs. before this change
- [x] 1.8 `fromProjectRecord()`: reconstruct `referenceMode` (default
      `'pixelated'`) and `originalSourceBlob` (default `null`) for
      records saved before these fields existed, same falsy-default
      pattern as `isBackground`/`isReferenceImage`
- [x] 1.9 ~~`LayerStack.hydrateReferenceOriginal()`~~ — **not
      implemented; not needed.** Since rendering only ever needs a
      `blob:` object URL (synchronous `URL.createObjectURL`), not a
      decoded `ImageBitmap`, `fromProjectRecord()`'s reconstructed
      `originalSourceBlob` is immediately usable by `CanvasView.render()`
      with no async decode step, no fallback-then-swap flicker, and no
      project-open-flow wiring. Verified via Playwright: reloading a
      project with an Original-mode reference layer shows it correctly
      on the very first render after load.

## 2. Persistence wiring (`js/persistence.js` and/or Dexie schema)

- [x] 2.1 Confirm Dexie can store the new `Blob` field directly — no
      code change needed: `db.projects`'s existing schema (`'id,
      updatedAt'`) only declares indexed fields, and IndexedDB/Dexie
      already store arbitrary structured-clone-able values (including
      nested `Blob`s) in a record without a schema version bump.
      Confirmed via Playwright (upload → reload → still renders).
- [x] 2.2 ~~Project-open flow: `hydrateReferenceOriginal()`~~ — not
      needed, see 1.9. No changes to `js/app.js`/`js/persistence.js`
      were required.
- [x] 2.3 Confirmed no change needed to autosave/thumbnail generation
      paths (`toPNGBlob()` unaffected — untouched by this change; export
      of a project with only a hidden/visible Original-mode reference
      layer verified transparent/excluded via Playwright)

## 3. On-screen rendering (`js/canvas-view.js`)

- [x] 3.1 `render()`: consumes `getRenderPlan()`, distributing its
      segments across three fixed sibling elements (`#canvasEl` for the
      below-raster/single-raster case, `#referenceImgEl` for the
      reference segment, `#aboveCanvasEl` for the above-raster segment)
      rather than a dynamically-sized pool — simpler given the plan is
      capped at 3 segments in a known shape
- [x] 3.2 Reference-original element: implemented as an `<img>` with
      `object-fit: contain`, sourced from a cached `blob:` object URL
      derived from `originalSourceBlob` (regenerated only when the Blob
      reference changes, and revoked when the segment disappears — see
      code review fix), sized to the drawing canvas's own CSS box
- [x] 3.3 `#applyTransform`: extended to loop over
      `[canvasEl, aboveCanvasEl, referenceImgEl, selectionOverlayEl]`
- [x] 3.4 CSS: raster segments (`#workspace-canvas`,
      `.workspace-canvas-above-layer`) keep `image-rendering: pixelated`;
      `.reference-original-overlay` does not (default/smooth). Also
      added `isolation: isolate` on `.canvas-container` per code review,
      since the reference overlay's blend mode uses CSS
      `mix-blend-mode`, which without isolation blends against the
      containing stacking context rather than just its DOM siblings.

## 4. Layers panel UI (`js/workspace.js`)

- [x] 4.1 Reference layer row: added a `.layer-reference-mode-toggle`
      button (Pixelated/Original); the existing smoothed/unsmoothed
      control is now only rendered (not just enabled) while mode is
      Pixelated
- [x] 4.2 Upload flow: new reference layer uploads default to
      `referenceMode: 'original'`, passing the raw uploaded `File`
      (a `Blob`) as `originalSourceBlob`; `decodeImageFile` usage for
      the pixelated-fit engine buffer is unchanged
- [x] 4.3 Mode toggle click handler: calls `setReferenceMode`,
      `canvasView.render()`, `commit()` (undo), `renderLayersPanel()`
- [x] 4.4 No separate reset/cleanup needed beyond what already existed:
      mode/source now live on the `Layer` object itself (discarded
      naturally when the layer is deleted), not module scope, so there
      was nothing new to reset in `initWorkspace`/the delete handler.

## 5. Tests

- [x] 5.1 Unit tests (`test/layers.test.js`, DOM-free): added for
      `addReferenceImageLayer`'s new options, `setReferenceMode`
      (success/refusal/invalid-mode/no-layer), snapshot/restore
      round-trip (including an explicit undo-after-toggle test),
      `toProjectRecord`/`fromProjectRecord` round-trip (including the
      "Pixelated stores no Blob" and "missing field defaults to
      pixelated" cases), resize/rotate90 preservation. **Gap** (flagged
      in code review, not closed by this change): `getRenderPlan()`'s
      actual segment-splitting logic has no automated coverage — it
      requires a DOM/canvas, which this repo's `node --test` harness
      doesn't provide (the same pre-existing boundary `composite()`/
      `toPNGBlob()`/`mergeLayers()`'s pixel-output already have). Covered
      only by manual Playwright verification below.
- [x] 5.2 Manual Playwright verification (this repo has no committed
      Playwright suite/config to add to — confirmed via search): a fresh
      upload defaults to Original mode and visibly shows the true
      un-pixelated source (screenshot-verified); toggling to Pixelated
      shows the existing blocky fit-to-grid behavior and back
      (screenshot-verified); moving the reference layer above vs. below
      a drawing layer in the panel visibly changes on-screen stacking in
      Original mode (screenshot-verified, including catching and fixing
      a DOM-append-order bug); exported PNG excludes the reference layer
      in Original mode; reloading a project with an Original-mode
      reference layer restores it with no re-upload and no visible
      flicker.
- [x] 5.3 Undo/redo test: `test/layers.test.js`'s "undo (restore) after
      a mode toggle brings back the prior mode" covers this at the
      `LayerStack` level (mode + source both restored).

## 6. Spec/doc sync

- [x] 6.1 `openspec validate --change
      reference-image-original-resolution --strict` passes
- [x] 6.2 `openspec/roadmap.md` updated: added a note under the
      `reference-image-layer` "Not yet scheduled" entry describing the
      Pixelated/Original toggle superseding the smoothing toggle, and
      pointing at this change.
