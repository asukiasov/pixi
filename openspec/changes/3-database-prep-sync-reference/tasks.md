## 1. Trim the reference schema doc

- [ ] 1.1 In `docs/supabase-database.md`, remove the `entitlements`
      table section and its RLS-intent bullet.
- [ ] 1.2 Remove the `community_posts`, `post_likes`, `post_comments`,
      and `reports` table sections and their RLS-intent bullets.
- [ ] 1.3 Remove the `community/{post_id}.png` line from the Storage
      paths section.
- [ ] 1.4 Reframe the remaining `profiles`/`projects` schema as
      explicitly reference-only (copy into your own project; never
      applied here) - update the doc's top status line and section 6's
      "to be firmed up when Phase 3 gets proposed" note to instead point
      at `examples/supabase-sync/` as a pattern reference.
- [ ] 1.5 Update "Open items for whoever proposes the sync/auth change"
      at the bottom - most items are now resolved/moot (no auth, no RLS
      to write for dropped tables); leave only what's still genuinely
      open for a developer's own fork.

## 2. Sync example module

- [ ] 2.1 Create `examples/supabase-sync/push.js`:
      `pushProject(client, project)` - upserts into `projects` keyed by
      `id`.
- [ ] 2.2 Create `examples/supabase-sync/pull.js`:
      `pullProject(client, projectId, localUpdatedAt)` - fetches the
      remote row, compares `updated_at`, returns `{ winner: 'local' |
      'remote', data }` without applying the result.
- [ ] 2.3 Create `examples/supabase-sync/README.md`: explains the
      example requires a caller-supplied authenticated `SupabaseClient`,
      links to `docs/supabase-database.md` for the schema, and states
      plainly that it is not imported anywhere in the shipped app.

## 3. Roadmap and CLAUDE.md

- [ ] 3.1 Rewrite `openspec/roadmap.md`'s Phase 3: rename away from
      "Supabase Auth + sync," describe the database-prep-and-example
      scope this change actually delivers, mark status **done** once
      implemented (this change is the entirety of what Phase 3 now
      means - no further app-facing work follows it).
- [ ] 3.2 Delete Phase 4 (Monetization) and Phase 5 (Community feed)
      from `openspec/roadmap.md` outright.
- [ ] 3.3 In `CLAUDE.md`'s "Stack" paragraph, reframe Supabase from
      "additive, later-phase only" to schema-documented-but-never-wired-
      in, with connecting a backend (including auth) left entirely to
      whoever forks the project.
- [ ] 3.4 Add a line to `CLAUDE.md`'s Non-goals: no built-in monetization
      or community features, ever - dropped, not deferred.

## 4. Verify

- [ ] 4.1 Run `npm test` - no regressions expected (no app code
      touched).
- [ ] 4.2 Confirm `js/app.js` and everything reachable from `index.html`
      has zero references to `examples/`, Supabase, or `createClient`.
- [ ] 4.3 Read the final `docs/supabase-database.md`,
      `openspec/roadmap.md`, and `CLAUDE.md` end to end for internal
      consistency (no leftover mentions of auth, entitlements, or
      community tables anywhere).
