# Repo voice — how Pixi's public docs talk

The language standard for anything a developer reads on Pixi's public
GitHub repo: README, CONTRIBUTING, docs/, issue/PR templates, commit-facing
prose. Grounded in patterns from five OSS repos analyzed in
[`repo-docs-research.md`](repo-docs-research.md); apply this with
[`writing-repo-docs`](../.claude/skills/writing-repo-docs/SKILL.md).

If a specific doc needs to deviate (e.g. a legal notice needs stiffer
language), that's fine — this is the default, not a straitjacket.

## Who's talking, and to whom

Pixi is a solo-built tool, not a funded startup with a growth team. The
existing README and CLAUDE.md already default to this correctly — this
doc makes it explicit so it stays that way as more docs get written.
Reader: a developer evaluating or using the tool, or a future contributor
— not a prospective customer being sold to.

**Default to third person / factual statements** ("Pixi does X"), not
second-person benefit copy ("You'll love how X streamlines..."). Compare:

| Don't (marketing register) | Do (Pixi's register) |
|---|---|
| "Unlock powerful pixel art creation with zero setup — get building in seconds!" | "A browser-based pixel art tool. No build step — open `index.html` or serve the directory." |
| "We're committed to fostering an open, welcoming, and safe environment ❤️" | "Issues and PRs are welcome. See CONTRIBUTING for setup." (only once there *is* a contributor process) |
| "Taipy: Go beyond existing libraries" | State what it does, not a comparison to unnamed competitors |

## Three rules

1. **State constraints as facts, not apologies.** Pixi's non-goals (no
   animation timeline, no native app, no backend server, no build step)
   are deliberate scope, not gaps to caveat. Say "no build step" the same
   flat way you'd say "written in JavaScript" — not "unfortunately, there's
   currently no build step yet."
2. **Precision over enthusiasm.** No exclamation points, no "powerful,"
   "seamless," "blazing fast," "battle-tested." If a claim needs an
   intensifier to land, the claim is too vague — replace the adjective
   with a number, a command, or a screenshot.
3. **Link instead of restate.** Never re-explain in a doc what another doc
   already covers — point to it. (Already the pattern in this repo's
   README and CLAUDE.md; keep applying it as the doc set grows.)

## Terminology

Use the exact names the UI and specs use — see
[`ui-reference.md`](ui-reference.md) for the full catalog. Docs that
invent softer synonyms ("the drawing area", "your artwork") create a
second vocabulary a reader has to reconcile with what they actually see
on screen.

| Say | Not |
|---|---|
| Canvas | "drawing area," "artboard" |
| Workspace | "editor," "the main screen" |
| Gallery | "your projects," "dashboard" |
| Layers | "levels" |
| Export | "download," "save as image" |
| OpenSpec change | "feature ticket," "proposal doc" (unless quoting OpenSpec's own docs) |

## What we won't do

Modeled on the values-statement pattern in `repo-docs-research.md`
(uBlock's `MANIFESTO.md`) — a short, standalone claim, not folded into the
README's feature list:

- **No dark patterns to retain data or force an account.** The app is
  fully usable signed out, permanently — Supabase auth/sync is additive,
  never a gate.
- **No metrics or telemetry beyond what's declared.** The version badge in
  the Gallery is a cache sanity check, not analytics — see the README's
  Deployment section. Anything that phones home gets called out
  explicitly, in the doc that introduces it, not buried in a privacy page.
- **No feature claimed before it ships.** `openspec/roadmap.md` is the
  only place "planned" work is described as planned — READMEs and doc
  pages describe what exists now, not what's coming, so a reader can't be
  misled by aspirational copy going stale.

This section is a candidate for its own short file (a Pixi equivalent of
uBlock's `MANIFESTO.md`) once there's a stable public-facing spot to link
it from — see the doc list in `repo-docs-research.md`'s companion
checklist.

## Quick self-check before publishing a doc

- Would this sentence survive being read literally by someone deciding
  whether to trust the project? (Cut anything that only survives as tone.)
- Does every claim point to where it's true (a command, a file, a spec)
  rather than asserting itself?
- Read it back replacing every adjective with "[good]" — if the sentence
  still makes sense, the adjective was doing no work. Cut it.
