# Repo docs audit — 2026-08-19

Content/voice + SEO/GEO pass over `README.md` (the doc GitHub renders on the
repo's public landing page), triggered by user feedback that it reads as
"dull, not interesting, not informative," and specifically asking for a
"Pro version" mention, the word "demo," and a feature matrix. Checked
against `docs/repo-voice.md`, `writing-repo-docs`, `openspec/roadmap.md`,
and `docs/repo-docs-plan.md`.

**No live network access this pass** — the GitHub About blurb/topics/
Social Preview checks fall back to the state already recorded in
`docs/repo-docs-plan.md` (last live-confirmed 2026-08-18) rather than a
fresh fetch; both are marked `needs-recheck` below per the skill's
fallback instructions.

**Severity**: High / Med / Low, by reader impact.
**State**: `open` (real, unaddressed) · `not-an-issue` (checked, already
satisfied or correctly absent) · `needs-recheck` (no live fetch this pass,
confirm before acting) · `tension` (user preference conflicts with an
existing project rule — needs a decision, not a fix).

| ID | Title | Category | Severity | State |
|---|---|---|---|---|
| RDOC-1 | "Pro version" is correctly absent — it doesn't exist yet | Content | — | not-an-issue |
| RDOC-2 | "demo" is already in the README | Content | — | not-an-issue |
| RDOC-3 | No feature/capability table — README is prose-only | Content/SEO/GEO | Med | done |
| RDOC-4 | Flat, factual register reads as "dull" to the user | Content | — | kept (user decision) |
| RDOC-5 | GitHub About blurb missing "demo"/"preview" | SEO | Low | done (user, via repo Settings) |
| RDOC-6 | Social Preview image unset (GitHub fallback card shown) | SEO | Med | open — needs repo Settings, not a file edit |
| RDOC-7 | `repo-docs-plan.md` versioning row is stale | staleness | — | done |

## Notes per finding

- **RDOC-1** — **not-an-issue.** `openspec/roadmap.md`'s "Not yet
  scheduled" section lists "Standard/Pro tier split" as **raised
  2026-08-18, not yet proposed via `/opsx:propose`, no phase assigned** —
  it's a design doc (`docs/superpowers/specs/2026-08-18-pixi-tiers-design.md`),
  not a shipped or even in-progress feature. `repo-voice.md`'s third rule
  is explicit: *"No feature claimed before it ships... READMEs and doc
  pages describe what exists now, not what's coming, so a reader can't be
  misled by aspirational copy going stale."* Adding "Pro version" copy to
  the public README today would violate that rule directly — there is no
  Pro repo, no pricing, no gate, nothing a reader could act on. This isn't
  a gap to fix; it's the doc correctly reflecting current state. Once the
  tier split is proposed and at least scaffolded, revisit — see RDOC-3 for
  how it could show up later without overclaiming (e.g. a matrix row
  marked "planned").

- **RDOC-2** — **not-an-issue.** `README.md:9` already reads: `**Live
  demo:** https://asukiasov.github.io/pixi/ — no install, try it now.`
  The word "demo" is present, bolded, and links to a working live
  instance — this is the single strongest GEO/SEO asset the README has
  (a self-contained, verifiable claim an answer-engine can quote
  directly). Worth surfacing since it directly contradicts the stated
  feedback — nothing to change here.

- **RDOC-3** — **open, Med.** The README describes Layers, local
  persistence, "a full drawing toolset," and export in a single run-on
  sentence (`README.md:3-5`) with no way to scan capabilities at a
  glance. This is the credible half of "not informative": a stranger
  can't tell in 3 seconds what tools exist (brushes? shapes? symmetry?
  color library?) without reading prose or clicking through to
  `openspec/roadmap.md`. A compact table of **currently shipped**
  capabilities (cross-referencing `openspec/specs/` — canvas-creation,
  pixel-drawing-engine, layers, local-persistence, gallery, brushes,
  shape-tools, color-library, canvas-navigation, canvas-settings, export,
  url-routing, symmetry-drawing) would satisfy both:
  - **SEO**: scannable, keyword-bearing rows beat one dense paragraph.
  - **GEO**: each row is a standalone answerable fact ("Layers: add,
    reorder, opacity, delete" needs no surrounding sentence to parse),
    exactly the structured-list requirement in the GEO pass.
  This does **not** conflict with `repo-voice.md`'s "link instead of
  restate" rule as long as the table stays a *summary* (tool names +
  one clause each) and keeps pointing to `openspec/roadmap.md`/`specs/`
  for detail, the way the current prose paragraph already does — it's a
  format change to existing scope claims, not new content. Recommend
  routing this through `writing-repo-docs` as a structural edit, not an
  ad hoc table drop-in, since it changes the README's shape.

  **Done 2026-08-19** via `writing-repo-docs`: a 13-row "## Features"
  table added to `README.md` between the opening paragraph and `##
  Stack`, one row per `openspec/specs/` area, each linking to its spec.
  Scoped explicitly to "shipped and usable today (Phase 2, complete)" —
  no Pro/planned rows, keeping RDOC-1's constraint intact. Re-checked
  against SEO/GEO: rows are self-contained facts (no dangling pronouns),
  "pixel art" repetition is reinforced without stuffing, voice stays
  third-person/factual.

