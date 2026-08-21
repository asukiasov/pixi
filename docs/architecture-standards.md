# Architecture Standards

Structural rules this repo follows — which module may depend on which,
how extension points are exposed, and what constraints the "no build
step" stack imposes. Complements [`code-standards.md`](code-standards.md)
(naming/style/testing conventions); this doc covers module boundaries and
dependency direction instead. Written 2026-08-21, red-teamed and revised
2026-08-21 — several claims in the original version turned out to
misdescribe the code they cited as evidence; this revision corrects those
rather than preserving them for diplomacy. Several of these rules were
first established as the `embeddable-integration-api` OpenSpec change's
`design.md` decisions and are captured here so they outlive that change
once it's archived.

A note on scope: this document is allowed to state forward-looking,
prescriptive guidance ("when you add X, do Y") in addition to describing
what's already true — unlike `code-standards.md`, which only describes
established practice. The distinction that matters is *honesty about
which is which*: a forward-looking rule must say so, and must not cite
examples that don't actually demonstrate it.

## The three top-level code areas

| Area | What lives here | May import from |
|---|---|---|
| `lib/` | Standalone, reusable modules — not Pixi-app-specific | Other `lib/` files, plus third-party packages for `lib/`'s own test files (see note below) |
| `js/` | The Pixi app itself: UI, tools, routing, persistence wiring | `lib/` and other `js/` files |
| `test/` | Tests for `js/` modules | `js/` and `lib/` |

**Correction**: the original version of this table said `lib/` may import
"other `lib/` files only," full stop — but `lib/`'s own co-located test
files (`lib/storage-adapter.test.js`, `lib/pixel-engine/*.test.js`) import
third-party packages (`dexie`, `fake-indexeddb`) as test-only dependencies,
the same way `test/persistence.test.js` does. That's not a violation of
the `lib/` → `js/` boundary rule below (those are still not `js/`
imports), but the table as originally stated would make a reader think
`lib/storage-adapter.test.js` breaks the rule. It doesn't — the boundary
this doc cares about is `lib/` never importing app-specific `js/` code,
not "zero third-party imports in test files."

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
would silently break that promise.

**How it's enforced**: by convention and code review, not tooling —
verified there is genuinely no lint rule or CI check preventing a
`lib/ → js/` import today (`package.json` has no `lint` script, no
`eslint-plugin-import` or equivalent boundary tooling anywhere in the
repo). Nothing currently stops a future PR from adding such an import
except human review. When adding to `lib/`, grep the new file for any
`from '../js` or `from './js` import before committing.

**Status**: verified holding with zero exceptions as of this revision.

## Rule: `lib/` modules are DOM-optional except at named, narrow points — the list of those points was incomplete

**Correction**: the original version of this rule named
`PixelEngine.toPNGBlob()` and `LayerStack.toPNGBlob()`/`composite()` as
the *only* DOM-touching methods in `lib/`. A full grep of `lib/**/*.js`
(non-test) for `document.`/`window.`/`navigator.`/`localStorage`/
`matchMedia` found the DOM dependency actually enters through a private
helper, `#compositeSubset` (`lib/pixel-engine/layers.js:456,465`), which
is called by more than the two named public methods:

- `LayerStack.composite()` — named in the original version, correct
- `LayerStack.toPNGBlob()` — named in the original version, correct
- `LayerStack.mergeLayers(indices)` — **not named**, calls
  `#compositeSubset` directly, has no "requires a DOM" note in its own
  doc comment
- `LayerStack.mergeDown(index)` — **not named**, calls `mergeLayers`,
  same gap
- `LayerStack.getRenderPlan()` — **not named**, calls `composite()`/
  `#compositeSubset` transitively, same gap despite a long doc comment
  that discusses rendering semantics at length without ever flagging the
  DOM dependency

This is real, not just a documentation nitpick: `lib/pixel-engine/
layers.test.js:702-709` already explicitly explains why only refusal
paths of `mergeLayers` are unit-tested ("DOM boundary") — the test suite
is visibly working around a constraint the architecture doc never told
anyone about. A contributor trying to unit-test `mergeLayers` under plain
Node with no DOM shim would hit a `document is not defined`
`ReferenceError` with no warning in the method's own doc comment.

**The underlying rule still holds** — everything else in `lib/` genuinely
has zero DOM dependency, and DOM-touching methods should say so in their
own doc comment. What's wrong is the enumeration, not the principle.

**Action item, not yet done**: add a "Requires a DOM" note to
`mergeLayers`, `mergeDown`, and `getRenderPlan`'s doc comments, matching
`toPNGBlob()`'s existing pattern — this is a real code/comment fix, not a
doc-only correction, and is tracked in `code-standards.md`'s "Known code
issues" list rather than done silently as part of this revision.

## Pattern: storage adapters as the persistence boundary

`js/persistence.js` never talks to Dexie directly for project records —
every read/write goes through a swappable `activeAdapter` object shaped
`{ load(id), save(record), list(), delete(id) }` (defined in
`lib/storage-adapter.js`), **with one known exception**:
`_clearAllForTests()` (test-only) reaches into `db.projects.clear()`
directly rather than going through the adapter — see
`code-standards.md`'s Error Handling section for why this matters (it's a
real latent bug under a non-Dexie adapter, not just an inconsistency).

