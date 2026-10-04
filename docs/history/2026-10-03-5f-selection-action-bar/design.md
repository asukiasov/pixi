## Context

See proposal.md for motivation and specs/floating-workspace/spec.md for
the required behaviour. The user settled the visible choices before this
was written:

- above the selection, flipping below when there is no room
- hidden while a selection is drawn or moved, following pan and zoom live
- Clear selection and Delete only, no new actions
- no selection controls left in the palette card

Current state that shapes the approach:

- **Who owns the selection.** `state.selection` in `workspace.js` (grid
  coordinates). It changes in only a few places:
  - the Select tool's `onDrawEnd`
  - the Move tool's `onDrawEnd`, which shifts it once on release (it is
    not updated during the drag)
  - `clearSelection()`, which is shared by Clear selection, Escape and
    Cmd/Ctrl+D
  - a tap outside the selection with the Select tool
  - project open
- **Visibility today.** `updateSelectionControls()` toggles `.hidden` on
  `#selection-controls` from `!state.selection`. Every path above calls
  it. Delete makes the pixels transparent and keeps the selection.
- **What the screen shows.** `CanvasView#setSelectionRect(rect)` places
  `#selectionOverlayEl`, a child of the transformed `#wrapperEl`. The
  overlay's `getBoundingClientRect()` is therefore the selection's
  on-screen box at the current pan and zoom. During a Select drag,
  `onDrawMove` keeps calling `setSelectionRect` with the live rubber band.
