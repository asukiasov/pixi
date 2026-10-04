## Context

`js/layers.js`'s `Layer` is currently `{ name, engine, visible, opacity,
blendMode }` with no notion of a locked/special layer. `LayerStack`'s
constructor creates the one starting layer directly from the
`background` argument (`'transparent' | 'white'`) already passed through
from New Canvas. `js/workspace.js`'s `pencilOrEraserApplyPixel(engine)`
(from `2e-pencil-eraser-size-opacity`) currently branches only on
`state.currentTool`; it has no layer awareness at all.

`2c2-color-panel`'s design.md explicitly flagged not wiring
`state.backgroundColor` into Eraser as a Non-Goal, "for a workflow this
app's layer model does not obviously need" - this change is exactly that
workflow becoming a real, explicit request, now that there's a concrete
Background-layer concept to scope it to. It does not reverse that
decision so much as complete the sentence: Background still does nothing
on a *regular* layer, exactly as `2c2` decided; the new, narrow exception
is specific to the one special layer this change introduces.

## Goals / Non-Goals

**Goals:**
- Match the Photoshop/Aseprite convention: a white-background canvas
  gets a locked "Background" layer; erasing it reveals a backdrop color
  instead of punching a transparent hole.
- Keep every existing Eraser/layer behavior for non-Background layers
  bit-for-bit unchanged.

**Non-Goals:**
- No "convert Background to a regular layer" action (Photoshop offers
  this via double-clicking the layer) - out of scope; the Background
  layer is locked in position for its whole lifetime in this slice.
- No locking of the Background layer's opacity or blend mode - only
  reordering is locked, matching exactly what was asked ("can't be moved
  somewhere").
- No change to how many layers a canvas can have, or to Delete Layer's
  existing rules - a Background layer can still be deleted like any
  other layer as long as it isn't the only one left (no new restriction
  added there).
- No retroactive Background-layer assignment for existing/already-saved
  white-background projects - see Migration Plan.

## Decisions

**`isBackground` is a plain boolean on `Layer`, set once at
`LayerStack` construction, never elsewhere.** Simplest possible
representation for "at most one, decided at creation time, never
reassigned by any other action" (per the "Only one Background layer per
canvas" requirement) - no need for an id reference or a stack-level
flag when a per-layer boolean already captures it exactly, and every
other layer operation (add, delete, reorder, rename, visibility,
opacity, blend) already operates per-`Layer` already.

**Reorder lock lives in `LayerStack.moveLayerUp`/`moveLayerDown`
(no-op for a Background layer), not just the UI.** The Layers panel
already disables the buttons for other reasons (topmost/bottommost), so
disabling them for `isBackground` is a one-line addition there too - but
guarding the underlying `LayerStack` methods as well means the lock
holds even if some other code path ever calls them directly, not only
through the button the current UI happens to expose.

**Eraser's Background-layer exception is checked in
`pencilOrEraserApplyPixel`, reading the *active* layer's `isBackground`
flag at the point the stroke starts** (same layer `strokeEngine` already
captures once per stroke/drag, per the existing "captured once per
stroke... keeps targeting the layer it started on" comment) - not
re-checked per pixel. A layer's Background-ness cannot change mid-stroke
(nothing in this change makes it mutable at all), so this is simply
reading a fact about the already-fixed target layer, consistent with how
the rest of that function already reads `state.currentTool` once per
call rather than per pixel.

**No engine-level "erase to a color" primitive - reuse
`setPixelBlended`.** Revealing the Background color is exactly a
Pencil-style blended paint (source-over compositing at the current
Opacity), not a new alpha-manipulation op - Eraser's Background-layer
branch calls `engine.setPixelBlended(x, y, state.backgroundColor,
state.pencilOpacity)`, the same function Pencil already uses, just with
a different source color. `erasePixelBlended` (alpha-only fade) remains
exactly what a non-Background layer's Eraser uses, untouched.

## Risks / Trade-offs

- **Existing white-background projects saved before this change won't
  retroactively get a Background layer** → their starting layer's
  `isBackground` simply reads `undefined`/falsy on load (the field never
  existed in their saved record), which behaves identically to `false` -
  they keep working exactly as before (Eraser still produces
  transparency there), just without the new lock/reveal behavior. No
  migration needed or attempted, and there's no dedicated "make this the
  Background layer" action to opt an old project in after the fact -
  flagged here as a known limitation, not silently glossed over.
- **A future "flatten image" or "merge layers" feature will need to
  decide what happens to `isBackground`** → not designed against
  speculatively; whichever layer a flatten operation keeps (or its own
  design) can decide then.
