## Why

Magnetic-hover was trialed with a plain mouse enabled on desktop only so
it could be evaluated without an iPad on hand (see `js/magnetic-hover.js`'s
own comments: "also enabled for a plain mouse on desktop during this
trial"). It's now been tested and approved (topbar and tool rail both
shipped). Per the original request, it should be restricted to
iOS/iPadOS - the trial's mouse support was never meant to be permanent.

## What Changes

- Magnetic-hover (both the top bar and tool rail) SHALL only activate on
  iOS/iPadOS. On any other platform (Mac, Windows, Linux desktop with a
  mouse), it does nothing - no translate, no scale, regardless of
  proximity.
- Reuses the app's existing `ios-platform` detection
  (`document.documentElement.classList.contains('ios-platform')`,
  already computed in `js/app.js` and already used to scope the existing
  "Buzz" hover effect the same way) - no new platform-detection logic.

## Capabilities

### Modified Capabilities
- `topbar-magnetic-hover`: "Proximity-based pull on top bar buttons"
  requirement now scopes activation to iOS/iPadOS only, not "any pointer
  (mouse or Pencil)."
- `toolrail-magnetic-hover`: "Proximity-based pull on tool rail buttons"
  requirement, same change.

### New Capabilities
(none)

## Impact

- `js/magnetic-hover.js`: `initMagneticHover` checks `ios-platform`
  before attaching/acting on pointer listeners.
- No changes to `style.css`, `index.html`, or the constants (45px
  radius, 4.5px pull, 1.0x-1.05x scale, no glow, exclusive activation) -
  only *when* the effect can activate changes, not how it behaves once
  active.
