# Pixi

## Project overview

A browser-based pixel art drawing tool. Fixed small canvas sizes (16/32/64/128px),
draw and export — no animation/frame timeline in this phase. Static site, no
build step, deployed to GitHub Pages.

**Non-goals for now**: no animation timeline/onion skinning, no native
Android/iOS build (web only), no bundler (plain HTML/CSS/JS, ES module
imports via CDN, not npm), no custom backend server (Supabase covers
auth/database/storage/functions when that phase arrives).

**Stack**: vanilla HTML/CSS/JS + ES modules, no framework, no build step.
Dexie.js (CDN) over IndexedDB as the offline-first local cache — the app must
be fully usable signed-out; Supabase (Auth/Postgres/Storage/Edge Functions,
via `@supabase/supabase-js` from an ESM CDN) and Stripe Checkout are
additive, later-phase only. Supabase project config, schema, and Storage
layout are in `docs/supabase-database.md`. The Supabase project (`pixi`) is
already GitHub-integrated with this repo for database migrations — see that
doc. Phase-by-phase build order and screen list are in
`docs/roadmap.md`.

**Brand**: Pixi is made by **Forma**, which also makes Lines (a vector
editor). Company description, positioning, audience, and voice are in
`docs/brand.md`. Use it for any user-facing copy and for shared naming
across Forma's apps.

## Process: Superpowers skills

There is no OpenSpec any more. Superpowers skills drive the whole workflow,
from design through merge.

- Requirements (what exists today): `docs/specs/<capability>/spec.md`.
- Phase-level plan (what order things get built in): `docs/roadmap.md`.
- Past change proposals, kept for reference: `docs/history/`.
- New feature / behavior change: `brainstorming` → design doc in
  `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` → `writing-plans`
  (plan in `docs/superpowers/plans/`) → implement with
  `test-driven-development` where there is logic → `requesting-code-review`
  → `finishing-a-development-branch`. Update the affected
  `docs/specs/*/spec.md`, `docs/ui-reference.md`, and `docs/roadmap.md` as
  part of the same branch.
- Bugs: `systematic-debugging` + TDD.
- `web-design-guidelines` reviews UI code (markup/CSS/JS touching layout,
  interaction, or accessibility) against the Web Interface Guidelines. Run it
  before `requesting-code-review` on any change that touches `index.html`,
  `css/*`, or a tool's DOM/interaction code — the general code review does not
  substitute for it. It's also part of `auditing-tool-improvements`'s
  screen-by-screen heuristics pass.

## Subagent dispatch defaults

Model/tier selection logic lives in superpowers' `subagent-driven-development`
skill (Model Selection section) — this section only maps Pixi's own task
shapes onto it, so dispatch doesn't default to `general-purpose` by habit.

Don't dispatch a subagent for something completable in 1-2 direct tool calls
(a single grep, a one-line edit) — dispatch overhead isn't worth it below that.

`haiku` is a false economy outside pure transcription: cheap models routinely
take 2-3× the turns on multi-step or ambiguous work, costing more overall
than `sonnet` finishing in fewer turns. Floor at `sonnet` for anything beyond
a fully-specified, single-file mechanical task.

| Task shape in this repo | Agent | model= |
|---|---|---|
| File moves/renames, import-path updates, wiring a fully-specified interface (e.g. plan "restructure" tasks) | `mechanical-implementer` | `haiku` |
| New public API design, cross-file integration (e.g. `Pixi.mount()`, storage adapter wiring) | `general-purpose` | `sonnet` |
| One independent bug/test-file fix among several dispatched together | `parallel-fixer` | `sonnet` |
| Repo-wide search ("where is X used/defined") | `Explore` | `sonnet` |
| Diff review before merge | `code-review` skill, scaled to diff risk | `sonnet` (bump to `opus` for high-risk diffs) |
| Architecture/design decisions, final whole-branch review | `general-purpose` or `Plan` | `opus` |

Always pass `model` explicitly on dispatch — an omitted model inherits the
session's model, usually the most expensive, silently defeating this table.

## Rule of thumb

1. New feature / behavior change → `brainstorming` first, always.
2. Once a design is written → `writing-plans`, then TDD, code review before
   merging.
3. Bug fixes with no spec/requirement impact go straight to
   `systematic-debugging` + TDD.
4. Every behavior change updates `docs/specs/` in the same branch.
5. Work through `docs/roadmap.md`'s phases in order — each should be a
   working, testable slice before the next starts. Ask before jumping ahead
   into a later phase.