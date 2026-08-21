# Code standards audit — 2026-08-21

First run of `.claude/skills/auditing-code-standards/`, against the
`embeddable-integration-api` change's diff since `main` (Sections 1-2:
`lib/pixel-engine/*.js` relocation, `lib/storage-adapter.js`,
`js/persistence.js`'s adapter refactor, and their test files). Checked
against [`docs/code-standards.md`](../code-standards.md) and
[`docs/architecture-standards.md`](../architecture-standards.md), both
written earlier in this same session.

**Severity**: High / Med / Low, by correctness/maintainability impact.
**State**: `confirmed` (verified against source) · `dismissed` (checked
and it's not real) · `approved` / `in-progress` / `done` once picked up.

| ID | Title | File | Severity | State |
|---|---|---|---|---|
| — | No findings this pass | — | — | — |

## Notes

No violations found in this pass. Expected, not a sign the check was
skipped: `docs/code-standards.md` was derived directly from this same
code (including Sections 1-2's own files) earlier in this session, and
`docs/architecture-standards.md`'s storage-adapter concurrency rule was
written *after* fixing the `enqueueWrite` race that code review found in
`js/persistence.js` — so the doc already reflects the fixed state, not
the version that would have failed this check.

Verified explicitly (per the skill's Architecture standards pass
checklist):
- `lib/pixel-engine/*.js`, `lib/storage-adapter.js`: no `from '../js` /
  `from './js` imports — the `lib/` → `js/` boundary holds.
- `lib/storage-adapter.js` has zero DOM/browser-global dependencies;
  `lib/pixel-engine/engine.js`'s/`layers.js`'s canvas-touching methods
  (`toPNGBlob`, `composite`) each name the DOM dependency in their own
  doc comment, per the DOM-optional-except-named-points rule.
- `saveProject`/`renameProject`/`deleteProject` (the only load-modify-save
  persistence call sites in this diff) are all routed through
  `enqueueWrite`.
- No new runtime dependency was added; the existing Dexie CDN import-map
  entry is unchanged.
- No new Pro-facing hook in this diff — not applicable.

This pass covers Sections 1-2 only. The real test of this skill's value
comes with Section 3 (the mount API) — new code written without having
been the direct source of the standards docs, where drift is actually
possible to catch.
