# Code Standards

Derived from the codebase (`js/`, `lib/`, `test/`) on 2026-08-21. Every
convention below is backed by 3+ examples found in the code — this
documents actual practice, not aspirational style.

## Naming Conventions

### Constants use `SCREAMING_SNAKE_CASE`, declared at module top-level

- `js/canvas-view.js:6-8` — `MIN_SCALE`, `MAX_SCALE`, `ZOOM_STEP_FACTOR`
- `js/theme.js:24` — `STORAGE_KEY = 'pixi-theme-preference'`
- `lib/pixel-engine/layers.js:9,11,22` — `MAX_LAYERS`, `BLEND_MODES`, `LOSSY_QUALITY`
- `js/workspace.js:9,15,24` — `BRUSH_EDITOR_SIZE`, `RAINBOW_HUE_STEP`, `BLEND_MODES`
- `js/gallery.js:30-32` — `PAW_PARADE_CLICKS`, `PAW_PARADE_WINDOW_MS`, `PAW_PARADE_LENGTH` (+5 more, e.g. `js/export.js:1-2`, `js/new-canvas.js:4-6`)

### Classes use `PascalCase`, one exported class per file

- `lib/pixel-engine/engine.js:5` — `export class PixelEngine`
- `lib/pixel-engine/layers.js:69` — `export class LayerStack` (internal helper `class Layer` at line 24 not exported)
- `lib/pixel-engine/undo.js:7` — `export class UndoStack`
- `js/canvas-view.js:10` — `export class CanvasView`

### Private class fields/methods use `#` prefix with `camelCase` names, declared as class-body fields before use in the constructor

- `lib/pixel-engine/engine.js:17,21` — `#indexOf(x, y)`, `#inBounds(x, y)`
- `js/canvas-view.js:11-31` — `#canvasEl`, `#containerEl`, `#layerStack`, `#ctx`, `#scale`, `#panX`, `#panY`
- `js/canvas-view.js:66-69` — bound private handlers used directly as listeners: `this.#onPointerDown`, `this.#onPointerMove`, `this.#onPointerUp`

### Functions and variables/parameters use `camelCase`, functions named `verbNoun`

- `js/router.js:18,44,66,85` — `parseRouteHash`, `formatRoute`, `navigate`, `onRouteChange`
- `js/brushes.js:62,83,122,137` — `pixelsFromGrid`, `rotatedBrushPixels`, `placeBrush`, `rainbowColor`
- `js/shape-tools.js:16,26,51` — `registerRectangleDrawOverride`, `drawRectangle`, `clipToSelection`
- `js/new-canvas.js:8,19` — `clampSize`, `initNewCanvasScreen`

### DOM element variables/params are suffixed with `El`

- `js/canvas-view.js:55-56` — constructor params `canvasEl`, `containerEl`
- `js/canvas-view.js:82` — `this.#aboveCanvasEl = document.createElement('canvas')`
- `js/workspace.js:803-818,1224-1225` — `tooltipEl`, `foregroundSwatchEl`, `backgroundSwatchEl`
- `js/export.js:12` — function parameter `anchorEl`

### File names use `kebab-case.js`, describing the module's purpose rather than mirroring the exported class/function name

- `js/canvas-view.js` exports `CanvasView`
- `js/confirm-dialog.js` exports `confirmDialog`
- `js/icon-font-fallback.js`, `js/magnetic-hover.js`, `lib/storage-adapter.js` — kebab-case throughout `js/`, `lib/`, `test/` with no exceptions found

### Options/config objects are destructured directly in function parameters, with inline defaults and an overall `= {}` fallback

- `js/confirm-dialog.js:41` — `confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Delete' } = {})`
- `js/icon-font-fallback.js:42` — `checkIconFontLoaded(fontSet, { timeoutMs = DEFAULT_TIMEOUT_MS } = {})`
- `js/router.js:66` — `navigate(route, { replace = false } = {})`
- `js/gallery.js:10` — `initGallery({ onOpenProject, onNewCanvas })`
- `lib/pixel-engine/layers.js:145,497,662` — `addReferenceImageLayer`, `#compositeToCanvas`, `toPNGBlob` (+2 more)

