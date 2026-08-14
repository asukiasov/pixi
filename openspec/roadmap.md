# Pixi Roadmap

Phase-level plan for the project. Each phase becomes one or more numbered
OpenSpec changes under `openspec/changes/` (e.g. `1-scaffold-drawing-engine`
for Phase 1). This file tracks intent, ordering, and which screens belong to
each phase; the changes themselves are the source of truth for scope and
requirements once written. Work through phases in order — each should be a
working, testable slice before the next starts; ask before jumping ahead.

## Phase 1 — Scaffold + core drawing engine

Repo scaffold, New Canvas flow, core drawing engine: one canvas drawable and
exportable to PNG, session-only (no persistence).

- Screens: **New canvas** (size presets + custom, background type),
  **Workspace** (pencil, eraser, bucket, pixel-perfect line, fixed palette,
  undo/redo, single-button PNG export at native resolution)

Status: **done** — archived at
`openspec/changes/archive/2026-08-14-1-scaffold-drawing-engine/`, specs live
at `openspec/specs/canvas-creation/` and `openspec/specs/pixel-drawing-engine/`.

## Phase 2 — Layers, local persistence, and the full toolset

Entirely local, no Supabase, no accounts. This is the point where Pixi becomes
a real standalone tool someone could use offline indefinitely. Too broad for
one OpenSpec change, so it's split into three ordered sub-changes, each
proposed/implemented/archived before the next starts:

- **2a — Layers**: add/reorder/opacity/delete, composited via canvas blend
  modes. Builds directly on Phase 1's engine.
- **2b — Local persistence + project management**: save/load through
  IndexedDB (Dexie) — turns Phase 1's session-only canvas into projects that
  survive closing the tab — plus the **Gallery** screen (grid of saved
  projects, thumbnails, "+" new canvas) and **Canvas settings** screen
  (resize/crop/rotate an existing project).
- **2c — Full toolset**: full color/palette panel (custom color picker,
  saved palettes, replacing Phase 1's fixed 16-swatch row), symmetry & grid
  tools (mirror axes, tile preview, grid overlay density), line/shape/
  selection tools (beyond Phase 1's pencil/eraser/bucket), and the full
  **Export** screen (scale multiplier, transparent-background toggle — Phase
  1 shipped only a single native-resolution export button).

Status: 2a in progress — `openspec/changes/2a-layers/`. 2b and 2c not
started; not detailed further until 2a is done, since implementing layers
may reveal constraints worth reflecting in their specs.

## Phase 3 — Supabase Auth + sync

- Google sign-in via Supabase Auth
- Projects sync to Postgres/Storage per the schema in
  `docs/supabase-database.md`
- Offline-first behavior: IndexedDB stays the source of truth when signed out
  or offline; sync is additive, not required to use the app
- Screen: **Sign in**

Status: not started.

## Phase 4 — Monetization

- Stripe Checkout + Supabase Edge Function webhook + entitlements gating —
  the one-time-purchase unlock
- Screen: **Upgrade/unlock**
- Needs real server compute (Edge Functions) for the webhook and
  `service_role`-key writes — GitHub Pages hosting can't run this part; see
  the Secrets & deployment note in `docs/supabase-database.md`

Status: not started, not urgent to detail yet.

## Phase 5 — Community feed

- Post/like/comment/report, plus a moderation queue
- Screen: **Community feed**

Status: not started, not urgent to detail yet.

## Not yet scheduled

Mentioned in early planning but not assigned a phase — pull one in when it
becomes the next priority:
- **Settings** screen (stylus calibration, gesture remapping, account)
- **Import** screen (.aseprite, reference images, palette files)
- Animation timeline / onion skinning — explicitly out of scope for now, see
  CLAUDE.md non-goals; would need its own roadmap discussion if ever revisited
