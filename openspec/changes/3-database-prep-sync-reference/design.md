## Context

This change was reached through direct brainstorming with the user
(not open design questions left for later) - see proposal.md for the
"why." It touches project documentation/roadmap plus one standalone,
non-shipped example module. It does not touch `js/app.js`, Dexie, or
any drawing/canvas code.

## Goals / Non-Goals

**Goals:**
- Leave a developer forking Pixi with an accurate, minimal reference
  schema (`profiles`, `projects`) and a working example of the sync
  pattern - not a half-finished feature they have to reverse-engineer.
- Zero behavior change to the shipped app.
- Roadmap/CLAUDE.md accurately describe the project's actual scope going
  forward (no auth, no monetization, no community feed - ever).

**Non-Goals:**
- No auth of any kind, anywhere in this change.
- No application of any SQL to the live `pixi` Supabase project.
- No changes to `docs/supabase-database.md`'s Storage-paths or Secrets/
  deployment sections beyond removing references to dropped tables -
  those sections' remaining content (GitHub integration, RLS-as-access-
  control explanation) is still accurate and useful reference material.

## Decisions

- **`examples/supabase-sync/` as plain Node-runnable modules, not
  browser ES modules loaded by `index.html`.** Since nothing in `js/`
  may import this code (per the spec's "not part of the shipped app"
  requirement), and the rest of the repo has no build step, the example
  is written as standalone `.js` files runnable directly (`node
  examples/supabase-sync/push.js`, etc., or documented as copy-paste
  reference) rather than trying to fit into the browser-only `js/`
  module graph. Its own `import { createClient } from
  '@supabase/supabase-js'` line is fine to differ from the rest of the
  repo's CDN-import convention, since this code never ships to a
  browser via `index.html`.
- **Functions take a `SupabaseClient` parameter, never construct their
  own.** `pushProject(client, project)` / `pullProject(client,
  projectId, localUpdatedAt)` - dependency injection, not a module-level
  `createClient(...)` call. This is what makes "not part of auth" a
  structural fact rather than a documentation promise: the example
  literally cannot authenticate anything, it only ever receives a client
  that's already able to make requests.
- **`pullProject` returns a decision, doesn't apply one.** Per the
  spec's last-write-wins requirement, the function compares timestamps
  and returns which version is authoritative (`{ winner: 'local' |
  'remote', data }`) rather than silently overwriting local Dexie state
  itself - keeps the example's surface small and lets a reader see the
  conflict-resolution logic directly instead of it being buried inside a
  larger orchestration function they'd have to trace through.
- **`docs/supabase-database.md` keeps its existing section structure**
  (Project, Environment Setup, Data Schema, Storage paths, RLS intent,
  Offline-first sync sketch, Secrets & deployment) - only removes the
  `entitlements`/community table entries and their RLS-intent bullets,
  and updates section 6's "to be firmed up when Phase 3 gets proposed"
  line (Phase 3 now means this change, which explicitly does NOT firm up
  a production sync design - that line is corrected to point at
  `examples/supabase-sync/` as a pattern reference instead, not a
  finished design).
- **`openspec/roadmap.md`'s Phase 3 keeps its "not yet started" framing
  inverted**: this change *is* what Phase 3 now means (a reference/
  example deliverable, not an app feature), so once implemented Phase
  3's status becomes "done" like Phases 1-2 - there's no further "real"
  Phase 3 work waiting behind it, since a fork's own auth/sync is by
  definition outside this repo's roadmap.

## Risks / Trade-offs

- [A future contributor might be tempted to import
  `examples/supabase-sync/` into `js/` for convenience] → the spec's
  "not part of the shipped app" requirement makes this an explicit
  regression to catch (e.g. in code review), not just an unstated
  assumption.
- [Reference schema in docs can drift from what a developer's actual
  fork needs] → acceptable; it's explicitly a starting point/reference,
  not a maintained product surface with compatibility guarantees.
