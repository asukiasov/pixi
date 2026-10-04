## Context

`LayerStack` (`js/layers.js`) currently tracks one `#activeIndex` and offers
no notion of a multi-layer selection. `js/workspace.js`'s `renderLayersPanel`
loops layers top-to-bottom and calls `buildLayerRow(layer, index, isActive,
layers)` with a single boolean; row click handlers call
`state.layerStack.setActiveLayer(index)` unconditionally. Compositing
already exists and is reused verbatim for on-screen rendering and PNG
export: `LayerStack#compositeToCanvas({ skipBackground })` draws visible
layers bottom-to-top onto an offscreen canvas using
`ctx.globalAlpha = layer.opacity` and
`ctx.globalCompositeOperation = BLEND_MODE_TO_COMPOSITE_OP[layer.blendMode]`.
Undo/redo works by snapshotting/restoring the whole `LayerStack` state
(`snapshot()`/`restore()`) onto `state.undoStack`, pushed via `commit()`
after every mutating action. See proposal.md for motivation and
`specs/layers/spec.md` (this change's delta) for the behavior contract.

## Goals / Non-Goals

**Goals:**
- Multi-select ("marking") layers in the panel, kept separate from the
  existing single active-layer concept.
- A `LayerStack` mutation that merges 2+ layers (marked-set) or the active
  layer + the one below it (merge-down) into a single new layer, reusing
  the existing compositing math exactly (not the export-only
  `needsWhiteFlatten` path, which flattens onto opaque white for JPG and
  doesn't touch `LayerStack`'s layer list at all).
- Cmd/Ctrl+E wired into the existing delegated keydown handler.
- Undo/redo support via the existing snapshot mechanism, with no changes to
  that mechanism itself.

**Non-Goals:**
- Tier gating (Pro-only enforcement) - explicitly deferred, per proposal.md.
- Drag-and-drop or checkbox-based marking UI beyond Cmd/Ctrl+click and
  Shift+click - no such pattern exists elsewhere in the app to be
  consistent with, so this change establishes it fresh for the Layers panel
  only.
- Any change to the export/flatten path (`needsWhiteFlatten`, `toPNGBlob`) -
  merge is a distinct, LayerStack-mutating operation.
- Merging layers with different pixel dimensions - not applicable; all
  layers in a `LayerStack` always share the stack's `width`/`height`.

## Decisions

**Compositing implementation: extend `#compositeToCanvas` rather than
duplicate it.** `#compositeToCanvas({ skipBackground })` already does
exactly the pixel math a merge needs (opacity + blend mode, bottom-to-top,
via canvas 2D compositing) but iterates the *entire* stack and returns a
canvas, not a `Layer`. Add a private helper,
`#compositeSubset(indices)`, that runs the same per-layer draw loop
restricted to the given layer indices (in their existing bottom-to-top
stack order) and returns an `ImageData`/pixel buffer, which
`mergeLayers()` then wraps in a new `Layer`. This keeps one source of truth
for "how do layers composite" rather than two.

**New `LayerStack` methods: `mergeLayers(indices)` and `mergeDown(index)`.**
Two small methods over one do-everything method, because their preconditions
differ (mergeLayers needs 2+ indices and no Background layer among them;
mergeDown needs a single index and derives its own pair) and workspace.js's
Cmd/Ctrl+E handler already has to decide which case applies from the marked
set - handing it two clearly-named entry points keeps that call site
readable. `mergeDown(index)` internally computes the target pair and can
delegate to the same private compositing helper `mergeLayers` uses.

```
mergeLayers(indices) {
  // indices: array of stack positions, length >= 2, none isBackground.
  // - sorts indices ascending (bottom-to-top order)
  // - composites via #compositeSubset(sortedIndices)
  // - name = layer at the *highest* index (topmost) among indices
  // - creates new Layer(name, ...) with blendMode 'normal', opacity 1
  // - splices out the source layers, inserts merged layer at the
  //   bottom-most (lowest) source index
  // - sets #activeIndex to the merged layer's new index
  // - returns true, or false if preconditions fail (< 2 indices, any
  //   isBackground, any index out of range)
}

mergeDown(index) {
  // - refuses if index is 0 (nothing below), out of range, the stack has
  //   1 layer, layers[index].isBackground, or layers[index - 1].isBackground
  // - otherwise delegates to mergeLayers([index - 1, index])
}
```

**Marking state lives in `js/workspace.js`, not `LayerStack`.** Marking is
transient UI state (which rows show a mark), not domain state the engine or
persistence layer needs to know about - parallel to how `shiftHeld` and
other UI-only flags already live as module-level variables in
`workspace.js` rather than in `state`/`LayerStack`. A `Set` of marked layer
ids (not indices, so marks survive an unrelated `renderLayersPanel()` re-run
between a mark and a merge - e.g. after a visibility toggle) is added
alongside the existing `state` fields consumed by `buildLayerRow`. It resets
to empty on: plain click, undo/redo, add/delete layer, and merge itself
(both success and no-op paths, so a merge attempt never leaves stale marks).
Leaving the Workspace screen doesn't need special-case handling because the
Set naturally still empties itself as normal interactions occur; if it
turns out to matter, clearing it in whatever function already handles
returning to the Gallery is a one-line addition, not a design change.

**`buildLayerRow` signature grows one parameter.** `renderLayersPanel`
already computes `isActive` per row from `activeIndex`; it will similarly
compute `isMarked` per row from the marked-id `Set` and pass it to
`buildLayerRow(layer, index, isActive, isMarked, layers)`. The row's click
handler branches on `e.metaKey || e.ctrlKey` (toggle mark) vs `e.shiftKey`
(range mark) vs neither (existing plain-click behavior), mirroring the
existing `(e.metaKey || e.ctrlKey)` gating style already used in the
Cmd/Ctrl+Z/Y/+/-/D handler.

**Cmd/Ctrl+E joins the existing handler at ~workspace.js:2051** rather than
a new `keydown` listener, for the same reason Cmd/Ctrl+D lives there: one
delegated listener already checks `(e.metaKey || e.ctrlKey)` and the
Workspace-visibility guard once, so adding an `else if (key === 'e')`
branch avoids a second full document-level listener doing the same guard
work.

**Naming: topmost layer wins.** Matches Photoshop's own convention (merging
"Layer 2" and "Layer 3" where 3 is on top keeps something closer to "Layer
3"'s identity) and needs no new state - just reading `layers[highestIndex].
name` before splicing.

**Blend mode Normal / opacity 100% on the merged layer.** The source
layers' opacity and blend mode are already baked into the merged pixels by
the compositing step, so carrying either value forward on the *new* layer
would double-apply it against whatever sits below the merge. This matches
Photoshop's own merge behavior.

## Risks / Trade-offs

- **[Risk]** A `Set` of marked layer *ids* means a stale id (layer deleted
  by some other path) could theoretically linger. → Mitigation: marks are
  cleared on every layer-count-changing operation (add/delete/merge) per the
  Decisions above, and `renderLayersPanel` only ever renders marks for ids
  it finds in the current `getLayers()` list, so a stale id simply never
  matches a row - it doesn't need active cleanup elsewhere.
- **[Risk]** Two new `LayerStack` methods plus a new private compositing
  helper is more surface than one method. → Mitigation: `#compositeSubset`
  is a small refactor of already-tested logic (`#compositeToCanvas`'s loop
  body), and the two public methods map directly to this change's two
  spec'd scenarios (marked-set merge, merge-down), keeping each easy to unit
  test in isolation the same way `LayerStack`'s other methods already are.
- **[Risk]** Forgetting to clear marks on undo/redo would let a user merge
  layers that no longer correspond to what's marked (indices shifted).
  → Mitigation: called out explicitly in both the spec's "Layer marking"
  requirement scope and this design's marking-state decision; `performUndo`/
  `performRedo` already call `renderLayersPanel()`, so clearing marks in the
  same place they're already touched is a small, visible addition to make
  during implementation, not a design gap.
