## Why

Requested directly, and it resolves a real gap: today, "white background"
at canvas creation just fills the one starting layer with opaque white -
there's nothing special about that layer afterward, and Eraser always
produces full transparency everywhere, so erasing on a white-background
canvas leaves a transparent hole rather than restoring the backdrop.
Real pixel-art/image tools (Photoshop, Aseprite) solve this with a
locked, non-reorderable "Background" layer whose Eraser behavior differs
from every other layer.

## What Changes

- Creating a canvas with **white** background produces a layer stack
  whose one starting layer is flagged as the **Background layer**:
  locked in position (can't be reordered up/down), shown with a lock
  indicator in the Layers panel.
- **Transparent** background creation is unchanged - a regular,
  unlocked, non-Background starting layer, exactly as today.
- Erasing on the Background layer reveals `state.backgroundColor` (the
  Foreground/Background color from `2c2-color-panel`) instead of
  producing transparency. Erasing on every other (non-Background) layer
  is unchanged - still always produces full transparency, per the
  existing Eraser requirement.
- Adding a new layer still always adds a regular, unlocked, transparent
  layer above the active one, as today - there is at most one Background
  layer per canvas, and only ever the one created at canvas creation.

## Capabilities

### Modified Capabilities
- `layers`: the "Starting layer" requirement gains the Background-layer
  distinction for white-background canvases; new requirements cover
  reorder-locking, the lock indicator, and Eraser's Background-layer
  exception. (Eraser's behavior *everywhere else* stays governed by
  `pixel-drawing-engine`'s existing Eraser requirement, unchanged -
  the exception is scoped and specified here instead of re-opening that
  requirement, since `2e-pencil-eraser-size-opacity` already has an
  unmerged delta on it and stacking a second one on the same requirement
  before either archives would be messy to reconcile.)

## Impact

- `js/layers.js`: `Layer` gains an `isBackground` boolean (default
  `false`); `LayerStack`'s starting-layer construction sets it `true`
  only for a white-background canvas; `moveLayerUp`/`moveLayerDown`
  become no-ops for a Background layer; `toProjectRecord`/
  `fromProjectRecord` persist the flag.
- `js/workspace.js`: `buildLayerRow()` shows a lock icon and disables the
  reorder buttons for a Background layer; the Eraser's `applyPixel`
  (from `pencilOrEraserApplyPixel`, `2e-pencil-eraser-size-opacity`)
  branches on the *active* layer's `isBackground` flag - reveals
  `state.backgroundColor` there, unchanged (full transparency) elsewhere.
- No change to `js/canvas-creation` UI - the existing transparent/white
  choice now has this consequence, nothing new to pick.
- Not addressed in this slice (explicitly out of scope, see design.md):
  converting an existing Background layer to a regular layer, locking
  its opacity/blend mode, or ever having more than one Background layer.
