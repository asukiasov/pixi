# Layers and colours redesign — design

The "Large" items from the iPad feedback
(`docs/feature-ideas/2026-10-12-ipad-feedback.md`): a Pixelmator-style
Layers panel with groups, Layers alone on the right, the colour palette at
the bottom, a Procreate-style colour picker, standard libraries, and a
brush palette. Plan: `docs/superpowers/plans/2026-10-12-layers-and-colours-redesign.md`.

Reference: `docs/Screenshots of other apps/other screens/pixelmator-pro-for-ipad-layers.avif`
(Pixelmator Pro for iPad's Layers card), Procreate's colour panel (Disc,
Classic, Value, Palettes, History).

## The new arrangement

```
┌ top bar ──────────────────────────────────────────────┐
│ rail │                canvas               │ Layers   │
│      │                                     │  card    │
│      │                                     │ (only    │
│      │                                     │  card on │
│      │        [ tool-options bar ]         │  the     │
│      │ [ palette ▾ | swatches … | ◐ | + ]  │  side)   │
└──────────────────────────────────────────────────────┘
```

- **Right side: Layers only.** The Color Library and Brushes cards leave
  the card column. The panel mini-rail keeps just the Layers button.
- **Bottom: the colour bar** replaces the fixed 16-colour strip: the
  active palette's swatches on one scrolling row, with a palette menu at
  its start and Rainbow and "add current colour" at its end.
- **Brushes: a popover** from the tool-options bar while the Brush tool
  is active, instead of a card.
- The Prefs "Open When a Project Opens" group keeps only Layers.

## 1. Standard libraries

"Reset standard libraries. Don't touch already created, but have ability
to download from the server standard libraries, like KitKat."

- The standard palettes ship as a static file,
  `assets/palettes/standard.json` (`[{ name, colors }]`), served with the
  site. The app fetches it when the user opens **Standard Libraries…**
  ("download from the server"); if the fetch fails (offline), it falls
  back to the same list built into `js/default-color-library.js`. When
  Supabase arrives (Phase 3) the URL moves to Storage; nothing else
  changes.
- The list: today's starter palettes (Vaporwave … Snickers, incl. Kit
  Kat), plus **Pixi Basics** (the 16 colours of the old fixed strip, so
  removing the strip loses nothing), **PICO-8** and **Game Boy**.
- The **Standard Libraries** sheet lists each one with its swatches and
  an **Add** button, or **Added** when a palette with that name already
  exists. Add creates a new palette; it never changes or replaces one the
  user has, even one with the same name they edited. A user who deleted
  Kit Kat gets it back with one tap.
- One-time: existing users get **Pixi Basics** added once (so the strip's
  colours are still one tap away); new users get it with the other
  starters.

## 2. Colour bar at the bottom

