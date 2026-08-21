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
| CFIX-1 | `_clearAllForTests()` bypasses the active storage adapter, clears `db.projects` directly | `js/persistence.js:209-211` | Med | fixed |
| CFIX-2 | Unguarded, module-eval-time `matchMedia()` call — throws at import time if `matchMedia` is missing | `js/gallery.js:36` | Med | fixed |
| CFIX-3 | Unguarded `matchMedia()` call inside `initThemeToggle()` | `js/theme.js:103` | Low | fixed |
| CFIX-4 | `matchMedia` existence is checked, but the call itself isn't try/caught (also module-eval-time, same as CFIX-2 — corrected from this file's original note) | `js/workspace.js:650-651` | Med | fixed |
| CFIX-5 | `referenceMode`'s `'pixelated'`/`'original'` values are re-listed as inline string literals at 6+ sites, including a validation check, instead of a named constant | `lib/pixel-engine/layers.js:57,145,165,312,376,611` | Low | deferred |
| CFIX-6 | `mergeLayers`/`mergeDown`/`getRenderPlan` touch the DOM transitively (via `#compositeSubset`) with no "requires a DOM" note in their own doc comments, unlike every other DOM-touching method in `lib/` | `lib/pixel-engine/layers.js` (methods around `:526,561,611`) | Low | fixed |
| CFIX-7 | 10 of 24 "Pro extension point" comments lack the `(split-pixi-pro-repo)` tag and/or name a specific consuming pixi-pro file | `js/workspace.js:155,198,221,262,271,903,940,1042,1476,1482` | Low | deferred |

## Notes per finding

- **CFIX-1**: **fixed**. `_clearAllForTests()` now lists+deletes through
  `activeAdapter` for the `projects` table (customBrushes/colorPalettes
  stay direct Dexie, deliberately out of adapter scope). Regression test
  added: creates a project under the default adapter, switches to an
  in-memory adapter, creates a second project, clears, and verifies only
  the in-memory project was cleared while the Dexie one survives. Was red
  before the fix (in-memory project wasn't cleared at all), green after.
  `npm test`: 202/202.
- **CFIX-2**: **fixed**. `js/gallery.js`'s module-eval-time
  `prefersReducedMotion` read is now wrapped in try/catch, defaulting to
  `false` (motion allowed) on failure — same pattern as
  `js/theme-boot.js`. No existing unit-test coverage for this DOM-wiring
  file (consistent with `workspace.js`/`app.js`/`new-canvas.js`, none of
  which have one either); verified via a Playwright smoke test of the
  running app instead (Gallery load, New Canvas, draw, theme toggle — no
  new console errors beyond the pre-existing harmless favicon 404).
- **CFIX-3**: **fixed**. `js/theme.js`'s `initThemeToggle()` now calls a
  new local `safeMatchMedia()` helper (try/catch, falls back to a static
  `{ matches: false, addEventListener() {} }` stand-in) instead of the
  bare `window.matchMedia()` call. TDD'd: added a test simulating a
  throwing `matchMedia`, confirmed it failed against the old code
  (`Got unwanted exception`), then fixed and confirmed green.
- **CFIX-4**: **fixed**, and reclassified from Low to Med — this call is
  also at module-evaluation time (the surrounding comment in
  `workspace.js` says so explicitly), the same risk category as CFIX-2,
  not lower severity as this file originally said. Wrapped in try/catch,
  same fallback pattern as CFIX-2/3.
- **CFIX-5**: **deferred**, per plan — not a bug, a refactor of working
  production code across 6+ call sites with no current defect; better done
  as deliberate cleanup separate from this fix batch.
- **CFIX-6**: **fixed**. Added "requires a DOM" notes to `mergeLayers`,
  `mergeDown`, `getRenderPlan`, and `composite()`'s doc comments, matching
  `toPNGBlob()`'s existing pattern. Comment-only change, no test needed;
  `npm test` (202/202) confirms nothing else moved.
- **CFIX-7**: **deferred**, per plan — can't be fixed accurately without
  access to the `pixi-pro` repo to confirm which file each hook is
  actually consumed by; guessing would leave wrong information, worse
  than the current honest gap.
