# UI polish audit — 2026-08-17

Findings from a full `.claude/skills/auditing-tool-improvements/` pass over
every screen and tool, cross-referenced against
[`docs/ui-reference.md`](../ui-reference.md) (control locations) and
`openspec/roadmap.md`'s "Still open" list (already-known items, not
re-listed as new). Live-screenshotted via Playwright; some readings were
degraded by a sandboxed test environment blocking Google Fonts (see
AUD-4/AUD-5/AUD-9/AUD-10 notes) and re-checked against source where
possible.

This file is the tracked register for that pass — one row per finding,
carrying an id so items can be discussed/approved by reference. Per the
skill, nothing here is implemented yet: approved items each become their
own `/opsx:propose`. Update `State` in place as items move through
triage → approved → proposed → done; don't delete rows, so the audit
trail stays intact (append new passes as new dated sections below instead
of overwriting this one).

**Severity**: High / Med / Low, by visibility × frequency of use.
**State**: `unverified` (screenshot-only, not confirmed in code) ·
`confirmed` (verified against source) · `dismissed` (checked and it's not
real) · `needs-recheck` (environment-degraded reading, re-test before
acting) · `known` (already tracked in roadmap's "Still open", listed here
for cross-reference only) · `approved` / `in-progress` / `done` once
picked up.

| ID | Title | Screen / Tool | Severity | State |
|---|---|---|---|---|
| AUD-1 | `#gallery-new-canvas-button` hover feedback unclear | Gallery | Low | dismissed |
| AUD-2 | Size preset stays visually active after typing a custom size | New Canvas | Med | done |
| AUD-3 | `#new-palette-name` placeholder text can be clipped by its own input width | Workspace → Color Library | Low-Med | done |
| AUD-4 | No visible keyboard focus indicator on top bar / tool-rail buttons | Workspace, cross-cutting | Med | dismissed |
| AUD-5 | No fallback when the Material Symbols icon font fails to load | Workspace, cross-cutting | Med | done |
| AUD-6 | `#color-picker-add` icon/label spacing looks jammed | Workspace → color picker popover | — | dismissed |
| AUD-7 | Selection overlay renders at the wrong screen position whenever zoom ≠ initial fit | Workspace → Selection tool | High | confirmed |
| AUD-8 | Zoom-in jumped from 100% to ~492% after 3 clicks | Workspace → zoom controls | — | dismissed |
| AUD-9 | Layers panel row-actions icons had no gap between them | Workspace → Layers panel | Low | done |
| AUD-10 | Brushes toolbar row (add/delete/library-toggle) looks cramped | Workspace → Brushes panel | Low | dismissed |
| AUD-11 | Right-sidebar hide/show toggles instantly, no slide animation | Workspace, cross-cutting | Med | done |
| AUD-12 | Color Library sequence toggle duplicated per tool instead of one shared control | Workspace → Pencil/Brush | Low-Med | done |
| AUD-13 | No light/dark/system theme toggle | Workspace, cross-cutting | — | done |

## Notes per finding

- **AUD-1**: **dismissed**, not fixed — `style.css`'s magnetic-hover
  buzz rule (~line 1760) explicitly excludes `+ New Canvas`/`Create`
  from hover feedback, "per feedback" that a jitter-on-hover "feels
  wrong for something consequential." Already litigated; adding hover
  feedback here would relitigate a decision already made, not fix a
  bug.
- **AUD-2**: **done** — `js/new-canvas.js` had no `input` listener on
  `#custom-width`/`#custom-height` to clear `.preset-button.active`;
  the create logic already correctly preferred custom values, only the
  visual indicator was stale. Fixed on `fix/aud-2-preset-active-state`
  (commit `12dabaf`), merged into `ui-polish-audit-batch-1`.
- **AUD-3**: **done** — `.new-palette-row input`'s `min-width: 0` let
  it shrink arbitrarily against two fixed-width buttons in the clamped
  8rem-minimum sidebar. Fixed via `flex-wrap: wrap` on the row +
  `min-width: 6rem` on the input (mirrors `.brush-editor-row`'s
  existing wrap convention for the same width constraint). Merged into
  `ui-polish-audit-batch-1`.
