# Pixi tier matrix — worksheet

> **Legacy — superseded.** This worksheet predates the OpenSpec process
> (see CLAUDE.md's "Process: OpenSpec vs. Superpowers skills") and was the
> input to `openspec/changes/split-pixi-pro-repo/`, which implements the
> split it worked out. Once that change is archived, its spec at
> `openspec/specs/pixi-pro-distribution/` is the source of truth — this
> file is kept only as historical design context.

Working doc for the Standard / Pro feature split. Standard and Pro are two
downloadable, self-hosted versions of Pixi — not an embeddable widget for
other sites (an earlier pass in this doc used "embeddable," which was a
misreading; corrected 2026-08-18). Fill in `✅` / `❌` for every `?` cell,
row by row — this isn't the final design doc, it's the input to it. Once
filled in, it gets folded into `docs/superpowers/specs/<date>-pixi-tiers-design.md`.

**Change log (2026-08-18):** collapsed from a 3-tier split (Light / Standard
/ Pro) to 2 tiers (Standard / Pro) — a third free tier was judged
unnecessary. Old Light was dropped; old Standard's `✅` set is now the
Standard baseline unchanged, old Pro is unchanged. **Standard is
open-source and free; Pro is paid and closed-source** — mirrors TinyMCE's
core (open) / premium (licensed) model. Repo/licensing mechanics for this
split are being worked out separately, not in this doc.

**Locked so far** (not open for this pass — revisit explicitly if you want
to change one): Standard = Pencil, Eraser, fixed 16-swatch palette, basic
custom color picker (no saved palettes), zoom/pan, PNG/WebP/JPG export w/
scale, Bucket, Shape tools (Line/Rectangle/Selection/Move), Brush (manual
creation only, no image import). Pixel-perfect stays Pro-only.

**Narrowed further (2026-08-18):** Layers and the full Color Library
(saved/named palettes, import) moved entirely to Pro — Standard's creative
toolset (Pencil/Eraser/Bucket/Shape tools/Brush) was judged too close to
Pro's to leave a clear reason to pay. Standard now draws a single flat
image with a full toolset; Pro adds the compositing/color-organization
workflow on top.

**Closed out (2026-08-18):** Export format and undo depth are shared,
not tier-split — both tiers get PNG/WebP/JPG export and 20-step undo.

**Tier policy (Rule A, agreed 2026-08-18):** once a tool is unlocked for a
tier, its base configuration controls travel with it — only bulk/automated
features (image import, palette generation) get held back for Pro. Applied
below to Brush spacing/rotation and the Pencil/Brush Color Library sequence
toggle. **Named exception:** Rectangle's fill/outline toggle stays Pro-only
even though the Rectangle tool itself is in Standard — Standard's
rectangles are always drawn outline-only (`state.rectangleFilled` defaults
to `false` in `js/workspace.js`, confirmed against code rather than
assumed), with no filled option; that's a deliberate narrowing, not an
oversight.

## Drawing tools

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Pencil | ✅ | ✅ | |
| Eraser | ✅ | ✅ | |
| Bucket (fill) | ✅ | ✅ | |
| Pixel-perfect toggle | ❌ | ✅ | |
| Line tool | ✅ | ✅ | part of "Shape tools" |
| Rectangle tool | ✅ | ✅ | part of "Shape tools" |
| Rectangle fill/outline toggle | ❌ | ✅ | tied to Rectangle |
| Selection tool | ✅ | ✅ | part of "Shape tools" |
| Selection clear/delete | ✅ | ✅ | tied to Selection |
| Move tool | ✅ | ✅ | part of "Shape tools" |
| Square-constraint ("1:1") toggle | ✅ | ✅ | tied to Rectangle/Selection |
| Hand / pan | ✅ | ✅ | bundled with zoom/pan |
| Eyedropper | ✅ | ✅ | |
| Symmetry / mirror drawing mode | ❌ | ✅ | new capability (shipped 2026-08-18, `openspec/changes/archive/2026-08-18-5-add-symmetry-drawing-mode`); not yet discussed for tier split |

## Brush

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Brush tool (built-in use) | ✅ | ✅ | |
| Brush editor (create/edit manually) | ✅ | ✅ | |
| Brush import from image | ❌ | ✅ | |
| Brush spacing/rotation controls | ✅ | ✅ | Rule A — travels with Brush tool |

## Pencil/Eraser options

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Pencil size slider (1-20px) | ✅ | ✅ | not yet discussed |
| Pencil opacity slider (1-100%) | ❌ | ✅ | not yet discussed |
| Color Library sequence toggle (Pencil/Brush) | ❌ | ✅ | Color Library itself is now Pro-only (2026-08-18), so this moves with it — Rule A applies to what a tier *has*, not a feature it lost |

## Color

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Fixed 16-swatch palette               | ✅ | ✅ | |
| FG/BG swatches + swap/reset           | ✅ | ✅ | not yet discussed |
| Custom color picker (native/hex/RGB)  | ✅ | ✅ | not yet discussed |
| Color Library panel                   | ❌ | ✅ | moved to Pro entirely 2026-08-18 |
| Add current color to palette          | ❌ | ✅ | tied to Color Library |
| Create new named palette (manual)     | ❌ | ✅ | tied to Color Library |
| Import palette from image             | ❌ | ✅ | |
| Delete palette                        | ❌ | ✅ | |
| Multiple palettes + select dropdown   | ❌ | ✅ | |
| Palette-aware color ramp generator    | ❌ | ✅ | new capability (shipped 2026-08-18, `openspec/changes/archive/2026-08-18-7-add-palette-color-ramp-generator`); not yet discussed for tier split |

## Layers

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Layers panel                  | ❌ | ✅ | moved to Pro entirely 2026-08-18 |
| Add / delete / reorder layer  | ❌ | ✅ | tied to Layers |
| Visibility toggle             | ❌ | ✅ | tied to Layers |
| Blend mode select             | ❌ | ✅ | tied to Layers |
| Layer opacity control         | ❌ | ✅ | tied to Layers |
| Background layer (locked, from canvas creation) | ❌ | ✅ | tied to Layers — Standard's canvas background (transparent/white) is still set at creation, just isn't a lockable layer without Layers itself |
| Reference image layer (trace-over, locked, excluded from export) | ❌ | ✅ | new capability, shipped 2026-08-18, `openspec/changes/reference-image-layer/`; depends on Layers, so Pro-only by the same logic as Background layer — tier-gating itself not yet implemented, see that change's proposal.md |
| Merge layers (multi-select + Cmd/Ctrl+E, incl. merge-down) | ❌ | ✅ | new capability, shipped 2026-08-18, `openspec/changes/merge-layers/`; depends on Layers — tier-gating itself not yet implemented, same reasoning as reference-image-layer above |

## Canvas / navigation

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Zoom in/out, readout, presets | ✅ | ✅ | |
| Canvas Settings (rename/resize/rotate) | ❌ | ✅ | |

## New Canvas (creation)

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Fixed size presets (16/32/64/128)                     | ✅ | ✅ | not yet discussed — likely all tiers |
| Custom width/height                                   | ✅ | ✅ | not yet discussed |
| Background choice (transparent/white)                 | ✅ | ✅ | not yet discussed |

## Export

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Export scale (1x/2x/4x/8x)                            | ✅ | ✅ | |
| Export format: PNG/WebP/JPG | ✅ | ✅ | shared feature, not tier-split (2026-08-18) |
| Transparent-background export toggle | ✅ | ✅ | |

## Undo/redo

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Undo/redo buttons (present in UI) | ✅ | ✅ | |
| Undo depth | full (20) | full (20) | not tier-split (2026-08-18) — same depth for both; 20 carried over from old Pro value, revisit if a different number is wanted |

## App-level

| Feature | Standard | Pro | Notes |
|---|---|---|---|
| Gallery (multiple saved projects) | ✅ | ✅ | not tier-split — both are the full app |
| Local persistence (IndexedDB save/load) | ✅ | ✅ | not tier-split |
| Theme (light/dark/system) | ✅ | ✅ | not tier-split |
