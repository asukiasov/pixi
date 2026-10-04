## Context

`style.css` currently has exactly five distinct fixed sizes on icon-only
buttons, each set per-component with no shared name behind it:

| Value  | Where used today |
|--------|-------------------|
| 1.4rem | `.layer-visibility-toggle`, `.layer-reference-smoothing-toggle`, `.layer-reorder-button`, `.layer-delete-button` (Layers panel rows) |
| 1.6rem | `.color-picker-popover-header .icon-button` |
| 1.8rem | `.color-library-header-actions .icon-button` |
| 2.2rem | `.zoom-controls .icon-button` |
| 2.6rem | base `.icon-button`, `.tools-sidebar .tool-button` (tool rail), `.bottom-bar-group .icon-button` (undo/redo) |

This is a workable base for a 5-step scale — every existing size already
maps 1:1 onto a step, so most call sites need no visual change. The project
has no existing BEM-style modifier convention (grep confirms no `.foo--bar`
classes anywhere); shared design tokens today are CSS custom properties on
`:root` (`--color-*`). Component sizing is otherwise scoped via ordinary
descendant selectors (`.zoom-controls .icon-button`, `.color-library-header-
actions .icon-button`, etc.), not modifier classes applied to the buttons
themselves.

Two containers hit real overflow bugs because `.color-library-panel` /
`.layers-panel` / `.layers-panel-body` set `overflow-y: auto` with no
explicit `overflow-x`, which CSS's overflow-pairing rule implicitly turns
into `overflow-x: auto` too (see `style.css`'s own comment on `.tool-
tooltip` for this project's existing writeup of the same quirk). That
hides overflowing controls behind an easy-to-miss horizontal scrollbar
instead of visibly breaking the layout.

## Goals / Non-Goals

**Goals:**
- One named scale (XS/S/M/L/XL) that every icon-button sizing rule in
  `style.css` reads from, replacing literal `width`/`height` pairs.
- Fix the two concrete overflow bugs (Color Library header, reference image
  layer row) so all their controls are reachable without horizontal scroll
  at the sidebar's normal clamped width.
- Keep the diff surgical: reuse the app's existing per-context-selector
  convention rather than introducing a new class-modifier system or
  rewriting `index.html`.

**Non-Goals:**
- Re-skinning every icon button to a new visual size. Existing sizes that
  aren't part of an overflow bug keep their current rendered size — they
  just now reference a named variable instead of a literal.
- A generic "any panel can wrap/scroll gracefully" layout overhaul. Scope
  is the two reported containers.
- Touch-target sizing (44px+). Pixi is explicitly desktop/mouse-oriented
  (CLAUDE.md); see the accessibility-floor decision below.

## Decisions

### 1. Scale values

```
--icon-size-xs: 1.4rem;  /* 22.4px */
--icon-size-s:  1.6rem;  /* 25.6px */
--icon-size-m:  1.8rem;  /* 28.8px */
--icon-size-l:  2.2rem;  /* 35.2px */
--icon-size-xl: 2.6rem;  /* 41.6px */
```

These are exactly the five values already in use (see Context table), so
adopting them as the scale changes zero existing rendered sizes except the
two call sites explicitly moved below. Picking new arbitrary values instead
would have meant re-verifying every existing layout for free — not worth it
for a sizing-consistency change.

### 2. Naming convention: CSS custom properties, consumed by existing per-context selectors

Chosen over a BEM modifier system (`.icon-button--xs` on the button
element) because:
- The project has no precedent for `--modifier` classes anywhere in
  `style.css` or `index.html` (verified by grep). Introducing one just for
  this change would be a new convention, not a followed one.
- The project *does* already scope one-off sizes to context selectors
  (`.zoom-controls .icon-button { width: 2.2rem; ... }`). Custom properties
  slot into that same pattern — the context selector still exists, its
  `width`/`height` just reads `var(--icon-size-l)` instead of a literal.
- No `index.html` or `js/workspace.js` markup changes are needed for the
  scale itself (only for the two overflow fixes' non-sizing tweaks — label
  truncation, spacing), keeping the diff small and easing the parallel
  `reference-image-original-resolution` change's merge.

Alternative considered: modifier classes on each button
(`class="icon-button icon-button--xs"`). Rejected — it would touch every
call site in `index.html` and `js/workspace.js` (`buildLayerRow`,
`buildLayerThumbnailCanvas`, etc.) for a purely cosmetic-consistency win,
which is a much larger and riskier diff than the two real bugs justify.

### 3. Accessibility floor for XS

XS stays at 1.4rem (22.4px), the value already shipping today for the
Layers panel's row controls. Pixi is a dense, desktop-oriented professional
tool (per CLAUDE.md's non-goals: no touch-first mobile build in this
phase), styled deliberately after Photoshop's own compact panels, which use
similarly small row-level icon controls. 22.4px is comfortably clickable
with a mouse/trackpad and is not shrunk further by this change — no new,
smaller step is introduced below XS. The WCAG 44px / iOS 44pt touch-target
guidance doesn't apply to a mouse-driven desktop surface; this app's own
`.ios-platform` haptic-buzz rules already treat iOS/touch as an explicitly
handled special case elsewhere in `style.css`, not the baseline.

### 4. Unstyled `.icon-button` default = XL

`.icon-button`'s base rule already sets `width: 2.6rem; height: 2.6rem`
with no modifier needed — that's XL. This change keeps it that way: XL is
simply what plain `.icon-button` resolves to when no more specific selector
overrides it (top bar, tool rail, bottom-bar undo/redo). It is not treated
as a separate "unstyled" state outside the scale; it's the default step.

### 5. Color Library header fix

`.color-library-header-actions .icon-button` moves from M (1.8rem) to XS
(1.4rem) via `var(--icon-size-xs)`. In addition, `.color-library-header h2`
gets `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-
space: nowrap;` so the "COLOR LIBRARY" label can shrink instead of forcing
the row wider than the sidebar at its narrowest clamped width (`clamp(8rem,
22vw, 13rem)`) — the icon buttons shrinking alone helps at the normal
width but the label is a second, independent overflow source at the
clamp's lower bound. M (1.8rem) stays defined in the scale for other
current/future M-sized contexts; it's simply not used by this container
anymore.

### 6. Reference image layer row fix

Already at XS (1.4rem) for all of its icon buttons — there's no smaller
scale step to drop to without going below the accessibility floor from
Decision 3. The fix is spacing, not size:
- `.layer-name-input`'s `min-width` drops from 3rem to a smaller floor so
  it yields more of its `flex: 1 1 4rem` space under pressure instead of
  pinning a wide minimum.
- `.layer-row-actions`'s internal gap tightens slightly.
- If those alone don't fit all of the visibility/thumbnail/name/lock/
  smoothing/up/down/delete controls in one line at the sidebar's normal
  clamped width, `.layer-row` is allowed to wrap (`flex-wrap: wrap`) rather
  than overflow — acceptable per the proposal's explicit "reflow/wrap is
  your call" allowance, since wrapping keeps every control visible and
  reachable with no scrollbar, just a taller row for that one layer type.
  Exact values are tuned against the real rendered layout (Playwright/
  browser check), not hand-computed, since flex arithmetic across nested
  gaps/padding is error-prone to predict exactly.

## Risks / Trade-offs

- [Shrinking Color Library icon buttons from 1.8rem to 1.4rem changes their
  visual weight relative to before] → Acceptable: 1.4rem is already used
  elsewhere in the same sidebar (Layers panel row buttons) sitting directly
  below, so the change makes the sidebar more visually consistent, not
  less.
- [Wrapping the reference image layer's row (if needed) makes that one row
  taller than a normal layer row] → Scoped to reference-image rows only
  (the only ones with a smoothing toggle); normal/background layer rows are
  unaffected.
- [CSS custom properties for size are a new small token category alongside
  the existing `--color-*` tokens] → Consistent with the project's existing
  token pattern, low risk.

## Migration Plan

No data/runtime migration. Deploy as a normal CSS/JS diff; rollback is a
plain revert. No feature flag needed — this is a pure layout/sizing fix
with unchanged functionality.
