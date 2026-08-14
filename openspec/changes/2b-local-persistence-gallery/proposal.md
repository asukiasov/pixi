## Why

Phase 1 and 2a's canvas lives only in memory — closing the tab loses
everything. Phase 2b (`openspec/roadmap.md`) makes Pixi a real standalone
tool: projects persist locally via IndexedDB, and a Gallery screen becomes
the app's home so a user can find, resume, or start a project.

## What Changes

- Add local persistence via Dexie/IndexedDB: every canvas is a **project**
  (id, name, dimensions, ordered layers with their pixel data/visibility/
  opacity/blend mode, a thumbnail, createdAt/updatedAt).
- **Auto-save, no Save button**: a project is written to IndexedDB after
  every committed action — the same granularity the undo stack already
  uses (stroke, fill, layer add/delete/reorder/rename/visibility/opacity/
  blend-mode, canvas resize/rotate) — not per-pixel. This matches "survives
  closing the tab" with no extra step and no risk of forgetting to save.
- Add a **Gallery** screen: grid of saved projects (thumbnail + name, most
  recently updated first), a "+ New Canvas" tile, tap-to-open, and
  delete-with-confirmation (deletion is the one destructive, irreversible
  action in this slice — everything else auto-saves).
- **Gallery becomes the app's entry screen**, replacing New Canvas as what
  loads first. New Canvas is now reached via Gallery's "+" tile.
- Add a **Canvas settings** screen/panel reachable from the Workspace:
  resize (width/height, 1–256, anchored top-left — shrinking crops,
  growing pads transparently, applied uniformly to every layer) and rotate
  (90° clockwise/counter-clockwise, all layers). Treated as one "canvas
  size" operation, not two — a separate crop tool isn't added since resize
  already covers it.
- **MODIFIED**: `canvas-creation`'s "Return to New Canvas from Workspace"
  requirement is replaced by "Return to Gallery from Workspace" — the
  Workspace's back control now returns to **Gallery**, not New Canvas, and
  the confirmation prompt is **removed**: since every action auto-saves,
  navigating away no longer risks losing work, so warning about it would be
  actively wrong.

Out of scope for this slice (later Phase 2c or beyond, per the roadmap):
full color/palette panel, symmetry/grid tools, line/shape/selection tools,
the full Export screen (scale multiplier/transparency toggle). Also out of
scope: project rename from Gallery (rename stays a Workspace/Canvas-settings
action for this slice), multi-select/bulk-delete in Gallery, sorting/search
in Gallery beyond most-recently-updated order, undo/redo persisting across
a reload (the undo stack itself stays in-memory and resets on reload/reopen
— only the saved pixel/layer state persists).

## Capabilities

### New Capabilities
- `local-persistence`: Dexie/IndexedDB project schema, auto-save on every
  committed action, project load, project delete.
- `gallery`: the Gallery screen — project grid, thumbnails, open, delete,
  "+ New Canvas", and being the app's entry point.
- `canvas-settings`: resize (crop/pad) and rotate an existing project's
  canvas, applied to all layers.

### Modified Capabilities
- `canvas-creation`: "Return to New Canvas from Workspace" is replaced by
  "Return to Gallery from Workspace", dropping the confirmation prompt since
  auto-save makes it unnecessary.

## Impact

- New files: `js/persistence.js` (Dexie setup, project CRUD, auto-save
  wiring), `js/gallery.js` (Gallery screen), `js/canvas-settings.js`
  (resize/rotate screen).
- Modified files: `js/app.js` (Gallery becomes the entry screen; routes
  between Gallery / New Canvas / Workspace / Canvas settings), `js/new-
  canvas.js` (creates a project record, not just a LayerStack), `js/
  workspace.js` (auto-save hook on every commit; back control goes to
  Gallery, no confirm; a Canvas Settings entry point), `js/layers.js`
  (serialize/deserialize a LayerStack to/from a persistence-friendly plain
  object), `index.html`/`style.css` (Gallery screen, Canvas settings
  screen/panel markup and styles).
- New dependency: Dexie, loaded via CDN ES module import (no npm/bundler,
  consistent with the rest of the project).
- New tests: `test/persistence.test.js` for the Dexie-backed project CRUD
  (using `fake-indexeddb` or an equivalent in-memory shim for `node --test`,
  since IndexedDB isn't available in Node by default — first slice needing
  a test-only dependency; document why in design.md).