## File/Folder Organization

### `lib/` holds standalone, DOM-optional/portable modules meant to be reusable outside the app, each with its own README; `js/` never gets imported by `lib/`

- `lib/pixel-engine/README.md:1-8` — "can be used outside the Pixi app... This folder is self-contained"
- `lib/pixel-engine/README.md` (Relationship section) — "The Pixi app (`js/`...) builds its Workspace screen... on top of these three classes"
- `js/app.js:6`, `js/new-canvas.js:1`, `js/workspace.js:1,6` — all import from `../lib/pixel-engine/*.js`, confirming the one-way dependency

### Tests for `lib/` modules are co-located next to their source (`<name>.test.js` beside `<name>.js`); tests for `js/` modules live in a separate top-level `test/` directory

- `lib/pixel-engine/engine.js` + `lib/pixel-engine/engine.test.js` — co-located pair
- `lib/storage-adapter.js` + `lib/storage-adapter.test.js` — co-located pair
- `test/brushes.test.js`, `test/router.test.js`, `test/shape-tools.test.js` — cover `js/brushes.js`, `js/router.js`, `js/shape-tools.js`, kept out of `js/` entirely
- `package.json:7` — test script globs both locations separately: `"node --test test/**/*.test.js lib/*.test.js lib/**/*.test.js"`

### `lib/` sub-libraries are grouped in their own named subfolder (multi-file modules); single-file `lib/` utilities sit flat at `lib/` root; `js/` is entirely flat (no subfolders)

- `lib/pixel-engine/` — `engine.js`, `layers.js`, `undo.js`, `README.md` grouped under one folder
- `lib/storage-adapter.js` — a single-file utility directly at `lib/` root, no subfolder
- every file under `js/` (16 files) sits flat with no subdirectories

### Within a module file, one primary export (class or init function) per file, with private helper functions/constants kept in the same file below it

- `lib/pixel-engine/engine.js:5` (`export class PixelEngine`) vs. `:144,154,169` — unexported helpers `colorsEqual`, `interpolatePath`
- `js/gallery.js:10` (`export function initGallery`) vs. `:44,68,87` — unexported `bindPawParadeEasterEgg`, `pawParade`, `buildProjectTile`
- `js/new-canvas.js:19` (`export function initNewCanvasScreen`) vs. `:8` — unexported `clampSize`
- `js/export.js:52` (`export function initExport`) vs. `:12,35` — unexported `positionPanel`, `sanitizeFilename`

## Error Handling & Logging

### Invalid input/out-of-range calls are handled by an early-return guard clause (`return`, `return false`, `return null`), never by throwing

- `lib/pixel-engine/engine.js:31` — `setPixel` returns silently if out of bounds
- `lib/pixel-engine/engine.js:59` — `floodFill` returns silently if out of bounds
- `lib/pixel-engine/layers.js:112` — `setActiveLayer` returns if out of range or targeting a reference layer
- `lib/pixel-engine/layers.js:119,146,197-198` — `addLayer`/`addReferenceImageLayer`/`deleteLayer` return `null`/`false` at capacity or on invalid index
- `lib/pixel-engine/layers.js:526-531` — `mergeLayers` returns `false` for non-array input, too few indices, out-of-range indices, or locked layers

There are no `throw` statements anywhere in `js/*.js` or `lib/**/*.js` (excluding tests) — confirmed repo-wide.

### Failures reaching browser APIs the code doesn't control (localStorage, matchMedia) are wrapped in try/catch, swallowed with an explanatory comment, and fall back to a safe default

- `js/theme-boot.js:13-27` — try/catch around localStorage/matchMedia access; empty catch body, comment explains the fallback
- `js/theme.js:75-81` — `readStoredPreference()` falls back to `'system'` on storage errors
- `js/theme.js:85-89` — `writeStoredPreference()`'s catch is a no-op ("Non-fatal — the preference just won't survive a reload")

### No `console.*` logging exists anywhere in `js/` or `lib/`

Confirmed by repo-wide grep across all non-test files in both directories — failures are handled purely through return-value conventions and comments, not logged.

