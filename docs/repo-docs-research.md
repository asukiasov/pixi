# Public repo docs — research notes

Comparative analysis of five public GitHub repos, done to ground
`.claude/skills/writing-repo-docs/` in real practice rather than generic
advice. Source repos and what each represents:

| Repo | Genre | Why it's in the sample |
|---|---|---|
| [appsmithorg/appsmith](https://github.com/appsmithorg/appsmith) | Funded low-code platform | Large-team OSS, heavy marketing/growth surface |
| [Avaiga/taipy](https://github.com/Avaiga/taipy) | Funded data/AI framework | Structured contributor process at scale |
| [emmetio/emmet](https://github.com/emmetio/emmet) | Small dev-tool library | README-as-reference-docs, no contributor apparatus |
| [usestrix/strix](https://github.com/usestrix/strix) | VC-stage AI security tool | Modern conventions: agent-facing docs, CI snippets |
| [gorhill/uBlock](https://github.com/gorhill/uBlock) | Long-running solo/small-team OSS | Opinionated voice, router-only contributor docs |

This file is reference material, not a spec — it explains *why* the skill
and [`repo-voice.md`](repo-voice.md) say what they say. If it goes stale
relative to those two files, they win.

## What all five do, regardless of size or genre

- **README always opens with identity, not features**: name, one-line
  pitch, and (for anything visual) an image — before any bullet list.
- **Quick start is a copy-pasteable block**, not prose describing steps.
  Every repo puts working shell/pip/npm commands in the first screenful.
- **CONTRIBUTING.md is a router, not an encyclopedia** — appsmith, strix,
  and uBlock all keep it short and link out to a fuller guide elsewhere
  (a `contributions/` dir, a docs site, or another repo). Taipy is the
  exception, and only because it has no separate contributor docs site to
  link to instead.
- **The doc set scales with contributor apparatus, not with project size.**
  Emmet (small, no outside-contributor process) ships only README + LICENSE.
  uBlock (old, high-traffic, but a closed/opinionated contribution model)
  ships CONTRIBUTING as a pure link-router and skips CODE_OF_CONDUCT and
  SECURITY entirely. CODE_OF_CONDUCT/SECURITY.md only showed up on the two
  funded, larger-team repos (appsmith, taipy) actively managing outside
  contributors. **Lesson: match the doc set to whether the repo actually
  has outside contributors yet, not to how public or popular it is.**
- **A README never re-explains what a linked doc already covers.** All
  five point outward (docs site, wiki, a deeper guide) rather than
  duplicating detail inline.

## Where they genuinely differ — and why

| Axis | Marketing-heavy (appsmith, taipy, strix) | Utilitarian (emmet, uBlock) |
|---|---|---|
| README opening | Logo + badge wall + video/GIF | Plain heading, straight to what it does |
| Tone | Second person, benefit-led ("streamlines...", "no more compromises") | Third person, factual, sometimes flatly opinionated |
| Community CTAs | Discord/star/"we ❤️ contributors" throughout | Minimal to none |
| Contributor list | Full avatar wall in README (appsmith) | Not shown |

The split tracks funding and growth incentives, not doc quality — a
solo/small project copying the marketing-heavy style reads as
overcompensating. **Pixi should read like the utilitarian column.**

## README text as its own SEO surface

Separate from repo metadata (About/topics) and from writing *quality*: the
literal visible text in a README's first screenful is what Google indexes
and quotes back in search results — for most small/mid projects the GitHub
repo page is the top search result for the project's name. strix's H1 is
followed immediately by "The open-source AI pentesting tool. Autonomous AI
hackers that find and fix your app's vulnerabilities." — the exact phrase
a searcher would type, stated plainly, before any badge or feature list.
That's not accidental copywriting, it's the highest-weight line on the
page doing search-snippet work. See the skill's "README on-page SEO"
section for the concrete rules this implies.

## Specific patterns worth adopting

1. **A values/position statement, kept separate from the README.**
   uBlock's `MANIFESTO.md` is seven lines stating the project's
   non-negotiable stance ("the user decides") and explicitly rejecting a
   competing philosophy. It's not a feature list — it's *why* the project
   exists, isolated so it doesn't clutter the README's job of orientation.
   → This is the shape of [`repo-voice.md`](repo-voice.md)'s "what we
   won't do" section.

2. **Agent-facing docs are now a normal doc type, not a novelty.**
   strix ships `AGENTS.md` — a short file distinct from CONTRIBUTING.md,
   written for AI coding agents that want to *use or contribute to* the
   project, with exact commands and no prose padding. Pixi already has
   `CLAUDE.md`, which mixes "how to use the repo" with "what tool this is
   for." An `AGENTS.md` (the emerging cross-tool convention — Claude,
   Cursor, and Codex all look for it) pointing at the parts of CLAUDE.md
   that matter for one-shot agent tasks is worth doing once Pixi has
   outside contributors likely to use coding agents against it.

3. **Transparency doc for removed/deprecated things.** uBlock's
   `REMOVED.md` tracks what was taken out and why — separate from a
   forward-looking `CHANGELOG.md`. For a phased roadmap project like Pixi,
   this maps to noting scope that was proposed and then deliberately
   dropped (OpenSpec already half-covers this via archived changes, but
   nothing summarizes it for a reader who won't dig through
   `openspec/changes/archive/`).

4. **SECURITY.md's minimum viable shape**, from appsmith and taipy: one
   sentence on how to report (GitHub private vulnerability reporting),
   optionally a supported-versions table if there are multiple
   maintained versions. Both keep it under 15 lines — this is not a place
   for prose.

5. **Badges as trust signals, used sparingly for a solo project.** License
   and build/deploy-status badges carry real information at a glance;
   Discord-member-count and YouTube-subscriber badges (appsmith) are pure
   marketing and would look hollow on a solo repo with no community
   channels yet. Pick badges that are true, not badges that look active.

## Explicitly not adopted for Pixi

- Contributor avatar walls, UTM-tagged marketing links, "Enterprise"
  upsell sections, trend-tracking badges (Trendshift, star-count badges) —
  all genre-appropriate for funded startups, wrong register for a solo
  static-site tool.
- Taipy's 14-day-inactivity bot process and formal issue-assignment
  workflow — overhead that assumes a maintainer team triaging a backlog;
  premature before Pixi has outside contributors at all.