**When adding a new kind of persisted data**: decide explicitly whether
the new data needs to be swappable by an embedding host. If yes, it needs
its own adapter interface before it ships. If no (standalone-app-only,
like custom brushes today), direct Dexie access is the established,
simpler default.

**Concurrency note** (forward-looking guidance — stated honestly as such,
not as an already-multiply-demonstrated pattern): a storage adapter's
`save()` is a full-record upsert, not a partial field update. Any caller
that does load-modify-save must serialize writes to the same record id —
see `js/persistence.js`'s `enqueueWrite`, currently the *only* place this
applies, since `activeAdapter` (and thus `load`/`save`) is referenced
nowhere else in the repo (verified by grep across `js/`, `lib/`, `test/`).
This wasn't a concern with the old direct `db.projects.update(id,
{partialFields})` call (a single atomic IndexedDB transaction); it became
one the moment persistence routed through a generic adapter interface.
Any *new* adapter-backed, read-modify-write call site needs the same
per-id serialization — this is unenforced by tooling, same as the `lib/`
boundary rule above.

## Pattern: "Pro extension point" — aspirational target, inconsistently achieved today

Pixi (this repo, MIT) and Pixi Pro (a separate private repo, paid) share
a codebase lineage — Pro was extracted out of what's now Standard (see
git history: "Extract Layers panel out to pixi-pro" and similar commits,
tracked under the `split-pixi-pro-repo` branch/theme). The intended
pattern:

1. **A hook, not an implementation.** Core logic Pro needs to extend is
   exposed as a registration function or exported constant, with a no-op
   default when no Pro module is present.
2. **A comment names what consumes it**, including a `(split-pixi-pro-repo)`
   tag and the specific pixi-pro file that calls it.
3. **Code that moved to Pro leaves a breadcrumb**: `moved to pixi-pro's
   js/pro/<file>.js (split-pixi-pro-repo)`.

**Correction — this is not consistently achieved.** A full count of "Pro
extension point" comments across the repo (24 total) found 10 (42%) missing
the `(split-pixi-pro-repo)` tag entirely, and naming the *specific*
consuming file is inconsistent even among the tagged ones — several say
only something generic like "a Pro Canvas Settings panel" rather than a
filename. This is worth calling out plainly: **the original version of
this rule cited `js/workspace.js:1476` (`getCanvasSize`) and `:1482`
(`onWorkspaceReset`) as canonical, fully-compliant examples — in the
actual source, neither one carries the tag, and neither names a specific
file.** The rule's own supporting citations didn't hold up.

Part 3 (the breadcrumb pattern) is different — it's followed consistently:
14/14 `moved to pixi-pro` comments checked carry the full form.

**What this means in practice**: the 3-part hook pattern is the right
target to aim for on a *new* Pro-facing hook (it's genuinely useful when
followed — see part 3's consistency for what "actually followed" looks
like), but don't assume an existing "Pro extension point" comment already
names its consuming file just because it has the tag; check it. Whether to
retroactively fix the 10 non-compliant comments is a separate decision,
tracked in `code-standards.md`'s "Known code issues" list.

## Constraint: no build step, ever

This repo has no bundler, no transpiler, no npm package for the shipped
app. `js/*.js` and `lib/**/*.js` are loaded directly by the browser as ES
modules; third-party dependencies (currently just Dexie) resolve via
`index.html`'s import map to a CDN URL, not a local `node_modules` copy.
`package.json`'s `devDependencies` exist solely so `node --test` can run
under Node for local/CI test runs — they are never shipped or bundled.

Verified directly: no `webpack.config.js`, `vite.config.*`,
`rollup.config.*`, `.babelrc`, or `tsconfig.json` exists anywhere in the
repo, and `package.json` has no `build`/`dev`/`start` script.

**This applies to every new module added anywhere in the repo, including
`lib/`.** A `lib/` folder meant to be copied out of the repo by a
developer doubly can't depend on a build step. If a new dependency is
ever needed at runtime, it must be either resolvable via the import map
(CDN) or a copy-in-repo vendored file.

## Where these rules come from, and what to do if they conflict with a real change

Every rule above is inferred from what the code already does — see
`code-standards.md`'s citations for the naming/testing/comment
conventions, and this change's `design.md` for the storage-adapter and
`lib/` boundary decisions specifically. If new work genuinely needs to
break one of these rules, that's a real architectural decision, not a
refactor — it belongs in a new OpenSpec change's `design.md` with the
trade-off explained, per this repo's `CLAUDE.md` process rules, and this
document should be updated to reflect the new rule once that change
lands.

**On revising this document**: when a rule turns out to be wrong (as
several were in this revision), say so in the text rather than quietly
rewording it — a future reader benefits from knowing a claim was checked
and corrected, not just seeing the corrected version with no trace of the
error. Don't let this doc's citations go stale relative to the code
either: if you touch a file this doc cites by line number and the cited
behavior moves or changes, update the citation in the same change.
