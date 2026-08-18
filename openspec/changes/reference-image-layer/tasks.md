## 1. Layer model (`js/layers.js`)

- [x] 1.1 Add `isReferenceImage` flag to `Layer`, parallel to
      `isBackground` (never both true on the same layer)
- [x] 1.2 Add a construction path that seeds a new reference image
      layer's pixel buffer from a decoded image (draw-to-offscreen-canvas
      + read `ImageData`, per design.md's "Seeding pixel data" decision):
      1:1 when the source fits within the canvas dimensions, scaled to
      fit (contain, centered, smoothed) when larger
- [x] 1.3 `LayerStack`: add a method to add a reference image layer to the
      top of the stack (refuse if one already exists, per the "only one
      reference image layer" scenario, and refuse past the existing
      8-layer max)
- [x] 1.4 `setActiveLayer`: refuse (no-op) when the target index's layer
      has `isReferenceImage` true
- [x] 1.5 `moveLayerUp`/`moveLayerDown`: extend the existing
      `isBackground` OR-guards to also check `isReferenceImage` on both
      sides of each swap
- [x] 1.6 `#compositeToCanvas` (export path): always skip layers with
      `isReferenceImage` true, independent of `skipBackground` — confirm
      first whether this method is shared with on-screen rendering
      (design.md Open Question) and add a separate parameter/method split
      if so, so on-screen rendering still honors the layer's own
      visibility toggle
- [x] 1.7 Serialization: add `isReferenceImage` to `toProjectRecord`,
      `fromProjectRecord`, snapshot, and restore call sites, mirroring
      every existing `isBackground` line in those methods

## 2. Layers panel UI (`js/workspace.js`)

- [x] 2.1 Add an "Add reference image" control to the Layers panel
      toolbar, wired to a hidden `<input type="file" accept="image/*">`
      (same pattern as Brush Import / Color Library Import's pickers)
- [x] 2.2 Wire the file input's change handler: decode via
      `decodeImageFile` (from `js/image-import.js`), then call the new
      `LayerStack` method from 1.3; disable the control while a reference
      image layer already exists on the canvas
- [x] 2.3 `buildLayerRow`: show a lock icon for `isReferenceImage` layers
      (reusing/paralleling the existing Background lock-icon code and
      title text) and disable their move-up/move-down buttons
- [x] 2.4 Layer row click handler: clicking a reference image layer's row
      does not change the active layer (consistent with 1.4's refusal at
      the model layer — this is the UI-level no-op)
- [x] 2.5 Confirm delete and visibility-toggle controls work unchanged
      for a reference image layer (no special-casing needed there per
      design.md, beyond what 1.6/1.7 already cover)

## 3. Export exclusion verification (`js/export.js` or equivalent)

- [x] 3.1 Confirm export's PNG/WebP/JPG code paths all route through the
      `#compositeToCanvas` change in 1.6 (no separate compositing logic
      that would bypass the reference-image filter)
- [x] 3.2 Confirm the "Transparent background" toggle and every
      scale/format combination still exclude the reference image layer
      (per the export delta spec's "independent of other toggles"
      scenario)

## 4. Tests

- [x] 4.1 Unit tests (`js/layers.js`'s existing `node --test` suite, DOM-
      free parts): add-reference-layer refusal past one-per-canvas and
      past 8-layer max, `setActiveLayer` refusal, reorder-lock guards,
      serialization round-trip of `isReferenceImage`
- [x] 4.2 Playwright/DOM tests (matching this project's existing
      convention for canvas/compositing-dependent code, per
      `js/layers.js`'s and `js/image-import.js`'s top-of-file comments):
      upload flow adds a full-fidelity reference layer, lock icon +
      disabled reorder controls render, clicking the row doesn't change
      the active layer, exported PNG/WebP/JPG never include the reference
      layer's content (visible or hidden, any scale/format/transparent-
      background combination), on-screen rendering still respects its
      visibility toggle
- [x] 4.3 Fidelity test: uploading a small (fits-within-canvas) image
      produces pixel-identical output to the source (no smoothing/
      blending applied at 1:1); uploading an oversized image produces a
      centered, contained, smoothed fit with no cropping

## 5. Spec/doc sync

- [x] 5.1 Confirm `openspec validate --change reference-image-layer`
      passes before implementation begins
- [x] 5.2 After implementation, update `openspec/roadmap.md`'s "Not yet
      scheduled" entry for "Reference image layer (trace-over)" to point
      at this change / mark it scheduled, per this project's existing
      convention for other formalized roadmap items
