## Why

The roadmap's Phase 3 was "Supabase Auth + sync," assuming Pixi would
eventually be a hosted product real end users sign into. That assumption
no longer holds: Pixi is a plug-and-play tool developers fork and deploy
themselves, not something this repo hosts for a public user base.
Brainstormed and agreed with the user - auth, monetization (Phase 4),
and community feed (Phase 5) are all dropped, not deferred. What
remains genuinely useful to prepare: the database schema a developer
would need if they add their own backend, plus a working example of the
sync *pattern* so they aren't starting from zero.

## What Changes

- `docs/supabase-database.md` trimmed: removes the `entitlements` table
  (backed Stripe monetization) and the four community-feed tables
  (`community_posts`, `post_likes`, `post_comments`, `reports`). Keeps
  `profiles` and `projects` as reference-only schema - real SQL a
  developer copies into their **own** Supabase project. Never applied to
  the live `pixi` Supabase project; never referenced by any code under
  `js/`.
- New `examples/supabase-sync/` directory: working example code
  demonstrating the sync pattern (push a local project to the `projects`
  table, pull remote changes via `updated_at` for last-write-wins)
  against that schema. Takes an already-authenticated Supabase client as
  a parameter - demonstrates sync only, not auth. A README explains a
  developer must supply their own authenticated client (however they
  build sign-in) for it to run. Not imported by `js/app.js` or any
  shipped app code path - lives entirely outside Pixi's runtime.
- `openspec/roadmap.md` rewritten: Phase 3 redefined around this
  database-prep-and-example scope (no auth). Phases 4 and 5 deleted
  outright.
- `CLAUDE.md`'s "Stack" paragraph reframed: Supabase is documented and
  schema-ready but intentionally never wired into the shipped app - a
  developer forking this project connects their own backend, including
  auth, entirely themselves. Non-goals gains: no built-in monetization
  or community features, ever - dropped, not deferred.
- `openspec/changes/3a-google-auth` (a prior Google-auth-only plan) was
  already deleted, unimplemented - superseded by this change.

## Capabilities

### New Capabilities
- `supabase-sync-example`: the standalone, non-shipped example module in
  `examples/supabase-sync/` demonstrating the project-sync pattern
  against the reference schema.

### Modified Capabilities
(none - no existing app-facing capability's requirements change; Pixi's
actual runtime behavior is untouched by this change)

## Impact

- `docs/supabase-database.md`: `entitlements` and the four community
  tables removed; `profiles`/`projects` reframed as reference-only.
- `examples/supabase-sync/` (new): example push/pull code + README, not
  part of the app bundle.
- `openspec/roadmap.md`: Phase 3 rewritten, Phases 4-5 deleted.
- `CLAUDE.md`: Stack paragraph and Non-goals updated.
- No changes to `js/app.js`, `js/persistence.js`, Dexie schema, or any
  drawing/canvas/UI code.
