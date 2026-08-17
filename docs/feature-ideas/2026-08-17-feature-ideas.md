# Feature ideas — 2026-08-17

Scan basis: `docs/ui-reference.md` (full current screen/control catalog) +
`openspec/roadmap.md`'s non-goals, "Not yet scheduled", and "Still open"
lists (checked so nothing here duplicates an already-known item without
saying so). Produced by `proposing-feature-improvements`. These are
candidate capabilities, not vetted designs — next step for anything picked
is `superpowers:brainstorming` then `/opsx:propose`, per CLAUDE.md's
process.

Explicitly out of scope, not repeated below: animation timeline/onion
skinning (declared non-goal), native mobile builds (declared non-goal), a
Settings screen and an Import screen for `.aseprite`/reference
images/palette files (both already "Not yet scheduled" in roadmap.md).

**Approval status (2026-08-17):** user reviewed all 8 ideas below.
Approved ideas were proposed as OpenSpec changes the same day; declined
ideas are left as-is (not implemented, not proposed) in case priorities
change later.

## Drawing / shape tools

### Symmetry / mirror drawing mode — ✅ approved, proposed as
[`openspec/changes/5-add-symmetry-drawing-mode`](../../openspec/changes/5-add-symmetry-drawing-mode/)
- **Why**: Pixel art of characters, icons, and tiles is very often
  symmetric; today every stroke on `pencil`/`brush`/`eraser` must be drawn
  and matched by hand on both halves. A horizontal/vertical (and
  optionally 4-way) mirror mode that reflects each stroke live would cut
  that work in half for a large share of use cases. Extends the left
  tools sidebar (`docs/ui-reference.md` §"Left tools sidebar") — likely a
  toggle near the pixel-perfect toggle, not a new tool.
- **Scope guess**: Medium — one new state flag plus a stroke-mirroring
  pass in the drawing engine (`pixel-drawing-engine` spec), reused by
  Pencil/Eraser/Brush/Line/Rectangle.
- **Non-goal check**: No conflict; not mentioned anywhere in roadmap.
- **Next step**: `superpowers:brainstorming` then `/opsx:propose`.

### Tile-seamless preview — ✅ approved, proposed as
[`openspec/changes/6-add-tile-seamless-preview`](../../openspec/changes/6-add-tile-seamless-preview/)
- **Why**: Pixi's fixed small canvas sizes (16–128px) are exactly the
  sizes used for tileable game/UI assets, but there's no way to check a
  tile repeats cleanly without exporting and testing elsewhere. A toggle
  that shows the canvas repeated 3×3 (or wraps brush strokes across
  edges) would directly serve that use case.
- **Scope guess**: Medium — a new canvas-area view mode
  (`docs/ui-reference.md` §"Canvas area"), no new data model.
- **Non-goal check**: No conflict; not mentioned in roadmap.
- **Next step**: `superpowers:brainstorming` then `/opsx:propose`.

## Color

### Palette-aware color ramp generator — ✅ approved, proposed as
[`openspec/changes/7-add-palette-color-ramp-generator`](../../openspec/changes/7-add-palette-color-ramp-generator/)
- **Why**: Color Library today only stores flat swatch lists
  (`#color-library-grid`) built manually or via image import
  (`#import-palette-button`). Pixel art shading conventions lean on
  ramps (a base hue stepped through shade/tint); generating a ramp from
  one picked color would remove a lot of manual hex-tweaking in
  `#color-picker-popover`.
- **Scope guess**: Small/medium — one new action in the color picker or
  palette header, no new persisted structure beyond adding swatches to
  the existing palette model.
- **Non-goal check**: No conflict.
- **Next step**: Small enough to go straight to `/opsx:propose` if
  approved.

## Layers

### Layer groups / folders — ⛔ declined
- **Why**: `#layers-panel-list` (see `docs/ui-reference.md` §"Layers") is
  a flat list with tap-to-reorder, no drag-and-drop. As a project grows
  past a handful of layers (sketch, line, base color, shading, per
  Background), a flat list gets unwieldy fast with no way to collapse
  related layers together.
