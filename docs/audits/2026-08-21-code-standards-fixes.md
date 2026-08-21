# Code standards red-team fixes — 2026-08-21

Tracked follow-up from the red-team pass over `docs/code-standards.md` and
`docs/architecture-standards.md` (both docs already corrected in place —
see their revision notes and `code-standards.md`'s "Known code issues"
section). This file tracks only the **real code issues** the red-team
surfaced, not the documentation corrections themselves — those are done.

All items are in the Pixi (Standard) repo; `pixi-pro` isn't checked out in
this workspace and nothing here was checked against or needs fixing there.

**Severity**: High / Med / Low, by correctness/maintainability impact.
**Status**: `open` (not yet fixed) · `fixed` · `wontfix` (reviewed,
decided not worth it) · `deferred` (real, but out of scope for now).

| ID | Title | File | Severity | Status |
|---|---|---|---|---|
| CFIX-1 | `_clearAllForTests()` bypasses the active storage adapter, clears `db.projects` directly | `js/persistence.js:209-211` | Med | open |
| CFIX-2 | Unguarded, module-eval-time `matchMedia()` call — throws at import time if `matchMedia` is missing | `js/gallery.js:36` | Med | open |
| CFIX-3 | Unguarded `matchMedia()` call inside `initThemeToggle()` | `js/theme.js:103` | Low | open |
| CFIX-4 | `matchMedia` existence is checked, but the call itself isn't try/caught | `js/workspace.js:650-651` | Low | open |
| CFIX-5 | `referenceMode`'s `'pixelated'`/`'original'` values are re-listed as inline string literals at 6+ sites, including a validation check, instead of a named constant | `lib/pixel-engine/layers.js:57,145,165,312,376,611` | Low | open |
| CFIX-6 | `mergeLayers`/`mergeDown`/`getRenderPlan` touch the DOM transitively (via `#compositeSubset`) with no "requires a DOM" note in their own doc comments, unlike every other DOM-touching method in `lib/` | `lib/pixel-engine/layers.js` (methods around `:526,561,601`) | Low | open |
| CFIX-7 | 10 of 24 "Pro extension point" comments lack the `(split-pixi-pro-repo)` tag and/or name a specific consuming pixi-pro file | `js/workspace.js:155,198,221,262,271,903,940,1042,1476,1482` | Low | open |

## Notes per finding

- **CFIX-1**: real latent bug, not just style — with a host-supplied
  non-Dexie adapter active (once the embeddable mount API exists),
  calling this test helper would clear the app's own local IndexedDB
  instead of the host's adapter-backed store, leaving stale data behind
  silently. Fix: route through `activeAdapter` like every other function
  in this file, or make explicit that this helper only ever targets the
  Dexie-backed default and document/guard that.
- **CFIX-2**: highest-severity item in this list after CFIX-1 — this runs
  at module-import time, before any try/catch a caller might add could
  help. `js/theme-boot.js:13-27` already shows the established pattern
  (try/catch + safe fallback) this file should follow instead.
- **CFIX-3, CFIX-4**: same underlying gap as CFIX-2, lower severity since
  neither is at module-eval time.
- **CFIX-5**: not a bug — `referenceMode` is validated correctly today —
  but a maintainability gap; a future third mode would require finding
  and updating 6 scattered literal comparisons instead of one array.
- **CFIX-6**: not a bug in current behavior, but a real trap for whoever
  next tries to unit-test `mergeLayers` under plain Node — the test suite
  already documents working around it (`lib/pixel-engine/
  layers.test.js:702-709`) without the source explaining why.
- **CFIX-7**: lowest urgency — these comments are the *only* record of
  which pixi-pro file depends on a given Standard hook (Pro's repo isn't
  checked out alongside Standard's), so a future rename/removal of one of
  these 10 hooks has no reliable way to know what to check in `pixi-pro`
  before doing so.
