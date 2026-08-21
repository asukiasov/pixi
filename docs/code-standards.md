# Code Standards

Derived from the codebase (`js/`, `lib/`, `test/`) on 2026-08-21, red-teamed
and revised on 2026-08-21 (see `docs/audits/2026-08-21-code-standards-audit.md`
for the audit that first *used* this doc, and the red-team pass that then
*corrected* it). Every convention below is backed by 3+ examples found in
the code — this documents actual practice, not aspirational style. Where
the original derivation overstated a pattern, this revision says so
explicitly rather than silently softening the wording.

## Naming Conventions

### Fixed, immutable tunable constants use `SCREAMING_SNAKE_CASE`; module-level mutable state/singletons/caches use `camelCase` regardless of `const`/`let`

The original derivation only checked for the first half and claimed it
covered "constants... declared at module top-level" without qualification.
Module-scoped state — a Dexie instance, a write queue, a mutable
reference — is just as common at module top-level and is consistently
`camelCase`, not `SCREAMING_SNAKE_CASE`, even when declared `const`.

- `js/canvas-view.js:6-8` — `MIN_SCALE`, `MAX_SCALE`, `ZOOM_STEP_FACTOR` (fixed tunables)
- `lib/pixel-engine/layers.js:9,11,22` — `MAX_LAYERS`, `BLEND_MODES`, `LOSSY_QUALITY` (fixed tunables)
- `js/magnetic-hover.js:17-19` — `ACTIVATION_RADIUS`, `MAX_PULL`, `MAX_SCALE_BUMP` (fixed tunables)
- `js/persistence.js:32` — `export const db = new Dexie('pixi');` (mutable-ish singleton reference, camelCase)
- `js/persistence.js:57,71` — `let activeAdapter = ...`, `const writeQueues = new Map();` (module state, camelCase)
- `lib/pixel-engine/engine.js:203,208` — `let pathTransform = null;`, `const circleOffsetsCache = new Map();` (module state, camelCase)

### Classes use `PascalCase`, one exported class per file

- `lib/pixel-engine/engine.js:5` — `export class PixelEngine`
- `lib/pixel-engine/layers.js:69` — `export class LayerStack` (internal helper `class Layer` at line 24 not exported)
- `lib/pixel-engine/undo.js:7` — `export class UndoStack`
- `js/canvas-view.js:10` — `export class CanvasView`

Checked every `class` declaration in the repo (6 total) — no exceptions.

### Private class fields/methods use `#` prefix with `camelCase` names

- `lib/pixel-engine/engine.js:17,21` — `#indexOf(x, y)`, `#inBounds(x, y)`
- `js/canvas-view.js:11-31` — `#canvasEl`, `#containerEl`, `#layerStack`, `#ctx`, `#scale`, `#panX`, `#panY`
- `js/canvas-view.js:66-69` — bound private handlers used directly as listeners

Note: declaring a private field somewhere in the class body is a **JS
language requirement**, not a team choice — only the `camelCase` naming
after `#` is a real, discretionary convention.

### Functions/variables use `camelCase`; most functions follow `verbNoun`, with real exceptions

The original derivation stated `verbNoun` as a blanket rule. It's the
majority pattern but not universal — bare-verb functions and event-handler
`on*` names are common enough to name as sub-patterns, not exceptions to
suppress.

- `js/router.js:18,44,66,85` — `parseRouteHash`, `formatRoute`, `navigate`, `onRouteChange` (verbNoun)
- `js/brushes.js:62,83,122,137` — `pixelsFromGrid`, `rotatedBrushPixels`, `placeBrush`, `rainbowColor` (verbNoun)
- `js/confirm-dialog.js:50,58,61,64,67` — `onConfirm`, `onCancel`, `onOverlayClick`, `onKeydown` (bare `on*` event-handler names, not verbNoun)
- `js/theme.js:105`, `js/workspace.js:768,816` — `apply`, `show`, `hide` (bare verbs, no noun)

### A leading-underscore prefix marks a test-only/internal export not meant to be called from app code

Not in the original derivation — a real, repeated, functionally
meaningful convention that was missed.