- **Scope guess**: Large — new data model (nested layer tree), new list
  rendering, blend-mode/opacity interaction with nested groups, reorder
  semantics change. Worth scoping carefully before proposing.
- **Non-goal check**: No conflict; not mentioned in roadmap.
- **Next step**: `superpowers:brainstorming` first — this one has real
  design surface (how does group opacity compose with member opacity?).

## Canvas / export

### Batch export across saved projects — ⛔ declined
- **Why**: `#export-panel` (spec `export`) only exports the currently
  open project. Someone building a set of icons or sprites at Pixi's
  fixed sizes has no way to export the whole Gallery (`#gallery-grid`)
  at once — must open, export, close, repeat per project.
- **Scope guess**: Medium — reuses the existing export pipeline per
  project, adds a new entry point from the Gallery screen and a
  zip/multi-file download flow.
- **Non-goal check**: No conflict.
- **Next step**: `superpowers:brainstorming` then `/opsx:propose`.

### Spritesheet packing on export — ⛔ declined
- **Why**: Currently each project exports as one image at a chosen scale
  (`.export-scale-option`/`.export-format-option`). If layers are being
  used as animation frames within a single canvas project (common
  workaround given the declared no-animation-timeline non-goal), there's
  no way to pack visible layers into a spritesheet grid on export instead
  of exporting each separately.
- **Scope guess**: Medium — new export-panel option, reuses per-layer
  render already available for layer thumbnails.
- **Non-goal check**: Adjacent to the animation-timeline non-goal but
  distinct — this doesn't add a timeline/playback UI, just a packing
  option for existing layers on export. Worth a one-line confirmation
  with the user before proposing given how close it sits to that
  boundary.
- **Next step**: `superpowers:brainstorming` (confirm non-goal boundary
  explicitly) before `/opsx:propose`.

## Recording

### Drawing-process timelapse recording — ✅ approved, proposed as
[`openspec/changes/8-add-drawing-timelapse-recording`](../../openspec/changes/8-add-drawing-timelapse-recording/)
- **Why**: Procreate's signature export is a replayable video of the whole
  drawing process, not just the final image — widely used for tutorials,
  social sharing, and process proof. Pixi has no equivalent today.
- **Correction (found while drafting the proposal)**: this entry
  originally assumed the existing undo/redo history could double as
  timelapse source data. That's wrong — `js/undo.js`'s undo stack is a
  session-only ring buffer capped at 20 full-canvas snapshots, discarded
  on reload, not a full drawing history. The proposal is scoped around a
  dedicated, independent live-capture buffer instead (see the change's
  design.md).
- **Scope guess**: Large — new engineering: a live opt-in frame-capture
  buffer independent of the undo stack, encoded client-side at Save time
  (`MediaRecorder` capturing a canvas stream — no backend, matches the
  static-site/no-custom-backend stack constraint), and a new export-style
  review flow (speed controls, analogous to `#export-panel`).
- **Non-goal check**: Adjacent to but distinct from the declared
  animation-timeline non-goal — confirmed explicitly with the user before
  proposing (2026-08-17): scoped as passive recording/export only, no
  in-canvas playback/authoring UI, encoding entirely client-side.

## Gallery

### Search / filter / tag projects — ⛔ declined
- **Why**: `#gallery-grid` (spec `gallery`) shows every saved project
  with no filtering. Fine at a handful of projects, not once someone has
  built up dozens of sprites/icons — no way to find one by name or group
  by tag.
- **Scope guess**: Medium — new metadata field (tags) on the persisted
  project model (`local-persistence` spec) plus a search input in the
  Gallery header.
- **Non-goal check**: No conflict.
- **Next step**: `superpowers:brainstorming` then `/opsx:propose`.

---

## Summary (titles only)

- Symmetry / mirror drawing mode
- Tile-seamless preview
- Palette-aware color ramp generator
- Layer groups / folders
- Batch export across saved projects
- Spritesheet packing on export
- Drawing-process timelapse recording
- Search / filter / tag projects
