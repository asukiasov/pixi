# Pixi Standard/Pro tiers — design

> **Legacy — superseded, and the split it describes has been reversed.**
> This doc predates the OpenSpec process (see CLAUDE.md's "Process:
> OpenSpec vs. Superpowers skills") and was the input to
> `openspec/changes/archive/2026-08-21-split-pixi-pro-repo/`, which
> implemented the split this doc designed. That split's own spec,
> `openspec/specs/pixi-pro-distribution/`, was then retired by
> `openspec/changes/merge-pixi-pro-into-standard/` (2026-08-24), which
> reversed the split entirely — all Pro-only features moved back into this
> single public repo, free, with a voluntary donation ask replacing the
> paid tier. This file is kept only as historical design context for a
> tier model that no longer exists.

Design doc for splitting Pixi into two downloadable, self-hosted versions:
**Standard** (free, open-source) and **Pro** (paid, closed-source). Both are
the same app — a user downloads one or the other and runs it themselves;
this is not a hosted SaaS and not an embeddable widget for other sites (an
earlier pass at this doc used "embeddable," which was a misreading of the
original worksheet's wording — corrected 2026-08-18).

Input to this doc: `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md`
(the full feature-by-feature Standard/Pro breakdown).

## Goals

- One codebase for the shared engine — no duplicated drawing logic between
  two builds.
- Pro's source never reaches a browser that hasn't paid (no bundler exists
  in this project to obscure it, so the repo boundary *is* the protection).
- Minimal new infrastructure — no license-key server, no automated
  entitlements system. Pricing is low ($5) and volume is expected to be low;
  manual gating is the right amount of engineering for that.

## Non-goals

- Not building a hosted/SaaS version of Pixi.
- Not building a `<script>`-tag embeddable widget for third-party sites.
- Not building automated license validation (Stripe/Supabase entitlements) —
  this supersedes `openspec/roadmap.md` Phase 4's original sketch of that,
  for this tier split specifically. Phase 4 as originally scoped may still
  apply to a different, future monetization path (e.g. hosted-app
  purchases); revisit that phase's description when this ships.

## Repos

- **`pixi`** (this repo, unchanged) — stays public, becomes the Standard
  tier as-is. No new repo needed for Standard; the existing open-source app
  *is* the free product.
- **`pixi-pro`** (new, private) — Pro-only modules layered on top. Includes
  `pixi` as a **git submodule, pinned to a released tag** (not tracking
  `main`) so Pro development isn't destabilized by unreleased Standard
  changes, and the pin only moves when deliberately bumped.

Two repos total, not three — the tier count (2) doesn't need to match repo
count. The repo boundary follows public/private, not Standard/Pro
one-to-one; today those happen to coincide.

## What's Pro-only

Full list lives in the tier matrix worksheet; the moved-to-Pro categories
are: Layers (entire panel and everything tied to it), the full Color
Library (saved/named palettes, import, ramp generator), pixel-perfect
drawing, symmetry/mirror mode, Canvas Settings (resize/rotate), Brush/
palette import from image, Rectangle fill/outline toggle, Pencil opacity
slider. Standard keeps a full single-flat-image toolset (Pencil, Eraser,
Bucket, Shape tools, Brush manual creation, basic color picker) — Layers
and Color Library were judged too close to Standard's other tools to leave
a clear reason to pay if left in, hence moving them to Pro entirely rather
than partially.

## Distribution and access

No automated licensing. Flow:

1. Buyer pays $5 via PayPal.
2. You manually add them as a collaborator on the private `pixi-pro` GitHub
   repo (or hand them a release archive/zip).
3. They clone/download and run it themselves, same as Standard.

This is deliberately the simplest possible gate — access to the repo *is*
the license. No key generation, no validation server, no Supabase Edge
Function for this flow specifically.

## Demo

A live, interactive public demo of Pro is worth the trade-off: it means
Pro's source is technically visible via browser devtools to anyone who
looks, but at this price point the conversion value of "try before you buy"
outweighs the low-stakes risk of someone reading (or copying) the code. No
DRM/obfuscation is attempted — that wouldn't work in a bundler-less vanilla
JS app anyway. Demo build may cripple export/save to keep it demo-only
(not yet decided — flag for implementation planning).

## Open questions (deferred to implementation planning)

- Exact mechanics of building/deploying the public Pro demo (separate
  branch/deploy of `pixi-pro`? gated to export-disabled?).
- Whether `pixi-pro`'s submodule pin is bumped manually per-release or via
  some lighter process.
- Marketing/purchase-flow details (where the PayPal link lives, what the
  buyer sees after paying, turnaround time expectation for manual repo
  access).
