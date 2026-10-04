# Customize Tools (design)

Phase 5 item, after 5g. Approved 2026-10-04.

## Goal

Let people choose which tools sit on the tool rail, and in what order,
the way Pixelmator Pro for iPad's Customize Tools screen does
(`docs/Screenshots of other apps/other screens/pixelmator-pro-ipad-customize-toolbar.avif`).
Standalone app only; the `Pixi.mount()` embed is untouched (its markup is
its own copy in `lib/pixi.js` and never loads `js/app.js`).

## Behavior

- **Rail.** The tool rail shows only the favorites, in their order. A ⋯
  button at the bottom of the rail (above the FG/BG swatches) opens a
  menu with the remaining tools, then a separator and **Customize
  Tools…**. Choosing a tool there selects it. When the current tool is
  not on the rail, ⋯ shows as active and its label names the tool
  ("More tools, Bucket selected").
- **Shortcuts.** Every tool's bare-letter shortcut keeps working whether
  the tool is on the rail or not.
- **Sheet.** A full-screen glass sheet: **Reset** at the top start corner
  (disabled while the set is the default), the title "Customize Tools",
  and a ✓ Done button at the top end corner. Below: the favorites row,
  the hint "Drag your favorite tools into the list above…", then a grid
  of every other tool (icon + label). ✓ and Escape close it.
- **Editing.**
  - Drag (pointer events: mouse, touch, Apple Pencil) a tile within the
    favorites row to reorder it, from the grid into the row to add it at
    the drop position, or from the row onto the grid to remove it. A
    small movement threshold separates a drag from a tap; tiles set
    `touch-action: none` so a touch drag doesn't scroll.
  - Tap / Enter / Space on a favorite removes it; on a grid tile adds it
    at the end of the row.
  - Alt+← / Alt+→ on a focused favorite moves it one place. A polite
    live region announces each change ("Pencil, position 2 of 7",
    "Line removed", "Line added, position 8 of 8").
  - Every change applies to the rail and is saved at once, like Prefs.
- **Default.** All 10 tools on the rail in today's order (Move, Pencil,
  Eraser, Bucket, Brush, Line, Rectangle, Select, Hand, Eyedropper), so
  nothing changes until someone customizes. With all 10 on the rail the
  ⋯ menu holds only Customize Tools…. Zero favorites is allowed: ⋯ then
  holds every tool.
- **Entry points.** The ⋯ menu's last item, and a new **Tools** section
  in the Prefs sheet with a **Customize Tools…** row; from Prefs the
  sheet opens on top of Prefs and Done returns to it.

## Architecture

**`js/rail-tools.js` (new, DOM-free, unit-tested).**

- `TOOL_IDS` — the 10 tool ids in default order. `DEFAULT_RAIL_TOOLS`
  — the same list, frozen.
- `normalizeRailTools(raw)` — keeps known ids in the given order,
  dropping unknowns and duplicates; a non-array gives the default. An
  empty array stays empty. Tool ids added in a later release are simply
  absent, so they start in the overflow.
- `overflowTools(rail)` — `TOOL_IDS` minus `rail`, in `TOOL_IDS` order.
- `insertTool(rail, id, index)` — returns a new list with `id` at
  `index` (clamped), removed from where it was first. Covers add,
  reorder and drag-drop with one function.
- `removeTool(rail, id)`, `isDefaultRail(rail)`.
- `dropIndex(centers, x)` — given the horizontal centers of the row's
  tiles (excluding the one being dragged), the insert index for a pointer
  at `x`.

**Prefs.** `js/prefs.js` gains a `railTools` field, normalized with
`normalizeRailTools` and stored in the same `pixi-prefs` JSON.
`js/prefs-sheet.js`'s `read()` currently rebuilds the whole prefs
object; it will merge its fields over `getPrefs()` so it no longer
drops `railTools` (or any field added later).

**Rail (`js/tool-rail.js`).** `applyRailTools(container, rail)`: moves the
tool buttons into `rail` order (moving nodes keeps their listeners) with
the off-rail ones after, and toggles an `off-rail` class (hidden by CSS).
It does not touch `.hidden`/`disabled`, which `js/workspace.js` uses for
the embed's `enabledTools`. Shortcuts find the button by
`data-shortcut` and call `.click()`, which works on a hidden button, so
they keep working.

**⋯ menu (`js/tool-overflow.js`, new).** Uses `initMenuButton` from
`js/topbar-menu.js` with a new `placement: 'side'` option, so the menu
opens beside the rail (on whichever side has room) rather than below.
`onOpen` rebuilds the items from the overflow list: `menuitemradio`
items (icon, label, shortcut `<kbd>`) that forward a click to the real
tool button, then Customize Tools…. A `MutationObserver` on
`#screen-workspace[data-current-tool]` toggles `.active` and the label
on ⋯ (the same signal `js/tool-options-bar.js` follows).

**Sheet (`js/customize-tools-sheet.js`, new).** A native modal
`<dialog id="customize-tools-sheet">` in `index.html`, styled with the
Prefs sheet's glass tokens but full-screen. It renders both lists from
`getPrefs().railTools` on open and after every change, and hands each
change to the same `setPrefs` used by Prefs (save + apply). Tiles are
`<button>`s; the favorites row is a `<ul>` with an accessible name and
`aria-describedby` pointing at the keyboard hint. Dragging moves a
fixed-position copy of the tile with the pointer (pointer capture on the
pressed tile) and opens a gap in the row at `dropIndex`.

**Wiring (`js/app.js`).** `applyRailTools` runs at boot and inside
`setPrefs`; `initToolOverflow` and `initCustomizeToolsSheet` are wired
once, next to `initPrefsSheet`.

## Testing

- Unit (`node --test`): `test/rail-tools.test.js` for every helper;
  `test/prefs.test.js` for `railTools` defaults, normalization and round
  trip; `test/tool-rail.test.js` for `applyRailTools` with fake nodes.
- Browser: Chromium + WebKit at 1180×820 and 768×1024, tools left and
  right — rail with a customized set, ⋯ menu open, ⋯ active for an
  off-rail tool, the sheet, a drag, keyboard reorder, Reset, a shortcut
  for an off-rail tool, reload keeps the order.

## Out of scope

Customizing the top bar, the panel mini-rail, or the embed's rail;
per-project tool sets.
