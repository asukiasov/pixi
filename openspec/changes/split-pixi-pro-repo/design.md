## Context

See proposal.md - Why. Input docs: `docs/superpowers/specs/2026-08-18-pixi-tiers-design.md`
and `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md` (legacy
location, superseded by this change as the living source of truth). `pixi`
has no bundler and no build step — plain HTML/CSS/JS with ES modules, which
constrains how `pixi-pro` can layer Pro modules on top (no compile-time
tree-shaking or module federation available).

## Goals / Non-Goals

**Goals:**
- One canonical copy of shared engine code (in `pixi`), never duplicated
  into `pixi-pro`.
- Pro modules added on top of `pixi` without editing `pixi`'s files inside
  `pixi-pro`'s own copy (that would fork the code and defeat "fix once").
- Minimal new infrastructure: no license server, no entitlements DB, no
  Stripe/Supabase involvement for this flow.
- Remove the already-shipped Pro-only feature set (Layers, Color Library,
  pixel-perfect, symmetry, Canvas Settings, brush/image import, Rectangle
  fill/outline toggle, Pencil/Eraser opacity — see proposal.md's What
  Changes for exact file locations) from `pixi` cleanly, without breaking
  Standard tools that share files with them (`workspace.js`, `engine.js`,
  `index.html`).

**Non-Goals:**
- Not preventing Pro source from being readable via the public demo's
  devtools — accepted trade-off, not solved here.
- Not building a hosted/SaaS version — both tiers are still downloadable,
  self-hosted apps.
- Not automating the PayPal → GitHub-collaborator step.

## Decisions

**Submodule, not fork or copy.** `pixi-pro` includes `pixi` as a git
submodule pinned to a released tag. Alternative considered: `pixi-pro` as a
full fork with Pro code merged in — rejected because it would require
manually reconciling merge conflicts against `pixi`'s `main` on every
Standard update, and risks silent drift where a core-engine bug gets fixed
in the fork but not upstream (or vice versa). The submodule approach keeps
exactly one copy of core-engine code; Pro modules must be additive files
that hook into `pixi`'s existing extension points (or, where a Pro feature
needs to change core behavior, that change is made in `pixi` itself behind
a "Pro modules present" check, not forked inside `pixi-pro`).

**Demo host: Cloudflare Pages, not GitHub Pages.** GitHub Pages requires
either a public source repo (GitHub Free) or a paid GitHub plan (Pro/Team/
Enterprise) to deploy from a private repo — see
[GitHub Pages private-repo requirements](https://docs.github.com/get-started/learning-about-github/githubs-products).
`pixi-pro` must stay private (that's the entire access-gate mechanism), so
GitHub Pages is unavailable on the free plan. Alternatives considered:
GitHub Pro ($4/mo) to unlock private-repo Pages — rejected as an ongoing
cost for something a free host already solves; a second public "demo-only"
repo mirroring built output — rejected as extra manual sync work per
release with no benefit over connecting a host directly to the private
repo. Cloudflare Pages connects directly to `pixi-pro` (private repo
access via GitHub App install), auto-deploys on push/tag, is free with no
bandwidth cap, and needs no build step, matching the no-bundler stance.
Netlify/Vercel are equivalent options if Cloudflare Pages turns out to be
unsuitable during implementation.

**Extraction before addition.** Layers, Color Library, pixel-perfect,
symmetry, Canvas Settings, brush/image import, Rectangle fill/outline, and
Pencil/Eraser opacity already exist in `pixi`'s shipped code (tier-gating
deferred per `openspec/changes/reference-image-layer/` and
`openspec/changes/merge-layers/`) — this is not a blank-slate addition to
`pixi-pro`. Each feature is removed from `pixi` per-feature: its JS
module(s), its `index.html` markup, its CSS, and any call sites in shared
files (`app.js`, `workspace.js`, `engine.js`, `persistence.js`) that
reference it, verified by confirming Standard's remaining tools have no
leftover dependency on the removed code path. The removed code is the
starting point for the equivalent `pixi-pro` module (copied over, then
adapted to hook into `pixi`'s extension points from outside), not
rewritten from scratch.

**No tier-gating flag in `pixi`'s code.** The split is structural (which
repo/build you have), not a runtime feature flag inside shared code. This
was already true of the pre-existing "tier-gating itself deferred" notes on
the reference-image-layer and merge-layers changes (openspec/roadmap.md) —
this change doesn't introduce a `state.tier` check; those Pro-only features
simply live in files that don't exist in the `pixi` repo at all.

## Risks / Trade-offs

- **Pro modules editing engine internals directly** → over time, easy for
  a Pro feature to reach into `pixi`'s internals in a way that only works
  if patched inside `pixi-pro`'s own tree, silently forking the engine.
  Mitigation: any Pro feature that needs new engine behavior gets that
  behavior added to `pixi` itself (gated on "Pro modules present," not
  duplicated) — a discipline to enforce in code review for `pixi-pro`,
  not something the submodule structure enforces automatically.
- **Manual submodule pin bumps get forgotten** → Pro drifts stale against
  Standard fixes. Mitigation: none automated in this change; flagged as a
  process risk to revisit if it causes real problems (e.g. a lightweight
  reminder/checklist step when tagging a `pixi` release).
- **Cloudflare Pages account is new infra outside GitHub** → one more
  service to manage credentials/access for. Mitigation: accepted, still
  net-simpler than a paid GitHub plan or a second synced repo.
- **Full live demo exposes Pro source** → already accepted explicitly by
  the user; not a risk being mitigated, a trade-off being taken
  deliberately at this price point.
- **Removing already-shipped features from `pixi` breaks any existing
  Standard install/fork relying on them today** → accepted; the roadmap
  already flagged these features' tier-gating as deferred/pending, so
  their removal from Standard was always the expected end state, not a
  new regression.

## Migration Plan

1. Create the private `pixi-pro` repo (empty).
2. Add `pixi` as a submodule pinned to `pixi`'s latest existing release tag
   (create one now if none exists yet).
3. Scaffold Pro module structure, then per feature: remove it from `pixi`
   (module, markup, CSS, call sites) and port the removed code into
   `pixi-pro` as an additive module, per the "Extraction before addition"
   decision above.
4. Connect Cloudflare Pages to `pixi-pro`, verify a live deploy builds and
   runs the full app end to end, then update `pixi`'s public README to
   link the new Pro demo URL alongside the existing Standard demo link.
5. Document the manual PayPal → collaborator-access runbook for the
   operator.

Rollback is not zero-cost here, unlike a purely additive change: reverting
would mean restoring the removed feature code in `pixi` (recoverable from
git history/the pre-removal tag). `pixi-pro` itself stays a fully separate
repo throughout, so a rollback never risks corrupting or blocking on
`pixi-pro`'s state.