- **RDOC-4** — **kept, per user decision 2026-08-19.** The user's "dull"
  reaction was reading exactly what `docs/repo-voice.md` was written to
  produce: third-person, no intensifiers, no exclamation points,
  constraints stated as facts. That's a deliberate, documented decision
  (`repo-voice.md` rules 1–2), not drift. Presented as a choice rather
  than picked unilaterally; the user chose to keep the current register.
  No further action — not revisiting unless asked again.

- **RDOC-5** — **done, via repo Settings (user, 2026-08-19).** The
  GitHub About blurb now includes "demo" per the suggested wording
  drafted in `docs/repo-docs-plan.md`. Not re-verified live this pass
  (no network access in this environment) — taking the user's report at
  face value; `repo-docs-plan.md`'s row should be updated to ✅ next time
  that file is touched with live access.

- **RDOC-6** — **open — this is a repo Settings change, not a file
  edit, so it can't be done from `README.md`.** GitHub's Social Preview
  (the Open Graph image shown when the repo URL is shared on Slack,
  Twitter/X, Discord, etc.) is a distinct setting from any image embedded
  in the README's markdown — the screenshot already in `README.md` only
  renders on the GitHub repo page itself, not in link-unfurl cards
  elsewhere. Manual step: Settings → General → Social preview → upload
  `docs/screen.png` (1500×1229 against GitHub's recommended 1280×640;
  GitHub will center-crop it, which is acceptable per the original plan-
  doc note). Arguably the single highest-leverage remaining item for
  "not interesting" as a first impression, since it's what a stranger
  sees before they even click through to the README's text.

- **RDOC-7** — **open, staleness note (per skill's plan-doc check).**
  `docs/repo-docs-plan.md`'s "Now" table marks versioning as `⚠️ tagged
  locally, not pushed`. A live check this pass (`git ls-remote --tags
  origin`) shows `v0.2.0` **is** present on the remote — the tag was
  pushed since that row was last updated. The status column should read
  pushed/done. Low-impact by itself, but a stale ✅/❌ here is exactly
  what this skill's inventory step warns misdirects the next audit —
  worth a one-line correction next time `repo-docs-plan.md` is touched.
  **Done 2026-08-19** — row updated to `✅ v0.2.0 pushed`.

## Summary for the user

Two of your four specific complaints don't hold up against the current
file: "demo" is already there (RDOC-2), and a Pro-version mention would
be false as of today — the tier split isn't even proposed yet, and
`repo-voice.md`'s own rule against claiming unshipped features exists
specifically to prevent this (RDOC-1). The feature-matrix ask is real and
worth doing (RDOC-3). "Dull" is the one that isn't a bug to fix so much
as a call to make: the current voice is a deliberate project decision,
not an oversight (RDOC-4) — say if you want that decision revisited.
The two items most likely to actually fix "not interesting" as a first
impression are the ones with nothing to do with README prose at all: the
GitHub About blurb and, especially, the missing Social Preview image
(RDOC-5, RDOC-6).
