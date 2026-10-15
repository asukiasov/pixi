# Standard brush packs — design

A standard set of brushes for the Brush tool: a larger always-on **Core**
set, plus themed **Standard Brushes** packs the user adds from a sheet,
the same way Standard Libraries adds palettes. Brush pixels gain
**per-pixel opacity** (any value 0–100%), so soft brushes are possible.
Brushes stay single-colour: every pixel is drawn in the current colour.

**Out of scope:** multi-colour brushes (stamps that keep their own
colours), tiled "pattern" placement aligned to the canvas grid, editing an
existing saved brush, and updating already-added pack brushes when a pack
changes.

## Context: what exists today

- `js/brushes.js`: two built-ins (Heart 9×8, Circle 5×5) as `X`/`.` string
  grids, converted by `patternToPixels` to `pixels: [[x, y], ...]`.
  `placeBrush` sets each pixel with `engine.setPixel` (fully opaque), with
  optional rotation and a symmetry `applyPixelTransform` wrapper.
- Custom brushes: grid editor in the brush popover (on/off cells, W/H 3 to
  canvas size, image Import via `js/brush-import.js`'s `thresholdToGrid`),
  saved to Dexie's `customBrushes` table (`js/persistence.js`
  `createCustomBrush` / `listCustomBrushes` / `deleteCustomBrush`).
- `js/workspace.js` `loadCustomBrushes()` merges `BRUSHES` + custom into
  `allBrushes`; `renderBrushesPanel()` draws a flat thumbnail grid.
- `lib/pixel-engine/engine.js` already has
  `setPixelBlended(x, y, rgba, opacity)` (source-over), used by Pencil's
  Opacity.
- Standard Libraries (`js/standard-libraries.js`, `#standard-libraries-sheet`):
  palettes downloaded from `assets/palettes/standard.json`, falling back to a
  built-in copy; adding copies a palette into the user's library.

## 1. Brush data and placement

**Pixel format.** A brush pixel is `[x, y]` or `[x, y, a]`, `a` in (0, 1].
A missing `a` means 1. Existing custom brushes and Heart/Circle keep
working with no migration. `a` is only stored when below 1.

**String grids.** `patternToPixels` reads `X` = 100%, `1`–`9` = 10%–90%,
`.` = off. Used for Core and pack brushes. Editor-made brushes are stored as
`pixels` arrays and can hold any value.

**Placement.** `placeBrush` calls `engine.setPixelBlended(x, y, rgba, a)`
per pixel instead of `setPixel`.
- A 100% pixel gives the same result as today (`setPixelBlended` at
  opacity 1 is pixel-identical to `setPixel` for an opaque colour).
- Every stamp blends over what is already there, so overlapping stamps in
  one drag build up (airbrush-like). No per-drag dedup.
- Spacing, Rotation, Rainbow, Color Library sequence and symmetry are
  unchanged; they all pass through `placeBrush`. The symmetry wrapper wraps
  a per-pixel function that now takes the pixel's opacity along.
- Rotation carries each pixel's `a`. When two source pixels round onto the
  same cell, the higher `a` wins.

**Previews.** Picker thumbnails, the tool-options brush button and the
Standard Brushes sheet draw each pixel black at its `a` on white, so soft
brushes read as grey (shared `js/brush-preview.js`). The brush cursor is an
outline of the pixels the dab touches, so it is unchanged.

**Image import (behaviour change).** `thresholdToGrid` becomes a mapping
to opacity per cell instead of on/off:
- Image with any transparency: `a = alpha / 255`.
- Fully opaque image: `a = 1 - luminance / 255` (darker is more opaque,
  same luminance weights as today).
- Cells below 5% become off.

## 2. Brush editor

- New **Opacity** row: a range input (1–100%, default 100%) with a %
  readout, like Pencil's `#pencil-opacity-slider`. It sets the value
  painted into cells.
- Clicking a cell sets it to the current opacity. Clicking a cell that
  already holds exactly that value clears it, so at 100% a click still
  toggles on/off as today. A drag paints whatever the first click did
  (set to the opacity, or clear).
- Each painted cell is shaded by its own opacity (the editor's accent
  colour mixed toward the empty-cell colour), so partial cells read as
  lighter.
- The editor grid state becomes `grid[y][x]` = number in [0, 1] (0 = off).
  `pixelsFromGrid` emits `[x, y]` for 1 and `[x, y, a]` below 1.

## 3. Packs, the Standard Brushes sheet, and the picker

### Core set (always present, not deletable)

Defined in `js/brushes.js` as string grids, in this order: Heart, Circle,
Square, Diamond, Star, Plus, Soft Round (opacity falling off from the
centre), Spray (scattered dots, some partial). Ids stay stable (`heart`,
`circle` unchanged).

### Packs

