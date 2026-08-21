# Architecture Standards

Structural rules this repo follows — which module may depend on which,
how extension points are exposed, and what constraints the "no build
step" stack imposes. Complements [`code-standards.md`](code-standards.md)
(naming/style/testing conventions); this doc covers module boundaries and
dependency direction instead. Written 2026-08-21, alongside the
`embeddable-integration-api` OpenSpec change — several of these rules were
first established as that change's `design.md` decisions and are captured
here so they outlive that change once it's archived.

## The three top-level code areas

| Area | What lives here | May import from |
|---|---|---|
| `lib/` | Standalone, reusable modules — not Pixi-app-specific | Other `lib/` files only |
| `js/` | The Pixi app itself: UI, tools, routing, persistence wiring | `lib/` and other `js/` files |
| `test/` | Tests for `js/` modules | `js/` and `lib/` |

`lib/`'s own tests (`lib/**/*.test.js`) are co-located next to their
source rather than living in `test/` — see `code-standards.md`'s
File/Folder Organization section.

## Rule: `lib/` never imports from `js/`

Dependency direction is one-way: `js/` → `lib/`, never the reverse. A
`lib/` module that needs something only `js/` has (e.g. the Dexie `db`
instance) takes it as a parameter instead of importing it directly — see
`lib/storage-adapter.js`'s `createDexieProjectAdapter(db)`, which accepts
`db` rather than importing it from `js/persistence.js`.

**Why**: `lib/` exists specifically to be copied out of the repo and used
standalone (see each `lib/` folder's own README). An import from `js/`
would silently break that promise — the folder would no longer be
self-contained, and a developer who copied only `lib/pixel-engine/` (for
example) would hit a missing-file error with no clear explanation.

**How it's enforced**: by convention and code review, not tooling — there
is no lint rule or CI check preventing a `lib/ → js/` import today. When
adding to `lib/`, grep the new file for any `from '../js` or `from './js`
import before committing.

## Rule: `lib/` modules are DOM-optional except at named, narrow points

Every `lib/` class/function is plain data manipulation and runs anywhere
JS runs, **except** a small number of methods that explicitly need
`document.createElement('canvas')` for PNG encoding or compositing (e.g.
`PixelEngine.toPNGBlob()`, `LayerStack.toPNGBlob()`/`composite()`). Those
methods say so in their own doc comment. Everything else in `lib/` — pixel
buffer manipulation, layer stack management, undo/redo, storage adapters —
has zero browser API dependency and is directly unit-testable under
Node's `node:test` runner with no DOM shim.

**Why**: this is what makes `lib/` genuinely portable and fast to test —
a developer (or this repo's own CI) doesn't need a browser or a DOM
polyfill to exercise the vast majority of `lib/`'s surface.

**When adding to `lib/`**: default to DOM-free. If a new method genuinely
needs a browser API, name the constraint explicitly in its doc comment
(see `PixelEngine.toPNGBlob()`'s doc comment for the pattern), rather than
letting the dependency be a surprise at import time.

## Pattern: storage adapters as the persistence boundary

`js/persistence.js` never talks to Dexie directly for project records —
every read/write goes through a swappable `activeAdapter` object shaped
`{ load(id), save(record), list(), delete(id) }` (defined in
`lib/storage-adapter.js`). The default (`createDexieProjectAdapter`) wraps
the existing Dexie `projects` table; `createInMemoryAdapter` is a test
double and the template for a host-supplied backend.

**When adding a new kind of persisted data** (following the existing
`customBrushes`/`colorPalettes` precedent, which stays direct-Dexie and
is *not* routed through an adapter): decide explicitly whether the new
data needs to be swappable by an embedding host. If yes, it needs its own
adapter interface (or an extension of the existing one) before it ships —
retrofitting an adapter onto direct Dexie calls later is a bigger change
than designing it in from the start. If no (the data is standalone-app-only,
like custom brushes today), direct Dexie access is the established,
simpler default — don't add adapter indirection for its own sake.

**Concurrency note**: a storage adapter's `save()` is a full-record
upsert, not a partial field update. Any caller that does
load-modify-save (rather than a single `save()` call with a
complete record) must serialize writes to the same record id — see
`js/persistence.js`'s `enqueueWrite` — otherwise two concurrent writers
can silently clobber each other's change. This wasn't a concern with the
old direct `db.projects.update(id, {partialFields})` call (a single
atomic IndexedDB transaction); it became one the moment persistence
routed through a generic adapter interface. Any new adapter-backed,
read-modify-write call site needs the same per-id serialization.

## Pattern: "Pro extension point" — how the open-source repo stays extensible without containing the paid add-on

Pixi (this repo, MIT) and Pixi Pro (a separate private repo, paid) share
a codebase lineage — Pro was extracted out of what's now Standard (see
git history: "Extract Layers panel out to pixi-pro" and similar commits,
tracked under the `split-pixi-pro-repo` branch/theme). The pattern that
makes this work without Pro's code leaking into the public repo:

1. **A hook, not an implementation.** Core logic that Pro needs to extend
   is exposed as a registration function or exported constant — e.g.
   `lib/pixel-engine/engine.js`'s `registerPathTransform(fn)` (Pro's
   pixel-perfect drawing hooks in here at runtime), or `LayerStack`'s
   exported `BLEND_MODES` array (Pro's Layers panel UI reads it rather
   than duplicating the list). The hook has a no-op default when no Pro
   module is present, so Standard works unmodified without Pro installed.
2. **A comment names what consumes it.** Every such export/hook has an
   inline comment identifying it as a "Pro extension point
   (split-pixi-pro-repo)" and naming which file in `pixi-pro` calls it —
   e.g. `js/workspace.js`'s `getCanvasSize()`/`onWorkspaceReset(fn)`
   documented as what "pixi-pro's own canvas-settings-ui.js calls
   instead." This is the only place that relationship is documented (Pro's
   repo isn't checked out alongside Standard's), so the comment is load-
   bearing, not decorative.
