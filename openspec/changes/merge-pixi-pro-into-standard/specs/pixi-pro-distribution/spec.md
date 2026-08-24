## REMOVED Requirements

### Requirement: Two-repo tier structure
The system SHALL exist as two repos: `pixi` (this repo, public, free,
unchanged — the entire Standard tier) and `pixi-pro` (new, private, paid —
Pro-only modules). `pixi-pro` SHALL NOT be a fork or copy of `pixi`; it
SHALL include `pixi` as a git submodule.

#### Scenario: Standard user gets the full free app
- **WHEN** a user clones or downloads the public `pixi` repo
- **THEN** they get the complete Standard toolset (Pencil, Eraser, Bucket,
  Shape tools, Brush manual creation, basic color picker, zoom/pan, export,
  undo/redo, Gallery, local persistence) with no Pro modules present and no
  disabled/greyed-out Pro UI

#### Scenario: Pro repo does not duplicate Standard's source
- **WHEN** the `pixi-pro` repo is set up
- **THEN** it contains only Pro-only modules plus a git submodule reference
  to `pixi`, not a duplicated copy of `pixi`'s files

**Reason**: The operator reversed the Standard/Pro tier split — see
`openspec/changes/merge-pixi-pro-into-standard/proposal.md` - Why. All
features move back into the single public `pixi` repo, free for everyone.
**Migration**: None needed by users — the merged `pixi` repo is a superset
of what either repo offered before. Anyone with `pixi-pro` collaborator
access can switch to the public `pixi` repo once this change ships.

### Requirement: Submodule pinned to a released tag
`pixi-pro`'s `pixi` submodule SHALL be pinned to a released tag of `pixi`,
not tracking `pixi`'s `main` branch. The pin SHALL only advance when
deliberately bumped.

#### Scenario: Unreleased Standard work doesn't affect Pro
- **WHEN** new commits land on `pixi`'s `main` branch
- **THEN** `pixi-pro`'s submodule reference is unaffected until someone
  deliberately bumps the pin to a newer tag

#### Scenario: Pin must stay ahead of any hook a Pro module depends on
- **WHEN** a Pro module in `pixi-pro` calls an extension hook exported by
  `pixi` (e.g. `registerApplyPixelTransform`)
- **THEN** the pinned tag must be at or after the `pixi` release that
  introduced that hook, or the module fails at import time with a
  `SyntaxError` in the browser — there is no build step to catch this
  earlier, so a pin bump must be followed by a live smoke test (see the
  submodule-pin-bump process in this change's `runbook.md`)

**Reason**: There is no more separate `pixi-pro` repo or submodule once
Pro's modules are merged back into `pixi` directly — see
`openspec/changes/merge-pixi-pro-into-standard/proposal.md` - Why.
**Migration**: None — `pixi`'s own release tags continue as normal;
nothing external pins against them for this purpose anymore.

### Requirement: Pro-only feature set
The following capabilities SHALL exist only in `pixi-pro`, never in the
public `pixi` repo: Layers panel and everything tied to it (add/delete/
reorder, visibility, blend mode, layer opacity, background layer, reference
image layer, merge layers), the full Color Library panel (saved/named
palettes, add-to-palette, import from image, ramp generator), pixel-perfect
drawing toggle, symmetry/mirror drawing mode, Canvas Settings (rename/
resize/rotate), Brush import from image, Rectangle fill/outline toggle, and
Pencil/Eraser opacity slider.

#### Scenario: Pro-only tool absent from Standard
- **WHEN** a user only has the `pixi` repo (no `pixi-pro` access)
- **THEN** none of the Pro-only tools listed above are present in the app,
  not even in a disabled or upsell state

**Reason**: All of these features move back into the public `pixi` repo as
free, always-present tools — see
`openspec/changes/merge-pixi-pro-into-standard/proposal.md` - What
Changes. Their restored behavior is governed by the existing `layers`,
`color-library`, `symmetry-drawing`, `canvas-settings`, `shape-tools`, and
`brushes` capability specs, which were never modified to describe tier
gating in the first place.
**Migration**: None — no action needed. Every `pixi` user gains these
tools once this change ships.

### Requirement: Manual, non-automated access gating
Access to Pro SHALL be gated entirely by manual processes — no license-key
generation, no validation server, no Stripe/Supabase entitlements check.

#### Scenario: Buyer receives Pro access
- **WHEN** a buyer pays $5 via PayPal and emails their GitHub username
- **THEN** they are manually added as a GitHub collaborator on the private
  `pixi-pro` repo, or manually handed a release archive/zip, by the
  operator — with no automated step in between

**Reason**: The $5 paid-access model is replaced by a voluntary donation
ask (README-only "buy me a beer" + PayPal link, no gating of any kind) —
see `openspec/changes/merge-pixi-pro-into-standard/proposal.md` - Why.
**Migration**: None — nothing to gate anymore. The manual PayPal →
collaborator runbook this requirement described no longer applies.

### Requirement: Full, unrestricted public live demo
`pixi-pro` SHALL have a public, live, fully working demo build with no
feature crippling (export/save fully functional, no watermark, no time
limit). The demo SHALL NOT be deployed via GitHub Pages, since GitHub Pages
cannot deploy from a private source repo without a paid GitHub plan and
`pixi-pro` must remain private for the collaborator-access gate to be
meaningful. The demo build SHALL instead deploy to a third-party static
host (Cloudflare) connected directly to the private repo, auto-deploying
on push.

#### Scenario: Visitor tries Pro before buying
- **WHEN** a prospective buyer visits the public Pro demo URL
  (https://pixi-pro.asukiasov.workers.dev/)
- **THEN** they get the complete, unrestricted Pro app (all Standard +
  Pro tools, full export/save) — functionally identical to what a paying
  collaborator gets, hosted on Cloudflare rather than GitHub Pages

#### Scenario: Demo source is visible via browser devtools
- **WHEN** a visitor inspects the demo site's client-side JS
- **THEN** Pro's source is technically readable — this is accepted, not
  prevented; no DRM or obfuscation is attempted

#### Scenario: Pro demo is discoverable from the public repo
- **WHEN** the `pixi-pro` Cloudflare demo goes live
- **THEN** `pixi`'s public README links to it alongside the existing
  Standard demo link, clearly labeled (free Standard vs. paid Pro), so
  visitors to the free repo can find and try Pro

**Reason**: There is no more separate Pro demo — the single public `pixi`
GitHub Pages demo now includes every feature, and the Cloudflare deploy is
torn down. See
`openspec/changes/merge-pixi-pro-into-standard/proposal.md` - What
Changes.
**Migration**: None — `pixi`'s existing GitHub Pages demo link in README
becomes the only demo link; no visitor action needed.
