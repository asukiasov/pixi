## Context

`js/magnetic-hover.js`'s `initMagneticHover(els)` already accepts a
collection of elements and, internally, computes exclusivity ("only the
single nearest in-range button reacts") across whatever set it was
given - see `openspec/specs/topbar-magnetic-hover/spec.md`. Today
`js/app.js` calls it once with only `.workspace-topbar button`. This
change adds the tool rail's 10 tool-selection buttons to that same
registered set.

## Goals / Non-Goals

**Goals:**
- Tool rail buttons get identical mechanics to top bar buttons (45px
  radius, 4.5px pull, 1.0x-1.05x scale, no glow) - no new constants.
- Exclusivity holds across both containers with zero new logic: the
  existing closest-wins loop already produces this once both containers'
  buttons are in one registered set.

**Non-Goals:**
- No change to tool *selection* behavior - clicking a tool rail button
  still selects that tool exactly as before; this only adds a hover
  visual.
- No change to the FG/BG swatch buttons, the Filled toggle, or the 1:1
  proportion toggle that also live inside `.tools-sidebar` - out of
  scope, not part of "tools buttons" as requested.
- No changes to `js/magnetic-hover.js` or `style.css` - both are already
  generic enough to cover this without modification.

## Decisions

- **Selector: `.tools-sidebar [data-tool]`, not `.tools-sidebar
  .tool-button`**: every element in `.tools-sidebar` that represents a
  selectable tool carries a `data-tool` attribute, and exactly 10
  elements in the whole document have one - a precise, self-documenting
  match for "the 10 tool buttons." `.tool-button` was rejected: the tool
  rail also contains `#square-constraint-toggle` (the "1:1" proportion
  toggle), which also carries the `.tool-button` class but is a
  tool-scoped option control, not one of the 10 tools themselves, and is
  out of scope per the proposal.
- **One combined `initMagneticHover` call, not two separate calls**:
  `js/app.js` changes its single call from `document.querySelectorAll(
  '.workspace-topbar button')` to a combined NodeList/array covering
  both `.workspace-topbar button` and `.tools-sidebar [data-tool]`.
  Two separate `initMagneticHover` calls (one per container) were
  considered and rejected: each call attaches its own `pointermove`
  listener and computes "nearest" only within its own registered set, so
  two calls could not produce cross-container exclusivity - a top bar
  button and a tool rail button could both end up active at once. A
  single combined call is required to satisfy the modified Exclusive
  activation requirement, not just a style preference.

## Risks / Trade-offs

- [Combining two `querySelectorAll` results into one list adds a small
  amount of call-site plumbing in `js/app.js`] → trivial; a
  `[...a, ...b]` spread or two `querySelectorAll` calls concatenated.
- [Looping over 18 buttons instead of 8 on every pointermove, globally]
  → still negligible at this scale (basic arithmetic per button, a
  couple dozen times); no measurable cost expected.