3. **Code that moved to Pro leaves a breadcrumb, not a silent deletion.**
   When a feature is extracted to Pro, the comment left behind says
   `moved to pixi-pro's js/pro/<file>.js (split-pixi-pro-repo)` at the
   point it used to live, so a future reader isn't left wondering where
   the logic went.

**When building a new Pro-only feature**: decide up front whether it
needs a hook in Standard (if Pro's UI needs to read/call into Standard's
state) or can live entirely inside Pro's own files with no Standard
changes at all (simpler, prefer this when possible). If a hook is needed,
follow the three points above — the hook, the naming comment, and (if
replacing existing Standard code) the breadcrumb.

## Constraint: no build step, ever

This repo has no bundler, no transpiler, no npm package for the shipped
app. `js/*.js` and `lib/**/*.js` are loaded directly by the browser as ES
modules; third-party dependencies (currently just Dexie) resolve via
`index.html`'s import map to a CDN URL, not a local `node_modules` copy.
`package.json`'s `devDependencies` exist solely so `node --test` can run
under Node for local/CI test runs — they are never shipped or bundled.

**This applies to every new module added anywhere in the repo,
including `lib/`.** A `lib/` folder meant to be copied out of the repo by
a developer doubly can't depend on a build step — there'd be nothing to
run it. If a new dependency is ever needed at runtime (not just for
tests), it must be either resolvable via the import map (CDN) or a
copy-in-repo vendored file — never an npm package the shipped app expects
to be pre-bundled.

## Where these rules come from, and what to do if they conflict with a real change

Every rule above is inferred from what the code already does — see
`code-standards.md`'s citations for the naming/testing/comment
conventions, and this change's `design.md` for the storage-adapter and
`lib/` boundary decisions specifically. If new work genuinely needs to
break one of these rules (e.g. a `lib/` module that must depend on
something in `js/`), that's a real architectural decision, not a
refactor — it belongs in a new OpenSpec change's `design.md` with the
trade-off explained, per this repo's `CLAUDE.md` process rules, and this
document should be updated to reflect the new rule once that change
lands.