### Mutating persistence functions silently no-op (rather than erroring) when the target id is missing, explicitly mirroring Dexie's own `.update()` semantics

- `js/persistence.js:134` — `saveProject`: `if (!existing) return;`
- `js/persistence.js:150` — `renameProject`: `if (!existing) return;`
- `lib/storage-adapter.js:12,36-38,61-63` — `delete(id)` documented and implemented as a no-op if `id` is missing, in both `createInMemoryAdapter` and `createDexieProjectAdapter`

## Layering & Dependency Direction

### `lib/` never imports from `js/` — dependencies flow strictly one way, `js/` → `lib/`

- `lib/pixel-engine/layers.js:7` — only import is `./engine.js` (a sibling lib file)
- `lib/storage-adapter.js:42-49,50` — `createDexieProjectAdapter(db)` takes `db` as a parameter instead of importing it from `js/persistence.js`, explicitly to avoid a `lib/` → `js/` dependency
- `lib/pixel-engine/engine.js` and `lib/pixel-engine/undo.js` have zero non-test imports at all
- repo-wide grep for `from '../js` inside `lib/**/*.js` (non-test) returns nothing

### `js/` modules import from `lib/` using explicit relative `../lib/...` paths

- `js/app.js:6` — `import { LayerStack } from '../lib/pixel-engine/layers.js'`
- `js/new-canvas.js:1` — same
- `js/persistence.js:23` — `import { createDexieProjectAdapter } from '../lib/storage-adapter.js'`
- `js/workspace.js:1,6` — `UndoStack`, `bresenhamLine`/`strokeFreehandThick`

## Data Access / Persistence

### All project-record reads/writes in `js/persistence.js` go exclusively through a swappable `activeAdapter` object (`load`/`save`/`list`/`delete`); brush/palette tables still go straight to Dexie

- `js/persistence.js:117` — `createProject` → `activeAdapter.save(record)`
- `js/persistence.js:133,142` — `saveProject` → `activeAdapter.load(id)` then `activeAdapter.save(merged)`
- `js/persistence.js:157` — `loadProject` → `activeAdapter.load(id)`
- `js/persistence.js:162` — `listProjects` → `activeAdapter.list()`
- `js/persistence.js:167` — `deleteProject` → `activeAdapter.delete(id)`
- Contrast: `js/persistence.js:187,193,197` (`db.customBrushes.put/toArray/delete`) bypass the adapter entirely, per that file's header comment

### Storage adapter implementations are thin one-line pass-throughs to the underlying store, with no extra logic or error translation

- `lib/storage-adapter.js:52-53` — `load(id) { return db.projects.get(id); }`
- `lib/storage-adapter.js:55-57` — `save(record) { await db.projects.put(record); }`
- `lib/storage-adapter.js:58-60` — `list() { return db.projects.toArray(); }`
- `lib/storage-adapter.js:61-63` — `delete(id) { await db.projects.delete(id); }`
- The same 1:1 shape is mirrored in `createInMemoryAdapter` (`lib/storage-adapter.js:27-38`)

### Writes to the same project id are serialized through a per-id promise queue (`enqueueWrite`) rather than fired directly

- `js/persistence.js:73-82` — `enqueueWrite` implementation, chaining each task behind the previous settled promise for that id
- `js/persistence.js:132` — `saveProject` wrapped in `enqueueWrite(id, async () => {...})`
- `js/persistence.js:148` — `renameProject` wrapped the same way
- `js/persistence.js:167` — `deleteProject` wrapped the same way

### LayerStack converts to/from plain storage records via a dedicated method pair (`toProjectRecord`/`fromProjectRecord`), never via `persistence.js` reaching into LayerStack internals

- `lib/pixel-engine/layers.js:333-351` — `toProjectRecord()`
- `lib/pixel-engine/layers.js:367-382` — `static fromProjectRecord(record)`
- `js/persistence.js:112` — `createProject` spreads `...layerStack.toProjectRecord()`
- `js/persistence.js:137` — `saveProject` spreads the same

## Testing Conventions

### Test files are co-located `*.test.js` siblings under `lib/`, and mirrored in a top-level `test/` folder for `js/`

