# Pixi tier matrix — worksheet

Working doc for the Light / Standard / Pro feature split (mini/embeddable
Pixi initiative). Fill in `✅` / `❌` for every `?` cell, row by row — this
isn't the final design doc, it's the input to it. Once filled in, it gets
folded into `docs/superpowers/specs/<date>-mini-pixi-design.md`.

**Locked so far** (not open for this pass — revisit explicitly if you want
to change one): Light = Pencil, Eraser, fixed palette, zoom/pan, PNG
export w/ scale, 1-level undo, no Bucket, no pixel-perfect. Standard adds
Shape tools, pixel-perfect, Brush (manual creation only, no image import),
Layers, Color Library (manual only, no image import).

Everything below is either already-decided (shown filled in) or open
(shown as `?`).

## Drawing tools

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Pencil | ✅ | ✅ | ✅ | |
| Eraser | ✅ | ✅ | ✅ | |
| Bucket (fill) | ❌ | ✅ | ✅ | |
| Pixel-perfect toggle | ❌ | ❌ | ✅ | |
| Line tool | ❌ | ✅ | ✅ | part of "Shape tools" |
| Rectangle tool | ❌ | ✅ | ✅ | part of "Shape tools" |
| Rectangle fill/outline toggle | ❌ | ❌ | ✅ | tied to Rectangle |
| Selection tool | ❌ | ✅ | ✅ | part of "Shape tools" |
| Selection clear/delete | ❌ | ✅ | ✅ | tied to Selection |
| Move tool | ❌ | ✅ | ✅ | part of "Shape tools" |
| Square-constraint ("1:1") toggle | ❌ | ✅ | ✅ | tied to Rectangle/Selection |
| Hand / pan | ✅ | ✅ | ✅ | bundled with zoom/pan |
| Eyedropper | ❌ | ✅ | ✅ | |
| Symmetry / mirror drawing mode | ❌ | ❌ | ✅ | new capability (shipped 2026-08-18, `openspec/changes/archive/2026-08-18-5-add-symmetry-drawing-mode`); not yet discussed for tier split |

## Brush

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Brush tool (built-in use) | ❌ | ✅ | ✅ | |
| Brush editor (create/edit manually) | ❌ | ✅ | ✅ | |
| Brush import from image | ❌ | ❌ | ✅ | |
| Brush spacing/rotation controls | ❌ | ❌ | ✅ | |

## Pencil/Eraser options

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Pencil size slider (1-20px) | ❌ | ✅ | ✅ | not yet discussed |
| Pencil opacity slider (1-100%) | ❌ | ❌ | ✅ | not yet discussed |
| Color Library sequence toggle (Pencil/Brush) | ❌ | ❌ | ✅ | ties to Color Library existing |

## Color

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Fixed 16-swatch palette               | ✅ | ✅ | ✅ | |
| FG/BG swatches + swap/reset           | ❌ | ✅ | ✅ | not yet discussed |
| Custom color picker (native/hex/RGB)  | ❌ | ✅ | ✅ | not yet discussed |
| Color Library panel                   | ❌ | ✅ | ✅ | manual only for Standard |
| Add current color to palette          | ❌ | ✅ | ✅ | tied to Color Library |
| Create new named palette (manual)     | ❌ | ✅ | ✅ | tied to Color Library |
| Import palette from image             | ❌ | ❌ | ✅ | |
| Delete palette                        | ❌ | ✅ | ✅ | |
| Multiple palettes + select dropdown   | ❌ | ✅ | ✅ | |
| Palette-aware color ramp generator    | ❌ | ❌ | ✅ | new capability (shipped 2026-08-18, `openspec/changes/archive/2026-08-18-7-add-palette-color-ramp-generator`); not yet discussed for tier split |

## Layers

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Layers panel                  | ❌ | ✅ | ✅ | |
| Add / delete / reorder layer  | ❌ | ✅ | ✅ | tied to Layers |
| Visibility toggle             | ❌ | ✅ | ✅ | tied to Layers |
| Blend mode select             | ❌ | ❌ | ✅ | not yet discussed |
| Layer opacity control         | ❌ | ✅ | ✅ | not yet discussed |
| Background layer (locked, from canvas creation) | ❌ | ✅ | ✅ | ties to New Canvas background choice |

## Canvas / navigation

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Zoom in/out, readout, presets | ✅ | ✅ | ✅ | |
| Canvas Settings (rename/resize/rotate) | ❌ | ❌ | ✅ | |

## New Canvas (creation)

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Fixed size presets (16/32/64/128)                     | ✅ | ✅ | ✅ | not yet discussed — likely all tiers |
| Custom width/height                                   | ✅ | ✅ | ✅ | not yet discussed |
| Background choice (transparent/white)                 | ✅ | ✅ | ✅ | not yet discussed |

## Export

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Export scale (1x/2x/4x/8x)                            | ✅ | ✅ | ✅ | |
| Export format: PNG only vs PNG/WebP/JPG | PNG only | PNG/WebP/JPG | PNG/WebP/JPG | reconfirm now Standard grew |
| Transparent-background export toggle | ✅ | ✅ | ✅ | reconfirm now Standard grew |

## Undo/redo

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Undo/redo buttons (present in UI) | ✅ | ✅ | ✅ | |
| Undo depth | 1 | 10 | full (20) | reconfirm now Standard grew — still 1? |

## App-level (probably not relevant to an embeddable widget — confirm)

| Feature | Light | Standard | Pro | Notes |
|---|---|---|---|---|
| Gallery (multiple saved projects)             | ❌ | ✅ | ✅ | is this even in scope for embeddable tiers, or full-app-only? |
| Local persistence (IndexedDB save/load) - if needed      | ✅ | ✅ | ✅ | same question |
| Theme (light/dark/system)                     | ✅ | ✅ | ✅ | embeds probably inherit host page instead |
