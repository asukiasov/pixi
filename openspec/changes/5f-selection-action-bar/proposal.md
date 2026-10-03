## Why

In the floating layout, Clear selection and Delete still live in the
bottom palette card (`#selection-controls`). They appear there only while
a selection exists, which makes the palette card grow, and they sit far
from the selection they act on, usually across the canvas. The target
layout (`openspec/roadmap.md`, Phase 5) puts the selection actions next to
the selection. 5f is the last region of the target layout to be built
before the switch-on (`5h-switch-on-floating`) makes floating the
default.

## What Changes

All of this applies only in the floating layout. The docked layout and
`Pixi.mount()` embeds look and work as before.

- **Selection action bar**: a small floating glass card holding **Clear
  selection** and **Delete**, the same two actions in the same order and
  with the same effects. It is shown while a selection exists and hidden
  when there is none.
- **Placed by the selection**: the bar sits centred above the selection.
  When there is no room above, it goes below. It always stays on screen
  and inside the area the other floating cards leave clear. When neither
  side has room (the selection fills the view), or the selection has been
  panned out of view, it is held at the nearest edge of that clear area.
- **Follows the view**: the bar moves with the selection when the canvas
  is panned or zoomed by any means (Hand tool, pinch, wheel, keyboard,
  zoom pill), and when the clear area changes (a card opens or closes,
  the tool-options bar appears, the window resizes).
- **Hidden during selection gestures**: while a selection is being drawn
  with the Select tool, or dragged with the Move tool, the bar is hidden.
  On release it reappears at the selection's new place. Panning and
  zooming do not hide it.
- **The palette card loses its selection controls**: `#selection-controls`
  is not shown in the floating layout. The palette card no longer changes
  height when a selection appears.
- **Focus is never dropped**: if the bar hides while it holds keyboard
  focus (for example after Clear selection from the keyboard), focus moves
  to the active tool's button in the tool rail.
- **No canvas movement**: showing, moving or hiding the bar never moves or
  re-fits the canvas, and Fit ignores it.

Not in 5f: any new selection actions (Move tool shortcut, copy, flip),
Prefs (5g), switching the floating layout on by default (5h), phone
widths.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `floating-workspace`:
  - Adds requirements for the selection action bar: its contents and
    visibility, its placement and how it follows the selection, and its
    accessibility.
  - Modifies "Full-screen canvas with floating regions": the selection
    controls become the selection action bar.
  - Modifies "Placement slots": the `options` slot no longer holds the
    selection controls, and the selection action bar belongs to no slot.
  - Modifies "Tool-options bar sits above the palette card": the palette
    card no longer holds the selection controls, so its scenario about
    them changes.

`shape-tools` (which owns selection behaviour) and `hide-interface` are
not modified. Clear and Delete keep their behaviour, and the bar is one
more region hidden by Hide interface, stated in `floating-workspace` the
same way 5d and 5e did for their regions.

## Impact

- `index.html`: a new `.floating-only` `#selection-bar` (role `group`,
  two buttons forwarding to `#selection-clear-button` and
  `#selection-delete-button` through `data-forward`), placed inside
  `.workspace-main` after `.slot-options` and outside every slot. The
  source buttons stay where they are. `lib/pixi.js` gets no new markup,
  because embeds are always docked.
- New `js/selection-bar.js`, wired once from `js/app.js` in the floating
  layout only, with a pure, unit-tested placement helper.
- `js/canvas-view.js`: a new `onViewChange` handler fired whenever the
  canvas transform or the selection overlay changes, and a
  `getSelectionClientRect()` read.
- `js/workspace.js`: `data-selection-drag` on the workspace screen while
  a selection is being drawn or moved (both layouts, nothing reads it in
  docked), plus a listener hook for view changes.
- `style.css`: floating-only rules for the bar, its show/hide (CSS
  `:has()` on the source's `.hidden`), the glass selector lists, and
  `display: none` for `#selection-controls`.
- Tests: the placement helper, CSS scoping checks.
- `docs/ui-reference.md`: a selection action bar paragraph, and updates
  to the 5a and 5d paragraphs that list `#selection-controls` in
  `.slot-options`.
