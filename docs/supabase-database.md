# Supabase / Database Reference

Status: **reference only** — nothing in this document is implemented yet.
Auth/sync (and Stripe entitlements, community feed) are explicitly out of
scope for Phase 1 (see `openspec/roadmap.md`). Per `CLAUDE.md`, any change
that actually wires this in — auth, Postgres reads/writes, Storage, Stripe
webhook — needs an OpenSpec proposal (`/opsx:propose`) before code is written.
This doc exists so that proposal has the schema and config to work from.

Supersedes the earlier Firebase-based design — the project switched database
providers on 2026-08-14, before any Firebase code was written. Nothing to
migrate; this is a clean-slate schema for Supabase.

## 1. Supabase Project

Project: `pixi`, org `asukiasov@gmail.com's Org` (Free tier).

```js
const SUPABASE_URL = "https://<project-ref>.supabase.co"; // from Project Settings > API
const SUPABASE_ANON_KEY = "<anon-key>"; // from Project Settings > API
```

Like Firebase's client config, the Supabase URL + anon key are **not
secrets** — they ship in client JS as-is. Access control is enforced by
Postgres Row Level Security (RLS) policies (see below), not by hiding these
values. Pull the live values from the dashboard when wiring this in rather
than hardcoding placeholders.

**GitHub integration is already connected**: repo `asukiasov/pixi`, working
directory `.` (no `supabase/` folder exists yet — `.` is correct so a future
`supabase init` creates it at the repo root), production branch `main`,
"deploy to production on merge" enabled. Once a `supabase/migrations/`
directory exists, merging to `main` auto-applies migrations to the production
database — no GitHub Actions or repo secrets involved in that path.

## 2. Environment Setup

**Chosen approach: CDN ES modules**, matching the no-build-step scaffold
(`index.html`, `style.css`, ES modules under `js/`, see
`openspec/changes/archive/2026-08-14-1-scaffold-drawing-engine/`). Unlike
Firebase, Supabase doesn't publish a first-party CDN build of `supabase-js`,
so import it from an ESM CDN wrapper such as esm.sh:

```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

Pin the major version (`@2` here); esm.sh resolves the latest matching
release, so bump deliberately if a breaking v3 ever ships.

## 3. Data Schema (Postgres)

Tables reflect Pixi's actual domain (canvases/artwork/community), not a
generic placeholder. Column lists are the intended shape for planning
purposes — the OpenSpec proposal that implements each capability is the
place to finalize types/constraints/RLS policies.

Auth itself is handled by Supabase's built-in `auth.users` table (Google
OAuth provider) — no custom `users` table is needed for login. A `profiles`
table below holds the app-specific fields Firestore would have kept on the
user document.

### `profiles`
One row per `auth.users` row, same `id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, FK → `auth.users.id` |
| `display_name` | text | |
| `email` | text | |
| `photo_url` | text | nullable |
| `created_at` | timestamptz | default `now()` |

### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, client-generated (so a project can exist offline in Dexie before ever syncing) |
| `user_id` | uuid | FK → `auth.users.id` |
| `name` | text | |
| `width` | integer | |
| `height` | integer | |
| `layers` | jsonb | array of `{ name, storagePath, opacity, blendMode }` — pixel data is a PNG in Storage, this column only stores the reference |
| `palette` | jsonb | array of hex color strings |
| `thumbnail_url` | text | |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | bump on every write; also the field an offline-first sync worker would use for last-write-wins conflict resolution |

### `entitlements`
Written only by the Stripe webhook (a Supabase Edge Function) via the
`service_role` key, which bypasses RLS — never from client code.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | PK, FK → `auth.users.id` |
| `licensed` | boolean | |
| `stripe_customer_id` | text | |
| `purchased_at` | timestamptz | |

### `community_posts`
Public read, author-only write.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `auth.users.id`, author |
| `image_url` | text | |
| `caption` | text | |
| `created_at` | timestamptz | default `now()` |
| `like_count` | integer | denormalized, default 0 |
| `report_count` | integer | denormalized, default 0 |

### `post_likes`
Unique `(post_id, user_id)` prevents double-likes (replaces Firestore's
doc-ID-is-the-uid trick).

| Column | Type | Notes |
|---|---|---|
| `post_id` | uuid | FK → `community_posts.id` |
| `user_id` | uuid | FK → `auth.users.id` |
| `created_at` | timestamptz | default `now()` |

