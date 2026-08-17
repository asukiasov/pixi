---
name: auditing-tool-improvements
description: Use when asked what can be improved in Pixi, to do a UI/UX polish pass, or to review every screen and tool for rough edges, inconsistencies, or missed affordances. Produces a task list grouped by screen/tool for the user to approve — does not propose or implement changes itself. Also for "review the UI", "audit the tools", "what's rough/unpolished", or continuing the roadmap's open-ended "UI polish pass" initiative.
---

# Auditing Tool Improvements

## Overview

Pixi has been built in phases; each shipped tool/screen was reviewed at
the time it landed but never re-examined once neighboring tools existed
to be inconsistent with. This skill is that re-examination: walk every
screen and every tool inside the Workspace, actually look at it running
(not just read the code), judge it against basic UX heuristics, and
produce a **task list for approval**. It never edits code, writes specs,
or calls `/opsx:propose` itself — the output is a menu the user picks
from; approved items become their own OpenSpec changes afterward, per
CLAUDE.md's process.

This is the mechanism behind roadmap.md's "UI polish pass" initiative
("work through it screen by screen, panel by panel, pulling in one
design/bug item at a time") — running this skill IS doing the next pass.

## When to Use

- "What can be improved?", "polish pass", "review the UI/tools", "audit
  for rough edges".
- Continuing the roadmap's open-ended UI polish initiative.

**Not for:** checking whether specced requirements got built at all —
that's missing scope, not quality. Use `auditing-scope-gaps` for that.
Not for reviewing one specific in-flight change's diff — use
`code-review`.

## Procedure

1. **Enumerate the full surface first.** Build a checklist before
   looking at anything:
   - Screens, from `openspec/roadmap.md`'s "Screens:" bullets across all
     phases (New canvas, Workspace, Gallery, Canvas settings, Export,
     Sign in once Phase 3 lands, …).
   - Every tool/panel inside Workspace, from `ls openspec/specs/` (one
     capability per tool family: `brushes`, `shape-tools`, `layers`,
     `color-library`, `canvas-navigation`, `pixel-drawing-engine`, …)
     plus anything in `index.html`'s toolbar not yet covered by a spec
     (surface that itself, don't silently skip it).
   - Read roadmap.md's "Still open" list once and hold it alongside —
     those are known issues to fold into the output, not rediscover.

2. **See it running, not just read it.** Code-only review misses
   hover/active/disabled states, popover positioning, empty states, and
   anything that only looks wrong rendered. Serve the app locally (per
   project convention, do this proactively — see the
   `pixi-auto-serve-for-testing` memory) and drive it with the `run`
   skill or `example-skills:webapp-testing` (Playwright) to screenshot
   each screen and each tool in its meaningful states: default, active/
   selected, a relevant popover open, an edge case (empty Gallery, a
   16px canvas, a 128px canvas, transparent background). Read the
   implementing code (`js/*.js` + `index.html` markup + the spec) beside
   the screenshot to understand intended behavior before judging it.

3. **Evaluate each screen/tool against these heuristics** (not every
   heuristic applies to every tool — skip ones that plainly don't):

   | Heuristic | Ask |
   |---|---|
   | Consistency | Does it look/behave like sibling tools (icon style, popover pattern, hover feedback)? |
   | Discoverability | Would a first-time user find this without being told? Tooltip present and accurate? |
   | Feedback | Does the UI visibly respond to the action (state change, animation, readout)? |
   | Error prevention / edge cases | What happens at extremes (smallest/largest canvas, empty list, max zoom)? |
   | Affordance | Does it look interactive/non-interactive correctly (disabled vs. active states)? |
   | Accessibility | Keyboard-reachable? `aria-label`/`data-tooltip` present? Contrast adequate? |
   | Known open items | Does roadmap.md's "Still open" list already name something here? |

   Also run the `web-design-guidelines` skill against the screen/tool's
   markup and CSS (`index.html`, `css/*`) — it checks the same surface
   against the Web Interface Guidelines and catches interaction/
   accessibility rules the heuristics table above doesn't spell out.
   Fold its findings into this pass instead of reporting them separately.

4. **Record findings as you go**, not from memory at the end — one
   finding per issue, tagged with screen/tool and heuristic.

5. **Compile the task list**, grouped by screen then tool, each item:
   - **Title** (short, actionable: "Right-sidebar hide/show should
     animate", not "sidebar issue")
   - **Where**: screen + tool/control (id/selector if known)
   - **What's off**: one or two sentences, heuristic it fails
   - **Suggested direction**: not a full design — enough to scope it
   - **Priority guess**: low/med/high (visibility × frequency of use)
   - Mark items already listed in roadmap's "Still open" as such, don't
     silently re-list them as new discoveries

6. **Present the list and stop.** Ask which items to approve. Do not
   create OpenSpec changes, edit code, or update roadmap.md until the
   user picks items — then each approved item becomes its own
   `/opsx:propose` (batch only if the user explicitly asks to group
   them).

## Common Mistakes

- **Judging from code alone.** Popover clipping, animation jank, and
  layout shift are invisible in source — always render and screenshot.
- **Skipping a tool because "it looks done."** Every tool in the
  checklist from step 1 gets looked at; "no issues found" is a valid
  outcome to note, not a reason to skip.
- **Silently duplicating roadmap's "Still open" items** as if newly
  discovered — cross-check and label them as already-known instead.
- **Jumping straight to implementing a fix.** This skill's job ends at
  the approved task list; fixes go through OpenSpec once picked.
- **Vague findings** ("toolbar feels off") with no heuristic or
  suggested direction — not actionable enough for the user to approve.
