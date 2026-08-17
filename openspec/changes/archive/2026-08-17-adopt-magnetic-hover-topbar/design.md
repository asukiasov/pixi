## Context

`js/magnetic-hover.js` currently exports `initMagneticHover(el)`, which
attaches its own `document`-level `pointermove`/`pointerleave` listeners
scoped to one hardcoded element (`#export-button`, wired in `js/app.js`).
See proposal.md for why this is being extended to the rest of the top bar.

## Goals / Non-Goals

**Goals:**
- One shared `pointermove` listener drives all 8 top bar buttons, not one
  listener per button.
- Disabled buttons (Undo/Redo, until there's history) never react.
- No behavior change to the already-approved trial constants (45px
  radius, 4.5px max pull, no glow). Scale is no longer the flat 1.03x
  from the original trial - see the distance-based scale decision below,
  added after testing feedback on the topbar rollout.
- At most one button reacts at a time, even when two buttons' radii
  overlap (added after testing feedback - see the exclusivity decision
  below).

**Non-Goals:**
- No gating by `pointerType` or iOS/platform detection - out of scope per
  the proposal (mouse stays included).
- No change to any button outside `.workspace-topbar` (tool rail,
  sidebar panels, etc.) - a later change if this is adopted further.
- No physics/spring easing - the existing CSS `transition` approach is
  kept as-is.

## Decisions

- **Single shared listener over per-button listeners**: `initMagneticHover`
  changes from taking one element to taking a list (or a container
  selector) and attaches exactly one `document` `pointermove` handler
  that loops over all registered buttons each move, computing each one's
  distance independently. 8 buttons is small enough that this loop is
  cheap, and it avoids 8 separate listeners doing largely duplicate work.
  Alternative considered: keep one `initMagneticHover` call per button
  (call it 8 times) - rejected because it re-adds a full `document`
  listener per button for no benefit, and was the exact one-off pattern
  the proposal calls out for cleanup.
- **Disabled check inline in the pointermove handler, not a
  MutationObserver**: on every move, for every button, check
  `el.disabled` before applying pull/scale; skip (and clear
  `.magnetic-active`) if disabled. This naturally covers the "Undo
  becomes enabled while the pointer is already nearby" scenario in the
  spec, since the very next pointermove after the `disabled` attribute
  flips will pick it up - no separate state tracking needed. A
  MutationObserver watching `disabled` was considered but adds
  complexity for a check that's already free inside the existing loop.
- **Selector-driven registration**: `initMagneticHover` is called once
  from `js/app.js` with `document.querySelectorAll('.workspace-topbar
  button')` (or equivalent) rather than a hand-maintained array of 8
  IDs, so a future top bar button automatically participates without
  another `app.js` edit. `index.html` still needs the `magnetic-hover`
  class added to each button for the CSS transition/transform rules to
  apply - the JS selector controls which buttons get pointer tracking,
  the CSS class controls which buttons render the effect. Both must be
  present on a button for it to work; this is a deliberate two-part
  contract also used by the existing trial button.
- **Distance-based scale, reusing the existing `pull` ratio**: the pull
  loop already computes `pull = distance / ACTIVATION_RADIUS` (0 at
  dead-center, 1 at the radius edge) to size the translate. Scale reuses
  the same ratio: `scale = 1 + MAX_SCALE_BUMP * (1 - pull)`, with
  `MAX_SCALE_BUMP = 0.05`, giving 1.0x at the radius edge and 1.05x at
  dead-center/direct hover. Set via a new `--pull-scale` custom property,
  consumed by `.magnetic-active`'s `transform`. Alternative considered:
  a separate CSS `:hover` rule for the extra scale, layered on top of the
  existing flat 1.03x - rejected per the chosen option in review, since
  it produces a visible jump at the button's own edge instead of one
  continuous curve across the whole radius.
- **Exclusivity via closest-in-range-wins, computed inside the existing
  loop**: the shared `pointermove` handler already loops over every
  registered button to compute its distance. It's extended to do this in
  two passes: first find the in-range button with the smallest distance
  (or none, if no button is in range), then in a second pass apply
  pull/scale/`.magnetic-active` only to that one button and clear
  `.magnetic-active` on every other one. This replaces the previous
  "every in-range button decides independently" behavior. Alternative
  considered: track "currently active button" as persistent state
  updated only on change - rejected as unnecessary complexity; recomputing
  the closest button fresh on every move is cheap at 8 buttons and avoids
  a second source of truth to keep in sync.

## Risks / Trade-offs

- [Looping over 8 buttons on every pointermove, globally] → negligible
  at this scale (a handful of arithmetic ops per button); revisit only if
  this pattern is later extended to many more elements.
- [`querySelectorAll('.workspace-topbar button')` also matches any future
  non-icon button added to the top bar] → acceptable; matches the
  proposal's "every button in the top bar" scope. If a future button
  should be excluded, exclude it explicitly in the selector at that time.
- [Two-pass loop (find closest, then apply) doubles the per-move work
  versus the original single-pass loop] → still negligible at 8 buttons;
  revisit only if this pattern is extended to many more elements.