- **AUD-4**: **dismissed** by user call — dropped from the batch, not
  being pursued.
- **AUD-5**: **done** — `index.html` loads Material Symbols from a
  single `fonts.googleapis.com` link with no self-hosted fallback and
  no reserved layout space for the ligature text if the font fails
  (confirmed by the sandboxed test run itself, which hit exactly this
  failure mode, `ERR_BLOCKED_BY_ORB`). Fixed two ways: `overflow:
  hidden` added to every fixed-size icon-only button class (so fallback
  text can no longer bleed into neighbors even in the worst case), plus
  `js/icon-font-fallback.js` using the Font Loading API to detect a
  genuine load failure and hide the raw ligature text entirely via an
  `.icon-font-failed` class (relying on existing `aria-label`/
  `data-tooltip` instead). Merged into `main`, done directly per
  CLAUDE.md's no-spec-impact bug-fix path — no `/opsx:propose`.
- **AUD-6**: `#color-picker-add` already sets `gap: 0.3rem`
  (`style.css:1173`) — the "jammed" read in the screenshot was the
  blocked-font ligature-text artifact, not real spacing.
- **AUD-7**: re-checked 2026-08-17 on a clean network (Playwright,
  `document.fonts.size` confirmed the icon font actually loaded this
  time). Root-caused via a scripted repro + reading `js/canvas-view.js`:
  `setSelectionRect()` sets the `.selection-overlay` div's `left`/`top`
  to `rect.x * this.#baseScale` / `rect.y * this.#baseScale`, then
  applies the *same* `transform: translate(panX,panY) scale(scale)` the
  canvas element uses (`#applyTransform()`). That shared transform
  correctly rescales the overlay's `width`/`height` (CSS `transform`
  does scale a box's rendered size) — but a box's `left`/`top`
  (its layout position, the transform's anchor point) is *not* itself
  rescaled by `transform: scale()`, only shifted by `translate()`. Since
  the canvas element's own `left`/`top` are hardcoded to `0`, this same
  formula is invisible for the canvas (`0 * anything = 0`) — the bug is
  overlay-only, and only visible once `#scale !== 1` (i.e. any zoom away
  from the initial post-create "Fit" view: zoom in/out, "100%", or
  "Fill"). Confirmed with a live repro at "100%" preset on a 32×32
  canvas: dragging a ~22×22px selection produced a correctly-sized
  overlay (23×23px — right) positioned ~110px away from the actual drag
  location (very wrong) — a reproducible, scale-proportional offset, not
  occasional/flaky. **Suggested fix**: multiply `left`/`top` by
  `this.#baseScale * this.#scale` (add the missing `* this.#scale`
  factor) instead of `this.#baseScale` alone; leave `width`/`height`
  unchanged (they're already correctly rescaled a second time by the
  shared CSS transform). Upgraded from "Unknown (High if real)" to
  confirmed **High** — this makes the Selection tool's marquee land in
  the wrong place at any zoom level other than the one right after
  creating/opening a project, which is a core-workflow-breaking bug, not
  a cosmetic one.
- **AUD-8**: re-checked 2026-08-17 on the same clean-network pass.
  Scripted 3 zoom-in clicks from a fresh canvas and read the actual
  readout values: `2300% → 2875% → 3594% → 4492%` — an exact ×1.25 curve
  per click, matching `ZOOM_STEP_FACTOR = 1.25` in `js/canvas-view.js`.
  **Dismissed** — the zoom math is correct and working as designed; the
  original "492%" reading was almost certainly a misread of "4492%"
  (dropped leading digit) by the first audit pass, not a rendering bug.
  Side note: a fresh canvas's initial zoom is a "fit to view" percentage
  (e.g. 2300% for a 32×32 canvas in a normal window), not literally
  100% — the static `100%` text in `index.html`'s `#zoom-readout` markup
  is just a pre-JS placeholder, which may be why the first pass assumed
  a 100% starting point that was never actually true.
- **AUD-9**: **done** — `.layer-row-actions` had no `gap` at all
  between its reorder/delete icons, unlike every sibling icon-toolbar
  in the app. Fixed with `gap: 0.3rem` (the value most such toolbars
  converge on). Merged into `ui-polish-audit-batch-1`.
- **AUD-10**: **dismissed** — checked `.brushes-panel-toolbar` in
  `style.css`, it already has `gap: 0.4rem`, consistent with siblings.
  The "cramped" read was the blocked-font artifact; nothing to fix.
- **AUD-11**: **done** — `#right-sidebar` now animates `width` and
  `border-left-color` over 0.2s on toggle (gated inside
  `prefers-reduced-motion: no-preference`, same pattern the existing
  magnetic-hover buzz animation used), with `inert` applied to the
  sidebar while collapsed so its content can't be tabbed into. Verified
  with frame-sampled width measurements confirming a genuine multi-frame
  slide, and that reduced-motion users get an effectively instant
  toggle. This was a real behavior change — normally an `/opsx:propose`
  candidate — implemented directly at the user's explicit request
  instead; `openspec/specs/canvas-navigation` has not been updated to
  reflect it yet.
- **AUD-12**: **done** — replaced the two duplicated DOM instances
  (`#pencil-library-toggle`, `#brush-library-toggle`) with one shared
  `#library-sequence-toggle` in `#library-sequence-options`, modeled
  directly on `#square-constraint-toggle`'s existing pattern (single
  DOM instance, tool-scoped visibility toggle). Verified that shared
  state (on/off) persists correctly across Pencil↔Brush tool switches.
  Also a real behavior change implemented directly at the user's
  request; `openspec/specs/brushes` has not been updated yet.
