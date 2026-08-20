## 1. Extract the pixel engine library (Phase 1)

- [x] 1.1 Create `lib/pixel-engine/` folder
- [x] 1.2 Move `js/engine.js` → `lib/pixel-engine/engine.js` (content unchanged)
- [x] 1.3 Move `js/layers.js` → `lib/pixel-engine/layers.js` (content unchanged); update its `from './engine.js'` import if the relative path changes
- [x] 1.4 Move `js/undo.js` → `lib/pixel-engine/undo.js` (content unchanged)
- [x] 1.5 Move `test/engine.test.js`, `test/layers.test.js`, `test/undo.test.js` → `lib/pixel-engine/`, updating their import paths to the moved source files
- [x] 1.6 Update `package.json`'s `test` script glob (currently `node --test test/**/*.test.js`) so it also picks up `lib/pixel-engine/*.test.js`
- [x] 1.7 Update `js/workspace.js`, `js/new-canvas.js`, `js/app.js` imports of `engine.js`/`layers.js`/`undo.js` to the new `lib/pixel-engine/` paths
- [x] 1.8 Grep `js/` for any other reference to the moved files and fix it (also found and fixed `test/brushes.test.js`, `test/persistence.test.js`, `test/shape-tools.test.js`, not just `js/`)
- [x] 1.9 Run `npm test` — confirm all tests (moved and remaining) still pass (186/186 pass)
- [x] 1.10 Serve the app locally and smoke-test: draw, undo/redo, export a PNG — confirm identical behavior to before the move (verified via Playwright: New Canvas → draw stroke → Undo/Redo enabled correctly → Export PNG panel opens with no new console errors → Gallery shows saved project with thumbnail. Standard has no Layers panel to test — it's Pro-only, already extracted to the private `pixi-pro` repo per this repo's git history)
- [x] 1.11 Write `lib/pixel-engine/README.md`: what it is, the three exported classes with constructor/method reference, one complete usage example (create engine → draw pixels → composite via `LayerStack` → snapshot/undo via `UndoStack` → get PNG bytes)
- [x] 1.12 State in the README the Pixi git tag/commit last verified against, and the license (MIT, matching repo root `LICENSE`)

## 2. Build the pluggable storage adapter (Phase 2)

- [x] 2.1 Define the storage adapter interface (`load(id)`, `save(record)`, `list()`, `delete(id)`) as a module, matching `js/persistence.js`'s existing project-record shape (`lib/storage-adapter.js`, with a shared contract test suite run against every implementation)
- [x] 2.2 Wrap `js/persistence.js`'s existing Dexie calls (`createProject`, `saveProject`, `loadProject`, `renameProject`, delete) as the default adapter implementation of that interface — custom-brush and color-palette CRUD stay direct Dexie calls, unaffected (`createDexieProjectAdapter`)
- [x] 2.3 Introduce an active-adapter mechanism (defaulting to the Dexie adapter) that `persistence.js`'s public functions delegate to, so call sites (`js/workspace.js`, `js/new-canvas.js`, `js/app.js`) are unchanged (`_setStorageAdapter`/`_resetStorageAdapter`; `saveProject`/`renameProject` now no-op on a missing id, matching Dexie's `.update()` semantics exactly, since the adapter's `save()` is a full-record upsert)
- [x] 2.4 Run `npm test` — confirm persistence tests still pass against the default adapter (all 13 pre-existing persistence tests pass unmodified; found and fixed the `package.json` test glob not picking up `lib/*.test.js` files directly under `lib/` — only one level deeper — while implementing this)
- [x] 2.5 Add a test double / in-memory adapter used only by tests to verify a non-Dexie adapter can be substituted and exercised through the same call sites (`createInMemoryAdapter` + `test/persistence.test.js`'s new "storage adapter substitution" test, going through `createProject`/`saveProject`/`loadProject`/`renameProject`/`listProjects`/`deleteProject`, not the adapter directly)
- [x] 2.6 Smoke-test the standalone app again (new project, auto-save, reload, Gallery, delete) — confirm no behavior change (verified via Playwright)

## 3. Build the mount API (Phase 3)

- [ ] 3.1 Give `js/workspace.js` (and `js/new-canvas.js` if in scope for the mounted flow) a constructor-style entry point that accepts a host container element and options, instead of assuming fixed `index.html` element IDs
- [ ] 3.2 Create `lib/pixi.js` exposing `Pixi.mount(hostElement, options)`, returning an instance with `destroy()`
- [ ] 3.3 Implement `instance.loadImage(pngBlobOrImageData)` on top of `lib/pixel-engine/`'s `LayerStack`
- [ ] 3.4 Implement `instance.getImage({ format })` (PNG/Blob/Base64/ImageData) on top of `lib/pixel-engine/`'s `LayerStack`; refactor `js/export.js`'s panel to call the same underlying encode function rather than duplicating it
- [ ] 3.5 Implement `instance.on(event, handler)` for at least a `change` event, firing on every committed drawing action (same granularity as auto-save)
- [ ] 3.6 Implement `options.ui.gallery: false` to suppress Gallery/navigation chrome when mounted
- [ ] 3.7 Implement `options.ui.tools` to restrict the available tool set
- [ ] 3.8 Implement `options.ui.onSave` / `options.ui.onCancel` callbacks that a host can supply in place of the app's own Gallery-driven save/cancel flow
- [ ] 3.9 Thread `options.storage` (a storage adapter per Phase 2) through to the mounted instance's persistence calls
- [ ] 3.10 Write an example host page (e.g. `lib/pixi-embed-example.html`, not part of the shipped app) demonstrating mount → loadImage → edit → getImage → destroy
- [ ] 3.11 Run `npm test` and smoke-test both the standalone app (unchanged) and the example embedded page

## 4. Documentation and licensing

- [ ] 4.1 Write the new mount API's usage docs (README or doc page) covering: mount/destroy, loadImage/getImage, events, UI-control options, storage adapter option, and whether the Dexie CDN dependency is needed (only when using the default adapter)
- [ ] 4.2 Add pointers from the main `README.md` to `lib/pixel-engine/README.md` and the new mount API docs; update the "Project structure" listing to include `lib/`
- [ ] 4.3 Confirm `LICENSE` (MIT) text permits this integration model as-is; state this explicitly in the new docs
- [ ] 4.4 Add an explicit note in the new docs that Pixi Pro's access/license terms (paid, private-repo collaborator or release archive) are separate from Standard's MIT terms and do not carry the same redistribution rights

## 5. Remove the superseded change

- [ ] 5.1 Delete `openspec/changes/extract-pixel-engine-library/` (its scope is fully covered by section 1 above)

## 6. Pixi Pro follow-on (tracked, not implemented here)

- [ ] 6.1 Once this change is implemented and merged in the Pixi (Standard) repo, open a corresponding change in the `pixi-pro` repo to extend the mount API and storage adapter contract to Pro's additional surface (Layers panel, Color Library, symmetry, etc.), verifying this design's assumptions against Pro's actual source
