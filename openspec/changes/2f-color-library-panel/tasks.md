## 1. Persistence

- [ ] 1.1 `js/persistence.js`: Dexie version bump adding `colorPalettes:
      'id, name'`; `createColorPalette(name, colors = [])`,
      `listColorPalettes()`, `renameColorPalette(id, name)`,
      `addColorToPalette(id, hex)`, `deleteColorPalette(id)` — mirrors
      `customBrushes`' functions (`userId: null` reserved, same as brushes)
- [ ] 1.2 Unit tests (`node --test`, using the existing `fake-indexeddb`
      setup): create/list/rename/add-color/delete, including that
      `addColorToPalette` appends without duplicating existing entries
      lost

## 2. Workspace state and rendering

- [ ] 2.1 `js/workspace.js`: module-level `colorPalettes` (loaded list)
      and `activePaletteId`; a `loadColorPalettes()` that fetches from
      IndexedDB, auto-creates one "Default" palette on first-ever load if
      none exist, and re-renders the panel — mirrors `loadCustomBrushes()`
- [ ] 2.2 `js/workspace.js`: `renderColorLibraryPanel()` — builds the
      palette-name dropdown (only shown when more than one palette
      exists, sorted alphabetically by name) and the active palette's
      scrollable swatch grid; each swatch click calls the existing
      `setForegroundColor()`
- [ ] 2.3 `index.html`/`style.css`: Color Library panel in
      `#right-sidebar` (third section, alongside Layers/Brushes) - header
      with the name dropdown + "add palette"/"delete palette" icon
      buttons, scrollable swatch grid area

## 3. Add color / add palette / delete palette

- [ ] 3.1 `js/workspace.js`: color-picker popover's "Add to palette"
      button now calls `addColorToPalette(activePaletteId, hex)` (via
      `js/persistence.js`) instead of pushing to the old
      `customSwatches` array, then reloads/re-renders the panel
- [ ] 3.2 `js/workspace.js`/`index.html`: "add palette" control opens an
      inline name `<input>` (matching the brush editor's naming pattern,
      not `window.prompt()`); saving creates the palette via
      `createColorPalette` and makes it active
- [ ] 3.3 `js/workspace.js`: "delete palette" removes the active palette
      via `deleteColorPalette`, disabled when it's the only one remaining
      (mirrors the layers panel's "can't delete the only layer" pattern)

## 4. Remove the superseded 2c2 flat-list behavior

- [ ] 4.1 `js/workspace.js`: remove the `customSwatches` array and its
      rendering from `renderPaletteRow()` — the bottom `palette-row` goes
      back to just the 16 presets + Rainbow; user-added colors now live
      only in the Color Library panel
- [ ] 4.2 Confirm no other code still references `customSwatches`

## 5. Verification

- [ ] 5.1 Re-run full `node --test` suite
- [ ] 5.2 Playwright smoke pass: first-ever load auto-creates and shows a
      "Default" palette; adding a color via the picker popover appears in
      the panel immediately and is selectable; creating a second named
      palette makes the dropdown appear, sorted alphabetically, and
      switches the visible swatch grid; adding a color while a
      non-default palette is active adds it there, not to "Default";
      reloading the page and opening a different project both preserve
      every palette and its colors; deleting a palette removes it and
      falls back to another; the delete control is disabled with only one
      palette left; zero console errors throughout