- `lib/pixel-engine/engine.test.js`, `lib/pixel-engine/layers.test.js`, `lib/storage-adapter.test.js` — co-located with source
- `test/router.test.js`, `test/theme.test.js`, `test/persistence.test.js`, `test/brushes.test.js`, `test/shape-tools.test.js`, `test/icon-font-fallback.test.js` — mirror a same-named file under `js/`

### Every test file imports `{ test, describe }` from `node:test` and `assert` from `node:assert/strict`, in that fixed order, as the first two lines

- `test/router.test.js:1-2`, `lib/pixel-engine/engine.test.js:1-2`, `lib/pixel-engine/undo.test.js:1-2`, `lib/pixel-engine/layers.test.js:1-2`, `test/theme.test.js:1-2` (10 files follow this exact pattern)

### `describe()` blocks group tests one level deep by function/class/behavior area, often named after the exact export or a spec/feature slug in parentheses

- `lib/pixel-engine/engine.test.js:17` — `describe('PixelEngine construction', ...)`
- `lib/pixel-engine/layers.test.js:20` — `describe('Background layer (2g-background-layer)', ...)`
- `lib/pixel-engine/layers.test.js:91` — `describe('reference image layer (reference-image-layer)', ...)`
- `test/router.test.js:5,50` — `describe('parseRouteHash', ...)`, `describe('formatRoute', ...)`
- `lib/storage-adapter.test.js:14` — `` describe(`${name} (storage adapter contract)`, ...) ``

### Test names are full lowercase sentences describing the behavior/expected outcome, reading like a spec — not `it should…`/`test_` style

- `lib/pixel-engine/engine.test.js:18` — `'transparent background fills all pixels with alpha 0'`
- `lib/pixel-engine/engine.test.js:50` — `'out-of-bounds setPixel is a no-op'`
- `lib/pixel-engine/layers.test.js:82` — `'a record with no isBackground field defaults to false'`
- `test/theme.test.js:29` — `'unrecognized input falls back to the start of the cycle'`
- `test/router.test.js:41` — `'"#/project/" (no id) -> gallery fallback'`

### `beforeEach`/`afterEach` are used sparingly, only for shared external/global state cleanup — each test constructs its own fresh object inline rather than relying on setup hooks

- `test/persistence.test.js:21-23` — `beforeEach(async () => { await _clearAllForTests(); })`
- `test/persistence.test.js:221-226` — `afterEach(() => { ... _setStorageAdapter(...) ... })`
- `test/theme.test.js:141-143` — `afterEach(() => { if (restoreGlobals) restoreGlobals(); })`

### Mocking uses hand-written plain-object "fakes" (not a mocking library), installed onto `globalThis` and restored afterward, or real minimal implementations used as test doubles

- `test/theme.test.js:70-110` — `fakeElement`, `fakeButton`, `fakeMediaQuery`, `fakeStorage` helpers
- `test/theme.test.js:116-138` — `setUp()` installs fakes as `globalThis.document`/`window`/`localStorage`
- `test/persistence.test.js:19` — uses `createInMemoryAdapter()` (a real implementation) as the storage test double, not a mock library
- `lib/storage-adapter.test.js:63-69` — builds a uniquely-named in-memory Dexie DB per test run as its double

### Assertions use only Node's built-in `node:assert/strict` — no third-party assertion library

- `lib/pixel-engine/engine.test.js:22` — `assert.deepEqual(...)`
- `lib/pixel-engine/engine.test.js:52-53` — `assert.doesNotThrow(...)`
- `lib/storage-adapter.test.js:56` — `assert.doesNotReject(...)`
- `test/persistence.test.js:29` — `assert.ok(record.id)`

### A shared test contract is factored into a reusable function invoked once per implementation under test, instead of duplicating test bodies

- `lib/storage-adapter.test.js:13-59` — `function adapterContractTests(name, createAdapter) { describe(...) {...} }`
- `lib/storage-adapter.test.js:61` — `adapterContractTests('createInMemoryAdapter', ...)`
- `lib/storage-adapter.test.js:63-69` — `adapterContractTests('createDexieProjectAdapter', ...)`

## Comments & Documentation Style

