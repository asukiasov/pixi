# Repo docs audit — 2026-08-24

Content/voice pass over `lib/README.md` (mount API) and
`lib/pixel-engine/README.md`, triggered by a batch of 10 "junior developer"
questions collected while testing whether these docs, plus the root
`README.md`, are clear enough to embed Pixi as an avatar-drawing plugin in a
social-media web app. This is a targeted re-read against one reader
scenario (embedding-for-avatars), not a full inventory pass — SEO/GEO and
the root `README.md`'s own content/voice were last covered in the
2026-08-18/19 audits and aren't re-run here.

A second block of 10 questions arrived in the same batch but is about an
unrelated GitHub repo (`github.com/andylassiter/pixi-plugin`, a PixiJS/
rendering-library avatar plugin) — not this project. Out of scope, not
actioned; flagging so it isn't mistaken for a finding against our docs.

**Severity**: High / Med / Low, by reader impact.
**State**: `open` (real, unaddressed) · `not-an-issue` (checked, already
satisfied) · `needs-recheck` (no live fetch this pass) · `tension` (conflict
needing a decision).

| ID | Title | Category | Severity | State |
|---|---|---|---|---|
| RDOC-1 | Q1–Q9 are already answered in `lib/README.md`, explicitly and in the same avatar-picker framing the questions use | Content | — | not-an-issue |
| RDOC-2 | Q10 (pixel-engine-only vs. full mount) has no decision guidance, only a one-line pointer in each direction | Content | Med | done |
| RDOC-3 | `lib/README.md` has no scannable index — 9 correct answers exist but only as prose a reader has to read start-to-end to find | Content/structure | Med | done |
| RDOC-4 | Pro-boundary note (Q6) sits in "Known limitations," ~300 lines in, with no forward pointer from where a reader would first look | Content/structure | Low | done |

## Notes per finding

- **RDOC-1 — not-an-issue, but worth stating plainly.** Checked each of
  the 10 questions against current `lib/README.md` line by line:
  - Q1 (bundler/CORS) → "No bundler support today" section, states the
    serve-as-static-assets-and-import-by-URL answer directly.
  - Q2 (single instance, reopen editor) → "Exactly one instance... can be
    active on the whole page at a time" paragraph, states `destroy()`
    first, re-mount after `destroy()` is supported.
  - Q3 (storage adapter for avatar picker) → `options.storage` section
    *already uses "avatar picker" as its own named example* and tells the
    reader to pass `createInMemoryAdapter()` explicitly.
  - Q4 (unscoped `style.css`) → states the collision risk and both
    mitigations (iframe, or scope it yourself) in the same paragraph,
    and says plainly `mount()` implements neither for you.
  - Q5 (circular/masked avatar) → states "that's a host-side concern...
    `mount()` has no crop/mask option of its own," again in an avatar-
    specific sentence.
  - Q6 (Pro-only boundary) → "Known limitations" states the hooks are
    inert no-ops in Standard, not a partial code path.
  - Q7 (pin against `main` drift) → the file's own second paragraph is
    the answer: pin to the "last verified against commit" line or the
    nearest tag at/before it.
  - Q8 (no `off()`) → states registered handlers stop firing once
    `destroy()` tears the instance down, which is why there's no `off()`.
  - Q9 (`loadImage()` side effects) → states the reset-to-fresh-baseline
    behavior and the "not an in-place edit" framing directly.

  None of these are gaps. The doc is unusually well-aimed at exactly this
  reader already — `options.storage` and the crop paragraph use "avatar
  picker" as their own example, not a generic one. If a junior asked
  these anyway, the likely cause is Q1–Q9 requiring a full top-to-bottom
  read of an ~340-line file to assemble, not missing content — see
  RDOC-3.

- **RDOC-2 — done.** Added a paragraph to `lib/pixel-engine/README.md`'s
  "Relationship to the rest of Pixi" section stating the reverse case
  directly: pixel-engine-only is the right call when the host already
  owns its own canvas rendering and pointer/touch input and only needs
  layer compositing/undo/export, and names the concrete work that route
  pushes onto the host (pointer-to-pixel translation, a tool state
  machine, any UI at all) versus `mount()`. Also closes the loop from
  `lib/README.md`'s Embedding checklist, which already pointed here for
  the mount-side half of this decision (added while fixing RDOC-3) but
  didn't carry the reverse guidance itself — a reader landing directly on
  `lib/pixel-engine/README.md` (not via `lib/README.md`) now gets the
  same answer.

- **RDOC-3 — done.** Added an "Embedding checklist" section near the top
  of `lib/README.md`, before the API reference: an 8-item numbered list
  covering serving strategy, single-instance lifecycle (including
  `destroy()` before host-element removal), storage adapter choice, style
  scoping, crop/mask, chrome configurability, and commit pinning, each
  linking to the existing section with the full explanation. No content
  duplicated — this is the index the finding asked for. (Two of the
  checklist's entries — `destroy()`-before-removal and chrome
  configurability — came from a later round of source-level questions in
  the same conversation, not from this audit's original 10, but landed in
  the same checklist since they're the same kind of "decision a narrow
  embed needs to make" entry.)

- **RDOC-4 — done.** Added a one-line forward pointer to `## options.ui`'s
  intro (the section a reader configuring the embeddable UI reaches
  first): "Looking for Layers, Color Library, symmetry drawing, or
  another Pro-only tool here: they're not reachable through `mount()` at
  all in Standard, configurable or otherwise — see Known limitations
  below for exactly why," linking to `#known-limitations`.

## Summary for the user

The good news first: `lib/README.md` already answers 9 of the 10 real
questions, explicitly, and two of its own paragraphs (`options.storage`,
the crop note) use an avatar picker as their worked example — this doc
was clearly written with something close to this exact reader in mind.
Nothing here is a correctness or completeness problem in the prose itself.

The actual finding was structural: the file had no way to scan for "what
do I need to decide for a narrow embed" without reading the whole thing
top to bottom, so a junior moving fast could end up asking a question the
doc already answered three sections later.

**All four findings are now closed.** RDOC-3's checklist/index was added
to `lib/README.md`, RDOC-4's forward pointer was added to `options.ui`,
and RDOC-2's content gap was filled on both sides (the mount-side pointer
in `lib/README.md`'s checklist, and the reverse pixel-engine-only
guidance in `lib/pixel-engine/README.md` itself). All were additive —
no `writing-repo-docs`-scale restructuring was needed, consistent with
this audit's original assessment.
