# Phase 3 whole-phase review — `embeddable-integration-api` (mount API, tasks 3.1–3.11)

**Range reviewed:** `7f46d04` (last commit before 3.1) → `9313910` (HEAD at
review time). All 3.1–3.11 confirmed checked off in
`openspec/changes/embeddable-integration-api/tasks.md`; every listed commit
present in `git log`.

This is a whole-phase pass, distinct from each task's own per-task code
review during implementation — it looks for cross-task consistency,
architectural drift, and conformance to this repo's own standards docs
(`docs/code-standards.md`, `docs/architecture-standards.md`), not
correctness of any one diff in isolation. It combines three passes: (1)
standards-doc conformance across every file Phase 3 touched, (2) a
Web Interface Guidelines pass over `lib/pixi.js`'s `WORKSPACE_MARKUP` and
the DOM/interaction code Phase 3 touched in `js/workspace.js`/`js/export.js`,
and (3) a whole-branch `/code-review` plus manual architecture read focused
on cross-task consistency, module-level-state leaks, options-surface
growth, and test-coverage-shape consistency.

No files were changed as part of this review — assessment only; findings
are triaged and fixed in a follow-up.

## Strengths

- **The module-level-state-leak lesson genuinely propagated.** 3.2's
  `bindDomOnce()` fix, 3.5's per-instance event emitter, and 3.9's
  `activeAdapter`-capture-before-enqueue in `js/persistence.js` all show the
  same discipline being reapplied deliberately (each with an explicit
  comment pointing back at the earlier fix), not reinvented ad hoc each
  time. `js/export.js`'s new `outsideClickHandler`/`escapeHandler`
  remove-then-readd pattern (introduced in this same phase) followed the
  identical precedent unprompted.
- **Options surface held its scope.** `options.ui` has exactly the four
  sub-options design.md named (`gallery`, `tools`, `onSave`, `onCancel`) —
  verified by grep, no fifth crept in across 3.6–3.9.
- **Typo-safety vs. fail-loud is a consistent, well-reasoned split**:
  cosmetic `options.ui.*` misconfiguration silently degrades to today's
  default (`shouldShowGalleryChrome`/`resolveEnabledTools`/
  `resolveUiCallback`), while a structurally critical argument
  (`hostElement`, `options.storage`) throws immediately — the same rule
  stated three times, applied consistently.
- **Test-coverage-shape discipline (DOM-incapable / Playwright-verified
  split) is uniform** across 3.1–3.11 — each task's `tasks.md` entry
  documents it at comparable depth (3.6–3.9 are, if anything, more detailed
  than earlier tasks, not less).
- **Doc-comment honesty about the single-active-instance limitation holds
  up.** `lib/pixi.js`'s module header explicitly extends the limitation to
  3.9's `activeAdapter`, not just 3.2's DOM root — someone updated it as new
  module state was added, rather than leaving it stale.

## Issues

### Critical — both fixed post-review (see addendum)

**C-1. Race: `destroy()` can silently reroute the last in-flight autosave to
the wrong storage adapter.** (`js/persistence.js:191` / `js/workspace.js:223-227`)

`autoSave()` calls `state.onChange()` synchronously, then
`await state.layerStack.toPNGBlob()`, and only *after* that resolves calls
`saveProject(state.projectId, ...)`. `saveProject()` captures
`const adapter = activeAdapter` at the moment it's invoked — i.e., after the
`toPNGBlob()` await, not before it. If a host calls `instance.destroy()`
while that encode is still in flight, `destroy()`'s `_resetStorageAdapter()`
runs first, so by the time `saveProject()` executes, `activeAdapter` is
already back to the default Dexie adapter — the user's last edit under a
custom `options.storage` is silently written to IndexedDB instead of the
host's backend, with no error, no `'error'` event, nothing. The 3.9
write-ordering regression test covers a swap racing a queued write, not a
swap racing the caller that hasn't even called `saveProject()` yet — a
narrower case than the one that actually exists. This is exactly the
failure class task 3.9's own module-doc-comment claims was "audited" for.

**C-2. `lib/` → `js/` import breaks the repo's central architecture
invariant, and the standards doc wasn't updated in the same change.**
(`lib/pixi.js:44-46`)

