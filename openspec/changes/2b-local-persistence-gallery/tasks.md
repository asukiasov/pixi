## 1. Layer stack serialization (`js/layers.js`)

- [x] 1.1 Implement `LayerStack.toProjectRecord()`: plain object with
      width/height/layers (id, name, ArrayBuffer copy of pixel data,
      visible, opacity, blendMode)/activeLayerIndex — no thumbnail/id/
      timestamps (those are `persistence.js`'s concern)
- [x] 1.2 Implement `LayerStack.fromProjectRecord(record)` (static):
      reconstructs a full `LayerStack` from a record
- [x] 1.3 Implement `LayerStack.resize(width, height)`: top-left anchored
      crop/pad on every layer
- [x] 1.4 Implement `LayerStack.rotate90(direction)`: rotate every layer,
      swap width/height when not square
- [x] 1.5 Unit tests (`node --test`): record round-trip, resize (both
      shrink and grow, content position preserved), rotate (both
      directions, square and non-square)

## 2. Persistence (`js/persistence.js`)

- [x] 2.1 Set up Dexie, `projects` table (id, updatedAt index). Loaded as
      bare specifier `"dexie"` — resolved via an import map in index.html to
      an ESM CDN build in the browser, and from node_modules in Node
      (installed as a devDependency purely so `node --test` can run this
      module; see design.md revision note on task 2.2)
- [x] 2.2 Implement `createProject(layerStack, name, thumbnail)`: builds a
      full record (id, name, `toProjectRecord()` fields, thumbnail,
      createdAt/updatedAt) and writes it. **Revised from design.md**:
      thumbnail is passed in by the caller (already computed via
      `layerStack.toPNGBlob()`) rather than generated inside this function —
      keeps `persistence.js` DOM-free and unit-testable in Node, consistent
      with the rest of the codebase
- [x] 2.3 Implement `saveProject(id, layerStack, thumbnail)`: updates an
      existing record's layer data, (optional) thumbnail, and updatedAt
- [x] 2.4 Implement `loadProject(id)`: returns a record ready for
      `LayerStack.fromProjectRecord()`
- [x] 2.5 Implement `listProjects()`: all records ordered by updatedAt desc
      (for the Gallery)
- [x] 2.6 Implement `deleteProject(id)`
- [x] 2.7 Add `fake-indexeddb` as a test-only dependency; unit tests
      (`node --test`) for all of the above

## 3. Auto-save wiring (`js/workspace.js`)

- [x] 3.1 On project open (new or loaded), track the current project id
- [x] 3.2 Hook `saveProject` into the existing `commit()` function, so every
      committed action (stroke, fill, layer change, resize/rotate)
      auto-saves — no new save-trigger concept, reuses the undo-commit point
- [x] 3.3 Confirm mid-stroke drawing (`onDrawMove`) does not trigger a save

## 4. Canvas settings (`js/canvas-settings.js`)

- [x] 4.1 Build a Canvas Settings panel/screen: width/height inputs
      (1–256, matching New Canvas's clamp), rotate CW/CCW buttons
- [x] 4.2 Wire resize to `layerStack.resize()` + `canvasView.resetView()` +
      `commit()` (auto-save + undo snapshot)
- [x] 4.3 Wire rotate to `layerStack.rotate90()` + `canvasView.resetView()`
      + `commit()`
- [x] 4.4 Add a Workspace entry point (button) to open Canvas Settings
- [x] 4.5 **Gap found post-verification**: proposal.md said rename "stays a
      Workspace/Canvas-settings action for this slice" but it was never
      built. Added a Name field to the Canvas Settings panel, wired to a new
      `persistence.js` `renameProject(id, name)` (+ unit test), independent
      of the undo stack (project name is metadata, not canvas content)
- [x] 4.6 **Bug found on a real phone (narrow viewport)**: the 9-button tab
      bar's `flex-wrap: wrap` made the "Gallery" back control hard to find/
      reach. Changed `.tab-bar` to horizontal scroll (`nowrap` +
      `overflow-x: auto`, matching the palette row) so Gallery, being first,
      stays reachable at a fixed position

## 5. Gallery (`js/gallery.js`)

- [x] 5.1 Build the Gallery screen: project grid (thumbnail + name),
      "+ New Canvas" tile, empty state for zero projects
- [x] 5.2 Wire project tap → `loadProject()` → `LayerStack.fromProjectRecord()`
      → open in Workspace
- [x] 5.3 Wire "+ New Canvas" → New Canvas screen
- [x] 5.4 Wire delete (with confirm) → `deleteProject()` → refresh grid
- [x] 5.5 Sort by updatedAt desc

## 6. Wire into the app (`js/app.js`, `js/new-canvas.js`)

- [x] 6.1 `js/app.js`: Gallery becomes the entry screen; router grows a
      third screen (Gallery / New Canvas / Workspace)
- [x] 6.2 `js/new-canvas.js`: on create, call `createProject()` immediately
      (record exists before any drawing happens), then open Workspace
- [x] 6.3 `js/workspace.js`: relabel the back control "Gallery" (was "New"),
      route to the Gallery screen, remove the leave-confirmation dialog

## 7. HTML/CSS

- [x] 7.1b Fix: `.gallery-empty-state.hidden` had no matching CSS rule, so
      the empty-state text stayed visible even with projects present —
      found during Playwright verification. Added a general `.hidden {
      display: none !important; }` utility rule instead of scattered
      per-element `.hidden` rules
- [x] 7.1 `index.html`: Gallery screen markup, Canvas Settings panel markup
- [x] 7.2 `style.css`: Gallery grid styles, Canvas Settings panel styles

## 8. Verification

- [x] 8.1 Playwright smoke pass: create a project, draw, reload the page,
      confirm it reappears via Gallery with the drawing intact
- [x] 8.2 Open a second project, confirm no cross-contamination with the
      first (matches the existing 2a regression check, extended to persisted
      projects)
- [x] 8.3 Delete a project, confirm it's gone from the Gallery and from
      IndexedDB
- [x] 8.4 Resize and rotate a canvas with multiple layers, confirm every
      layer transforms correctly and the result auto-saves
- [x] 8.5 Re-run the full `node --test` suite to confirm no regressions
