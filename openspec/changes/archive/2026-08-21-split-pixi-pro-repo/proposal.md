## Why

Pixi is currently one free, open-source app. To monetize it at a low price
point ($5) without building license-key infrastructure, it needs to become
two self-hosted tiers — free Standard and paid Pro — with Pro's extra tools
(Layers, Color Library, pixel-perfect drawing, symmetry, Canvas Settings,
image import, Rectangle fill/outline, Pencil opacity) gated by which repo a
user has access to, not by a runtime license check. This formalizes the
design already worked out in `docs/superpowers/specs/2026-08-18-pixi-tiers-design.md`
and `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md` (legacy
location per CLAUDE.md) as a real OpenSpec change, and resolves the one
open question those docs left flagged: the public demo will be a full,
unrestricted live build (not export-crippled) — the user has decided
$5 is low enough that code visibility via devtools isn't worth trading off
against demo conversion value.

## What Changes

- Create a new private GitHub repo, `pixi-pro`, containing only the
  Pro-only modules (not a fork of `pixi`).
- `pixi-pro` includes this repo (`pixi`) as a **git submodule pinned to a
  released tag** (not tracking `main`), so Standard's unreleased work
  doesn't destabilize Pro development. The pin is bumped manually.
- `pixi` (this repo) stays public and free and remains the Standard tier,
  but is **not code-unchanged**: the full Pro-only feature set already
  shipped into `pixi`'s code with tier-gating explicitly deferred — Layers
  panel (`js/layers.js` + its `index.html` markup), Color Library
  (`js/default-color-library.js` and its call sites), pixel-perfect
  drawing (`js/engine.js`, `js/workspace.js`), symmetry (`js/symmetry.js`),
  Canvas Settings (`js/canvas-settings.js`), brush/image import
  (`js/brush-import.js`, `js/image-import.js`), Rectangle fill/outline
  toggle (`js/shape-tools.js` + its `index.html` markup), and the
  Pencil/Eraser opacity slider (`js/workspace.js` + its `index.html`
  markup). This change removes all of it from `pixi` and re-homes it as
  additive modules in `pixi-pro`. No tier-gating flag is added to `pixi`
  in its place; the split stays structural (which repo you have), not a
  runtime flag.
- `pixi-pro` gets its own public live deploy publishing a **full,
  unrestricted** working build — no watermarking, no export/save
  crippling. This is the public demo. It is **not** GitHub Pages: GitHub
  Pages requires either a public source repo (GitHub Free) or a paid plan
  (Pro/Team/Enterprise) to deploy from a private one, and `pixi-pro` must
  stay private for the collaborator-access gate to mean anything. Instead,
  `pixi-pro` deploys to **Cloudflare Pages**, connected directly to the
  private repo (auto-deploy on push/tag) — free, no bandwidth cap, no
  second repo to keep in sync. `pixi` (Standard) keeps its existing GitHub
  Pages deploy unchanged, since it's already public.
- Distribution stays fully manual: buyer pays $5 via PayPal, is added as a
  GitHub collaborator on `pixi-pro` (or handed a release zip) by hand. No
  automated licensing, no Stripe/Supabase entitlements for this flow —
  this explicitly supersedes `openspec/roadmap.md` Phase 4's original
  Stripe/entitlements sketch for this specific split (Phase 4 may still
  apply to a different future monetization path).
- Superseded/clarified from the legacy design docs: the "Demo" section's
  open question (full demo vs. export-crippled) is now resolved — full
  live demo, decided by the user.

## Capabilities

### New Capabilities
- `pixi-pro-distribution`: the two-repo structure (`pixi` public/Standard,
  `pixi-pro` private/Pro), the submodule pin mechanism, which feature set
  belongs to each tier, the manual PayPal→collaborator access flow, and
  the public live-demo deployment of `pixi-pro` to Cloudflare Pages.

### Modified Capabilities
(none — `pixi` itself has no requirement changes; this is additive
infrastructure living entirely in the new `pixi-pro` repo)

## Impact

- New repo: `pixi-pro` (private), with its own Cloudflare Pages deploy
  (connected to the repo, auto-deploy on push/tag) — not GitHub Pages,
  since GitHub Pages can't deploy from a private repo on the free plan.
- `pixi`: requires real code changes — removal of the already-shipped
  Pro-only feature set listed above (Layers, Color Library, pixel-perfect,
  symmetry, Canvas Settings, brush/image import, Rectangle fill/outline
  toggle, Pencil/Eraser opacity), touching `index.html` and most of `js/`.
  This is a breaking change for any existing Standard install relying on
  those features today — accepted, since the roadmap already flagged
  their tier-gating as deferred/pending. Its GitHub Pages deploy and repo
  identity are otherwise unchanged.
- Distribution/ops process: manual PayPal payment handling, manual GitHub
  collaborator management, manual submodule tag bumps when Pro is
  rebuilt against a newer Standard release.
- `openspec/roadmap.md`'s "Standard/Pro tier split" entry under "Not yet
  scheduled" should be marked as proposed (pointing at this change) once
  this is archived/synced.
- Legacy docs `docs/superpowers/specs/2026-08-18-pixi-tiers-design.md` and
  `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md` become
  historical input to this change rather than the living source of truth;
  the spec delta below is the source of truth going forward.
