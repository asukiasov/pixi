## Context

See `proposal.md` for motivation. Relevant current-state facts, verified
against this repo before writing this design:

- `js/engine.js` (`PixelEngine`), `js/layers.js` (`LayerStack`), and
  `js/undo.js` (`UndoStack`) are already DOM-decoupled — their only browser
  API use is `document.createElement('canvas')` for offscreen
  compositing/PNG encoding (this is `extract-pixel-engine-library`'s
  finding, carried over unchanged).
- `js/persistence.js` is already DOM-free and Dexie-only — it imports
  `dexie` directly and exports functions like `createProject`,
  `saveProject`, `loadProject`, `renameProject`, plus custom-brush and
  color-palette CRUD. It has no adapter seam today.
- `js/app.js` is the app shell: it owns routing (`js/router.js`,
  hash-based), and wires `initNewCanvasScreen`, `initWorkspace`,
  `initGallery` against `document`-level elements in `index.html`. There is
  no code path today that constructs a workspace against an arbitrary host
  element instead of the app's own fixed DOM.
- `js/export.js` builds PNG/WebP/JPG bytes today only as a save-file
  side effect of the UI's Export panel — the encoding logic itself
  (canvas → blob) is exactly what a `getImage()` API needs, but it's
  currently entangled with the Export panel's DOM (positioning code,
  filename sanitization, a form of scale/format UI state).
- `index.html` resolves `dexie` via an import map pointing at a CDN ESM
  build — the shipped app has no npm dependency, `package.json`'s deps
  exist only for `node --test`.

## Goals / Non-Goals

**Goals:**
- Give a host application a JS surface to mount an editor, feed it an
  image, read the result back, and control which chrome shows — reachable
  by vendoring/copying source files, no registry, no bundler.