- `js/persistence.js:93` — `_setStorageAdapter`
- `js/persistence.js:98` — `_resetStorageAdapter`
- `js/persistence.js:208` — `_clearAllForTests`

### DOM element variables are usually named after their UI role (`Button`, `Input`, `Panel`, `Slider`, `Toggle`, `Checkbox`), not a generic `El` suffix

**Correction**: the original derivation claimed a generic `El` suffix was
the convention, citing `CanvasView`'s internal fields. Red-teaming found
this is backwards — `El` is the minority pattern (roughly 10-12 instances,
concentrated in `canvas-view.js`), against 60+ role-suffixed DOM variables
across the rest of the codebase.

- `js/gallery.js:11-13` — `grid`, `emptyState`, `newButton`
- `js/export.js:53-60` — `toggleButton`, `panel`, `closeButton`, `transparentCheckbox`, `downloadButton`
- `js/new-canvas.js:20-24` — `presetButtons`, `customWidthInput`, `customHeightInput`, `backgroundRadios`, `createButton`
- `js/workspace.js` — 40+ more: `widthInput`, `nameInput`, `undoButton`, `exportButton`, `pencilSizeSlider`, `brushesPanel`, `deleteBrushButton`, etc.

`El` itself still appears, narrowly, inside `CanvasView`'s own private
fields (`js/canvas-view.js:11-31,55-56,82`) and as a generic parameter name
in one-off DOM-utility functions (`js/export.js:12`'s `anchorEl`) — worth
knowing, not worth following as the general rule.

### `kebab-case.js` filenames, describing the module's purpose rather than mirroring the exported class/function name

- `js/canvas-view.js` exports `CanvasView`
- `js/confirm-dialog.js` exports `confirmDialog`
- `js/icon-font-fallback.js`, `js/magnetic-hover.js`, `lib/storage-adapter.js` — kebab-case throughout, all 26 files checked, zero exceptions

### Options-object arguments: a genuinely optional argument gets an overall `= {}` default with inline per-field defaults; a required argument (all fields always supplied by the caller) does not

**Correction**: the original derivation stated the `= {}` fallback as a
blanket rule for "options objects." It isn't — it tracks whether the
argument is actually optional, and the majority of citable examples are
*required*-argument init functions that correctly omit the fallback.

- `js/confirm-dialog.js:41` — `confirmDialog({ title = '...', ... } = {})` — callable with zero args, so it needs the fallback
- `js/router.js:66` — `navigate(route, { replace = false } = {})` — the options half is optional
- `js/gallery.js:10` — `initGallery({ onOpenProject, onNewCanvas })` — required, no fallback; calling with no argument throws `TypeError`
- `js/new-canvas.js:19`, `js/workspace.js:1598`, `js/app.js:101` — same required-argument pattern, no fallback

This is a real functional distinction, not just two styles: omitting the
fallback on a required-argument function is correct (a caller must supply
it); adding one there would silently paper over a caller bug.

## File/Folder Organization

### `lib/` holds standalone, DOM-optional/portable modules meant to be reusable outside the app; `js/` never gets imported by `lib/`

- `lib/pixel-engine/README.md:1-8` — "can be used outside the Pixi app... This folder is self-contained"
- `js/app.js:6`, `js/new-canvas.js:1`, `js/workspace.js:1,6` — all import from `../lib/pixel-engine/*.js`, confirming the one-way dependency

**Correction**: the original derivation also claimed "each with its own
README" — that's not supported. `lib/pixel-engine/` has one; the
single-file `lib/storage-adapter.js` does not. Treat a README as
appropriate for a multi-file `lib/` unit, not a rule every `lib/` file
must individually satisfy.

### Tests for `lib/` modules are co-located next to their source (`<name>.test.js` beside `<name>.js`); tests for `js/` modules live in a separate top-level `test/` directory

- `lib/pixel-engine/engine.js` + `lib/pixel-engine/engine.test.js` — co-located pair
- `lib/storage-adapter.js` + `lib/storage-adapter.test.js` — co-located pair
- `test/brushes.test.js`, `test/router.test.js`, `test/shape-tools.test.js` — cover `js/brushes.js`, `js/router.js`, `js/shape-tools.js`, kept out of `js/` entirely
- `package.json:7` — test script globs both locations separately

(This is the same fact as the Testing Conventions section's first rule —
stated once here as the organizational rule; see that section for the
testing-specific conventions built on top of it.)

### Within a module file, one primary export is common in small/focused files; the codebase's two largest and most central files (`workspace.js`, `persistence.js`) do not follow this, and neither does `lib/pixel-engine/engine.js`

**Correction — the original "one primary export per file" rule doesn't
survive contact with the code.** `js/workspace.js` has ~30 exports,
`js/persistence.js` has 12, and `lib/pixel-engine/engine.js` — cited by
the original derivation *as an example of the rule* — itself exports 4
functions beyond its one class. This isn't a rule the codebase follows;
it's an artifact of the original derivation sampling only small files
(`gallery.js`, `new-canvas.js`, `export.js`) and missing the large ones.

- `js/workspace.js` — ~30 exports (state accessors, Pro-extension hooks, canvas operations)
- `js/persistence.js` — 12 exports (`db`, CRUD functions, test-only `_`-prefixed helpers)
- `lib/pixel-engine/engine.js` — `PixelEngine` class plus `bresenhamLine`, `registerPathTransform`, `circleOffsets`, `strokeFreehandThick`

No rule stated here — this is deliberately left out. A small, focused file
tends to have one primary export; a file that's the hub for a whole
screen or subsystem (`workspace.js`, `persistence.js`) does not, and
that's the normal, working shape of this codebase, not a deviation from one.

## Error Handling & Logging

### Invalid input/out-of-range calls are handled by an early-return guard clause (`return`, `return false`, `return null`); refused/invalid operations signal the same way, never by throwing

(Merges the original derivation's separate "never throw" rule and
"refused operation returns null/false" rule under API/Interface Design —
they're the same underlying pattern, cited twice in the original doc.)

- `lib/pixel-engine/engine.js:31,59` — `setPixel`/`floodFill` return silently if out of bounds
- `lib/pixel-engine/layers.js:112,119,146,165,197-236,526-531` — `setActiveLayer`/`addLayer`/`addReferenceImageLayer`/`deleteLayer`/`setReferenceMode`/reorder-and-lock guards/`mergeLayers` all return `false`/`null` on invalid input
- `js/workspace.js:49` — `if (!HEX_COLOR_RE.test(value)) return null;`
- `js/app.js:145` — `return false;` on a refused operation

Verified repo-wide: zero `throw` statements exist in any non-test `js/*.js`
or `lib/**/*.js` file.

### Failures reaching browser APIs the code doesn't control are *usually* wrapped in try/catch with a safe fallback — but this is not universal

**Correction**: the original derivation stated this as an absolute rule.
It isn't — three production `matchMedia()` calls are unguarded, one of
them (`js/gallery.js:36`) at module-evaluation time with no feature
detection at all, meaning it would throw on import (not just at call
time) in an environment lacking `matchMedia`.

- `js/theme-boot.js:13-27` — try/catch around localStorage/matchMedia access, comment explains the fallback (follows the rule)
- `js/theme.js:75-89` — `readStoredPreference`/`writeStoredPreference` both catch and fall back safely (follows the rule)
- `js/theme.js:103` — unguarded `window.matchMedia(...)` inside `initThemeToggle()` (does not follow the rule)
- `js/gallery.js:36` — unguarded, module-eval-time `window.matchMedia(...)` (does not follow the rule; flagged as a real fix candidate, not just a doc note — see the follow-up list)
- `js/workspace.js:650-651` — checks `matchMedia` *exists* before calling it, but doesn't try/catch the call itself

### No `console.*` logging exists anywhere in `js/` or `lib/` — verified even stronger than originally stated (holds in `test/` too)

Confirmed by repo-wide grep across all four locations — failures are
handled purely through return-value conventions and comments, never logged.

### Mutating persistence functions silently no-op when the target id is missing, mirroring Dexie's own `.update()` semantics — with one known exception

- `js/persistence.js:134,150` — `saveProject`/`renameProject`: `if (!existing) return;`
- `lib/storage-adapter.js:12,36-38,61-63` — `delete(id)` documented and implemented as a no-op if `id` is missing, in both adapter implementations

**Known exception**: `js/persistence.js:209-211`'s test-only
`_clearAllForTests()` calls `db.projects.clear()` directly, bypassing the
active adapter entirely for the `projects` table — the exact table the
Data Access section's "exclusively through `activeAdapter`" rule claims is
adapter-only. Flagged as a real fix candidate (see follow-up list): with a
non-Dexie adapter active, this clears the wrong store.

## Layering & Dependency Direction

### `lib/` never imports from `js/` — dependencies flow strictly one way, `js/` → `lib/`

- `lib/pixel-engine/layers.js:7` — only import is `./engine.js` (a sibling lib file)
- `lib/storage-adapter.js:42-49` — `createDexieProjectAdapter(db)` takes `db` as a parameter instead of importing it from `js/persistence.js`, explicitly to avoid a `lib/` → `js/` dependency
- Verified: zero `lib/` → `js/` imports anywhere, tests included

### `js/` modules import from `lib/` using explicit relative `../lib/...` paths

- `js/app.js:6`, `js/persistence.js:23`, `js/new-canvas.js:1`, `js/workspace.js:1,6`

## Data Access / Persistence

### Project-record reads/writes in `js/persistence.js` go through a swappable `activeAdapter` object, with one known test-only exception; brush/palette tables still go straight to Dexie by design

- `js/persistence.js:117,133-134,142,157,162,167` — `createProject`/`saveProject`/`loadProject`/`listProjects`/`deleteProject` all route through `activeAdapter`
- `js/persistence.js:187,193,197` — `db.customBrushes.put/toArray/delete` bypass the adapter, deliberately (out of scope per this file's header comment, not a bug)
- `js/persistence.js:209-211` — `_clearAllForTests()` bypasses the adapter for the `projects` table too, but this is *not* deliberate the way the customBrushes carve-out is — see the Error Handling section's note

### Storage adapter implementations are thin one-line pass-throughs to the underlying store, with no extra logic or error translation

- `lib/storage-adapter.js:27-63` — every method body in both `createInMemoryAdapter` and `createDexieProjectAdapter` is exactly one statement

### Writes to the same project id are serialized through a per-id promise queue (`enqueueWrite`)

- `js/persistence.js:73-82,132,148,167` — `saveProject`/`renameProject`/`deleteProject` all wrapped; `createProject` (`:117`) correctly isn't, since a brand-new id has nothing in flight to race against

### `LayerStack` converts to/from plain storage records via a dedicated method pair (`toProjectRecord`/`fromProjectRecord`)

- `lib/pixel-engine/layers.js:333-382` — the only avenue in, since `LayerStack`'s fields are private (`#`) and not reachable from outside the class at all

## Testing Conventions

### Every test file's setup imports (`{ test, describe }` from `node:test`, `assert` from `node:assert/strict`) appear near the top, though not always as a strict first-two-lines rule

**Correction**: the original derivation claimed a fixed "first two lines"
order for all 10 test files. 8 of 10 do this; 2 files put a required
polyfill import first.

- `test/router.test.js:1-2`, `lib/pixel-engine/engine.test.js:1-2` — test/describe then assert, first two lines
- `lib/storage-adapter.test.js:1-3`, `test/persistence.test.js:1-3` — `import 'fake-indexeddb/auto';` comes first (a required polyfill for these two files' IndexedDB use), then test/describe, then assert

### `describe()` blocks group tests one level deep by function/class/behavior area

- `lib/pixel-engine/engine.test.js:17`, `lib/pixel-engine/layers.test.js:20,91`, `test/router.test.js:5,50`, `lib/storage-adapter.test.js:14`
- Verified: no `describe()` is nested inside another anywhere in the repo

### Test names are full lowercase sentences describing the behavior/expected outcome — not `it should…`/`test_` style

- `lib/pixel-engine/engine.test.js:18,50`, `lib/pixel-engine/layers.test.js:82`, `test/theme.test.js:29`, `test/router.test.js:41`

### `beforeEach`/`afterEach` are used sparingly, only for shared external/global state cleanup

- `test/persistence.test.js:21-23,221-226` — clearing the DB, restoring the storage adapter
- `test/theme.test.js:141-143` — restoring stubbed globals

### Mocking uses hand-written plain-object "fakes" installed onto `globalThis`, or real minimal implementations as test doubles — no mocking library

- `test/theme.test.js:70-138` — `fakeElement`/`fakeButton`/`fakeMediaQuery`/`fakeStorage`, installed as `globalThis.document`/`window`/`localStorage`
- `test/persistence.test.js:19` — `createInMemoryAdapter()`, a real implementation used as the storage double
- No mocking library exists in `package.json` devDependencies (`dexie`, `fake-indexeddb` only) — worth noting `fake-indexeddb` is itself a third-party test double, not hand-written, used by `lib/storage-adapter.test.js` and `test/persistence.test.js`

### Assertions use only Node's built-in `node:assert/strict` — no third-party assertion library

- `lib/pixel-engine/engine.test.js:22,52-53`, `lib/storage-adapter.test.js:56`, `test/persistence.test.js:29`

### A shared test-contract function, run once per implementation under test, is a technique used in this codebase — currently once, not an established repeated convention

**Correction**: the original derivation generalized this into a
convention from a single occurrence, below its own 3+ citation bar.

- `lib/storage-adapter.test.js:13-59` — `adapterContractTests(name, createAdapter)`, invoked at `:61` and `:63-69` for the two adapter implementations

Worth reaching for again if a second multi-implementation scenario shows
up; not (yet) something every test file is expected to follow.

## Comments & Documentation Style

### Most, not "nearly every," module opens with a plain `//` header comment stating what the file is and its DOM-free/testability boundary

**Correction**: the original derivation claimed "nearly every module."
5 of 16 `js/` files (31%) have no file-level header at all — including
`js/workspace.js`, the single largest and most central file in the app.

- `lib/pixel-engine/engine.js:1-3`, `lib/pixel-engine/layers.js:1-5`, `lib/storage-adapter.js:1-17`, `js/canvas-view.js:1-4`, `js/persistence.js:1` — have headers
- `js/workspace.js:1`, `js/app.js:1`, `js/gallery.js:1`, `js/new-canvas.js:1`, `js/export.js:1` — start directly with an import or constant, no header

### JSDoc `/** */` blocks are used on most exported functions/classes to explain non-obvious behavior, edge cases, or design rationale — not to restate parameter types

- `js/router.js:13-17`, `lib/pixel-engine/engine.js:195-202,210-218`, `lib/pixel-engine/undo.js:23-28`, `js/icon-font-fallback.js:20-41`

### Inline comments cross-reference other files, spec/change slugs, or audit docs by name/date

- `js/app.js:19-22`, `js/icon-font-fallback.js:7-8`, `lib/pixel-engine/layers.js:10`, `js/persistence.js:12-20`

### Non-obvious test assertions/setups get inline `//` comments explaining *why* a particular input or arrangement was chosen

- `lib/pixel-engine/layers.test.js:483-487,96,702-709`, `lib/pixel-engine/engine.test.js:226-227`

### No TODO/FIXME markers appear anywhere in `js/`, `lib/`, or `test/`

Verified by repo-wide case-insensitive grep — zero hits. Deferred work is
documented inline as prose pointing to a design doc or future change instead.

## API/Interface Design

### `create*`-named factory functions return a plain object literal, not a class instance

**Correction**: the original derivation's third citation
(`persistence.js`'s `createProject`) doesn't actually support the "object
implementing an interface" half of the claim — `createProject` returns a
plain data record with no methods, not an interface implementation. Only
2 solid citations exist for the full claim; treat this as a pattern worth
following when it applies (a factory backing a swappable interface), not
yet a 3+-evidenced blanket convention.

- `lib/storage-adapter.js:24` — `createInMemoryAdapter()` returns `{ load, save, list, delete }`
- `lib/storage-adapter.js:50` — `createDexieProjectAdapter(db)` returns the same shape

## Configuration & Environment Handling

### Third-party/CDN dependencies are resolved through the HTML import map by bare specifier, never bundled or vendored locally

- `index.html:24` — `{ "imports": { "dexie": "https://esm.sh/dexie@4" } }`
- `js/persistence.js` — `import Dexie from 'dexie';`, resolved via the import map
- `index.html:35` — the same external-URL idiom applied to the Google Fonts stylesheet

### Type/format enum-like arrays are usually declared as named constants and reused — with one documented exception

**Correction**: the original derivation stated this without exception.
`lib/pixel-engine/layers.js`'s `referenceMode` (`'pixelated'`/`'original'`)
is a genuine two-value enum that's never given a named constant — its
literals are re-listed inline at 6+ sites, including the validation check
the rule's rationale specifically calls out as the case a named constant
would help.

- `js/export.js:1-2` — `SCALES`, `FORMATS` (follows the rule)
- `js/theme.js:25,28` — `PREFERENCES`, `CYCLE_ORDER` (follows the rule)
- `lib/pixel-engine/layers.js:18` — `MIME_TYPES` (follows the rule)
- `lib/pixel-engine/layers.js:57,145,165,312,376,611` — `referenceMode`'s `'pixelated'`/`'original'` literals, including the `:165` validation `if` check (does not follow the rule; flagged as a real fix candidate — see follow-up list)

## Other Observed Patterns

### "Pro extension point" comments mark hooks kept in the open-source repo for the private `pixi-pro` add-on — compliance with the full pattern (tag + named consuming file) is inconsistent

See `architecture-standards.md`'s "Pro extension point" section for the
full pattern definition and the compliance-gap finding — restated briefly
here since it's also a comment-style convention: most instances include
the `(split-pixi-pro-repo)` tag, a minority (10 of 24, 42%) don't, and
naming the *specific* consuming pixi-pro file is inconsistent even among
tagged instances.

### A `moved to pixi-pro's js/pro/<file>.js (split-pixi-pro-repo)` comment marks code extracted to the paid add-on, left as a breadcrumb

- `js/workspace.js:111-127,385-396,632,1030-1031,1083-1084`, `lib/pixel-engine/engine.test.js:73-74,142`, `lib/pixel-engine/README.md:24`

Unlike the "Pro extension point" rule above, this pattern is followed
consistently — 14/14 instances checked carry the full breadcrumb.

### Value clamping to a numeric range uses the repeated `Math.max(min, Math.min(max, value))` idiom (or a locally-scoped `clamp` helper) rather than a shared utility

- `js/canvas-view.js:459`, `js/new-canvas.js:8`, `js/workspace.js:462,529-530,1075,1191,1254,1264`, `js/export.js:21,24` — 15+ sites, three separate local `clamp`/`clampSize` helpers, no shared module-level utility

Genuine duplication, not just style — 15+ near-identical clamp expressions
would collapse into one shared helper, but nothing has forced the issue yet.

## Known code issues surfaced by this audit, not yet fixed

These aren't documentation problems — they're real inconsistencies or
latent bugs in the code itself, found while verifying the rules above.
Listed here for visibility; whether/how to fix them is a separate decision
from what this doc describes.

1. `js/persistence.js:209-211` — `_clearAllForTests()` bypasses the active
   storage adapter, clearing `db.projects` directly. With a non-Dexie
   adapter active, this clears the wrong store.
2. `js/gallery.js:36` — unguarded, module-eval-time `matchMedia()` call
   with no feature detection; would throw at import time in an environment
   lacking `matchMedia`.
3. `js/theme.js:103`, `js/workspace.js:650-651` — unguarded `matchMedia()`
   calls, lower severity than #2 (not at module-eval time).
4. `lib/pixel-engine/layers.js`'s `referenceMode` — inline-relisted string
   literals instead of a named constant, including in a validation check.
5. `lib/pixel-engine/layers.js`'s `mergeLayers`/`mergeDown`/`getRenderPlan`
   — touch the DOM transitively (via `#compositeSubset`) without saying so
   in their own doc comments, unlike every other DOM-touching method in
   `lib/`. See `architecture-standards.md`'s DOM-optional rule.
6. 10/24 "Pro extension point" comments lack the `(split-pixi-pro-repo)`
   tag and/or a named consuming pixi-pro file.
