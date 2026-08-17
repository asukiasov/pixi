# Web Interface Guidelines audit — 2026-08-17

Findings from a `.claude/skills/web-design-guidelines/` pass (Vercel's
[Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines))
over `index.html`, `style.css`, and the Workspace/Gallery interaction code
(`js/workspace.js`, `js/gallery.js`, `js/magnetic-hover.js`,
`js/confirm-dialog.js`), cross-referenced against
[`docs/ui-reference.md`](../ui-reference.md) for control locations. Read
directly from source, not screenshotted — every row below is `confirmed`
unless noted otherwise.

This file is the tracked register for that pass — one row per finding,
carrying an id so items can be discussed/approved by reference. Per
`auditing-tool-improvements`, nothing here is implemented yet: approved
items each become their own `/opsx:propose` (or skip straight to a fix if
they're a no-spec-impact bug fix, per `CLAUDE.md` rule 3). Update `State`
in place as items move through triage → approved → proposed → done; don't
delete rows.

**Severity**: High / Med / Low, by how many users hit it and how badly.
**State**: `confirmed` (verified against source) · `dismissed` (checked
and it's not real) · `dropped` (real, but user decided not to fix) ·
`approved` / `in-progress` / `done` once picked up.

| ID | Title | Location | Severity | State |
|---|---|---|---|---|
| WIG-1 | Gallery project tile is a click-only `<div>`, not keyboard-operable | Gallery | High | dropped |
| WIG-2 | Layers panel row is a click-only `<div>`, not keyboard-operable | Workspace → Layers panel | High | dropped |
| WIG-3 | Gallery thumbnail `<img>` has no `alt` text | Gallery | Med | done |
| WIG-4 | Export celebration effects ignore `prefers-reduced-motion` | Workspace → Export | Med | done |
| WIG-5 | `#color-picker-copied` "Copied!" flash isn't announced to screen readers | Workspace → color picker popover | Low-Med | done |
| WIG-6 | Several icon-only buttons are labeled via `title` only, not `aria-label` | Gallery, Workspace → Layers panel | Low-Med | done |
| WIG-7 | `.layer-name-input:focus` removes the focus outline with a low-contrast replacement | Workspace → Layers panel | Low-Med | done |
| WIG-8 | No `color-scheme: dark` on `<html>` despite an always-dark UI | Workspace, cross-cutting | Low | done (superseded) |
| WIG-9 | `placeholder="custom"` doesn't show an example value | New Canvas | Low | done |
| WIG-10 | Magnetic-hover pointermove handler isn't rAF-throttled | Workspace, cross-cutting (iOS only) | Low | done |

## Notes per finding

- **WIG-1**: `js/gallery.js:79-84` builds each project tile as a `<div>`
  with a `click` listener that opens the project — no `<button>`/`<a>`,
  no keyboard handler, not focusable. A keyboard-only user cannot open a
  project from the Gallery at all. Same root cause as WIG-2.
- **WIG-2**: `js/workspace.js:401-407` (`buildLayerRow`) — `.layer-row`
  is a `<div>` with a `click` listener that sets the active layer, same
  gap as WIG-1. The row already contains real `<button>`s for its
  actions (visibility/reorder/delete), so only "select this layer" is
  unreachable by keyboard.
- **WIG-1 / WIG-2 dropped 2026-08-17**: real findings, user decided not
  to fix for now (both would need a `<button>`/keyboard-handler rework
  of a click-only `<div>` — bigger than the WIG-3–6 batch). Left in this
  table rather than deleted so the audit trail stays complete; revisit if
  keyboard-only usage becomes a priority.
- **WIG-3**: `js/gallery.js:86-93` creates the thumbnail `<img>` and
  sets `.src` but never `.alt` — screen readers get nothing (not even
  the filename). Also no `width`/`height`, so the tile can reflow when
  the image loads.
- **WIG-4**: `style.css:1622` (`confetti-burst-fly`) and `style.css:1739`
  (`paw-print-step`) run unconditionally on export/delete. Compare
  `hover-buzz` right below them (`style.css:1790`), which is correctly
  wrapped in `@media (prefers-reduced-motion: no-preference)`. The
  matrix-rain palette effect (`style.css:1655`) has the same gap. No JS
  `matchMedia` guard exists anywhere as a fallback either.
- **WIG-5**: `index.html:170` — the "Copied!" flash next to the hex
  input has no `aria-live="polite"` (or `role="status"`), so a screen
  reader user who double-clicks to copy gets no confirmation.
- **WIG-6**: `js/gallery.js:103` (delete button) and
  `js/workspace.js:454/467/480` (layer reorder-up, reorder-down, delete)
  set `.title` only. `title` becomes the accessible name as a browser
  fallback when there's no `aria-label`, so this mostly works today, but
  it's inconsistent with every icon button defined directly in
  `index.html`, which does carry `aria-label` — worth aligning so
  screen-reader behavior doesn't depend on which code path built the
  button.
- **WIG-7**: `style.css:934-936` — `:focus` (not `:focus-visible`, so it
  also fires on mouse click) sets `outline: none` and swaps in
  `border-color: #48484a`, a dark gray barely distinguishable from the
  input's own border. Weakest focus indicator in the app.
- **WIG-8**: originally, `style.css:5` (`html, body`) hardcoded a dark
  palette with no light variant and no theme toggle. **Superseded
  2026-08-17**: a separate light/dark/system theme toggle landed on
  `main` (`d561e98`, refined in `d033196`) after this audit was written,
  and it already sets `color-scheme` correctly for all three states —
  `:root { color-scheme: dark }` as the base, `:root[data-theme="light"]
  { color-scheme: light }` for light, with `js/theme.js` resolving
  `system` to a concrete value (and live-updating on
  `prefers-color-scheme` changes) before `js/theme-boot.js` applies it
  pre-paint. No further change needed.
- **WIG-9**: `index.html:51-52` — `#custom-width`/`#custom-height`
  placeholders read `"custom"`, not an example value like `"e.g. 24"`.
  Minor, but the guideline's pattern (`10 MB`-style example, ending in
  `…`) is meant to hint the expected format, which "custom" doesn't.
- **WIG-10**: `js/magnetic-hover.js:47-89` reads `getBoundingClientRect()`
  for every tracked button on every raw `pointermove` (no
  `requestAnimationFrame` coalescing). Reads and writes are already
  batched within one handler pass, so this isn't a thrashing bug, just
  more layout work per event than necessary. Low impact today — gated to
  `.ios-platform` only, and the tracked-element count is small
  (topbar + tool rail).

**WIG-3/4/5/6 fixed 2026-08-17**, each in its own worktree/branch, merged
into `main`:
- WIG-3: `js/gallery.js` sets `img.alt = project.name` on the thumbnail;
  no explicit `width`/`height` added since `.gallery-thumbnail` is fully
  fluid (`width: 100%; aspect-ratio: 1`) in `style.css`, so there's no
  fixed size to mirror.
- WIG-4: `celebrateExport`, `matrixRain` (`js/workspace.js`), and
  `pawParade` (`js/gallery.js`) now early-return under
  `prefers-reduced-motion: reduce` (checked once at load, matching
  `js/app.js`'s existing one-time platform-detection convention). The
  Konami-code easter egg's own confetti trigger was left unguarded — out
  of this fix's scope, revisit separately if it matters.
- WIG-5: `#color-picker-copied` (`index.html`) now has
  `role="status" aria-live="polite"`; verified the show/hide logic in
  `js/workspace.js` only toggles `.hidden`, never touches
  `.textContent` or removes the element, so the live region announces
  correctly.
- WIG-6: `aria-label` added alongside the existing `.title` on every
  icon-only button in `js/gallery.js`/`js/workspace.js` that lacked one
  (project delete, layer visibility toggle, layer move-up/down, layer
  delete) — a full sweep of `js/brushes.js`, `js/layers.js`,
  `js/canvas-settings.js`, `js/export.js`, `js/brush-import.js` found no
  other instances.

All four merged cleanly (no conflicts despite overlapping files), full
test suite (`node --test`, 164 tests) still passes.

**WIG-7/9/10 fixed 2026-08-17**, each in its own worktree/branch, merged
into `main`:
- WIG-7: `.layer-name-input:focus` → `:focus-visible` (so mouse clicks no
  longer trigger it) with `border-color: var(--color-accent)` replacing
  the low-contrast gray — matches the accent used for
  `.tool-button.active` and the selection-overlay outline elsewhere.
- WIG-9: `#custom-width`/`#custom-height` placeholders changed from
  `"custom"` to `"e.g. 24…"` / `"e.g. 96…"`.
- WIG-10: `js/magnetic-hover.js`'s `pointermove` handler now only
  records the latest pointer position per event and coalesces the actual
  read/write pass into a single `requestAnimationFrame` callback per
  frame; `pointerleave` cancels any pending frame before clearing
  `.magnetic-active`, so a stale queued frame can't re-activate a button
  after the pointer has left.

All three merged cleanly, full test suite still passes.

## Not re-flagged (already tracked elsewhere)

Per `docs/ui-reference.md` and `openspec/roadmap.md`'s "Still open" list:
`#right-sidebar-toggle`'s instant (non-animated) toggle, the duplicated
Color Library sequence toggle
(`#pencil-library-toggle`/`#brush-library-toggle`), and the missing
light/dark/system theme toggle (`AUD-4`, `AUD-11`–`AUD-13` in
[`2026-08-17-ui-polish-audit.md`](2026-08-17-ui-polish-audit.md)) are
known gaps, not new findings from this pass.
