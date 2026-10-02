## Context

See proposal.md for motivation. Swatches in `#color-library-grid` are
~19px `<button>`s whose click sets the Foreground color. Pixi is used
mostly on iPad with finger and Apple Pencil, so the remove gesture must
not depend on hover, right-click, or a precise target. Palettes live in
IndexedDB (`colorPalettes`, a `colors: string[]` per record), outside the
drawing undo history.

## Goals / Non-Goals

**Goals:** one removal path that works the same on mouse, touch, Pencil,
and keyboard; no conflict with the existing tap-to-pick.

**Non-Goals:** reordering swatches, undo for palette edits (palette
edits have never been in the drawing undo stack), multi-select delete.

## Decisions

**1. An explicit edit-mode toggle, not long-press or a context menu.**
The user asked for a gesture that works on touch. Options considered:
- *Long-press → menu:* hidden (undiscoverable), fights the
  `-webkit-touch-callout: none` / tap-to-pick timing on iPad, and needs a
  separate desktop path (right-click) plus a keyboard path.
- *Hover × badge:* doesn't exist on touch, and a 19px swatch has no room
  for a tappable badge.
- *Edit mode (chosen):* one visible button, then a plain tap does the
  removal on every input type. Swatches are already `<button>`s, so the
  keyboard path comes free. This is the same model as iOS home-screen
  "jiggle" mode and Procreate's palette editing. Removing several colors
  is one tap each.

**2. Remove by index, not hex.** Palettes allow duplicates
(`addColorToPalette` doesn't de-duplicate), so `removeColorFromPalette(id,
index)` splices one position. The swatch carries its index from the
render loop.

**3. No per-color confirmation dialog.** Entering edit mode is the
deliberate step; a confirm on every tap would make trimming a palette
tedious. A removed color is one "Add current color" away from coming
back. Whole-palette deletion keeps its confirmation.

**4. The default palette keeps ≥1 color.** The color-library spec
promises an undeletable, populated fallback palette. Trimming Material is
useful, emptying it would break that promise, so its last swatch renders
disabled in edit mode.

**5. Visual cue is CSS-only.** `.color-library-grid.editing` adds a
diagonal × overlay (`::after`) to each swatch and a dashed border, and
the toggle gets `.active` + `aria-pressed="true"`. Each swatch's
`aria-label` switches to "Remove color #rrggbb".

## Risks / Trade-offs

- [The user forgets edit mode is on and "picks" a color, which removes
  it] → strong visual state (× on every swatch, pressed toggle), and
  edit mode auto-exits on palette switch and workspace reset.
- [Removal is not undoable] → scoped to one color per tap and trivially
  re-addable; listed as a Non-Goal rather than half-built here.
