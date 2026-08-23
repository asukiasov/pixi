## Why

Pixi's fixed small canvas sizes (16–128px) are exactly the sizes used for
tileable game/UI assets, but there's no way today to check a tile repeats
cleanly without exporting and testing it elsewhere. Phase 2c2 explicitly
scoped "tile preview" out alongside symmetry/grid tools ("weren't
requested with the color picker and are unrelated in implementation; still
available to pull into a later 2c2-follow-up or its own change when
prioritized" — `openspec/roadmap.md`); this proposal picks that deferred
item up as its own change.

## What Changes

- Add a tile-preview toggle to the Workspace: when on, the canvas area
  renders the current canvas content repeated in a 3×3 grid (the real
  canvas centered, live copies surrounding it) instead of just the single
  canvas.
- The preview updates live as the user draws — it is a read-only rendering
  of the existing canvas content, not a separate editable surface; all
  drawing still happens on the single real (center) canvas exactly as
  today.
- Zoom/pan (`canvas-navigation`) continue to operate on the composed 3×3
  view the same way they operate on the canvas today — no new zoom/pan
  model.
- Toggle lives in the canvas area's controls (near the existing
  `#pixel-perfect-toggle`/top-bar icon-button group, see
  `docs/ui-reference.md`'s "Top bar" section) rather than as a new tool.
- Off by default, state is session-only (not persisted with the project),
  matching pixel-perfect's existing pattern.

## Capabilities

### New Capabilities
- `tile-preview`: 3×3 seamless-tiling preview toggle for the canvas area.

### Modified Capabilities
(none — `canvas-navigation`'s zoom/pan requirements are unchanged; the
preview composes visually on top of the existing canvas rendering rather
than altering zoom/pan behavior)

## Impact

- `js/workspace.js`: new render path for the composed 3×3 view, hooked
  into the same draw-commit cycle that already repaints the canvas after
  each stroke.
- `index.html`: new toggle button in the top bar / canvas-area controls.
- `css/*`: styling for the toggle and the repeated-copy layout.
- No persistence/schema changes (session-only toggle state).
