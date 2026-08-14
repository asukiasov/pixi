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
- **2c — Full toolset**: full color/palette panel, symmetry & grid tools,
  line/shape/selection tools, a brush tool, and the full Export screen. Grew
  to 5 fairly independent areas (the brush tool was added later, see below),
  so it's further split into three ordered sub-changes of its own:
  - **2c1 — Brushes and shape tools**: an extensible brush tool (place a
    predefined pixel pattern in the current color with one click, or drag
    to place a repeating trail — a "heart" brush is the first shape, with
    a Rainbow color-cycling mode) plus line/shape/selection tools (beyond
    Phase 1's pencil/eraser/bucket).
  - **2c2 — Color panel**: custom color picker with RGB/hex entry and
    "add to palette", alongside Phase 1's fixed 16-swatch row; an
    Eyedropper tool (sample a color from the canvas); Photoshop-style
    Foreground/Background colors (two swatches, swap, reset-to-default),
    with Background not yet wired into any tool's drawing behavior.
    Scoped down from the original "color panel and symmetry/grid"
    description — symmetry & grid tools (mirror axes, tile preview, grid
    overlay density) weren't requested with the color picker and are
    unrelated in implementation; still available to pull into a later
    2c2-follow-up or its own change when prioritized. "Saved palettes"
    (persisting custom swatches across sessions) is also deferred — this
    slice is session-only.
  - **2c3 — Full Export screen**: scale multiplier, transparent-background
    toggle (Phase 1 shipped only a single native-resolution export button).

  - **2d — Canvas navigation and workspace layout**: zoom in/out (buttons
    + Cmd/Ctrl +/-), 100% / Fit Screen / Fill Screen zoom presets, a
    zoom-percentage readout, a Hand tool for panning while zoomed in, and
    moving the Layers panel to a right-side sidebar with a way to hide the
    whole panel. Raised after 2c1; not part of the original 2c split, but
    fits alongside it (workspace chrome, not a new drawing tool) rather
    than under Phase 3+.
  - **2e — Pencil/Eraser Size and Opacity**: a configurable circular tip
    (Size, in pixels) and Opacity (alpha blending, not full overwrite),
    shared by Pencil and Eraser, with vertical sliders in the tools
    sidebar shown only while one of those tools is active. Also raised
    after 2c1; grouped with 2d as workspace/tool refinements rather than
    new drawing capabilities in their own right.

Status: **2a done** — archived at
`openspec/changes/archive/2026-08-14-2a-layers/`, spec lives at
`openspec/specs/layers/`. **2b done** — archived at
`openspec/changes/archive/2026-08-14-2b-local-persistence-gallery/`, specs
live at `openspec/specs/local-persistence/`, `openspec/specs/gallery/`,
`openspec/specs/canvas-settings/`. **2c1 in progress. 2d, 2e, 2c2 done**
(none yet archived). **2c3 proposed, not yet implemented.**

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
- **Custom brush creation** — a way to draw your own pattern (mini pixel
  grid editor) and save it into the Brush picker alongside Heart, instead
  of only shipping predefined shapes. Raised while building 2c1's Brush
  tool; explicitly deferred, not a priority right now.
