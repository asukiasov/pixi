## Why

A magnetic-hover proximity effect (iOS 26 / Apple Pencil hover style: the
button nudges slightly toward the pointer as it approaches, no glow) was
trialed on a single button (`#export-button`) and approved after two rounds
of tuning. It should now be adopted across the rest of the top bar so the
whole toolbar feels consistent, rather than one button behaving
differently from its neighbors.

## What Changes

- Every button in `.workspace-topbar` (Gallery, Pixel-perfect, Layers,
  Canvas Settings, Export, Undo, Redo, Right panel toggle) gets the same
  magnetic-hover proximity effect currently applied only to Export.
- The effect stays active for any pointer type (mouse or Pencil) - not
  gated to iOS 26, matching the trial.
- Trial-tuned constants carry over unchanged: 45px activation radius,
  4.5px max translate pull, 1.03x scale, no glow/halo, CSS
  transition-based ease-out.
- `js/magnetic-hover.js`'s `initMagneticHover(el)` (single hardcoded
  element) is generalized to attach to multiple elements, since it will
  now be wired to 8 buttons instead of 1.
- Undo/Redo only respond to the effect while enabled (they start
  `disabled` until there's history) - a disabled button shouldn't visibly
  react to the pointer.

## Capabilities

### New Capabilities
- `topbar-magnetic-hover`: proximity-based hover behavior for
  `.workspace-topbar` buttons - activation radius, pull/scale amounts,
  which buttons participate, and the disabled-button exception.

### Modified Capabilities
(none - no existing capability spec currently documents top bar button
interaction behavior)

## Impact

- `js/magnetic-hover.js`: generalize from a single-element API to a
  multi-element one.
- `js/app.js`: replace the single `initMagneticHover(exportButton)` call
  with one that wires up every `.workspace-topbar` button.
- `index.html`: add the `magnetic-hover` class to the remaining 7 top bar
  buttons (Export already has it).
- `style.css`: no changes expected - `.magnetic-hover`/`.magnetic-active`
  rules are already generic, not Export-specific.
- No changes to canvas drawing, persistence, or other capabilities.
