---
name: proposing-feature-improvements
description: Use when asked what functionality Pixi is missing, to suggest deeper feature ideas beyond surface polish, or to go past docs/ui-reference.md's current catalog and propose new capabilities/tools/workflows. Also for "what should Pixi do that it doesn't", "suggest new features", "what's missing functionality-wise", or seeding the next OpenSpec proposal with fresh ideas rather than fixing what already exists.
---

# Proposing Feature Improvements

## Overview

`docs/ui-reference.md` is a complete map of every screen and control Pixi
*currently* has. This skill reads that map, then asks a different question
than the other audit skills do: not "is what exists polished?" (that's
`auditing-tool-improvements`) and not "does code match spec?" (that's
`auditing-scope-gaps`), but **"what capability is Pixi missing entirely that
would meaningfully expand what a user can draw or do?"** The output is a
seed document — candidate feature ideas, not vetted designs — meant as the
starting point for a `superpowers:brainstorming` session and eventual
`/opsx:propose`, not a finished plan.

**The bar for an idea here is depth, not surface area.** "Add a clear-all
button to the Gallery" is a UI nit — send it to `auditing-tool-improvements`
instead. "Add a symmetry/mirror drawing mode" or "tile-seamless preview" is a
new capability — that's what belongs in this document.

## When to Use

- "What functionality are we missing?", "what deeper features could we
  add?", "what should Pixi do that it doesn't yet?"
- Wanting fresh feature ideas to seed the next OpenSpec proposal, as
  opposed to fixing/polishing what's already built.

**Not for:** UI/UX polish of existing controls (consistency, discoverability,
affordance) — use `auditing-tool-improvements`. Not for checking whether
already-specced requirements got built — use `auditing-scope-gaps`. Not for
implementing anything — this skill only writes a document and stops.

## Procedure

1. **Read `docs/ui-reference.md` in full.** Build a mental inventory of
   every functional area (not every individual button) it documents:
   drawing tools, shape tools, brushes, layers, color library, canvas
   navigation, export, canvas settings, gallery.

2. **Read `openspec/roadmap.md`'s non-goals and "Still open" list, and skim
   `openspec/specs/` capability names.** These bound the search:
   - Anything already an explicit non-goal (e.g. animation/onion-skinning,
     native mobile builds, a custom backend) is out — don't re-suggest it.
   - Anything already named in roadmap's "Still open" or a future phase is
     not a new discovery — if you want to include it, label it as already
     known rather than presenting it as fresh.

3. **For each functional area, ask what's structurally missing** — a
   capability class absent, not a control tweak. Ground ideas in what
   working pixel-art tools of this style typically offer (Aseprite,
   Piskel, Pixaki), filtered through Pixi's actual scope (static site, no
   build step, fixed canvas sizes, no animation timeline). Useful prompts
   per area:
   - Drawing/shapes: symmetry or mirror drawing, tiling/seamless preview,
     reference-image overlay/tracing layer, dithering brush patterns.
   - Color: palette-aware color ramps, contrast-check between FG/BG,
     palette sharing/export formats beyond the current import.
   - Layers: layer groups/folders, clipping masks, per-layer lock (not
     just Background).
   - Canvas/export: batch export of multiple saved projects, spritesheet
     packing, canvas templates/presets beyond the four fixed sizes.
   - Gallery/workspace: search/filter/tag projects, duplicate-project,
     project-level undo history beyond the session.
   Treat this list as a prompt, not a checklist to fill — skip categories
   with nothing genuinely deeper to add, and include ideas outside it if
   they surface.

4. **For each idea, write:**
   - **Title** — short, names the capability ("Symmetry/mirror drawing
     mode", not "improve drawing tools")
   - **Why** — what a user can't do today that this enables; cite the
     `docs/ui-reference.md` area it extends
   - **Scope guess** — small/medium/large, roughly how much new surface
     it touches (new tool vs. new panel vs. new data model)
   - **Non-goal check** — one line confirming it doesn't conflict with a
     declared non-goal or duplicate a "Still open" item (name the overlap
     if it does, instead of silently dropping it)
   - **Suggested next step** — almost always
     "`superpowers:brainstorming` then `/opsx:propose`"; note if an idea
     is small enough to skip straight to proposing

5. **Write the document** to
   `docs/feature-ideas/<YYYY-MM-DD>-feature-ideas.md` (create the
   directory if it doesn't exist), grouped by functional area, using the
   per-idea fields above. Open with one line on what was read
   (`docs/ui-reference.md` + roadmap non-goals) so a reader knows the
   scan's basis.

6. **Present a short summary in chat** (list of titles) and point to the
   file. Do not brainstorm designs, call `/opsx:propose`, or edit
   `openspec/` yourself — this skill stops at the seed document.

## Common Mistakes

- **Listing UI nits.** "Rename this button", "add a tooltip" — belongs to
  `auditing-tool-improvements`, not here. If a functional-area scan turns
  up only nits, say so and stop rather than padding the doc.
- **Re-suggesting a declared non-goal** (animation timeline, native app,
  custom backend) without checking roadmap.md first.
- **Presenting a "Still open" roadmap item as a new discovery** — cross-
  check and label it as already-known instead.
- **Vague ideas** ("better layers") with no concrete capability named —
  not actionable enough to brainstorm from.
- **Skipping the write step and only answering in chat.** The document is
  the point — it's what makes this a starting point for later work
  instead of a one-off answer that evaporates.
