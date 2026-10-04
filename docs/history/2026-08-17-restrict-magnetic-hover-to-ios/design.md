## Context

`js/magnetic-hover.js`'s `initMagneticHover(els)` currently attaches a
`document`-level `pointermove` listener unconditionally. `js/app.js`
already computes `document.documentElement.classList.contains(
'ios-platform')` at boot (see its own comment explaining why UA+
touch-points detection is the only reliable way to distinguish a Pencil
from a mouse, both of which report `pointer: fine`).

## Goals / Non-Goals

**Goals:**
- Desktop mouse hover produces zero visible effect on any magnetic-hover
  button, going forward.
- No new detection logic - reuse `ios-platform` exactly as computed
  today.

**Non-Goals:**
- No change to the 45px/4.5px/1.0x-1.05x/no-glow/exclusive-activation
  mechanics - only the platform gate is added.

## Decisions

- **Check `ios-platform` once, inside `initMagneticHover`, before
  attaching listeners at all** - if the class isn't present at call time,
  `initMagneticHover` returns immediately without adding any
  `pointermove`/`pointerleave` listener. Simpler and cheaper than
  attaching listeners that check the class on every move; the class is
  set once at boot in `js/app.js` and never changes during a session, so
  there's no need to re-check per-event.

## Risks / Trade-offs

- [Checking the class only once at init time, not per-event] → fine
  since `ios-platform` is a static, boot-time-only classification (no
  code anywhere adds/removes it after initial page load).