- **View-change signals.** `CanvasView` has `onZoomChange`, fired from
  `resetView`, zoom steps, presets and pinch. Hand-tool panning
  (`#onPointerMove`'s `#panning` branch) and `panBy` call
  `#applyTransform()` without it. Nothing today notifies listeners of a
  pan.
- **Handlers are per project open.** `app.js` creates one `CanvasView`
  lazily on the first project open and reuses it afterwards, but
  `initWorkspace()` replaces its handlers (`setHandlers({...})`) on every
  open. A module wired once at boot (like `tool-options-bar.js`) runs
  before the view exists and cannot register a handler that survives the
  next open.
- **Clear area.** `measureClearInsets(screenEl, containerEl)` in
  `layout.js` measures every `.slot-*` card and returns insets. Fit uses
  it once at project open. It appends a probe element, so it is too
  costly to run on every pan frame.
- **Hide interface.** 4d's structural rule
  `.workspace-screen.ui-hidden .workspace-main > :not(.canvas-container)`
  hides every direct child of `.workspace-main` other than the canvas
  container.
- **Patterns from 5b–5e to keep.**
  - New markup is `.floating-only`.
  - Controls forward to the existing control (`data-forward`), and state
    is read back from the source rather than stored a second time.
  - Show and hide is CSS-driven.
  - Positions use logical insets.
  - The `.glass` look comes by selector.
  - Pure helpers are unit-tested.

## Goals / Non-Goals

**Goals:**
- One source of truth for whether the bar shows: `#selection-controls`'
  existing `.hidden` class.
- One source of truth for where the selection is on screen: the overlay
  element's box.
- Placement is a pure function of rectangles, tested without a DOM.
- Docked layout and embeds unchanged in look and behaviour.

**Non-Goals:**
- New selection actions, or changes to how selections are made, moved
  or cleared (`shape-tools` is untouched).
- Moving the bar live with the content during a Move drag.
- Placement beside the selection, or user-draggable placement.
- Phone widths beyond "stays on screen" (post-5h follow-up).
- Removing `#selection-controls` (the later docked-deletion change does
  that, and can make the bar's buttons the real controls).

## Decisions

### 1. Proxy buttons in a slot-less element inside `.workspace-main`

New `.floating-only` markup:
`<div id="selection-bar" class="selection-bar floating-only" role="group"
aria-label="Selection actions">`, with two `tool-button` text buttons,
`data-forward="selection-clear-button"` and
`data-forward="selection-delete-button"`. It is a direct child of
`.workspace-main`, after `.slot-options`.

- **Forwarding.** Each button forwards `click()` to its source, as the
  5b menu items and 5d bar buttons do. Delete's own guard
  (`if (!state.selection) return`) and `clearSelection()` run unchanged.
- **No slot class.** `measureClearInsets` only measures `.slot-*`
  elements, so Fit ignores the bar, as the spec requires, and the bar
  never takes part in 5e's `--slot-options-reach`.
- **Hide interface for free.** As a direct child of `.workspace-main` it
  falls under 4d's structural rule. No new `.ui-hidden` selector.
- **Text labels, not icons.** They are the existing labels, and they are
  self-explanatory next to a selection. They need no tooltips.
- **Alternative: move `#selection-controls` itself out of the palette
  card into a positioned wrapper.** Rejected for the same reasons 5d
  rejected moving elements: it changes the DOM that 4d's structural
  selectors and the docked layout rely on, and it would need JS to move
  it by layout.
- **Alternative: put the bar inside `.slot-options`.** Rejected, because
  that column is centred at the bottom and measured for Fit and for the
  panel column's reach.

### 2. Show and hide is CSS, read back from the source

- Shown only while the source is shown:
  `.workspace-screen[data-layout="floating"]:has(#selection-controls.hidden)
  #selection-bar { display: none; }`. This is the same `:has()`
  read-back 5b uses for the recording dot.
- Hidden during gestures:
  `.workspace-screen[data-selection-drag] #selection-bar { visibility:
  hidden; }`. `visibility`, not `display`, so the bar keeps its size and
  can be placed while hidden, and appears in the right place on release.
- `#selection-controls` gets floating-only `display: none`. Its `.hidden`
  class keeps toggling as today, and the `:has()` rule reads it, so
  `updateSelectionControls()` is untouched.
- **`data-selection-drag`** is a new attribute on the workspace screen,
  set by `workspace.js`:
  - in `onDrawStart` when the tool is Select, or the tool is Move and
    `state.selection` exists
  - removed in `onDrawEnd` and `onDrawCancel`, and in `initWorkspace()`
    as a reset

  It runs in both layouts, like 5d's `data-current-tool`. Only floating
  CSS reads it.
- **Alternative: a `MutationObserver` that copies `.hidden` to the bar.**
  Rejected. `:has()` does it with no JS, and the module still needs the
  observer only as a reposition trigger (decision 4).
- **Alternative: hide during every gesture, including pan and pinch.**
  The user chose to follow pan and zoom live.

### 3. Placement: a pure helper over client rectangles

`placeSelectionBar(selection, bar, clear, outer, gap)` in
`js/selection-bar.js` returns `{ x, y, side }`. `side` is `'above'`,
`'below'` or `'held'`. All inputs are client-pixel rectangles:

- `selection`: the overlay's box
- `bar`: `{ width, height }`
- `clear`: the clear area, from `measureClearInsets` applied to the
  workspace screen's box
- `outer`: the screen's box inset by `--float-edge-*`, which already
  include the safe areas

Steps:

1. **Bounds.** Use `clear` if the bar fits inside it, otherwise `outer`.
   That is the spec's "may overlap only when the clear area is too
   small", for narrow windows.
2. **x.** Centre on the selection, then clamp into the bounds.
3. **y.**
   - Above (`selection.top − gap − bar.height`) when that lies within
     the bounds.
   - Otherwise below (`selection.bottom + gap`) when that lies within
     the bounds.
   - Otherwise the above position clamped into the bounds (`'held'`).
     This one rule covers "selection fills the view" (held at the top of
     the clear area) and "selection panned out of view" (held at the
     nearest edge).

Unit tests (`test/selection-bar.test.js`):

- middle of the canvas
- flip below near the top
- clamp beside the tool rail and the panel cards
- selection larger than the clear area
- selection entirely off each edge
- a clear area smaller than the bar, falling back to `outer`
- a zero-size selection (a 1×1 at low zoom)

**Alternative: CSS anchor positioning** (`anchor-name` on the overlay,
`position-try` for the flip). Rejected for now:

- Safari support is too new for the iPad-first target.
- It cannot express "inside the clear area left by other cards".
- The overlay sits inside a transformed subtree, where anchoring support
  is uneven.

### 4. When to re-place: one scheduler, three kinds of trigger

`initSelectionBar({ onCanvasViewChange })` is wired once from `app.js` in
the floating layout only, next to `initPanelRail()`. It keeps one
`schedule()` that coalesces into a single `requestAnimationFrame`. Each
frame:

1. Read the selection box. Skip the frame if there is none, or if the
   bar is `display: none`.
2. Read the bar's size.
3. Use the cached clear area.
4. Call `placeSelectionBar` and write the result.

The triggers are:

- **View changes.** `CanvasView` gets a new `onViewChange` handler,
  fired at the end of `#applyTransform()`. That method is the single
  point that every pan, zoom, preset, pinch, `panBy`, resize re-fit and
  `setSelectionRect` goes through. `workspace.js` registers it in its
  per-open `setHandlers` and fans it out to listeners registered once
  through a new exported `onCanvasViewChange(fn)`. That bridges the
  per-open view and the once-wired module. `getSelectionClientRect()`
  on `CanvasView` returns the overlay's box, or `null` while it is
  hidden. The module reads it through a matching export
  (`currentSelectionClientRect()`).
- **Clear-area changes.** A `ResizeObserver` on every `.slot-*` element
  and on the workspace screen re-measures `measureClearInsets` into the
  cache, then calls `schedule()`. Opening or closing a panel card, the
  tool-options bar appearing, and a window resize all change one of
  those boxes.
- **Visibility changes.** A `MutationObserver` on `#selection-controls`
  (`class`) and on the workspace screen (`data-selection-drag`) calls
  `schedule()`, so the first frame after the bar becomes displayed
  measures its real size.

Writing the result: the module sets `--selection-bar-x` and
`--selection-bar-y` on the bar. CSS positions it with
`position: fixed; inset-block-start: var(--selection-bar-y);
inset-inline-start: var(--selection-bar-x)`.

- The values are physical client coordinates. They come from a physical
  on-screen box, and the document is always LTR. 5g's handedness flips
  the slot variables, not the writing direction, so nothing here changes
  when the layout is mirrored.
- The rule uses logical properties only, which keeps 5a's CSS test
  ("no `left`/`right` in floating rules") passing.

**Alternatives considered:**

- **Polling every frame while a selection exists.** Rejected: constant
  work while idle.
- **Measuring the clear area on every frame.** Rejected: `measureClearInsets`
  adds and removes a probe element and reads computed styles. The
  `ResizeObserver` cache changes only when a card's box does.
- **Reusing `onZoomChange` for pans.** Rejected: it would update the
  zoom pill readout and aria-label on every pan frame, and its name
  would stop meaning what it says.

### 5. Focus when the bar hides

The bar never takes focus when it appears. If it is about to become
hidden while `document.activeElement` is inside it, the module moves
focus to the active tool's rail button (`[data-tool][aria-pressed="true"]`,
kept in sync by 5c's `syncToolButtons`).
The `#selection-controls` mutation is the signal: it fires synchronously
in the same task as `clearSelection()`.

Delete keeps the selection, so focus stays on Delete.

- **Alternative: let focus fall to `<body>`, as the docked controls do
  today.** Rejected. The docked controls sit in fixed flow, so a keyboard
  user can find their place again. A bar that vanishes leaves no
  landmark. With focus on `<body>`, 4d's Tab shortcut could also hide
  the interface on the next Tab if the last pointer press was on the
  canvas.
- **Alternative: focus the canvas.** Rejected: it is not focusable, and
  making it focusable would change 4d's Tab rule.

### 6. Look

- Glass selector lists gain `#selection-bar`. The bar gets
  `position: fixed` (required for the `::before` blur layer) and the
  usual card padding and radius.
- Buttons are at least `--rail-button-size` tall, with text padding, in
  one row with the card gap.
- `z-index` sits above the canvas container but below popovers and
  menus. It uses the same layer as the other floating cards, so a top
  bar menu opening over it covers it.
- `pointer-events: auto` on the bar. It is a card, so pointer input on
  it does not reach the canvas.

## Risks / Trade-offs

- **[Bar covers pixels next to the selection]** It sits above the
  selection, where the user may want to draw. → It is small (two
  buttons), it hides during Select and Move drags, and a pan moves it
  along with the selection. If this proves annoying, auto-hide while
  drawing is 5g's preference.
- **[`#applyTransform()` fires per pointer move during pan or pinch]**
  → The listener only calls `schedule()`, which coalesces into one rAF.
  The frame does one `getBoundingClientRect()` on the overlay, one on
  the bar, and arithmetic.
- **[Bar lags one frame behind the canvas during fast pans]** The
  transform is written synchronously and the bar on the next frame.
  → Acceptable. If it is visible on the iPad, write the position
  synchronously in the listener instead (reads in a pointermove handler
  are cheap with no pending style changes). This is a task check, not a
  design change.
- **[`:has()` support]** Required already by 5b's recording dot. →
  Nothing new.
- **[Selection overlay inside the tile preview]** The overlay belongs to
  the central canvas, so the bar follows the real selection, not a copy.
  → Intended.
- **[Two copies of the buttons until docked deletion]** → Each proxy
  carries a comment naming its source, as in 5d.

## Migration Plan

- Built behind the existing floating switch. Outside it the only change
  is the `data-selection-drag` attribute and the `onViewChange` handler,
  neither of which changes anything on screen.
- 5h's switch-on then makes this the default.
- Rollback is reverting the change.
