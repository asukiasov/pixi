## Why

The magnetic-hover proximity effect (openspec/changes/adopt-magnetic-hover-topbar)
was deliberately scoped to `.workspace-topbar` only, with the tool rail
called out as "a later change if this is adopted further." Having used it
on the top bar, the tool rail (`.tools-sidebar`) should get the same
treatment so both icon-button rows in the workspace feel consistent.

## What Changes

- Every button in `.tools-sidebar` (Move, Pencil, Eraser, Bucket, Brush,
  Line, Rectangle, Selection, Hand, Eyedropper) gets the same
  magnetic-hover proximity effect as the top bar: 45px activation
  radius, 4.5px max translate pull, distance-based scale (1.0x at the
  radius edge, 1.05x at dead-center), no glow.
- **Exclusivity becomes pointer-global, not per-container.** Today,
  "only the nearest button reacts" is computed across whatever elements
  were passed to a single `initMagneticHover` call. Once the tool rail
  is added, the same rule must hold across *both* containers together -
  at most one button reacts anywhere in the app, never one topbar button
  and one tool rail button simultaneously. Register every eligible
  button (both containers) with a single `initMagneticHover` call so the
  existing closest-wins logic naturally covers this without a container
  boundary. **This is a behavior clarification, not a mechanism change** -
  the existing single shared listener/loop already produces this outcome
  once both containers' buttons are in the same registered set.
- No new module needed: `js/magnetic-hover.js`'s `initMagneticHover`
  already accepts multiple elements and is reused unchanged - only its
  call site (`js/app.js`) and the registered element set change.

## Capabilities

### New Capabilities
- `toolrail-magnetic-hover`: proximity-based hover behavior for
  `.tools-sidebar` buttons - same constants and mechanics as
  `topbar-magnetic-hover`, applied to the tool rail's buttons.

### Modified Capabilities
- `topbar-magnetic-hover`: the "Exclusive activation" requirement is
  broadened from "at most one top bar button" to "at most one button
  across the top bar and tool rail together" - a top bar button and a
  tool rail button must never both be magnetic-active at the same time.

## Impact

- `js/app.js`: the single `initMagneticHover(...)` call is updated to
  register both `.workspace-topbar button` and `.tools-sidebar
  .tool-button` elements together (one combined set, not two separate
  calls) so exclusivity naturally spans both containers.
- `index.html`: add the `magnetic-hover` class to the 10 tool rail
  buttons.
- `js/magnetic-hover.js`, `style.css`: no changes expected - both are
  already generic across elements/containers.
- No changes to canvas drawing, tool selection logic, or other
  capabilities - this only affects the hover *visual* on tool rail
  buttons, not tool selection behavior (clicking still selects a tool
  exactly as before).