- **AUD-13**: **done** — see Batch 1 below; landed from a separate
  parallel effort, not implemented as part of either batch here.

## Batch 1 — 2026-08-17

AUD-2, AUD-3, AUD-9 implemented in parallel via git worktrees
(`superpowers:systematic-debugging` + `superpowers:test-driven-development`
per CLAUDE.md's "trivial bug fix, no spec impact" path). AUD-13 (light/
dark/system theme toggle) landed the same day from a separate parallel
effort. All four merged conflict-free (`git merge-tree` dry run showed no
conflicts before merging for real) into `main` at `1149ee9`. Full suite:
164/164 passing on `main` post-merge (150 pre-existing + 14 new theme
tests).

## Batch 2 — 2026-08-17

AUD-5, AUD-11, AUD-12 implemented in parallel via git worktrees, same
TDD/systematic-debugging path as Batch 1 — but explicitly *not* routed
through `/opsx:propose` even though AUD-11/AUD-12 are real behavior
changes, per the user's direct request to skip it this time. Flagged
once at the time, not blocked on.

Merging surfaced one real conflict (an import-statement collision in
`js/app.js` between AUD-5's and the already-merged AUD-13's independent
additions — trivial, kept both) and one integration-only regression
invisible to any single branch: AUD-11 added a `window.matchMedia(...)`
call at `js/workspace.js` module-eval time; AUD-12 added
`test/workspace.test.js`, which imports `js/workspace.js` directly under
plain Node with no DOM shim. Neither branch alone exercised both
conditions at once — the combination broke the new test's import. Fixed
by guarding the reference (`typeof window !== 'undefined'`) rather than
reworking either branch's approach. Full suite: 177/177 passing on
`main` post-merge. Worktrees and branches cleaned up after landing.

`docs/ui-reference.md` and `openspec/roadmap.md`'s "Still open" list
updated to match (AUD-11/12/13 moved out of roadmap's open list into
"Resolved so far"; a note added there that `openspec/specs/
canvas-navigation` and `brushes` still need a sync pass to reflect
AUD-11/AUD-12's actual behavior changes, since they skipped
`/opsx:propose`).