### Nearly every module opens with a plain `//` header comment stating what the file is, its DOM-free/testability boundary, and cross-references to design docs or other files — WHY over WHAT

- `lib/pixel-engine/engine.js:1-3` — "Pixel buffer and pure drawing operations. DOM-free... See design.md for the rationale."
- `lib/pixel-engine/layers.js:1-5` — explains stack management is DOM-free/unit-testable, compositing isn't
- `lib/pixel-engine/undo.js:1-3` — explains the stack is "opaque to what a snapshot is"
- `lib/storage-adapter.js:1-17` — explains the adapter interface contract and cross-references the `pluggable-storage-adapter` spec and design.md
- `js/canvas-view.js:1-4` — states ownership boundary ("Knows nothing about tools, colors, layers, or the undo stack")

### JSDoc `/** */` blocks are used on most exported functions/classes to explain non-obvious behavior, edge cases, or design rationale — not to restate parameter types

- `js/router.js:13-17` — JSDoc on `parseRouteHash` explaining it's a pure function, easy to unit test
- `lib/pixel-engine/engine.js:195-202` — JSDoc on `registerPathTransform` explaining the Pro-extension-point pattern
- `lib/pixel-engine/engine.js:210-218` — JSDoc on `circleOffsets` explaining the membership formula
- `lib/pixel-engine/undo.js:23-28` — JSDoc on `push()` explaining why the redo branch is discarded
- `js/icon-font-fallback.js:20-41` — long JSDoc justifying an API choice with manual-testing evidence

### Inline comments cross-reference other files, spec/change slugs, or audit docs by name/date, tying code back to its origin/rationale

- `js/app.js:19-22` — "AUD-5: detect whether the Material Symbols icon font... See js/icon-font-fallback.js."
- `js/icon-font-fallback.js:7-8` — "See docs/audits/2026-08-17-ui-polish-audit.md AUD-5."
- `lib/pixel-engine/layers.js:10` — "Pro extension point (split-pixi-pro-repo): exported so pixi-pro's Layers panel UI can populate its blend-mode select..."
- `js/persistence.js:12-20` — references `lib/storage-adapter.js`, the `embeddable-editor-api` capability, and design.md

### Non-obvious test assertions/setups get inline `//` comments explaining *why* a particular input or arrangement was chosen

- `lib/pixel-engine/layers.test.js:483-487` — "'transparent', not 'white' - a white-background starting layer is now the locked Background layer..."
- `lib/pixel-engine/layers.test.js:96` — "Isolate the center pixel's row from the rest via a border, then fill."
- `lib/pixel-engine/layers.test.js:702-709` — explains why only refusal paths are unit-tested (DOM boundary)
- `lib/pixel-engine/engine.test.js:226-227` — explains a `-0` vs `0` normalization gotcha in the assertion

No TODO/FIXME markers appear anywhere in `js/`, `lib/`, or `test/` (confirmed by repo-wide grep) — deferred/out-of-scope work is documented inline as prose pointing to a design doc or future change instead.

## API/Interface Design

### Options-object arguments are destructured inline with per-field defaults, wrapped in an overall `= {}` default

