## 1. Layer model (`js/layers.js`)

- [ ] 1.1 Add `referenceMode: 'pixelated' | 'original'` to `Layer`
      (meaningful only when `isReferenceImage`); add `originalImage`
      (`ImageBitmap | null`) and `originalSourceBlob` (`Blob | null`) —
      per design.md's Approach B
- [ ] 1.2 Keep the existing `engine` pixel buffer populated via the
      current `fitImageToCanvas` pixelated-fit path unconditionally,
      regardless of `referenceMode` — it remains the export/thumbnail/
      undo/persistence fallback representation (no behavior change to
      how it's produced)
- [ ] 1.3 `LayerStack.getRenderPlan()`: new method returning an ordered
      array of `{ type: 'raster', imageData }` / `{ type:
      'reference-original', image, opacity, blendMode }` segments per
      design.md's "Rendering" section — single-segment output when there
      is no reference layer or it's in Pixelated mode, up to three
      segments (below-raster / reference / above-raster) when it's in
      Original mode, reusing `#compositeSubset` over split index ranges
- [ ] 1.4 `LayerStack.composite()`: keep as a thin wrapper delegating to
      `getRenderPlan()`'s single-segment case, so existing callers
      (tests, `js/workspace.js`'s merge-mark preview) are unaffected when
      no Original-mode reference layer is present
- [ ] 1.5 `LayerStack.setReferenceMode(mode)`: new method, flips
      `referenceMode` on the reference layer in place (position, name,
      opacity, visibility untouched); refuses (no-op) if there is no
      reference layer
- [ ] 1.6 `snapshot()`/`restore()`: add `referenceMode` to the serialized
      per-layer fields, mirroring the existing `isBackground`/
      `isReferenceImage` lines (`originalImage`/`originalSourceBlob` are
      NOT part of the in-memory undo snapshot — see design.md)
- [ ] 1.7 `toProjectRecord()`: add `referenceMode` to the per-layer
      record, and a top-level (or per-layer) `referenceImageOriginal:
      Blob | null` field populated only when `referenceMode ===
      'original'`
- [ ] 1.8 `fromProjectRecord()`: reconstruct `referenceMode` (default
      `'pixelated'` for records saved before this field existed, same
      falsy-default pattern as `isBackground`/`isReferenceImage`); leave
      `originalImage` as `null` initially (async hydration, see 1.9)
- [ ] 1.9 `LayerStack.hydrateReferenceOriginal()`: new async method,
      decodes a stored `referenceImageOriginal` Blob via
      `createImageBitmap()` and attaches it to the reference layer's
      `originalImage`; no-ops if there's no reference layer or no stored
      Blob

## 2. Persistence wiring (`js/persistence.js` and/or Dexie schema)

- [ ] 2.1 Confirm Dexie can store the new `Blob` field directly (per
      design.md, no encoding step needed) — add/adjust schema as needed
- [ ] 2.2 Project-open flow: after `fromProjectRecord()` resolves,
      `await`/call `hydrateReferenceOriginal()` once, then trigger one
      re-render — per design.md's "fallback, then swap to true original"
      sequencing
- [ ] 2.3 Confirm no change needed to autosave/thumbnail generation paths
      (`toPNGBlob()` unaffected — see design.md's "Export/thumbnail
      exclusion: unaffected" decision)

## 3. On-screen rendering (`js/canvas-view.js`)

- [ ] 3.1 `render()`: consume `getRenderPlan()` instead of `composite()`
      directly; maintain a small pool of sibling elements (raster
      `<canvas>`(es) + a reference-original element) matching the current
      plan's segment count and order
- [ ] 3.2 Reference-original element: draw/size per design.md's
      "Rendering" section — 1:1 `drawImage` (or `<img>` `object-fit:
      contain`) from `originalImage`, positioned/sized to the drawing
      canvas's visual box (contain, centered), with smooth (not
      pixelated) scaling
- [ ] 3.3 `#applyTransform`: extend the existing sibling-transform loop
      (already covers the selection overlay) to include the
      reference-original element(s), so Original-mode rendering tracks
      pan/zoom in lockstep — per design.md's pan/zoom requirement
- [ ] 3.4 Confirm/adjust CSS so raster segments keep crisp
      (`image-rendering: pixelated`-equivalent) scaling while the
      reference-original element explicitly does not (see design.md's
      Open Questions)

## 4. Layers panel UI (`js/workspace.js`)

- [ ] 4.1 Reference layer row: replace the existing single smoothing
      toggle button with a Pixelated/Original mode toggle, plus the
      existing smoothed/unsmoothed control shown only while mode is
      Pixelated — per design.md's "Mode toggle UI" decision
- [ ] 4.2 Upload flow: new reference layer uploads default to Original
      mode (`referenceMode = 'original'`); keep decoding via
      `decodeImageFile` unchanged, and additionally retain the original
      `File`/Blob (`originalSourceBlob`) and decoded `originalImage` on
      the new `Layer`
- [ ] 4.3 Mode toggle click handler: calls `setReferenceMode`, re-renders
      via the updated `CanvasView.render()`, and calls `commit()` for
      undo — matching the existing smoothing toggle's pattern
- [ ] 4.4 Reset/cleanup on reference layer deletion and project switch
      (`initWorkspace`): mirror the existing `referenceImageSourceImage`/
      `referenceImageSmoothing` reset, extended to the new mode/original-
      image state now living on the `Layer` rather than module scope

## 5. Tests

- [ ] 5.1 Unit tests (`test/layers.test.js`, DOM-free): `getRenderPlan()`
      segment counts/order for no-reference / Pixelated-mode-reference /
      Original-mode-reference-at-various-stack-positions; `composite()`
      still matches today's output for the single-segment cases;
      `setReferenceMode` refusal with no reference layer; snapshot/
      restore round-trip of `referenceMode`; `toProjectRecord`/
      `fromProjectRecord` round-trip of `referenceMode` and the
      conditional Blob field
- [ ] 5.2 Playwright/DOM tests: uploading defaults to Original mode and
      visibly shows un-downscaled content; toggling to Pixelated and back
      re-fits/restores correctly; reordering the reference layer above vs.
      below a drawing layer changes on-screen stacking in Original mode;
      pan/zoom keeps the reference image aligned; exported PNG/WebP/JPG
      still exclude the reference layer in Original mode; reloading a
      saved project with an Original-mode reference layer restores it
      (after the async hydrate) without re-upload
- [ ] 5.3 Undo/redo test: toggling mode, then Undo, restores the prior
      mode and rendering

## 6. Spec/doc sync

- [ ] 6.1 Confirm `openspec validate --change
      reference-image-original-resolution --strict` passes
- [ ] 6.2 After implementation, update `openspec/roadmap.md` if it
      references the reference image layer's smoothing toggle as a
      completed/final state
