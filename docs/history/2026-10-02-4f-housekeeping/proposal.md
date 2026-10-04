## Why

Phase 4's last slice is cleanup, with no user-facing change. Two
already-shipped UI changes (AUD-11, AUD-12) were built without updating
`docs/specs/`, so the specs describe behavior that no longer exists.
The standards docs still teach "Pro extension point" and "moved to
pixi-pro" comment patterns for a `pixi-pro` add-on that was merged back
on 2026-08-24; none of those comments exist in the code anymore. And
`referenceMode`'s two values are re-typed as string literals across
`lib/` and `js/` (CFIX-5).

## What Changes

- Spec sync, to match what is already built:
  - `canvas-navigation`: the whole-right-sidebar toggle slides (width
    animation, reduced-motion aware), and the hidden sidebar is removed
    from keyboard focus (AUD-11).
  - `brushes`: Pencil and Brush share one Color Library sequence toggle
    control, shown only for those two tools, instead of one control per
    tool's panel (AUD-12).
- Docs: replace the stale "Pro extension point" and "moved to pixi-pro"
  sections in `docs/code-standards.md` and
  `docs/architecture-standards.md` with a short historical note, and
  close CFIX-7 as no longer applicable.
- CFIX-5: one exported, frozen `REFERENCE_MODES` constant in
  `lib/pixel-engine/layers.js`, used at every `referenceMode`
  comparison and assignment. Stored values are unchanged, so existing
  saved projects load as before.
- Reminder only: the operator-side teardown for
  `merge-pixi-pro-into-standard` (delete the private `pixi-pro` repo and
  the `pixi-pro.asukiasov.workers.dev` Worker) is a manual step. That
  change is archived only once the operator confirms the teardown.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `canvas-navigation`: "Whole right sidebar visibility toggle" gains the
  slide animation and focus-removal behavior that was already shipped.
- `brushes`: "Color Library sequence mode (Pencil and Brush)" describes
  the single shared control that was already shipped.

## Impact

- `docs/specs/canvas-navigation`, `docs/specs/brushes`
  (documentation of existing behavior; no code change for these).
- `docs/code-standards.md`, `docs/architecture-standards.md`,
  `docs/audits/2026-08-21-code-standards-fixes.md`.
- `lib/pixel-engine/layers.js`, `js/layers-ui.js`, and tests in
  `lib/pixel-engine/layers.test.js`.
