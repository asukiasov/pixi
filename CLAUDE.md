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
`openspec/roadmap.md`.

## Process: OpenSpec vs. Superpowers skills

This project uses two toolsets together. They are not alternatives — they cover
different halves of the work and must not be conflated.

## OpenSpec owns "what should exist"

- Source of truth for requirements: `openspec/specs/`
- Source of truth for in-flight change proposals: `openspec/changes/`
- Phase-level project plan (what order things get built in): `openspec/roadmap.md`.
  Each phase maps to one or more numbered changes, e.g. Phase 1 is
  `openspec/changes/1-scaffold-drawing-engine/`.
- Every new feature or behavior change starts here, via `/opsx:propose`.
- A change is not "real" until it has a spec delta and tasks under
  `openspec/changes/<id>/`. Implementation should not begin without one,
  except for trivial fixes with no spec impact.
- `/opsx:apply` implements a proposed change; `/opsx:archive` closes it out and
  folds the delta into `openspec/specs/`.

## Superpowers skills own "how the work gets done"

- Skills like `brainstorming`, `writing-plans`, `test-driven-development`,
  `systematic-debugging`, `executing-plans`, `requesting-code-review`,
  `verification-before-completion`, and `finishing-a-development-branch` are
  the execution process *inside* an OpenSpec change's implementation phase.
- They do not define requirements and do not replace `openspec/specs/`. They
  govern design exploration, coding discipline, and review/merge hygiene once
  a change already has an OpenSpec proposal.

## Rule of thumb

1. New feature / behavior change → `/opsx:propose` first, always.
2. Once a change is proposed and has tasks → use superpowers skills
   (brainstorming for open design questions, TDD for writing the code,
   systematic-debugging for bugs found along the way, code review before
   merging) to actually build it.
3. Bug fixes with no spec/requirement impact can skip OpenSpec and go straight
   to `systematic-debugging` + TDD.
4. Never write ad-hoc design docs outside `openspec/changes/` for anything
   that changes behavior — that's what OpenSpec proposals are for.
   `docs/superpowers/specs/` predates this setup and is legacy; new spec work
   belongs in `openspec/`.
5. Work through `openspec/roadmap.md`'s phases in order — each should be a
   working, testable slice before the next starts. Ask before jumping ahead
   into a later phase.