`architecture-standards.md` states — as of this same worktree, unmodified
by Phase 3 — "`lib/` never imports from `js/`... Status: verified holding
with zero exceptions." `lib/pixi.js` imports `CanvasView`, `initWorkspace`,
and three `persistence.js` exports from `../js/`. This break is *sanctioned*
by `design.md:71-78`, which is the correct process per the architecture
doc's own escape hatch — but that same escape hatch requires "this document
should be updated to reflect the new rule once that change lands," and it
wasn't. Today, anyone consulting `architecture-standards.md` gets a false
answer about whether the boundary holds, and the rule's own stated
rationale ("`lib/` exists to be copied out standalone") is now false for
`lib/pixi.js` specifically with no note saying so.

### Important

**I-1. Inconsistent `destroyed`-guard on the `'error'` event vs.
`'change'`.** (`lib/pixi.js:730-732` vs. `:804-806`)

`onChange` is explicitly guarded (`if (!destroyed) events.emit('change')`),
with a comment explaining exactly why (`destroy()` doesn't stop
`js/workspace.js`'s document-level shortcuts from still running against
torn-down state). The `createProjectWithId(...).catch((err) =>
events.emit('error', err))` handler at mount-time has no equivalent guard —
a host that calls `destroy()` immediately after `mount()` and then sees a
late adapter failure still gets an `'error'` event fired against an
instance it believes is fully torn down. Same file, same emitter, same
"don't fire into a destroyed instance" principle applied to one call site
and not its sibling.

**I-2. Documented error-handling convention reversed in `lib/pixi.js` with
no `design.md` record.** (`lib/pixi.js:278,322,363,502,513,879,932,977,1024`,
`lib/pixel-engine/layers.js:411`)

`code-standards.md` states, with a repo-wide zero-exception verification,
that invalid/refused operations return `false`/`null`/early, never throw.
`lib/pixi.js` introduces 13 `throw` sites; `LayerStack.loadImage()` (in the
class the standards doc cites as the *canonical example* of the
return-guard pattern) throws `RangeError` where every sibling method on the
same class returns `false`/`null`. The public-API rationale for throwing
here is reasonable, but it's a documented-convention reversal recorded
nowhere — not in `design.md`, not in either standards doc.

**I-3. `console.error` — the only one in the entire repo.** (`lib/pixi.js:525`)

`code-standards.md`: "No `console.*` logging exists anywhere in `js/` or
`lib/`... verified even stronger than originally stated." `createEventEmitter`'s
handler-catch logs via `console.error` instead of re-emitting through the
`'error'` event this same file already built at `:730-732` — the file has
its own better mechanism sitting right next to the violation.

**I-4. `_resetStorageAdapter()` called from production code; its doc
comment still says test-only.** (`lib/pixi.js:1047`, `js/persistence.js:103`)

The leading-underscore convention ("test-only/internal export, not meant to
be called from app code") is broken by `destroy()`'s production call.
Tellingly, `_setStorageAdapter`'s doc comment *was* updated to name
`lib/pixi.js` as a real consumer; `_resetStorageAdapter`, added right after
it, was not — this reads as an oversight, not a considered exception.

**I-5. `Pixi.mount()`'s 70-line doc comment never states it requires a
DOM.** (`lib/pixi.js:533-602`)

`architecture-standards.md` treats "DOM-touching methods should say so in
their own doc comment" as a real rule (the whole section exists because
`mergeLayers`/`mergeDown`/`getRenderPlan` violated it silently). `mount()`
is now the most DOM-dependent entry point in `lib/` (`innerHTML`,
`ownerDocument.createElement`, `requestAnimationFrame`, `CanvasView`) and
its doc comment covers everything except this. The file's own smaller
helpers (`blobToBase64`, `decodeToImageData`) do carry the note, making the
primary method's omission the outlier.

**I-6. Stale line citations in `architecture-standards.md` from Phase 3's
own edits to files it cites.** (`architecture-standards.md:74,89-92`)

