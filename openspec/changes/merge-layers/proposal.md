## Why

The Layers panel currently has no way to combine layers: a user who wants to
lock in the result of stacked sketch/lineart/shading layers, or flatten a
couple of extra layers made while experimenting, has to manually redraw
content onto one layer or leave the canvas needlessly fragmented against the
8-layer cap. Photoshop-style merge (multi-select layers + Cmd/Ctrl+E, or
merge-down when nothing extra is marked) is a well-understood idiom that
closes this gap. This is the "Merge layers" item flagged in
`openspec/roadmap.md`'s "Not yet scheduled" list and
`docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md` (raised
2026-08-18); this change formalizes it into an OpenSpec proposal.

## What Changes

- Add layer **marking** (multi-select) to the Layers panel, distinct from the
  existing single **active** layer (where new strokes go). Cmd/Ctrl+click a
  layer row to toggle it in/out of the marked set; Shift+click extends the
  marked set to every layer between the last-clicked row and the clicked row
  (contiguous range). A plain click keeps today's behavior unchanged: it sets
  the active layer and clears any marks. Marked rows get a distinct visual
  treatment (checkbox/highlight) from the single active-row highlight already
  in place.
- Bind **Cmd/Ctrl+E** while the Workspace screen is visible, alongside the
  existing Cmd/Ctrl+Z/Y/+/-/D shortcuts:
  - If 2+ layers are marked, merge exactly those marked layers into one.
  - Otherwise (nothing marked, or only the active layer effectively marked),
    merge the active layer down into the layer directly below it. No-op if
    the active layer is already the bottom layer, or is the only layer.
- Add a `LayerStack.mergeLayers(indices)` mutation (name TBD in design.md)
  that composites the given layers' pixel data - honoring each layer's
  opacity and blend mode, using the same per-layer compositing approach
  `LayerStack` already uses for on-screen rendering/export (`#compositeToCanvas`)
  rather than the JPG-only `needsWhiteFlatten` path - into one new layer,
  removes the source layers, and inserts the merged layer at the
  bottom-most merged position. The merged layer is named after the
  topmost merged layer, uses blend mode Normal and opacity 100% (the
  source layers' opacity/blend mode is already baked into its pixels), and
  becomes the active layer. This mutation is undoable/redoable exactly like
  existing layer operations (add/delete/reorder/rename/visibility/opacity/
  blend mode), via the same snapshot-based undo stack.
- The locked **Background layer** (Phase 2g) cannot be marked and is excluded
  when computing merge-down's "layer below" target and from the marked-set
  merge entirely - consistent with it already being reorder-locked and
  exempt from normal layer manipulation.
- Marking state resets (nothing marked) whenever the active layer changes via
  a plain click, an undo/redo, a layer add/delete, or leaving the Workspace
  screen - it is transient UI state, not part of the persisted project or
  the undo snapshot.
- **Tier gating is explicitly out of scope for this change.** The tier
  matrix worksheet flags this feature Pro-only (it depends on Layers, which
  Standard doesn't have), but no tier-gating mechanism exists in the
  codebase yet - tiers are still planning-only. This capability is built as
  designed, unconditionally available, ready to be gated once the
  Standard/Pro split lands as its own change.

## Capabilities

### New Capabilities

(none - this extends the existing `layers` capability)

### Modified Capabilities

- `layers`: adds layer marking (multi-select) to the Layers panel and a new
  Merge layers operation (marked-set merge and merge-down), including its
  keyboard shortcut, compositing behavior, undo/redo integration, and
  Background-layer exclusion.

## Impact

- `js/layers.js`: `LayerStack` gains marked-layer-aware merge logic (new
  method(s)), reusing its existing per-layer compositing code path.
- `js/workspace.js`: `renderLayersPanel`/`buildLayerRow` gain marked-state
  rendering and click-to-mark handling; a new Cmd/Ctrl+E handler joins the
  existing delegated keydown handler (~line 2051) that already covers
  Cmd/Ctrl+Z/Y/+/-/D.
- No persistence/schema changes - marking is transient UI state, and merged
  layers serialize through the existing `toProjectRecord`/`fromProjectRecord`
  shape unchanged.
- No tier-gating code changes (see "Tier gating is explicitly out of scope").
