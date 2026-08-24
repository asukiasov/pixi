## Context

See proposal.md - Why. This reverses the extraction done by
`openspec/changes/archive/2026-08-21-split-pixi-pro-repo/` (design.md there
documents the original decisions this change undoes). `pixi` still has no
bundler or build step; `../pixi-pro` exists as a sibling checkout on this
machine with the extracted modules under `js/pro/*`, its `pixi` submodule
pinned to `v0.4.0` — ahead of this repo's current `main`, so the source
being restored already accounts for whatever engine changes landed on
`pixi` since the split.

## Goals / Non-Goals

**Goals:**
- Every one of the 8 extracted features works in `pixi` exactly as it did
  in `pixi-pro`, wired inline (no hook indirection), with no regression to
  the Standard tools that share files with them (`workspace.js`,
  `engine.js`, `index.html`).
- Remove the extension-hook layer entirely — no dead exports left behind
  for a consumer that no longer exists.
- `pixi-pro`'s existing tests for these modules carry over rather than
  being rewritten from scratch.

**Non-Goals:**
- Not redesigning any of the 8 features while restoring them — this is a
  reintegration, not a feature revision. Any improvement ideas that come up
  along the way get flagged for a separate change, not folded in here.
- Not building any in-app donation UI (README-only per the proposal).
- Not preserving the extension-hook API surface for a hypothetical future
  plugin consumer — proposal.md's What Changes already closes that idea out.

## Decisions

**Merge by copying `pixi-pro`'s modules back into `pixi`, then inlining
their hook call sites — not a git merge/rebase of `pixi-pro` history into
`pixi`.** `pixi-pro` is a separate repo with its own commit history
(including a `pixi` submodule directory that must not be pulled in
verbatim). The restored files are copied from `../pixi-pro/js/pro/*` as a
starting point and adapted in place, mirroring the original split's own
"Extraction before addition" decision in reverse. Alternative considered:
`git subtree`/history-preserving merge — rejected as unnecessary complexity
for 13 files whose original history already lives in `pixi`'s own git log
before the 2026-08-21 split (`git log` on those paths pre-split still
resolves), and `pixi-pro`'s own commits on top are mostly hook-adaptation
churn not worth preserving.

**Remove hooks by inlining each call site, one feature at a time, mirroring
the original extraction order in reverse.** For each of the 8 features:
restore its module file(s), restore its `index.html` markup and CSS, then
replace its `registerX(...)` call in `js/pro/*` with a direct call/import
into the relevant shared file, and delete the now-unused `registerX`/
`getX` export from that shared file. Verified per-feature (not deferred to
one final pass), matching the split's own verification discipline.
Alternative considered: leave the hooks in place and just register the
restored modules through them — rejected per the brainstorming discussion
in this change's originating conversation: the hooks have no remaining
consumer once Pro is back in-repo, and CLAUDE.md's own bias is toward
removing indirection that no longer serves a purpose (YAGNI).

**Order of extraction reversal.** Do the reverse of the original order
where dependencies matter: Layers last-out-first-in isn't required, but
`image-import.js` (which the original split moved to `pixi-pro` wholesale,
as Color Library's and the reference-image layer's last remaining caller)
needs to come back before or alongside both Color Library and Layers,
since both depend on it. Concretely: Color Library and Layers restored
together (they share `image-import.js`), then the other 6 features in any
order since they don't depend on each other or on Layers/Color Library.

**Delete `pixi-pro` and its Cloudflare demo as a manual operator step, not
a scripted task.** Repo deletion and Cloudflare project teardown are
one-off, irreversible, credential-gated actions outside what an
implementation agent should do unattended. tasks.md lists them as an
operator checklist item (mirroring how the original split's runbook.md
documented manual steps), to be done by the user after verifying the
merged `pixi` app works.

## Risks / Trade-offs

- **Reintroducing Pro modules could reintroduce whatever bugs the
  extraction incidentally fixed, or vice versa** → mitigation: the same
  per-feature live-browser verification the original extraction used (see
  archived tasks.md's task 2.2), run again in reverse, plus `pixi`'s
  existing test suite plus whatever tests exist in `pixi-pro/test/`.
- **`pixi-pro`'s submodule pin (`v0.4.0`) is ahead of this repo's current
  `main`** → the restored module source may reference engine behavior
  `pixi`'s `main` doesn't have yet. Mitigation: diff `pixi-pro`'s `pixi`
  submodule checkout against this repo's `main` for the relevant shared
  files before restoring, and pull forward any engine-side change the
  restored modules depend on.
- **Deleting `pixi-pro` is irreversible** → mitigation: it's a GitHub repo
  delete, recoverable from GitHub's short-lived repo-deletion grace period
  if done in error, and the operator does this manually only after the
  merged `pixi` app is verified working — not automated, not done first.
- **Breaking change for anyone who forked or is running `pixi-pro`
  standalone** → accepted; per proposal.md this is the deliberate business
  decision being made, not an unintended regression.

## Migration Plan

1. Restore Color Library + Layers together (shared `image-import.js`
   dependency), inlining their hooks; verify live in browser.
2. Restore the remaining 6 features (symmetry, pixel-perfect, Canvas
   Settings, brush import, Rectangle fill/outline, Pencil/Eraser opacity),
   inlining their hooks as each lands; verify live in browser per feature.
3. Sweep `js/workspace.js`, `js/engine.js`, `js/shape-tools.js` (and any
   other shared file) for leftover `register*`/hook exports with no more
   callers; remove them.
4. Restore README's Features table and demo links; add the donation line.
5. Retire `openspec/specs/pixi-pro-distribution` (via this change's spec
   delta) and update `openspec/roadmap.md`'s tier-split and plugin-idea
   entries.
6. Run the full test suite; port over any `pixi-pro/test/` coverage for
   the restored modules that `pixi`'s suite doesn't already have.
7. Operator step (manual, after the above is verified): delete the private
   `pixi-pro` GitHub repo and tear down its Cloudflare Workers deploy.

Rollback: revert the merge commit(s) in `pixi` — the pre-merge state
(hooks + `pixi-pro` as the Pro home) is fully recoverable from git history
as long as step 7 hasn't happened yet. Once `pixi-pro` is deleted (step 7),
rollback would require restoring it from GitHub's deletion grace period or
from the local `../pixi-pro` checkout, which is why step 7 is explicitly
sequenced last and manual.

## Open Questions

- Whether any `pixi-pro`-only bug fixes or tweaks made to the 8 modules
  after the split (visible in `pixi-pro`'s own commit history beyond the
  initial extraction) should be preserved during restoration, versus
  restoring the modules as first-extracted and re-applying `pixi`'s own
  subsequent fixes. Doesn't change the spec, approach, or task breakdown —
  resolved during implementation by diffing `pixi-pro`'s current module
  state (not just its first extraction commit) against what's being
  restored.