The doc's `#compositeSubset` and "DOM boundary" citations into
`lib/pixel-engine/layers.js`/`layers.test.js` no longer point at the
described content — Phase 3's `loadImage()` insertion shifted both by ~37
lines. The doc states its own rule for this exact situation ("if you touch
a file this doc cites by line number... update the citation in the same
change") and the same change didn't follow it.

### Minor

**M-1. Orphaned JSDoc block.** `lib/pixi.js:375-398`'s comment documents
`createEventEmitter` by name and content but is positionally attached to
`shouldShowGalleryChrome` (declared at `:409`); `createEventEmitter` itself
(`:508`) has no doc comment.

**M-2. `getImage()`'s format literals re-listed inline**
(`lib/pixi.js:933,937-938`) despite `GET_IMAGE_FORMATS` existing — milder
duplicate of the `referenceMode` pattern `code-standards.md` already flags
as a known issue elsewhere.

**M-3. `lib/pixi.test.js:79-93`** stubs `globalThis.document` in `before()`
with no restoring `after()`, departing from the one cited precedent
(`test/theme.test.js`) for this exact technique. Low blast radius
(`node --test` per-file process isolation) but inconsistent.

**M-4. Numerous stale line citations in `code-standards.md`** into
`js/persistence.js`/`js/export.js`/`js/workspace.js`, caused by this
phase's edits (e.g. `writeQueues` cited at `:71`, now `:77`). Lower
severity than I-6 since `code-standards.md` states no self-maintenance
rule, but the two docs cross-reference each other's citations, so it's
worth fixing in the same pass.

## Web Interface Guidelines pass

Scope: `lib/pixi.js`'s `WORKSPACE_MARKUP` template plus the DOM/interaction
code Phase 3 actually changed in `js/workspace.js`/`js/export.js` (root-
scoping of `querySelector`/`getElementById` calls, `options.ui.gallery`/
`tools`/`onSave`/`onCancel` wiring).

`WORKSPACE_MARKUP` itself is an unmodified copy of `index.html`'s existing
`#screen-workspace` block (a deliberate, documented duplication — see
`lib/pixi.js`'s module header), so it inherits whatever a11y state that
markup already had rather than introducing anything new; no findings
against the markup itself.

The genuinely new UI-control surface — `shouldShowGalleryChrome`'s
`classList.toggle('hidden', ...)` on `#back-to-gallery-button`, and
`resolveEnabledTools`'s per-button hidden+disabled toggle on the tool
sidebar — checked clean:

- `.hidden` resolves to `display: none !important` (`style.css:106`), so
  hidden buttons are correctly removed from the tab order, not just
  visually hidden while still focusable.
- Restricted tool buttons are both `hidden`-classed *and* given the native
  `disabled` attribute, specifically so the bare-letter keyboard-shortcut
  path (`button.click()` on a `disabled` button is a no-op per the HTML
  spec) is blocked too, not just the visible button — a stronger a11y
  posture than hiding alone would give.
- `js/export.js`'s new outside-click/Escape handler pair is root-scoped
  correctly and removes its predecessor before re-adding, matching the
  Escape-closes-overlay guideline with no leak across repeated
  `initExport()` calls.

No Web Interface Guidelines violations found in the code Phase 3 touched.

## Cross-task consistency assessment

- **`options.ui.*` shape**: consistent — all three (`gallery`/`tools`/
  `onSave`+`onCancel`) follow the identical "typo/misconfiguration degrades
  to today's default" contract, documented with the same vocabulary each
  time.
- **`options.storage` vs. `width`/`height`/`loadImage()`**: interacts
  sanely — one `projectId` per instance, generated once at `mount()`, reused
  across every `loadImage()`-triggered re-init; this was explicitly reasoned
  through in 3.9's task notes and checked against the storage-adapter spec.
- **Single-active-instance limitation**: still honestly documented in the
  module header through 3.9 — but **C-1 shows the audit for this exact
  failure mode was incomplete**, not merely under-documented. The doc
  comment describes the adapter-swap-on-destroy mitigation ("`destroy()`
  calls `_resetStorageAdapter()` so a torn-down instance's custom adapter
  can't outlive it") without accounting for a write already past its
  adapter-capture point when that reset fires.
- **Options surface growth**: no creep — verified by grep across every
  `options.ui.*` reference in `lib/pixi.js`.
- **Test coverage shape**: consistent across all of 3.1–3.11; no task's
  Playwright verification is meaningfully under-documented relative to the
  others.

## Ready to proceed to Phase 4?

**No — not until C-1 and C-2 are addressed.** C-1 is a real data-loss race
in the option (`options.storage`) that's the entire point of task 3.9, and
it's silent (no error surfaced) — the worst kind of persistence bug for an
embedding host to discover. C-2 is a sanctioned-but-undocumented
architecture rule break that should get a one-paragraph fix in
`architecture-standards.md` before it's forgotten as "how things are"
rather than "a decision that was made." The Important-tier items (I-1
through I-6) are good candidates for a single follow-up commit alongside
the two Critical fixes — none require redesign, all are localized. Minor
items can be swept up opportunistically. Recommend: fix C-1/C-2 (+ ideally
I-1 through I-4, which are small), then re-run `npm test` and the existing
Playwright smoke suite before archiving this phase and moving to Phase 4.

## Addendum (post-review): C-1 and C-2 fixed

Both Critical findings were fixed in this same worktree (uncommitted at
time of writing) and verified against this review:

- **C-1**: `js/persistence.js` gained `_activeAdapter()`, an explicit
  getter for the module-level `activeAdapter`. `js/workspace.js`'s
  `autoSave()` now calls it *before* its `await state.layerStack.toPNGBlob()`
  gap and threads the captured adapter into `saveProject()` as a new
  explicit fourth parameter (defaulting to the module-level `activeAdapter`
  for every other caller, unchanged). A new regression test in
  `test/persistence.test.js` ("a write whose caller captures the adapter
  before its own async gap is not rerouted by a swap during that gap")
  reproduces the exact race — an adapter swap landing after the adapter is
  captured but before `saveProject()` is called — and asserts the write
  lands on the pre-swap adapter.
- **C-2**: `docs/architecture-standards.md`'s "Status" line for the
  `lib/` → `js/` rule now documents `lib/pixi.js` as a deliberate, cited
  exception (pointing at `design.md`'s "New mount API entry point" decision)
  instead of asserting zero exceptions, and states the real consequence
  (`lib/pixi.js` is not standalone-copyable the way the rest of `lib/` is).
  The same edit also corrected I-6's stale `#compositeSubset`/"DOM
  boundary" line citations as a bonus (`layers.js:456,465` → `:494,503`;
  `layers.test.js:702-709` → `:733-740`) — both verified to point at the
  right content now.

Verified: `npm test` → 261/261 passing, including the new regression test.
I-1 through I-6 and M-1 through M-4 are unchanged/still open.

## Addendum (post-review): I-1 through I-6 and M-1 through M-4 fixed

Fixed in a separate worktree off the same pre-fix commit (`9313910`), not
the one carrying the C-1/C-2 fixes above — this addendum's baseline is
therefore 262/262 (260/260 pre-existing plus the 2 new tests below), not
the 261/261 the C-1/C-2 addendum reports; the two worktrees' fixes are
independent and both apply cleanly against the same base.

- **I-1**: `lib/pixi.js`'s mount()-time `createProjectWithId(...).catch()`
  handler now guards on `destroyed`, matching `onChange`'s existing guard
  right below it (`if (!destroyed) events.emit('error', err)`). Not unit-
  testable without a real DOM (same as the rest of `mount()`, per
  `lib/pixi.test.js`'s header comment) — a one-line change verified by
  inspection and `node --check`.
- **I-2**: recorded, not removed — this is a deliberate design decision.
  Added a new Decision to
  `openspec/changes/embeddable-integration-api/design.md` explaining why
  `lib/pixi.js`'s public API and `LayerStack.loadImage()` throw instead of
  following the repo's return-based convention (host-facing API boundary,
  not the editor's internal call graph — a thrown error surfaces a host's
  own integration bug immediately, at the call site, instead of as a
  confusing downstream silent failure). Added a matching **Correction**
  note to `docs/code-standards.md`'s Error Handling section naming both as
  a named, deliberate exception, in the same style as that doc's other
  "Correction"/exception callouts.
- **I-3**: `createEventEmitter()`'s handler-catch no longer calls
  `console.error` — it re-emits through the same emitter's own `'error'`
  event instead (the mechanism `mount()`'s `createProjectWithId().catch()`
  already uses), guarded against `event === 'error'` so a broken `'error'`
  handler can't recurse forever. TDD'd: two new tests in `lib/pixi.test.js`
  ("a throwing handler re-emits through the 'error' event instead of
  logging to console", "a throwing 'error' handler does not recurse or
  throw back out of emit()") written first (confirmed red against the old
  `console.error` implementation), then made to pass. Repo-wide grep
  confirms zero `console.*` calls remain in `js/`, `lib/`, or `test/`
  (only this fix's own explanatory comments mention `console.error` by
  name).
- **I-4**: `js/persistence.js`'s `_resetStorageAdapter()` doc comment no
  longer says "Test-only" — it now names `lib/pixi.js`'s `destroy()` as a
  real production consumer, mirroring `_setStorageAdapter`'s doc comment
  one function above it.
- **I-5**: `Pixi.mount()`'s doc comment gained a closing paragraph stating
  it requires a real DOM (`hostElement.innerHTML`,
  `hostElement.ownerDocument.createElement`, `requestAnimationFrame`,
  `CanvasView`), matching the "Requires a real DOM" phrasing this file's
  smaller helpers (`blobToBase64`, `decodeToImageData`) already use.
- **I-6**: verified per this addendum's own instruction, not found already
  fixed — this worktree's base commit predates the C-2 fix that corrected
  these citations in the other worktree, so `architecture-standards.md`
  here still had the stale `layers.js:456,465`/`layers.test.js:702-709`
  citations. `lib/pixel-engine/layers.js`/`layers.test.js` themselves are
  untouched by this pass (confirmed identical to the other worktree's
  copy), so the correct target line numbers are the same ones C-2's fix
  used: `layers.js:494,503` and `layers.test.js:733-740`, both re-verified
  against this worktree's actual file content before writing.
- **M-1**: the orphaned `createEventEmitter` JSDoc block (previously
  attached to `shouldShowGalleryChrome`) now sits directly above
  `createEventEmitter` itself; its "caught and logged" line was also
  updated to describe the actual post-I-3 re-emit-through-`'error'`
  behavior instead of the removed `console.error` call.
- **M-2**: `getImage()`'s doc comment no longer re-lists `'png'`/`'base64'`/
  `'imagedata'` as inline literals — it references `GET_IMAGE_FORMATS` by
  name and describes the three formats positionally instead.
- **M-3**: `lib/pixi.test.js` now imports `after` from `node:test` and
  restores (`delete globalThis.document`) in a new `after()` block,
  matching `test/theme.test.js`'s precedent.
- **M-4**: spot-checked and refreshed stale citations into
  `js/persistence.js`/`js/export.js`/`js/workspace.js` across
  `code-standards.md` caused by Phase 3's edits (`writeQueues` at `:77`,
  `_setStorageAdapter`/`_resetStorageAdapter`/`_clearAllForTests` at
  `:99`/`:111`/`:285`, `createProject`/`saveProject`/`loadProject`/
  `listProjects`/`deleteProject`'s `activeAdapter` routing, the per-id
  write-queue wrapping, the bare-verb/DOM-role/clamp-helper examples in
  `js/theme.js`/`js/workspace.js`/`js/export.js`). Along the way, found two
  citations whose *described content*, not just line number, had gone
  stale from unrelated earlier fixes (`_clearAllForTests()`'s CFIX-1 fix
  and `js/theme.js`'s CFIX-3 fix, both predating this phase) — corrected
  those with **Correction**/strikethrough notes in the same style as the
  doc's existing corrections, rather than leaving a citation pointing at
  now-accurate line numbers but a now-false claim.

Verified: `npm test` → 262/262 passing (260/260 baseline + 2 new
`createEventEmitter` tests for I-3), `node --check` clean on every edited
`.js` file. C-1/C-2 remain untouched, per instruction — this worktree does
not carry their fixes; it is based on the pre-fix commit `9313910` and is
expected to be reconciled with the C-1/C-2 worktree's branch separately.

## Addendum: C-1/C-2 and I-1–I-6/M-1–M-4 reconciled

The two addenda above came from independent worktrees/branches sharing the
same pre-fix base (`9313910`) and were merged (`git merge --no-ff`) rather
than rebased, so both sets of fixes are now present together on
`worktree-embeddable-integration-api`. Two files were touched by both
sides:

- `docs/architecture-standards.md`: both branches independently made the
  *exact same* I-6 line-citation correction (`layers.js:456,465` →
  `:494,503`; `layers.test.js:702-709` → `:733-740`) as part of otherwise
  different edits (C-2's exception note vs. this addendum's dedicated I-6
  pass) — git's merge resolved this automatically with no conflict, since
  both sides converged on identical text.
- `js/persistence.js`: no overlap in practice — C-1 added `_activeAdapter()`
  and `saveProject()`'s new `adapter` parameter; this addendum's I-4 only
  reworded `_resetStorageAdapter()`'s doc comment. Auto-merged cleanly.
- This audit file itself was the only real conflict (add/add: both branches
  created it fresh, then appended their own addendum) — resolved manually
  by keeping the original review body once and both addenda in sequence,
  which is what you're reading now.

Verified post-merge: `npm test` → 263/263 (260 baseline + C-1's 1 regression
test + I-3's 2 new `createEventEmitter` tests). All of C-1, C-2, I-1 through
I-6, and M-1 through M-4 are now fixed on this branch. Ready to proceed to
Phase 4.
