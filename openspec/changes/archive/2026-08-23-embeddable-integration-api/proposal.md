## Why

Today Pixi and Pixi Pro are standalone web apps only — a developer cannot
pull either into their own product. There is no public JS surface to mount
into a host element, no way to load/read an image without the UI's own
Export button, and persistence is hardcoded to Dexie/IndexedDB. A developer
evaluating the repo for integration hits this as an immediate blocker (see
README's own "This is a standalone web app, not a library" disclaimer).
The intended distribution stays the project's existing model — a developer
downloads/vendors the repo's source onto their machine, no npm registry,
no bundler, no build step — but today even that vendoring path has no
integration seam to land on. This change adds that seam.

This supersedes the narrower `extract-pixel-engine-library` change (folding
`PixelEngine`/`LayerStack`/`UndoStack` into a standalone folder), whose goal
becomes this change's first phase — extracting the headless data model is a
prerequisite for the mount API described below, not a separate effort.

## What Changes

- **BREAKING** (internal only, not app-visible): relocate `js/engine.js`,
  `js/layers.js`, `js/undo.js` (and their tests) into a dependency-free
  `lib/pixel-engine/` folder — carried over unchanged from
  `extract-pixel-engine-library`'s scope. No behavior change to the
  deployed app.
- Add a new public entry module (e.g. `lib/pixi.js`) exposing a
  mount/lifecycle API: `Pixi.mount(hostElement, options)` returns an editor
  instance with:
  - `loadImage(pngBlobOrImageData)` / `getImage({ format })` returning
    PNG/Blob/Base64/ImageData, independent of the UI's Export button
  - `on(event, handler)` for change notifications (e.g. `change`, `export`)
  - `destroy()` to unmount and release canvas/DOM resources
  - `options.ui` to control which chrome is shown (e.g. `gallery: false`,
    `tools: [...]`, `onSave`/`onCancel` callbacks replacing the app's own
    Gallery/Save flow) — enough for a host to run Pixi as a focused
    single-canvas editing surface, not just the full app shell
- Define a storage adapter interface (`load(id)`, `save(record)`,
  `list()`, `delete(id)`) with Dexie/IndexedDB as the default
  implementation, used unmodified when the app runs standalone. A host
  passes `options.storage` to supply its own backend when embedding;
  `js/persistence.js`'s Dexie calls move behind this interface rather than
  being called directly.
- Document, in the new module's own README, whether the CDN-resolved
  runtime dependency (Dexie, via `index.html`'s import map) is still
  required when embedded, and what a vendoring developer needs to provide
  for it (see design.md).
- Confirm and document Standard's `LICENSE` (MIT) permits this integration
  model as-is. Separately document that Pixi Pro's access/license terms
  (paid, private-repo collaborator or release archive) are **not** the same
  as Standard's MIT terms — an embedding developer with Pro access does not
  automatically get MIT-level redistribution rights for Pro's code.
- Pixi Pro (separate private repo, not checked out in this workspace):
  extend the same mount API and storage adapter contract to Pro's
  additional surface (Layers panel, Color Library, symmetry, etc.), built
  the same way Pro currently layers its own files on top of Standard's
  exports. This half of the change is designed against Standard's new
  public contract and Pro's existing import pattern, not verified against
  Pro's actual source — treat it as a starting point to confirm/adjust once
  work begins in the `pixi-pro` repo itself.

## Capabilities

### New Capabilities
- `pixel-engine-library`: the extracted, documented, standalone pixel data
  model (`PixelEngine`, `LayerStack`, `UndoStack`) at `lib/pixel-engine/`,
  usable outside the Pixi app by copying the folder. Carried over from
  `extract-pixel-engine-library` (that change's proposal/design/tasks
  content is folded into this one; its directory is removed).
- `embeddable-editor-api`: the public mount/lifecycle JS surface
  (`Pixi.mount`, `loadImage`/`getImage`, events, `destroy`, UI-control
  options) that lets a host application embed Pixi in its own page.
- `pluggable-storage-adapter`: the storage adapter interface plus the
  Dexie/IndexedDB default implementation, replacing `local-persistence`'s
  current hardcoded Dexie usage as the *only* option.

### Modified Capabilities
- `local-persistence`: requirements are restated in terms of the default
  storage adapter rather than assuming Dexie/IndexedDB directly — standalone
  behavior is unchanged, but the requirement language now allows a
  substitutable backend.

## Impact

- **Code moved**: `js/engine.js`, `js/layers.js`, `js/undo.js` (+ tests) →
  `lib/pixel-engine/`.
- **New files**: `lib/pixi.js` (or similar) as the mount API entry point;
  `lib/pixel-engine/README.md`; a storage adapter module/interface file;
  usage docs for the new embeddable surface.
- **Changed**: `js/persistence.js` (routed through the adapter interface
  instead of calling Dexie directly), `js/workspace.js`/`js/new-canvas.js`/
  `js/app.js` (import path updates), `README.md` (pointers to the new
  library/embedding docs).
- **Removed**: `openspec/changes/extract-pixel-engine-library/` (superseded
  by this change).
- **No new runtime dependency** beyond the existing CDN-resolved Dexie;
  no build tooling added.
- **Pixi Pro repo**: out-of-repo impact, tracked as a follow-on change in
  `pixi-pro` once this lands in Standard.