Five packs, each brush 3×3 to 16×16, hand-drawn for 16–64 px canvases:

| Pack id | Name | Brushes |
|---|---|---|
| `shapes` | Shapes | Triangle, Ring, Crescent, Arrow, Lightning, Music Note, Sparkle |
| `nature` | Nature | Grass Tuft, Leaf, Flower, Cloud, Tree, Snowflake, Raindrop |
| `texture` | Texture & Dither | Checker 50%, Bayer 25%, Bayer 75%, Hatching, Crosshatch, Noise, Brick, Stipple |
| `soft` | Soft | Soft Round S, Soft Round M, Soft Round L, Glow, Soft Square, Feather, Smudge |
| `game` | Game & UI | Coin, Gem, Key, Skull, Sword, Potion, HUD Heart |

**Data.** `assets/brushes/standard.json`:
`[{ id, name, brushes: [{ id, name, rows: ['..X..', ...] }] }]`, with the
same content as a built-in copy in `js/default-brush-packs.js` (used
offline or when the download is unusable).

**Module `js/standard-brushes.js`** (DOM-free, mirrors
`standard-libraries.js`):
- `parseStandardBrushes(json)`: drops malformed packs and brushes (bad id
  or name, ragged rows, unknown characters, size outside 3–16, no on
  pixels); drops packs left with no brushes. Returns `null` if not an
  array.
- `standardBrushRows(packs, existingBrushes)`: each pack with
  `status: 'add' | 'restore' | 'added'` — `add` when none of its brushes
  are present, `restore` when some are, `added` when all are. Presence is
  matched by `pack` + `packBrushId`.
- `missingPackBrushes(pack, existingBrushes)`: the pack's brushes not yet
  present, converted to `{ name, width, height, pixels }`.
- `loadStandardBrushes(fetchFn)`: fetches `assets/brushes/standard.json`
  with `cache: 'no-cache'`, falls back to the built-in packs.

**Adding a pack.** Each missing brush is written to `customBrushes` as a
normal custom brush plus `pack`, `packName`, `packBrushId` and `packIndex`
fields. These fields are
not indexed, so the Dexie schema version does not change.
`createCustomBrush` gains an optional
`{ pack, packName, packBrushId, packIndex }` argument.
Adding never creates duplicates.

### Standard Brushes sheet

- A `prefs-sheet` dialog, `#standard-brushes-sheet`, built like
  `#standard-libraries-sheet`.
- Opened from a new **Standard Brushes** icon button in the brush popover
  toolbar (next to Add and Delete). Not in the palette menu, which is
  colour-only. Not in the docked embed (`lib/pixi.js`).
- One row per pack: name, a strip of the first few brush previews, and one
  button: **Add**, **Restore**, or disabled **Added** (the same wording as Standard Libraries).

### Picker

- The brush grid is split into sections with small headings: **Core**,
  then each added pack (in pack order), then **My Brushes** (user-made or
  imported). Empty sections are hidden.
- Pack brushes are ordered within their section by `packIndex` (their
  position in the pack, stored when added). Pack brushes whose pack is no
  longer in the list still show, under their stored `packName`, after the
  known packs.
- Delete is enabled for pack and My Brushes brushes, disabled for Core.

### Existing users

Nothing is added automatically. Heart and Circle remain; Core grows to
eight. Packs are added through the sheet.

## 4. Errors

- Pack download fails or is malformed: built-in packs are used silently.
- IndexedDB write fails while adding: the existing error toast is shown;
  the sheet re-reads `customBrushes` so its statuses reflect what was
  actually saved.

## 5. Testing

Unit tests (`node --test`):
- `patternToPixels`: `X`, `1`–`9`, `.`.
- `placeBrush`: 100% pixels match the old `setPixel` result; a 50% pixel
  blends; two overlapping stamps build up; rotation keeps `a` and the
  higher `a` wins on collision.
- `pixelsFromGrid` with numeric cells.
- `thresholdToGrid` opacity mapping and the 5% cut-off, for alpha and
  opaque images.
- `standard-brushes.js`: parsing, statuses, `missingPackBrushes`, fallback.
- Pack data: every built-in pack brush parses, fits 3–16, ids unique per
  pack, and `assets/brushes/standard.json` equals the built-in copy.

Manual check in the local app: add, restore and delete a pack; drag a soft
brush; paint opacities in the editor; import a soft-edged PNG; picker
section headings. `web-design-guidelines` review on the popover, editor and
sheet changes before code review.

## 6. Docs updated in the same branch

- `docs/specs/brushes/spec.md`: per-pixel opacity, Core set, Standard
  Brushes, picker sections, image-import change, editor Opacity.
- `docs/ui-reference.md`: sheet, popover toolbar button, editor row.
- `docs/roadmap.md`: entry for this change.
