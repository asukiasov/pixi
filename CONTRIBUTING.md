# Contributing

Pixi is solo-maintained. Bug reports and pull requests against Standard
(this repo) are welcome; the process below is how they get in without
surprising anyone, maintainer included.

## Proposing a change

A new feature or behavior change starts as a design doc, not as a PR
straight to code. See [`CLAUDE.md`](CLAUDE.md) for the full process — the
short version:

- Every feature/behavior change gets a design doc in
  `docs/superpowers/specs/` and an implementation plan in
  `docs/superpowers/plans/` before implementation starts, and updates the
  affected `docs/specs/*/spec.md` in the same PR.
- A **bug fix with no spec/requirement impact** can skip this and go
  straight to a PR — no proposal needed for fixing something that's
  supposed to work one way and doesn't.
- `docs/specs/` is the source of truth for what's already shipped;
  `docs/roadmap.md` is the phase-by-phase build order. Check both
  before proposing something that might already be planned, or already
  rejected, elsewhere.

If you're not sure whether your change needs a design doc, open an issue
first and ask — cheaper than writing one for something that turns out to
be five lines.

## Local dev setup

No build step, no install beyond test dependencies. See the README's
[Quick Start](README.md#quick-start) for running the app locally, and
[Testing](README.md#testing) for `npm test`.

## Before opening a PR

- `npm test` passes. This is the actual gate — a PR with failing tests
  won't be merged regardless of what it fixes.
- If the change touches `index.html`, `style.css`, or a tool's DOM/
  interaction code, it should hold up against the [Web Interface
  Guidelines](https://github.com/vercel-labs/web-interface-guidelines) the
  same way the rest of the UI does — not a formal requirement for outside
  contributors, but worth a look before submitting.
- Link the design doc and plan your PR implements (if any) in the PR
  description, so a reviewer can check the diff against them rather than
  reverse-engineering intent from the code.

## Reporting bugs / requesting features

Open a GitHub issue using the provided templates. A bug report that
includes exact steps to reproduce and what you expected instead gets
looked at faster than "X is broken."

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
