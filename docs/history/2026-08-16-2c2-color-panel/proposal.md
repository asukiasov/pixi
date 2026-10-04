## Why

The palette is currently a fixed set of ~16 preset swatches with, per the
original Phase 1 spec, explicitly "no custom color input" — a real
limitation once a user wants a color that isn't one of those 16 (a
specific skin tone, a brand color, a shade picked from a reference image).
Phase 2c's roadmap entry already anticipated this ("full color/palette
panel, custom color picker, saved palettes"); this change delivers the
custom-picker half of that (RGB/hex entry, add to the palette). Symmetry
& grid tools, also mentioned under the same roadmap line, are not part of
this slice — not requested, and unrelated in implementation.

## What Changes

- A custom color picker, reachable from the palette row, offering both a
  visual picker and direct RGB/hex entry.
- Picking a custom color makes it the current draw color immediately
  (same as tapping any existing swatch).
- An explicit "add to palette" action appends the currently-picked custom
  color as a new swatch in the palette row, so it can be reselected with
  one tap like any preset color, for the rest of the session.
- **Eyedropper tool**: a new tool in the tools sidebar that samples the
  composited color under a tapped point on the canvas and makes it the
  current (foreground) draw color. **Revised per feedback**: this is what
  "add a color picker" originally meant, not the custom RGB/hex picker
  above (which stays in scope too, under its own name).
- **Foreground/Background colors**: the single "current draw color"
  becomes a Photoshop-style pair — Foreground (what tools actually draw
  with, same role `state.currentColor` already plays) and Background (a
  second held color) — shown as two overlapping swatches with a swap
  control and a reset-to-black/white control. Picking any color (preset
  swatch, custom picker, or Eyedropper) sets the *Foreground* color, same
  as today; Background is a second slot the user can swap into place.
- **BREAKING** (spec-level only, not a runtime break): supersedes Phase
  1's "no custom color input is provided" constraint in the Color palette
  requirement.

## Capabilities

### Modified Capabilities
- `pixel-drawing-engine`: the "Color palette" requirement changes from
  "fixed palette only, no custom color input" to "fixed palette plus a
  custom color picker with RGB/hex entry and the ability to add a picked
  color to the palette." A new Eyedropper tool and a Foreground/
  Background color model are added alongside it (same capability — all
  three are about how the current draw color gets chosen).

## Impact

- `js/workspace.js`: palette-row gains a custom-color picker control;
  a new in-memory list of user-added custom swatches (rendered alongside
  the fixed 16 + Rainbow); `state.currentColor` is renamed/reframed as
  `state.foregroundColor` with a new `state.backgroundColor` alongside it
  (swap + reset controls just exchange/reset these two); a new
  `eyedropper` tool branch in the draw-handler dispatch that samples
  `layerStack.composite()` at the tapped point instead of modifying
  pixels.
- `index.html` / `style.css`: new picker UI (native color input +
  RGB/hex text fields + "Add to palette" button), palette row grows to
  accommodate custom swatches; new Eyedropper tool button in the tools
  sidebar; new Foreground/Background swatch-pair control (with swap and
  reset icons) near the palette row.
- No `js/engine.js` changes for the picker/palette/FG-BG parts — this
  only affects how the current color gets set, not how it's drawn. The
  Eyedropper reads pixel data (via the existing `LayerStack.composite()`
  used for rendering) but writes nothing.
- No persistence changes in this slice: custom swatches, and the
  foreground/background colors themselves, live for the current session
  only (like every other tool/color selection in this app already
  resets per project), not saved to IndexedDB. Full "saved palettes"
  (the other half of the original roadmap line) is a possible future
  increment, not built here.
- Out of scope for this slice: Background color does not change Eraser's
  behavior (Eraser continues to always erase to full transparency,
  per its existing, unmodified requirement) — Background is purely a
  second selectable/swappable color slot in this change, not wired into
  any tool's drawing behavior yet.
