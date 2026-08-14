## Why

`2c2-color-panel` deliberately deferred "saved palettes" (named,
persisted collections of custom colors) as a future increment — its
`customSwatches` are a flat, unpersisted, session-only list. A reference
screenshot (a Figma-style color-library panel: named collection, sorted,
scrollable, on the right side of the screen) makes clear what that
increment should look like: this change builds it.

## What Changes

- A new **Color Library** panel in the right-sidebar (alongside Layers
  and Brushes), replacing `2c2`'s flat `customSwatches` array and its
  "Add to palette" button.
- Colors are organized into one or more **named palettes** (e.g.
  "Default", "Skin Tones") — not individually-named colors. A dropdown
  selects the active palette; palettes are sorted alphabetically by name
  when there's more than one.
- The active palette's colors show as a scrollable swatch grid, matching
  the reference screenshot's layout.
- **Add color**: adds the current color-picker-popover color (Foreground
  or Background, whichever was open) to the active palette.
- **Add palette**: creates a new, empty named palette and makes it active.
- Palettes **persist to IndexedDB** (a new `colorPalettes` table,
  following `customBrushes`' pattern) — global and session-independent,
  not scoped to one project, surviving reloads. This is the actual
  "saved" half of "saved palettes."
- The 16 built-in preset swatches (+ Rainbow) in the bottom `palette-row`
  are unchanged — this panel is additive, for user-created colors only,
  not a replacement for the quick-access preset row.

## Capabilities

### New Capabilities
- `color-library`: named, persisted palettes of user-added colors,
  presented in a scrollable right-sidebar panel, including the "add to
  palette" action from the color-picker popover.

### Modified Capabilities
(none — `pixel-drawing-engine`'s "Color palette" requirement, already
modified once by the still-open `2c2-color-panel`, covers *selecting* a
color; this change's "add to palette" behavior is fully specified under
the new `color-library` capability instead, to avoid layering a second
unmerged delta on top of `2c2`'s not-yet-archived one.)

## Impact

- `js/persistence.js`: new Dexie table `colorPalettes` (version bump),
  `createColorPalette`/`listColorPalettes`/`renameColorPalette`/
  `addColorToPalette`/`deleteColorPalette` (mirrors `customBrushes`'
  functions).
- `js/workspace.js`: replaces `customSwatches` (array) and its render/add
  logic with a palette-aware equivalent; new panel render function
  (mirrors `renderBrushesPanel`); "Add to palette" in the color-picker
  popover now targets the active named palette instead of pushing to a
  flat list.
- `index.html`/`style.css`: new Color Library panel markup in
  `#right-sidebar`, palette-name dropdown, "add palette" control,
  scrollable swatch grid.
- No `js/engine.js` changes.
- Out of scope: individually-named colors (this change names palettes,
  not colors within them — see the resolved design question); renaming/
  deleting a palette's individual colors beyond adding them; per-user
  ownership (same `userId: null`-reserved pattern `customBrushes` already
  established for the future Supabase Auth phase).