- **Palette menu** (first item, shows the palette's name and ▾): a menu
  listing every palette alphabetically (tap to switch; current one
  checked), then New Palette…, Import from Image…, Generate Ramp, Edit
  Colors, Delete Palette, Standard Libraries…. These are today's Color
  Library header actions with the same behaviour.
- **Swatches**: the active palette, one row, scrolling sideways, the
  active colour ringed and scrolled into view. Edit Colors works as
  today (tap removes, Undo toast).
- **Rainbow** swatch and **+** (add the current colour) at the end.
- The import and ramp popovers anchor to the palette menu button and move
  out of the card column (to the workspace screen), so nothing stacks
  under the colour picker any more.

## 3. Brush palette

The Brushes card becomes a popover opened from a **brush button** in the
tool-options bar (showing the current brush's shape) while Brush is
active. Same content and behaviour as the card — grid, New, Import,
Delete, the brush editor — it just isn't permanent screen furniture. It
closes on tool change, Escape or a press outside.

## 4. Procreate-style colour picker

Opened from the Foreground / Background swatches as today, rebuilt:

- **Header**: title, the new colour beside the colour it had when the
  picker opened (tap the old half to go back), close.
- **Tabs**: **Disc** (hue ring around a saturation/brightness square),
  **Classic** (large saturation/brightness square, hue slider below),
  **Value** (H, S, B and R, G, B sliders with numbers, hex field, and the
  system colour picker), **Palettes** (every palette's swatches, tap to
  pick). The last tab used is remembered.
- **History**: the last 10 colours picked, newest first, kept between
  sessions on this device.
- **Add to palette** and **Generate ramp** stay at the bottom.
- Dragging on the disc/square updates the colour live; everything goes
  through `setForegroundColor` / the background setter as today.
- Pure maths in `js/color-math.js` (RGB↔HSV, ring/square hit-testing),
  unit-tested.

## 5. Layer groups (engine)

- One level of groups (no nesting). A group is
  `{ id, name, visible, opacity, collapsed }`; a layer has `groupId`
  (or null). A group's members are always contiguous in the stack.
- Compositing: a member draws only if it and its group are visible, at
  `layer.opacity × group.opacity`. (Exact isolated-group compositing
  would differ only where members overlap inside a half-transparent
  group; not worth an offscreen pass per group here.)
- `LayerStack`: `groupLayers(indices, name)` (members gathered, in order,
  at the topmost one's position), `ungroup(id)`, `renameGroup`,
  `setGroupVisibility`, `setGroupOpacity`, `setGroupCollapsed`,
  `deleteGroup(id)` (the group and its layers), `getGroups()`.
- Up/Down moves respect groups like Photoshop: the top member moving up
  leaves the group; a layer just below a group moving up joins it as its
  bottom member; otherwise it swaps. Mirror for Down. `moveGroup(id,
  ±1)` moves a whole group past its neighbour (a layer or a whole group).
- Merge, delete, duplicate keep groups consistent (an emptied group is
  removed; a merged layer stays in the group when all sources were in it;
  a duplicate joins its source's group).
- Background and reference layers can't be grouped.
- `snapshot`/`restore`/`toProjectRecord`/`fromProjectRecord` carry
  `groups` and each layer's `groupId`; old records load with no groups.

## 6. Layers panel (Pixelmator iPad)

- **Card header**: ⋯ (panel menu), Layers title, **+** (add layer), close.
  Panel menu: Select Layers, Add Reference Image, and (in Select mode)
  Group, Merge, Delete for the selected layers.
- **Rows**: rounded cards with a larger thumbnail, the name and a detail
  line ("Normal · 100%", "Multiply · 60%", "Background", "Reference"),
  and an on/off **visibility switch**. The active row is highlighted and
  shows a **⋯** button: Rename, Duplicate, Merge Down, Group / Remove
  from Group, Move Up, Move Down, Opacity & Blend…, Delete.
- **Groups**: a group row with a disclosure chevron, folder icon, name,
  "N layers", visibility switch and ⋯ (Rename, Ungroup, Opacity…, Move
  Up/Down, Delete Group); its members indented beneath it, hidden while
  collapsed.
- **Select mode** (iPad-friendly replacement for Cmd/Shift-click marking,
  which still works): each row gets a checkbox; a bar shows "N selected"
  with Group, Merge and Done.
- **Opacity & Blend** is a small popover (today's shared toolbar
  controls), for the layer or group it was opened for.
- **Reorder by dragging** a row's grip: drop between rows; dropping
  between two members of a group joins it, elsewhere leaves it.
- Merge (Cmd/Ctrl+E) and Duplicate (Cmd/Ctrl+J) keep working; the
  Merge/Duplicate header buttons from earlier fold into the row and panel
  menus.

## Decisions taken

1. Right side holds only Layers; colours go to the bottom bar, brushes to
   a popover. The Prefs pins for Colors/Brushes go away.
2. The fixed 16-colour strip is replaced by the active palette; its
   colours live on as the "Pixi Basics" standard library.
3. "Download from the server" = a static JSON on the same site now,
   Supabase Storage later; offline falls back to the built-in list.
4. Colour picker: Disc, Classic, Value, Palettes + History. No Harmony
   tab.
5. Groups are one level deep, with multiplied opacity.
6. Select mode replaces modifier-key marking on touch.

## Out of scope

Nested groups, clipping masks, layer effects, Harmony colour mode,
syncing palettes through Supabase (Phase 3).
