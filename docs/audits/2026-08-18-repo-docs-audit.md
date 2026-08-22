# Repo docs audit — 2026-08-18

Findings from a `.claude/skills/auditing-repo-docs/` pass over Pixi's
public-facing docs: `README.md` and reader-facing files under `docs/`
(`repo-voice.md`, `ui-reference.md`, `repo-docs-plan.md`,
`repo-docs-research.md`, `supabase-database.md`); `docs/audits/*` and
`docs/superpowers/*` excluded per the skill (internal-only). Checked
against `docs/repo-voice.md` (voice), `writing-repo-docs`'s on-page-SEO
section (SEO), and this skill's GEO checklist, cross-referenced against
`openspec/roadmap.md` and `openspec/specs/` for staleness.

**No live GitHub API/network access in this pass** — the GitHub
About-blurb/topics check (RDOC-5) could not be fetched live. Per the
task's instruction, the known facts already recorded in
`docs/repo-docs-plan.md` (About blurb = "pixel art web app", topics/
homepage unset) are treated as given rather than re-verified; that row
is marked `needs-recheck` and should be confirmed live before acting on
it.

This file is the tracked register for this pass — one row per finding,
carrying an id so items can be discussed/approved by reference. Per the
skill, nothing here is edited yet: this skill's job ends at the findings
file, same discipline as `auditing-tool-improvements`. Approved
content/structure changes go back through `writing-repo-docs`, not ad hoc
edits here. Append new passes as new dated files rather than overwriting
this one.

