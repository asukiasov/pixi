## 1. Persistence

- [x] 1.1 `js/persistence.js`: Dexie version bump adding `colorPalettes:
      'id, name'`; `createColorPalette(name, colors = [])`,
      `listColorPalettes()`, `renameColorPalette(id, name)`,
      `addColorToPalette(id, hex)`, `deleteColorPalette(id)` — mirrors
      `customBrushes`' functions (`userId: null` reserved, same as brushes)
- [x] 1.2 Unit tests (`node --test`, using the existing `fake-indexeddb`
      setup): create/list/rename/add-color/delete, including that
      `addColorToPalette` appends without duplicating existing entries
      lost

## 2. Workspace state and rendering

- [x] 2.1 `js/workspace.js`: module-level `colorPalettes` (loaded list)
      and `activePaletteId`; a `loadColorPalettes()` that fetches from
      IndexedDB, auto-creates one "Default" palette on first-ever load if
      none exist, and re-renders the panel — mirrors `loadCustomBrushes()`
- [x] 2.2 `js/workspace.js`: `renderColorLibraryPanel()` — builds the
      palette-name dropdown (only shown when more than one palette
      exists, sorted alphabetically by name) and the active palette's
      scrollable swatch grid; each swatch click calls the existing
      `setForegroundColor()`
- [x] 2.3 `index.html`/`style.css`: Color Library panel in
      `#right-sidebar` (third section, alongside Layers/Brushes) - header
      with the name dropdown + "add palette"/"delete palette" icon
      buttons, scrollable swatch grid area

## 3. Add color / add palette / delete palette

- [x] 3.1 `js/workspace.js`: color-picker popover's "Add to palette"
      button now calls `addColorToPalette(activePaletteId, hex)` (via
      `js/persistence.js`) instead of pushing to the old
      `customSwatches` array, then reloads/re-renders the panel
- [x] 3.2 `js/workspace.js`/`index.html`: "add palette" control opens an
      inline name `<input>` (matching the brush editor's naming pattern,
      not `window.prompt()`); saving creates the palette via
      `createColorPalette` and makes it active
- [x] 3.3 `js/workspace.js`: "delete palette" removes the active palette
      via `deleteColorPalette`, disabled when it's the only one remaining
      (mirrors the layers panel's "can't delete the only layer" pattern)

## 4. Remove the superseded 2c2 flat-list behavior

- [x] 4.1 `js/workspace.js`: remove the `customSwatches` array and its
      rendering from `renderPaletteRow()` — the bottom `palette-row` goes
      back to just the 16 presets + Rainbow; user-added colors now live
      only in the Color Library panel
- [x] 4.2 Confirm no other code still references `customSwatches`

## 5. Verification

- [x] 5.1 Re-run full `node --test` suite
- [x] 5.2 Playwright smoke pass: first-ever load auto-creates and shows a
      "Default" palette; adding a color via the picker popover appears in
      the panel immediately and is selectable; creating a second named
      palette makes the dropdown appear, sorted alphabetically, and
      switches the visible swatch grid; adding a color while a
      non-default palette is active adds it there, not to "Default";
      reloading the page and opening a different project both preserve
      every palette and its colors; deleting a palette removes it and
      falls back to another; the delete control is disabled with only one
      palette left; zero console errors throughout

## 6. Default palette seeding + Add-to-palette overflow bug fix

- [x] 6.1 New `js/default-color-library.js`: exports
      `DEFAULT_MATERIAL_COLORS`, the full Material Design color list
      (verbatim, user-supplied) as hex strings
- [x] 6.2 `js/workspace.js`'s `loadColorPalettes()`: first-ever-load
      auto-create now names the palette "Material" and seeds it with
      `DEFAULT_MATERIAL_COLORS` instead of creating an empty "Default"
      palette
- [x] 6.3 Bug fix: `#color-picker-add` ("+ Add to palette") rendered as a
      collapsed ~42px square with its label overflowing outside the
      button's own box, because `#color-picker-popover` lives inside
      `#tools-sidebar` in the DOM, so `.tools-sidebar .tool-button`'s
      fixed `2.6rem` width/height (meant for the icon-only tool rail) won
      the cascade on those two properties — `#color-picker-add`'s own
      rule set padding/font-size but never width/height, so a higher-
      specificity ID selector didn't help. Fixed by adding explicit
      `width: 100%; height: auto;` to `#color-picker-add`
- [x] 6.4 Playwright verification: fresh IndexedDB → Color Library panel
      shows a "Material" palette with 255 swatches, scrollable, on first
      load with no user action needed; `#color-picker-add`'s bounding box
      now spans the popover's full inner width and sits fully inside the
      popover's bounding box (was previously a ~42px square with the
      label rendering outside it)

## 7. Delete-palette confirmation + default-palette protection

- [x] 7.1 **Bug**: the default "Material" palette could be deleted with a
      single click (delete was only disabled when it was the *only*
      remaining palette), and no delete in the app asked for confirmation
      first
- [x] 7.2 `js/persistence.js`: `createColorPalette(name, colors,
      isDefault = false)` gains an `isDefault` flag, persisted on the
      record; `loadColorPalettes()`'s first-ever-load auto-create now
      passes `isDefault: true`
- [x] 7.3 New `js/confirm-dialog.js`: `confirmDialog({title, message,
      confirmLabel})` - a shared, dark-themed, promise-based "are you
      sure?" modal (lazily built once, appended to `<body>`), replacing
      `window.confirm()` everywhere the app deletes something. Dismisses
      via Cancel, clicking outside, or Escape (all resolve `false`)
- [x] 7.4 `js/workspace.js`: `deletePaletteButton` is now also disabled
      whenever the active palette's `isDefault` is true (in addition to
      the existing "only one palette left" check); its click handler
      awaits `confirmDialog` before calling `deleteColorPalette`
- [x] 7.5 Same `confirmDialog` wired into `js/gallery.js` (project
      delete, replacing its prior `window.confirm`), the custom-brush
      delete button, and the per-layer delete button (`js/workspace.js`)
      - every delete action in the app now confirms first
- [x] 7.6 Playwright: default "Material" palette's delete button stays
      disabled even with a second palette present and active; deleting a
      non-default palette shows the confirm modal, Cancel leaves it
      intact, Confirm removes it; same confirm-then-delete flow verified
      for a layer, a custom brush, and a gallery project; re-run full
      `node --test` suite (103/103)
