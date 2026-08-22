# Public repo docs — what Pixi needs

Concrete checklist derived from [`repo-docs-research.md`](repo-docs-research.md)
and the [`writing-repo-docs`](../.claude/skills/writing-repo-docs/SKILL.md)
skill's inventory step, run against this repo's actual state. Update this
file's status column as items ship — it's a checklist, not a spec.

Pixi today: public repo, solo maintainer, no outside contributors yet, no
GitHub topics/social preview set. That fact drives most of the "not yet"
calls below — see the research doc's "doc set scales with contributor
apparatus, not with project size" finding.

## Now

| Doc / item | Status | Why |
|---|---|---|
| README.md | ✅ exists, solid, screenshot added 2026-08-18 | — |
| README H1/opening line — on-page SEO | ✅ fixed | "pixel art" now appears 4x naturally through the file (opening line, alt text, Stack, Project structure) — see RDOC-1 |
| LICENSE | ✅ added 2026-08-18 (MIT, holder: Aleksandr Sukiasov) | License choice was made by default per `repo-docs-research.md`'s recommendation — confirm this is the intended license before it's relied on by forks |
| GitHub About blurb + topics + homepage URL | ✅ set by user 2026-08-18 | Live-checked: description "Browser-based pixel art editor — no build step, no backend, runs entirely in the browser.", homepage set, 14 topics set (broader than originally suggested — fine, more topic-page surface). One gap: description doesn't say "demo"/"preview" — see next row |
| GitHub About blurb — revise to include "demo"/"preview" | ✅ done by user 2026-08-19 | Updated via repo Settings per the suggested wording; not re-verified live this pass (no network access in this environment) — taking the user's report at face value |
| GitHub Social Preview image | ✅ set 2026-08-19 by user | Uploaded via Settings → General → Social preview: https://repository-images.githubusercontent.com/1333489755/b9621943-e679-4aad-93d2-89923e4c1b7a — not re-verified live this pass (no network access in this environment), taking the user's report at face value |
| Link `docs/ui-reference.md` from README | ✅ linked 2026-08-18 | — |
| Versioning (git tags + GitHub Releases) | ✅ `v0.2.0` pushed | Cut 2026-08-18 at that HEAD (Phase 2 + symmetry mode + color ramp generator complete, Phase 3 not started); confirmed on `origin` 2026-08-19. README's Deployment section distinguishes this from `js/version.js`'s cache-stamp. Chose the lightweight option: tag notable points (phase boundaries / batches), no hand-maintained CHANGELOG.md. Turning it into a GitHub Release with notes is still optional/not done |

## Later — once Pixi has (or is actively seeking) outside contributors

Adding these before that point is unused noise per the skill's guidance —
don't front-load them.

| Doc | Shape to use |
|---|---|
| CONTRIBUTING.md | Router, not encyclopedia (appsmith/strix/uBlock pattern) — local dev setup (already in README), link to `CLAUDE.md`'s OpenSpec + Superpowers process rather than re-describing it, PR expectations |
| CODE_OF_CONDUCT.md | Contributor Covenant boilerplate is sufficient — no need to author from scratch |
| .github/ISSUE_TEMPLATE/ (bug, feature request) | Keep to the fields that let you triage without a back-and-forth: repro steps, expected/actual, browser |
| .github/PULL_REQUEST_TEMPLATE.md | Link to OpenSpec change id if applicable, checklist for tests |
| AGENTS.md | Cross-tool convention (Claude/Cursor/Codex) for AI agents that want to use or contribute to the repo in one shot — distinct from CLAUDE.md's process doc, see research doc §2 |

## Maybe, once relevant

| Doc | Trigger to add it |
|---|---|
| SECURITY.md | Once the app handles anything sensitive worth a private disclosure channel (relevant once Supabase auth/data ships — Phase 3+); keep under 15 lines, point to GitHub private vulnerability reporting |
| CHANGELOG.md or a "removed/deprecated" note | Once a shipped feature gets cut or replaced — right now `openspec/changes/archive/` covers this for anyone willing to dig, a summary doc isn't needed yet |
| A short values/position file (Pixi's `MANIFESTO.md` equivalent) | Once there's a stable public spot to link it from (About page, README badge) — content already drafted in `repo-voice.md`'s "What we won't do" section, just needs promoting to its own file if it grows |
| Badges (license, deploy status) | Once LICENSE exists (license badge needs something to point to) and/or CI is added; skip community-count badges (Discord/stars) — no community channel exists yet, and a badge for zero members reads worse than no badge |

## Explicitly deferred, not forgotten

- Contributor-workflow apparatus (issue assignment, inactivity bots) —
  taipy-style overhead that assumes a maintainer team; revisit only if
  contributor volume ever justifies it.
- Docs site / dedicated documentation domain — `docs/` in-repo is
  sufficient at this scale; don't stand up infrastructure prematurely.