(See Naming Conventions' matching rule — same citations apply.)

### Factory functions named `create*` return a plain object literal implementing an interface, rather than a class instance

- `lib/storage-adapter.js:24` — `createInMemoryAdapter()` returns `{ load, save, list, delete }` backed by a closed-over `Map`
- `lib/storage-adapter.js:50` — `createDexieProjectAdapter(db)` returns the same shape backed by `db.projects`
- `js/persistence.js`'s `createProject` follows the same `create*` naming for its own factory-style call site

### Mutating/validating methods signal a refused operation by returning `null`/`false` instead of throwing

- `lib/pixel-engine/layers.js:119` — `if (this.#layers.length >= MAX_LAYERS) return null;`
- `lib/pixel-engine/layers.js:165` — `if (mode !== 'pixelated' && mode !== 'original') return false;`
- `lib/pixel-engine/layers.js:197-236` — five more `return false;` guards for out-of-range/locked-layer refusals
- `js/workspace.js:49` — `if (!HEX_COLOR_RE.test(value)) return null;`
- `js/app.js:145` — `return false;` on a refused operation

## Configuration & Environment Handling

### Module-level `UPPER_CASE` constants near the top of the file hold tunable magic numbers/enums, usually with a comment explaining units/meaning

- `js/canvas-view.js:6-8` — `MIN_SCALE = 0.25`, `MAX_SCALE = 8`, `ZOOM_STEP_FACTOR = 1.25`
- `js/new-canvas.js:4-6` — `PRESETS = [16, 32, 64, 128]`, `MIN_SIZE = 1`, `MAX_SIZE = 256`
- `lib/pixel-engine/undo.js:5` — `MAX_SNAPSHOTS = 20`
- `lib/pixel-engine/layers.js:9,22` — `MAX_LAYERS = 8`, `LOSSY_QUALITY = 0.92`
- `js/magnetic-hover.js:17-19` — `ACTIVATION_RADIUS = 45; // px`, `MAX_PULL`, `MAX_SCALE_BUMP`

### Third-party/CDN dependencies are resolved through the HTML import map by bare specifier, never bundled or vendored locally

- `index.html:24` — `{ "imports": { "dexie": "https://esm.sh/dexie@4" } }`
- `js/persistence.js` — `import Dexie from 'dexie';`, resolved via the import map above
- `index.html:35` — the same external-URL idiom applied to a non-JS resource (Google Fonts stylesheet)

### Type/format enum-like arrays are declared as named constants and reused for validation/iteration instead of re-listing literals inline

- `js/export.js:1-2` — `SCALES = [1, 2, 4, 8]`, `FORMATS = ['png', 'webp', 'jpg']`
- `js/theme.js:25,28` — `PREFERENCES`, `CYCLE_ORDER`
- `js/workspace.js:24` — `BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay']`
- `lib/pixel-engine/layers.js:18` — `MIME_TYPES = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' }`

## Other Observed Patterns

### "Pro extension point" comments mark public exports/hooks kept in the open-source repo specifically so the private `pixi-pro` add-on can call into or extend core state, each explaining what pixi-pro does with it

- `js/workspace.js:150` — read access to the current `LayerStack` "so pixi-pro's Layers panel can call its ... methods directly"
- `js/workspace.js:1476-1489` — `getCanvasSize()`/`onWorkspaceReset(fn)` documented as what "pixi-pro's own canvas-settings-ui.js calls instead"
- `lib/pixel-engine/engine.js:196-204` — `registerPathTransform(fn)`, the hook pixi-pro uses for pixel-perfect corner removal
- `lib/pixel-engine/layers.js:10` — `BLEND_MODES` exported "so pixi-pro's Layers panel UI can populate its blend-mode select without duplicating this list"
- `js/shape-tools.js:6`, `js/persistence.js:25-30` — two more sites documenting the same split-pixi-pro-repo rationale (+15 more across `js/workspace.js` alone)

### A `moved to pixi-pro's js/pro/<file>.js (split-pixi-pro-repo)` comment marks code that used to live in this file and was extracted to the paid add-on, left as a breadcrumb rather than silently deleted

- `js/workspace.js:111-127` — merge-layers/clearLayerMarks logic "moved to pixi-pro"
- `js/workspace.js:385-396,632,1030-1031,1083-1084` — Layers panel rendering, Color Library UI, opacity popovers (+6 occurrences in this one file)
- `lib/pixel-engine/engine.test.js:73-74,142` — notes pixel-perfect corner removal moved to pixi-pro
- `lib/pixel-engine/README.md:24` — cross-references `registerPathTransform` as the engine's documented extension point

### Value clamping to a numeric range uses the repeated `Math.max(min, Math.min(max, value))` idiom (or a locally-scoped `clamp`/`clampSize` helper) rather than a shared utility

- `js/canvas-view.js:459` — local `function clamp(value, min, max) {...}`
- `js/new-canvas.js:8` — local `function clampSize(value) {...}`
- `js/workspace.js:462,529-530,1075,1191,1254,1264` — six separate inline clamps (grid cell size, brush editor dimension, popover slider, RGB channel, brush spacing, rotation)
- `js/export.js:21,24` — two more inline clamps for popover viewport positioning
