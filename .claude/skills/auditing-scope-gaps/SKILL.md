---
name: auditing-scope-gaps
description: Use when checking Pixi for gaps between documented scope (openspec/specs, openspec/roadmap.md) and what actually exists in code — undocumented tools/functions, specced requirements never implemented, roadmap "still open"/"not yet scheduled" items that stalled, or dead specs for removed features. Also use when asked to "audit the codebase", "find what's missing", or "check for scope drift".
---

# Auditing Scope Gaps

## Overview

Pixi's requirements live in `openspec/specs/` (source of truth for what
should exist) and `openspec/roadmap.md` (phase plan, status notes, "Still
open"/"Not yet scheduled" lists). Code lives in `index.html`, `js/*.js`,
`style.css`. These three drift apart over time: a spec describes a
requirement the code never finished, code grows a button or function no
spec ever wrote down, or a roadmap "still open" item sits unaddressed
across several phases. This skill is the systematic diff between them —
it does not fix anything, it produces a findings report.

**Core principle:** every claim of a gap must cite where it looked
(spec file + line-equivalent, or roadmap section) and what it found (or
didn't find) in code. "I didn't see X" is not a finding unless you
searched for X's actual selectors/handlers, not just skimmed.

## When to Use

- Before starting a new roadmap phase, to confirm the prior phase's specs
  actually match shipped code.
- User asks to "find gaps", "audit scope", "what's missing", "what's
  undocumented".
- Periodic health check independent of any single change.

**Not for:** reviewing one specific change's diff (use `code-review` or
`superpowers:requesting-code-review` instead) — this skill is a
project-wide sweep, not a single-PR review.

## The Four Gap Types

| Type | Meaning | Where to look |
|---|---|---|
| **Unimplemented spec** | A spec requirement with no matching code | `openspec/specs/*/spec.md` → grep code for the feature's selectors/handlers |
| **Undocumented code** | A tool, button, keyboard shortcut, or exported function with no spec covering it | `index.html` controls + `js/*.js` exports → grep specs for a matching requirement |
| **Stalled roadmap item** | Something roadmap.md lists as planned/"still open"/"not yet scheduled" with no change ever proposed for it | `openspec/roadmap.md` → `ls openspec/changes/` (active + archive) for a matching change |
| **Dead spec** | A spec describing a feature no longer present in code (removed, renamed, superseded) | `openspec/specs/*/spec.md` → confirm the described UI/function is actually gone, not just moved/renamed |

## Procedure

1. **Read `openspec/roadmap.md` in full.** Note current phase, each
   phase's status line, and everything under "Still open" / "Not yet
   scheduled". These are your candidate stalled-roadmap-item findings —
   don't stop at the first one.

2. **List spec capabilities**: `ls openspec/specs/`. Read each
   `spec.md`'s requirements (not just the title — the actual "the system
   MUST/SHALL" bullets). For each requirement, find its implementation:
   grep `index.html` for the control (button id, panel), and `js/*.js`
   for the handler/function. If you can't find it after a real grep
   (not a guess), it's an unimplemented-spec finding — quote the
   requirement text.

3. **List active changes**: `ls openspec/changes/` (excluding `archive/`).
   Cross-check each against roadmap — is it accounted for, or is the
   roadmap stale about it?

4. **Sweep code for undocumented surface area**: grep `index.html` for
   interactive elements (`<button`, `id=`, tool icons) and `js/*.js` for
   top-level exported functions / event listeners. For each one that
   looks like a user-facing tool or capability, check it's named in some
   spec's requirements. Internal helpers (not user-facing) don't need
   spec coverage — only flag things a user could discover and use.

5. **Check for dead specs**: for each spec capability, confirm its
   described control/behavior is still reachable in the current
   `index.html`/`js/` (not just that a similarly-named identifier
   exists — read enough of the handler to confirm it does what the spec
   says).

6. **Write the findings report** (see Output below). Do not silently
   fix anything found — gaps become OpenSpec proposals
   (`/opsx:propose` or `superpowers:brainstorming` first if the fix
   needs design work) per this project's process in CLAUDE.md, not ad
   hoc edits.

## Output

Group findings by the four types above. For each finding, give:
- **What**: one line naming the requirement/tool/roadmap item
- **Where**: file(s)/section checked on both sides (spec path or
  roadmap section; code file/selector or "not found")
- **Suggested next step**: propose a change, update the spec to match
  code, update the roadmap, or (for dead specs) archive/remove the spec

Skip a category entirely in the output if the sweep found nothing —
don't pad the report with "no findings" filler for every type.

## Common Mistakes

- **Skimming spec titles instead of requirement bullets.** A spec's
  filename matching a feature doesn't mean every sub-requirement is
  built — check each MUST/SHALL line.
- **Treating "not yet scheduled" items as automatic findings without
  checking roadmap intent.** Some are deliberately deferred (roadmap
  says so explicitly, e.g. animation timeline is a stated non-goal) —
  those aren't gaps, they're documented decisions. Only flag items
  roadmap treats as live/open, not ones explicitly parked.
- **Flagging internal helper functions as "undocumented tools."** Only
  user-reachable capabilities need spec coverage.
- **Guessing code doesn't exist without grepping.** Search `js/*.js`
  and `index.html` for the actual identifier before calling something
  unimplemented — Pixi's feature set is spread across ~19 files under
  `js/`, not just `app.js`.
