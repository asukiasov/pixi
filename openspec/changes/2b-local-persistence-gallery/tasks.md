## 1. Layer stack serialization (`js/layers.js`)

- [ ] 1.1 Implement `LayerStack.toProjectRecord()`: plain object with
      width/height/layers (id, name, ArrayBuffer copy of pixel data,
      visible, opacity, blendMode)/activeLayerIndex — no thumbnail/id/
      timestamps (those are `persistence.js`'s concern)
- [ ] 1.2 Implement `LayerStack.fromProjectRecord(record)` (static):
      reconstructs a full `LayerStack` from a record
- [ ] 1.3 Implement `LayerStack.resize(width, height)`: top-left anchored
      crop/pad on every layer
- [ ] 1.4 Implement `LayerStack.rotate90(direction)`: rotate every layer,
      swap width/height when not square
- [ ] 1.5 Unit tests (`node --test`): record round-trip, resize (both
      shrink and grow, content position preserved), rotate (both
      directions, square and non-square)

## 2. Persistence (`js/persistence.js`)

- [ ] 2.1 Set up Dexie via CDN ES module import, `projects` table (id,
      updatedAt index)
- [ ] 2.2 Implement `createProject(layerStack, name)`: builds a full record
      (id, name, `toProjectRecord()` fields, thumbnail via
      `layerStack.toPNGBlob()`, createdAt/updatedAt) and writes it
- [ ] 2.3 Implement `saveProject(id, layerStack)`: updates an existing
      record's layer data, thumbnail, and updatedAt
- [ ] 2.4 Implement `loadProject(id)`: returns a record ready for
      `LayerStack.fromProjectRecord()`
- [ ] 2.5 Implement `listProjects()`: all records ordered by updatedAt desc
      (for the Gallery)
- [ ] 2.6 Implement `deleteProject(id)`
- [ ] 2.7 Add `fake-indexeddb` as a test-only dependency; unit tests
      (`node --test`) for all of the above

## 3. Auto-save wiring (`js/workspace.js`)

- [ ] 3.1 On project open (new or loaded), track the current project id
- [ ] 3.2 Hook `saveProject` into the existing `commit()` function, so every
      committed action (stroke, fill, layer change, resize/rotate)
      auto-saves — no new save-trigger concept, reuses the undo-commit point
- [ ] 3.3 Confirm mid-stroke drawing (`onDrawMove`) does not trigger a save

## 4. Canvas settings (`js/canvas-settings.js`)

- [ ] 4.1 Build a Canvas Settings panel/screen: width/height inputs
      (1–256, matching New Canvas's clamp), rotate CW/CCW buttons
- [ ] 4.2 Wire resize to `layerStack.resize()` + `canvasView.resetView()` +
      `commit()` (auto-save + undo snapshot)
- [ ] 4.3 Wire rotate to `layerStack.rotate90()` + `canvasView.resetView()`
      + `commit()`
- [ ] 4.4 Add a Workspace entry point (button) to open Canvas Settings

## 5. Gallery (`js/gallery.js`)

- [ ] 5.1 Build the Gallery screen: project grid (thumbnail + name),
      "+ New Canvas" tile, empty state for zero projects
- [ ] 5.2 Wire project tap → `loadProject()` → `LayerStack.fromProjectRecord()`
      → open in Workspace
- [ ] 5.3 Wire "+ New Canvas" → New Canvas screen
- [ ] 5.4 Wire delete (with confirm) → `deleteProject()` → refresh grid
- [ ] 5.5 Sort by updatedAt desc

## 6. Wire into the app (`js/app.js`, `js/new-canvas.js`)

- [ ] 6.1 `js/app.js`: Gallery becomes the entry screen; router grows a
      third screen (Gallery / New Canvas / Workspace)
- [ ] 6.2 `js/new-canvas.js`: on create, call `createProject()` immediately
      (record exists before any drawing happens), then open Workspace
- [ ] 6.3 `js/workspace.js`: relabel the back control "Gallery" (was "New"),
      route to the Gallery screen, remove the leave-confirmation dialog

## 7. HTML/CSS

- [ ] 7.1 `index.html`: Gallery screen markup, Canvas Settings panel markup
- [ ] 7.2 `style.css`: Gallery grid styles, Canvas Settings panel styles

## 8. Verification

- [ ] 8.1 Playwright smoke pass: create a project, draw, reload the page,
      confirm it reappears via Gallery with the drawing intact
- [ ] 8.2 Open a second project, confirm no cross-contamination with the
      first (matches the existing 2a regression check, extended to persisted
      projects)
- [ ] 8.3 Delete a project, confirm it's gone from the Gallery and from
      IndexedDB
- [ ] 8.4 Resize and rotate a canvas with multiple layers, confirm every
      layer transforms correctly and the result auto-saves
- [ ] 8.5 Re-run the full `node --test` suite to confirm no regressions
