## Why

Each Layers panel row renders the layer's name as an always-live
`<input class="layer-name-input">`, so a single click or tap on the name
drops straight into text editing (and, on iPad, pops the on-screen
keyboard) when the user only meant to select the layer. Renaming is rare;
selecting is constant - the common action should not trigger the rare one.

## What Changes

- The layer name is shown as plain text, not an input.
- A single click/tap anywhere on a row, including its name, only selects
  the layer (existing Cmd/Ctrl/Shift marking behavior unchanged).
- A double-click (mouse) or double-tap (touch, including iPad) on the
  name enters rename mode: the name is swapped for a focused text input
  with its contents selected.
- In rename mode: Enter or blur commits, Escape cancels. An empty or
  unchanged name commits nothing (no undo entry, no re-render churn).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `layers`: the "Rename layer" requirement gains an explicit
  entry gesture (double-click/double-tap) and the rule that a single
  click/tap on the name selects rather than edits.

## Impact

- `js/layers-ui.js` - `buildLayerRow`'s name element and the row click
  handler; new exported pure helpers for double-tap detection and rename
  value resolution.
- `style.css` - `.layer-name-input` styling split into a display label
  and an editing input.
- New `test/layer-rename.test.js`.
- No data-model, persistence, or `LayerStack` API changes
  (`renameLayer` is reused as-is).