- Make persistence swappable without changing standalone behavior.
- Keep the extraction of the pixel data model (this design's first phase)
  a pure move, per `extract-pixel-engine-library`'s original design
  rationale — that reasoning is not repeated here in full; see that
  change's git history / the archived content folded into this one.

**Non-Goals:**
- No package registry publication, no build step, no CDN bundle for the
  new mount API — same "download/copy from GitHub" model as the engine
  library.
- No framework-specific wrapper (React/Vue components) — the mount API is
  framework-agnostic vanilla JS; a host's own framework code calls it from
  a lifecycle hook (e.g. `useEffect`/`onMounted`) on its own.
- No redesign of the Workspace screen's own visual layout — UI-control
  options (`gallery: false`, restricted tool list) reuse existing
  Workspace markup/behavior with pieces hidden, not a rebuilt UI.
- No decision here about Pixi Pro's actual implementation — that's
  explicitly deferred to the `pixi-pro` repo, informed by this design's
  contract.

## Decisions

**Phase the work: (1) extract the engine library, (2) build the storage
adapter, (3) build the mount API on top of both.** Each phase is
independently testable and the mount API's `loadImage`/`getImage` methods
are thin wrappers over the engine library once it exists — building it
last avoids designing the mount surface against code that's still being
moved.

**`lib/pixel-engine/` location and no-packaging stance carried over
unchanged from `extract-pixel-engine-library`.** That change's reasoning
(sibling of `js/`, tests move with source, no `package.json`, README
states last-verified tag) already resolved this; re-litigating it here
would add no value. See that change's original design content, preserved
in this change's git history.

**New mount API entry point lives at `lib/pixi.js`, a second top-level
library sibling to `lib/pixel-engine/`, not inside `js/`.** Mirrors the
engine library's placement rationale: it's meant to be copied out
independently of the app shell, so it can't live nested under `js/`.
`lib/pixi.js` depends on `lib/pixel-engine/` and on `js/`'s rendering/tool
code (see next decision) — that dependency direction is fine since
`lib/pixi.js` is the outermost, optional layer; `js/` and
`lib/pixel-engine/` never import back from `lib/`.

**The mount API reuses `js/`'s existing rendering/tool/UI code rather than
reimplementing it.** `Pixi.mount()` programmatically does what
`js/app.js` does today for the Workspace route — construct a Workspace
against a container — except the container is host-supplied instead of a
fixed `index.html` element, and `options.ui`/`options.storage` are threaded
through. This means `js/workspace.js` (and `js/new-canvas.js` if a host
wants the New Canvas flow) need a constructor-style entry point that takes
a container element and options, instead of assuming `document`-level
fixed IDs — a refactor of *how* they're invoked, not what they render.
Alternative considered: a fully separate, parallel "embedded mode"
implementation — rejected as duplicate maintenance burden for what is
fundamentally the same drawing surface.

**`loadImage`/`getImage` are built on `lib/pixel-engine/`'s
`LayerStack`, not on `js/export.js`.** `export.js`'s PNG/WebP/JPG encoding
is UI-entangled (panel DOM, filename UI); `LayerStack` already has (or
gains, if missing) the composite-to-canvas primitive needed for both
directions. `export.js`'s UI panel becomes a thin caller of the same
underlying encode function the mount API exposes, so there is one
encoding path, not two.

**Storage adapter interface: `{ load(id), save(record), list(),
delete(id) }`, matching `js/persistence.js`'s existing record shape.**
Chosen over a richer interface (e.g. separate methods per entity type —
projects vs. custom brushes vs. color palettes) because only project
records are in scope for embedding today; custom brushes/color palettes
stay Dexie-only for now (Pro-only surface, per proposal, deferred to the
`pixi-pro` follow-on). `js/persistence.js`'s Dexie calls become the
default adapter implementation, wrapped behind this interface; its public
function names (`createProject`, `saveProject`, etc.) stay as the
call-site API used by `js/workspace.js` etc., now delegating to whichever
adapter is active instead of calling `db.projects.*` directly.

**CDN-resolved Dexie stays as-is; embedding does not require vendoring
it.** A host that supplies its own storage adapter never exercises the
Dexie code path, so the import map entry is only resolved if the default
adapter is used. The new library's docs state this explicitly: embedding
with a custom adapter needs no CDN dependency; embedding with the default
adapter needs the same `dexie` CDN resolution the standalone app already
needs (host must keep or replicate the import map entry).

**`lib/pixi.js`'s public API throws on misuse/structural errors, reversing
`code-standards.md`'s repo-wide "never throw, return false/null/early"
convention — a deliberate exception, not an oversight.** `mount()`
(`validateHostElement`, `validateStorageAdapter`), `instance.on()` (a
non-function handler), and `instance.loadImage()`/`getImage()`/`save()`/
`cancel()` (called after `destroy()`) all throw instead of silently
no-op'ing or returning `null`. `LayerStack.loadImage()`
(`lib/pixel-engine/layers.js`) throws `RangeError` on a mismatched
`imageData.data.length` for the same reason, even though every sibling
method on that same class returns `false`/`null`. The rest of the
codebase's return-based convention exists so a refused *editor* operation
(an invalid tool click, a malformed record read from storage) degrades
silently rather than crashing a user's drawing session — but `lib/pixi.js`
and `LayerStack.loadImage()` are the boundary a *host application*
programs against, not the editor's own internal call graph. A host that
passes a non-Element `hostElement`, calls `mount()` with a broken
`options.storage`, or feeds `loadImage()` a wrongly-shaped `ImageData`
has a bug in its own integration code, not a recoverable in-editor
refusal — a thrown error surfaces that immediately, at the call site,
with a message naming exactly what's wrong; a silent `null`/`false`
return would instead surface as a confusing downstream failure (or no
failure at all) far from the actual mistake, which is worse for a host
developer debugging their integration than for an end user clicking the
wrong tool. This distinction is intentional and is not meant to spread:
new `lib/pixi.js` methods and `LayerStack.loadImage()`-style structural
validators should keep throwing for the same reason; everything else in
`lib/`/`js/` keeps returning `false`/`null`/early per `code-standards.md`.

**License: Standard's MIT `LICENSE` already permits this integration
model as written (use/copy/modify/distribute) — no license change needed
for Standard.** Verified by reading `LICENSE` directly (MIT, standard
terms, no additional restriction). Pixi Pro's terms are separate and not
addressed by Standard's LICENSE file — the new docs must say so explicitly
rather than let a developer assume Pro inherits MIT terms.

## Risks / Trade-offs

- **Refactoring `js/workspace.js`/`js/app.js` to accept a host container
  is more invasive than the pure-move engine extraction — real risk of
  behavior drift in the standalone app.** → Mitigation: same discipline as
  `extract-pixel-engine-library`'s "No app behavior change" requirement —
  run `npm test` and manually smoke-test the standalone app (draw, undo,
  layers, export, Gallery) after each phase, before considering it done.
- **`export.js` and the new `getImage()` sharing one encode path could
  regress the UI's Export feature if the refactor is careless.** →
  Mitigation: keep `export.js`'s own spec (`openspec/specs/export/`)
  as the regression check — its scenarios must keep passing unchanged.
- **The mount API's UI-control options (`gallery: false`, restricted
  tools) could grow into a large, ad-hoc options surface over time.** →
  Mitigation: this change ships only what's specified (hide Gallery,
  restrict tool list, `onSave`/`onCancel`); further UI-control knobs are a
  future change, not scope creep here.
- **Pixi Pro's actual code isn't available to verify this design
  against.** → Mitigation: explicitly flagged in the proposal; the
  `pixi-pro` follow-on change is where Pro's real constraints get checked
  against this contract, before Pro implementation starts.
- **A developer vendors an old commit/tag and hits a bug already fixed on
  `main`.** → Mitigation: same as the engine library — docs name the last
  verified tag; no further mitigation given the no-packaging constraint.

## Migration Plan

Ships as normal commits to `main`, deployed the same way as everything
else (static GitHub Pages, no build). No user-facing rollback concern —
this is a source-level integration seam, not a runtime feature toggle.
Sequence: (1) extract engine library + tests, verify standalone app
unchanged → (2) introduce storage adapter interface, migrate
`persistence.js` behind it, verify standalone app unchanged → (3) build
`lib/pixi.js` mount API on top of both, add its own README/usage example →
(4) update main `README.md` with pointers → (5) open the `pixi-pro`
follow-on change once this lands.

## Open Questions

- Exact shape of `options.ui`'s tool-restriction list (tool ids vs. a
  denylist vs. a category filter) — deferred to `tasks.md`
  implementation detail; doesn't change the spec-level requirement that
  tools are restrictable.