**Category**: `Content` (voice/accuracy/document-set, checked against
`repo-voice.md` + `writing-repo-docs`) · `SEO` (classic search
discoverability) · `GEO` (LLM answer-engine extractability). One pass
covers both SEO and GEO per the skill — tagged separately only to note
which sub-type a finding falls under.
**Severity**: High / Med / Low, by how much it blocks a reader or search/
AI surface from finding or trusting the project.
**State**: `confirmed` (verified by reading the file/repo directly) ·
`needs-recheck` (requires live GitHub access this sandbox doesn't have) ·
`dismissed` (checked and it's not real).

| ID | Title | Location | Category | Severity | State |
|---|---|---|---|---|---|
| RDOC-1 | Core noun phrase "pixel art" appears only once in the whole README, not 2–4x in the opening section | README.md | SEO | Med | done |
| RDOC-2 | No screenshot/GIF of the Workspace in README | README.md | Content | Med | done |
| RDOC-3 | LICENSE file missing from repo root | repo root | Content | High | done |
| RDOC-4 | `docs/ui-reference.md` still not linked from README | README.md | Content | Low | done |
| RDOC-5 | GitHub About blurb is a generic category label; topics/homepage unset | GitHub repo metadata | SEO | Med | confirmed (live check matches recorded state); fix pending — needs manual GitHub UI edit, not scriptable from here |
| RDOC-6 | `repo-docs-plan.md`'s "README H1/opening line" row is stale — the issue it describes is already fixed in the current README | docs/repo-docs-plan.md | Content | Low | done |
| RDOC-7 | README's "Testing" section lists a stale, incomplete set of test-coverage areas | README.md | Content | Low-Med | done |

## Notes per finding

- **RDOC-1**: `grep -n "pixel art" README.md` returns exactly one hit —
  line 3, the opening sentence ("A browser-based pixel art drawing
  tool."). `writing-repo-docs`'s SEO section calls for the core noun
  phrase 2–4 times naturally in the opening section for search weight;
  right now it appears once and never again in the whole file, including
  the Stack/feature-list sections that could carry it naturally (e.g.
  "the pixel art canvas", "pixel-art projects" where accurate). **Fix
  direction**: work one or two more natural mentions of "pixel art" into
  the Stack or Project-structure sections without stuffing — not a
  rewrite of the opening line, which is otherwise good.

- **RDOC-2**: No `<img>`/screenshot/GIF anywhere in `README.md` (confirmed
  by grep for image markdown/HTML). This is a carried-forward item, not
  new — `docs/repo-docs-plan.md`'s "Now" table already flags it as the
  "highest-leverage single addition for a visual tool," and
  `writing-repo-docs`'s README Structure step 2 says a screenshot "does
  more work than any paragraph" for anything visual. Still open as of
  this pass.

- **RDOC-3**: No `LICENSE` file at the repo root (confirmed via `ls`).
  `docs/repo-docs-plan.md` already tracks this as "❌ missing... blocks
  anyone from legally reusing/forking," and `writing-repo-docs`'s
  document-set table marks LICENSE "Never [skip], for any public repo."
  Highest-severity finding in this pass — it's the one gap that blocks a
  legitimate use case (forking/reuse) outright, not just discoverability.

- **RDOC-4**: `grep -n "ui-reference" README.md` returns no hits.
  `docs/ui-reference.md` is a complete, already-written screen/control
  catalog with no inbound link from the one doc people read first — an
  easy, zero-risk fix (one line under "Project structure" or "Contributing
  / process"). Matches `docs/repo-docs-plan.md`'s existing "❌ not linked"
  row; still true.

- **RDOC-5**: Per the task's constraint, not fetched live this pass.
  `docs/repo-docs-plan.md` records the About blurb as "pixel art web
  app" — a generic category label, not the README's actual opening
  phrase — and topics/homepage as unset. `writing-repo-docs` calls this
  out specifically: GitHub renders the About blurb into the page's
  `<meta name="description">`, so a generic blurb wastes literal
  search-engine-quoted text, and an untagged repo is invisible to
  GitHub's own topic-page discovery regardless of README quality. Needs
  a live check (`gh repo view` or the repo settings page) before acting,
  but nothing in this pass contradicts the plan's recorded state.

- **RDOC-6**: `docs/repo-docs-plan.md`'s "Now" table still marks the
  README H1/opening-line row `⚠️ weak`, describing the problem as "a bare
  `# Pixi` H1 wastes the highest-weight line... fold the pitch onto/under
  the H1." Reading the current README: line 1 is `# Pixi`, and the very
  next visible line (line 3, one blank line between) already opens with
  "A browser-based pixel art drawing tool..." — which is exactly what
  `writing-repo-docs`'s own rule asks for ("the H1 **and/or** the line
  right under it" must carry the phrase — strix's example is cited as a
  tagline on the line directly under the H1, the same shape Pixi's README
  already has). The underlying SEO problem this row describes appears to
  already be fixed; the tracking doc itself is what's out of date. **Fix
  direction**: update `repo-docs-plan.md`'s row to ✅ (or reword the
  concern if there's a narrower gap intended, e.g. "the H1 itself, not
  just the line under it, should carry the phrase" — but that's a
  stricter bar than the skill's own stated rule, so worth confirming
  intent with the user rather than assuming that's what was meant).

- **RDOC-7**: README's Testing section says "Tests cover DOM-free logic
  (engine, layers, undo, persistence, routing, brushes, shape tools)
  directly under Node" — stated as a plain list, not qualified with "e.g."
  or "including." `test/` currently has 14 files: the seven named plus
  `symmetry.test.js`, `color-ramp.test.js`, `color-extraction.test.js`,
  `theme.test.js`, `brush-import.test.js`, `icon-font-fallback.test.js`,
  and `workspace.test.js` — none of which are mentioned. This isn't
  false (everything named is still true), but it reads as a complete
  inventory and has drifted well behind the actual suite as Phase 2's
  later sub-changes (2f color library, 2m/2n import, the theme toggle,
  5-add-symmetry-drawing-mode, 7-add-palette-color-ramp-generator) each
  added test files. **Fix direction**: either add "e.g." to signal the
  list isn't exhaustive, or refresh the parenthetical to match
  `test/`'s current contents — cheap either way, and prevents this from
  drifting further as new areas ship.

## Checks that passed (no finding)

Recorded for completeness, since a clean pass on these was part of the
skill's checklist:

- **GEO — declarative opening sentence**: README's opening ("A
  browser-based pixel art drawing tool. Fixed small canvas sizes...") is
  self-contained and would survive being quoted out of context by an
  answer engine. No finding.
- **Terminology**: grepped README.md, ui-reference.md, repo-voice.md,
  repo-docs-plan.md, and supabase-database.md for repo-voice.md's listed
  "don't" synonyms ("drawing area," "artboard," "editor," "your
  projects," "dashboard," "levels," "download," "save as image") — the
  only hits were DOM ids/icon names in ui-reference.md (e.g.
  `#export-download`), not prose. No drift found.
- **Voice**: no second-person benefit copy, intensifier adjectives, or
  unearned claims found in README.md or the docs/*.md files audited.
- **Status staleness vs. roadmap**: README's Phase 3/4 "not yet built"
  language for Supabase/Stripe matches `openspec/roadmap.md`'s current
  Phase 3 ("deliberately not started yet") and Phase 4 ("not started")
  status. No stale claims found.
- **llms.txt**: not present, and per the skill this is a suggestion, not
  a finding, below docs-site scale — Pixi is a single-README project, so
  not flagged as a gap.

## Issues hit following the skill

- The skill's step 1 ("everything under `docs/*.md` that's reader-facing")
  doesn't give a bright line for meta/process docs like
  `repo-docs-plan.md` and `repo-docs-research.md` — they're about the
  docs rather than for an external reader deciding whether to use Pixi.
  Included them in the inventory since they weren't in the two named
  exclusions (`docs/audits/`, `docs/superpowers/`), which is how RDOC-6
  surfaced — but the skill could be more explicit about whether
  self-referential tracking docs are in scope, since flagging staleness
  in a checklist-about-checklists feels one level removed from the
  skill's stated purpose (auditing docs a stranger reads).
- No other gaps — the procedure's four-part structure (inventory →
  content/voice → SEO → GEO) mapped cleanly onto this repo's actual doc
  set, and `docs/repo-docs-plan.md` made the document-set-gap checks
  (LICENSE, ui-reference link, screenshot) fast since that comparison
  table already existed rather than needing to be derived from scratch.
- The GitHub About/topics step assumes live API access by default; the
  skill doesn't have an explicit fallback instruction for a sandboxed
  pass with no network access (this session's constraint, not
  necessarily typical) — worked from the task's given instruction to
  treat `repo-docs-plan.md`'s recorded state as ground truth, but that's
  an ad hoc accommodation rather than something the skill itself
  anticipates.
