## Context

The repo is public on GitHub (`asukiasov/pixi`) with a live GitHub Pages
deploy, but has never had the standard OSS governance documents. README's
existing "Contributing / process" section already briefly describes the
OpenSpec + Superpowers process (see `CLAUDE.md` for the full version) -
this change gives that its own home in `CONTRIBUTING.md` rather than
growing README indefinitely.

## Goals / Non-Goals

**Goals:**
- A developer landing on the repo can find license terms, how to
  contribute, expected conduct, and structured issue/PR templates -
  the standard signals of a maintained open-source project.
- No duplication between README and CONTRIBUTING - each has one home for
  its content, cross-linked.

**Non-Goals:**
- No CI/GitHub Actions changes - issue/PR templates are plain Markdown
  forms, not automation.
- No governance process changes (this is a solo-maintained project;
  CONTRIBUTING documents the existing OpenSpec/Superpowers process, it
  doesn't invent a maintainer team or review-committee structure that
  doesn't exist).

## Decisions

- **MIT over Apache-2.0/GPL-3.0**: per the user's choice - maximizes
  reuse, matches "plug and play for developers" positioning (no
  copyleft obligation on forks, no patent-grant complexity a solo
  project doesn't need).
- **CONTRIBUTING.md absorbs, doesn't duplicate, README's process
  section**: README keeps a one-line pointer ("see CONTRIBUTING.md");
  CONTRIBUTING.md is the actual source for propose→implement→archive
  workflow, referencing `CLAUDE.md` for the full detail rather than
  re-explaining OpenSpec/Superpowers from scratch a third time (README
  → CONTRIBUTING → CLAUDE.md would be three copies of the same
  explanation otherwise).
- **Two issue templates (bug report, feature request), not a generic
  single template**: matches GitHub's own convention and keeps each
  form's fields relevant (repro steps vs. use-case description) rather
  than one template with irrelevant optional fields either way.
- **Standard Contributor Covenant text for CODE_OF_CONDUCT.md**,
  unmodified - no project-specific customization needed at this stage;
  a widely-recognized document reduces "did they actually mean what
  they wrote" friction for a first-time contributor.

## Risks / Trade-offs

- [CONTRIBUTING.md describes a process (OpenSpec proposals) that's
  fairly heavyweight for a small external contribution, e.g. a one-line
  typo fix] → CLAUDE.md already carves this out ("Bug fixes with no
  spec/requirement impact can skip OpenSpec"); CONTRIBUTING.md repeats
  that carve-out explicitly so external contributors see it too, not
  just future Claude Code sessions reading CLAUDE.md.
