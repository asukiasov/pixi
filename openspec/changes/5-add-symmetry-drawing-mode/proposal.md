## Why

Pixel art of characters, icons, and tiles is very often symmetric, but every
Pencil/Eraser/Brush stroke today must be drawn and hand-matched on both
halves of the canvas. Phase 2c2 explicitly scoped symmetry tools out
("weren't requested with the color picker and are unrelated in
implementation; still available to pull into a later 2c2-follow-up or its
own change when prioritized" — `openspec/roadmap.md`); this proposal picks
that deferred item up as its own change.

## What Changes

- Add a symmetry/mirror drawing toggle to the Workspace: horizontal,
  vertical, or both, with the mirror axis fixed at the canvas's center
  (no draggable axis in this first pass).
- While a symmetry mode is active, every pixel written by the Pencil,
  Eraser, or Brush tool is mirrored live across the active axis/axes as
  part of the same stroke — one continuous undo/redo step, same as an
  unmirrored stroke today.
- Bucket fill, Line, Rectangle, Selection, and Move are unaffected in this
  first pass (their strokes are not mirrored) — noted as a possible
  follow-up, not required here.
- Toggle lives in the left tools sidebar area, alongside the existing
  pixel-perfect toggle (`#pixel-perfect-toggle` in
  `docs/ui-reference.md`'s "Left tools sidebar" section) — not a new tool,
  no tool-scoped option panel.
- Symmetry state is per-session (not persisted with the project), same as
  the pixel-perfect toggle today — matches existing tool-state patterns and
  keeps the first pass small; persisting it is a possible follow-up.

## Capabilities

### New Capabilities
- `symmetry-drawing`: mirror/symmetry drawing mode — toggle, axis
  selection, and live-mirrored stroke behavior for Pencil/Eraser/Brush.

### Modified Capabilities
(none — `pixel-drawing-engine` and `brushes`' existing requirements are
unchanged; symmetry mirrors their output rather than altering how a single
unmirrored stroke behaves)

## Impact

- `js/workspace.js` (or a new `js/symmetry.js`): stroke pipeline for
  Pencil/Eraser gains a mirroring pass before commit.
- `js/brushes.js`: Brush tool's stroke pipeline gains the same mirroring
  pass.
- `index.html`: new toggle button in the left tools sidebar.
- `css/*`: styling for the new toggle, consistent with
  `#pixel-perfect-toggle`.
- No persistence/schema changes (session-only state, like pixel-perfect
  mode).