### `post_comments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `post_id` | uuid | FK → `community_posts.id` |
| `user_id` | uuid | FK → `auth.users.id` |
| `text` | text | |
| `created_at` | timestamptz | default `now()` |

### `reports`
Top-level moderation queue (not nested — admins scan across all posts).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `post_id` | uuid | FK → `community_posts.id` |
| `reported_by` | uuid | FK → `auth.users.id` |
| `reason` | text | |
| `status` | text | `pending` \| `reviewed` \| `dismissed` |
| `created_at` | timestamptz | default `now()` |

## 4. Storage paths

Bucket layout, analogous to the Firebase Storage design it replaces:

- `projects/{user_id}/{project_id}/layers/{layer_id}.png`
- `projects/{user_id}/{project_id}/thumbnail.png`
- `community/{post_id}.png`

Layer pixel data lives in Storage as PNGs; the `projects.layers` jsonb column
only holds the storage path plus metadata (name, opacity, blendMode).

## 5. RLS policy intent

Row Level Security is Postgres's equivalent of Firestore security rules —
the actual access-control layer, not the URL/anon-key secrecy.

- `projects` — select/insert/update/delete only where `user_id = auth.uid()`
- `entitlements` — client can `select` their own row (`user_id = auth.uid()`);
  no client `insert`/`update`/`delete` policy at all — writes only via the
  Stripe webhook Edge Function using `service_role`, which bypasses RLS
- `community_posts` — public `select`; `insert`/`update`/`delete` only where
  `user_id = auth.uid()`
- `post_likes` / `post_comments` — public `select`; write only where
  `user_id = auth.uid()`
- Storage bucket policies mirror the table policies for the paths above
  (owner-only for `projects/`, public read for `community/`)
- **RLS must be enabled on every table above** — Supabase tables are
  RLS-disabled (open) by default; do not ship a table without explicitly
  enabling and writing its policies

## 6. Offline-first sync sketch (Dexie ↔ Supabase)

Not decided yet — sketch only, to be firmed up when Phase 3 gets proposed.
See `openspec/roadmap.md` Phase 2/3.

- Dexie/IndexedDB is the primary store the UI reads/writes; Postgres is a
  sync target, not the source of truth for a signed-out or offline user.
- A project's `id` (uuid) is generated client-side at creation, so it exists
  in Dexie before it ever syncs — the same id becomes the `projects.id` row.
- Sync direction: local writes push to Supabase when signed in and online
  (queued via a `dirty`/`pending_sync` flag Dexie keeps but Postgres doesn't
  need); remote changes pull down via `updated_at` comparison.
- Conflict resolution: last-write-wins via `updated_at` is the simplest
  default; nothing more sophisticated has been decided.
- Open: auto-sync on sign-in/reconnect vs. user-initiated; live-pull via
  Supabase Realtime vs. on-demand pull.

## Secrets & deployment

Deployment target is **GitHub Pages** for the static app (no server compute,
no GitHub Actions/CI planned for the frontend). Supabase itself is separate
infrastructure with its own deployment path:

- `SUPABASE_URL` / anon key above are not secrets — ship in client JS. No
  GitHub repo secrets needed for them.
- RLS policies are the actual access-control layer for everything in this
  doc — not secret-keeping.
- Database schema/migrations deploy via **Supabase's GitHub integration**
  (already connected, see section 1) — merging `supabase/migrations/`
  changes into `main` applies them to production automatically. This isn't
  GitHub Actions; it's Supabase's own GitHub App, no repo secrets involved.
- Anything that's a genuine secret — Stripe secret key, Stripe webhook
  signing secret, the Supabase `service_role` key — must never ship to the
  client and cannot live on GitHub Pages (static hosting only). That code
  runs as a **Supabase Edge Function** (Deno runtime), using Supabase's own
  secret storage (`supabase secrets set`), not GitHub Actions secrets. This
  only becomes relevant at Phase 4 (see `openspec/roadmap.md`).

## Open items for whoever proposes the sync/auth change

- Write the actual RLS policies (SQL) implementing the intent above — this
  doc states intent, not enforced policies.
- Write the `supabase/migrations/` SQL for the schema above.
- Confirm Google is the only OAuth provider needed, or add others.
- Firm up the offline-first sync design in section 6.
