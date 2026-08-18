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
  - **2f — Color Library panel**: named, IndexedDB-persisted palettes of
    user-added colors in a scrollable right-sidebar panel (dropdown to
    switch palettes, sorted alphabetically once more than one exists) —
    the "saved palettes" half of custom colors that 2c2 deliberately
    deferred (2c2's `customSwatches` was session-only, unnamed, flat).
    Replaces `customSwatches` outright rather than living alongside it.
  - **2g — Background layer**: a white-background canvas's starting
    layer becomes a locked (reorder-disabled) "Background" layer;
    erasing it reveals the current Background color (from 2c2's
    Foreground/Background model) instead of transparency. Transparent-
    background canvases are unaffected. Completes a Non-Goal 2c2's
    design.md explicitly deferred ("Background does not affect Eraser"),
    now scoped to this one special layer instead of every layer.
  - **2h — Canvas Settings popover**: converts Canvas Settings from a
    docked bottom panel to a popover anchored to the top bar's gear icon
    (same clamped-to-viewport pattern the color-picker popover uses), so
    opening it no longer shifts the Workspace layout. Also raised
    directly, grouped here as another workspace-chrome refinement (not a
    new drawing capability) alongside 2d/2e/2f.
  - **2i — URL routing**: hash-based routes (`#/`, `#/new`,
    `#/project/<id>`) so the URL always reflects the current screen —
    reloading the page while a project is open reopens that same
    project instead of dropping back to the Gallery, and Back/Forward
    navigate between screens. Keyed off the stable ID every project
    already gets at creation; does not enable sharing a project to
    another browser/device (no backend yet — see Phase 3). Raised
    directly.
  - **2j — Move tool**: a Photoshop/Illustrator-style Move tool
    (shortcut `V`) that drags pixel content on the active layer to a new
    position — with an active selection, just the selected region's
    content (the selection rect moves with it); with none, the whole
    active layer's content. The source area clears to transparent, same
    idea `2c1`'s selection Delete already uses. Raised directly, right
    after `2c1`'s Selection tool shipped with moving/copying a
    selection's contents explicitly out of scope — this closes that gap.
  - **2k — Layers panel redesign**: redraws the Layers panel in
    Photoshop's own style — a live per-layer pixel thumbnail, and
    Blend mode/Opacity moved from per-row controls to a shared toolbar
    that edits whichever layer is active. Presentation only; no change
    to what the panel can do. Raised directly, with a reference
    screenshot.
  - **2l — Right-panel redesign**: reorders the right sidebar (Color
    Library above Layers, since color selection is used more often
    while drawing), adds a VSCode-style whole-sidebar show/hide toggle
    independent of each panel's own state, makes both panel headers
    collapse-to-header (Photoshop-accordion style, folding 2d's
    Layers-panel hide/show and 2k's shared-controls layout into this
    shape), bounds Color Library's height instead of letting it fill
    all remaining space, and compresses Layers' Blend mode/Opacity onto
    one row. Raised directly, with reference screenshots.
  - **2m — Brush import from image**: an "Import" entry point in the
    Brushes panel that opens a file picker, decodes the image, and
    pre-fills the existing custom-brush grid editor (2c1) via
    alpha-based thresholding (falling back to brightness-based
    thresholding for fully-opaque images) at the editor's current W/H —
    producing a monochrome silhouette brush, not a full-color stamp.
    Changing W/H afterward re-pixelates from the stored source image
    instead of clearing, so the user can dial in resolution before
    hand-tweaking and saving through the same editor. Raised directly;
    to be built in parallel with 2n via git worktrees, sharing a small
    image-decode/downsample utility.
  - **2n — Color Library import from image**: an "Import" entry point
    in the Color Library panel that opens a file picker, downsamples
    the image to a fixed internal grid purely as a color-extraction
    step (the grid itself isn't user-facing), and extracts a
    user-adjustable number of representative colors via clustering
    (e.g. median-cut) rather than raw top-N-by-frequency, so
    anti-aliasing/gradients don't crowd the result with near-duplicate
    shades. Shows a live preview (adjust color count, watch it
    re-extract) before naming and saving as a new palette through the
    existing "+ New Palette" flow (2f). Raised directly; to be built in
    parallel with 2m via git worktrees, sharing a small image-decode/
    downsample utility.

Status: **all sub-changes (2a–2n) done and archived** — specs live at
`openspec/specs/` (`layers`, `local-persistence`, `gallery`, `canvas-
settings`, `brushes`, `shape-tools`, `pixel-drawing-engine`, `canvas-
navigation`, `color-library`, `url-routing`, `export`); archives under
`openspec/changes/archive/`. **Phase 2 is complete.** 2m and 2n were
built in parallel via separate git worktrees, sharing a small
`js/image-import.js` decode/downsample utility that each change created
independently and which was reconciled on merge (see that merge commit).

## Phase 3 — Supabase Auth + sync

- Google sign-in via Supabase Auth only, for now — no email+password.
  Other providers (Apple, GitHub, magic link, anonymous accounts, etc.)
  are possible later but explicitly not planned yet; revisit when this
  phase is actually picked up.
- Projects sync to Postgres/Storage per the schema in
  `docs/supabase-database.md`
- Offline-first behavior: IndexedDB stays the source of truth when signed out
  or offline; sync is additive, not required to use the app
- Screen: **Sign in**

Status: **deliberately not started yet** — holding off on the whole
auth/sync layer for now, not just deferring a decision within it.

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
- ~~**Reference image layer (trace-over)**~~ — upload an image onto its
  own layer as a visual guide (not downsampled/pixelated - kept at
  original fidelity, only scaled down to fit the fixed canvas size when
  the source is larger), so the user can draw pixel art on a separate
  layer on top of it. The reference layer is locked like Phase 2g's
  Background layer (non-drawable, reorder-disabled) and is always
  excluded from export regardless of its visibility toggle. Distinct
  from the "Import screen" idea above, which is about importing files as
  editable content. Raised 2026-08-18; proposed and implemented via
  `openspec/changes/reference-image-layer/` (tier-gating itself deferred
  - see that change's proposal.md - since no Standard/Pro gating
  mechanism exists in code yet).
- **UI polish pass — refine the design window by window, panel by
  panel.** Raised directly on 2026-08-17, after 2m/2n shipped and real
  usage surfaced rough edges. An open-ended initiative, not one change -
  work through it screen by screen, panel by panel, pulling in one
  design/bug item at a time rather than batching.

  Resolved so far:
  - ~~`2n`'s Import icon rendered broken (overlapping "I"/"MAG" text)~~ -
    fixed directly (no OpenSpec change - pure bug fix, no behavior
    change): the `image` Material Symbol was missing from `index.html`'s
    font `icon_names` subset, so it fell back to literal ligature text.
  - ~~Layer thumbnails didn't update live while drawing~~ - fixed
    directly (no OpenSpec change): the drawing-stroke, bucket-fill, and
    selection-delete commit paths called `commit()` but never
    `renderLayersPanel()`, unlike every structural layer action (add/
    delete/reorder/visibility/rename).
  - ~~`2m`'s SVG import silently failed~~, ~~`2n`'s color-count input
    shifted position as the preview grew~~, and ~~`2m`'s Import button
    was a full-width text button in its own row~~ - all three fixed
    together via `2o-image-import-refinements` (archived): SVG now
    decodes via an `<img>`-element fallback when `createImageBitmap`
    fails; `2n`'s import preview became an anchored popover (fixed-height
    swatch grid, not just `max-height` - the first attempt still let
    shorter previews shift position, caught by the Playwright pass and
    corrected); `2m`'s Import control is now an icon button in the
    editor's header row. The brush editor itself stayed a docked panel
    (confirmed with the user, not converted to a popover).
  - ~~Light/dark/system-match theme toggle~~ - shipped: `js/theme.js` +
    `js/theme-boot.js` (FOUC handling), a toggle near the right-sidebar
    hide toggle, `test/theme.test.js`.
  - ~~Right-sidebar hide/show should slide, not snap~~ - fixed directly
    (AUD-11, no OpenSpec change - see below on why): `#right-sidebar`
    now animates `width`/`border-left-color` on toggle (0.2s,
    `prefers-reduced-motion`-gated, same pattern the magnetic-hover buzz
    animation already used), with `inert` applied while collapsed.
  - ~~Color Library sequence mode duplicated per tool
    (`#pencil-library-toggle`/`#brush-library-toggle`)~~ - fixed
    directly (AUD-12): consolidated into one shared
    `#library-sequence-toggle` in `#library-sequence-options`, modeled
    on `#square-constraint-toggle`'s existing single-shared-control
    pattern (tool-scoped visibility: shown for Pencil/Brush, hidden
    otherwise) instead of two DOM instances driving one flag.

  A dated, per-finding audit register (id/severity/state, one row per
  issue) lives under `docs/audits/` going forward - e.g.
  `docs/audits/2026-08-17-ui-polish-audit.md` - rather than folding new
  findings into this roadmap section. AUD-11/AUD-12 above were real
  behavior changes and CLAUDE.md's own process would normally route
  them through `/opsx:propose` before implementation; they were
  implemented directly at the user's explicit request instead, so
  `openspec/specs/` (`canvas-navigation` for the sidebar animation,
  `brushes` for the consolidated toggle) has not been updated to
  reflect them - worth a spec sync pass so the specs don't drift from
  what's actually built.

  Still open: none from this pass currently tracked here - see
  `docs/audits/` for the fuller, itemized register (includes items still
  `needs-recheck` or intentionally not pursued).
