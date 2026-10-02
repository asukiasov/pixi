## Context

See proposal.md for motivation. Two constraints in `js/layers-ui.js` shape
the approach:

- **Every row click re-renders the whole list.** The row's click handler
  calls `renderLayersPanel()`, which empties `#layers-panel-list` and
  rebuilds every row. The second click of a double-click therefore lands
  on a *different* DOM element than the first.
- **iPad is the primary device.** `html, body` set
  `touch-action: pan-x pan-y`, which disables Safari's double-tap zoom.
  That is good here, but iOS Safari's synthesized `dblclick` from two
  taps is historically unreliable, and it is even less reliable when the
  tapped node is replaced between taps.

## Goals / Non-Goals

**Goals:**
- One code path for mouse double-click and touch double-tap.
- Keyboard users keep a way to rename (they had one before, via the
  always-focusable input).

**Non-Goals:**
- A context-menu "Rename" item (no row context menu exists today).
- Making the rest of the row keyboard-operable (rows were never
  focusable; out of scope here).

## Decisions

**1. Detect double-click/double-tap ourselves from `click` events, keyed
by layer id - not the native `dblclick` event.** The row click handler
records `{ layerId, time, x, y }` for every plain (unmodified) click that
lands on the name. If the next such click is on the same layer, within
400 ms and 10 px, it is a double. `click` fires for mouse, touch, and
Apple Pencil alike, so one path covers all three. Keying by layer id
(not element identity) survives the re-render between the two clicks.
The logic is a pure, exported `isDoubleTap(prev, next)` so it is
unit-testable without a DOM. *Alternative:* native `dblclick`. Rejected
because the target element is destroyed between the clicks, and iOS
support is unreliable.

**2. On a detected double, the second click does not re-render.** That
click already landed on the freshly rendered row (the first click made
the layer active), so the handler swaps that row's name label for an
input in place and returns before `renderLayersPanel()`. Focusing inside
the click handler keeps it within a user gesture, which iOS requires
before it will open the on-screen keyboard.

**3. The name is a focusable `<span class="layer-name" tabindex="0">`,
not a `<button>`.** The row handler already ignores clicks that land on
`button, input`. A button would make a single click on the name
stop selecting the layer. Enter/F2 on the focused span starts rename,
which preserves keyboard access. *Alternative:* keep an always-present
`readonly` input and toggle readonly. Rejected because a readonly input
is still a text field: it shows a caret and selection handles on iOS,
which is the behavior this change removes.

**4. Commit is resolved by a pure `resolveLayerRename(raw, current)`.**
It returns the trimmed name, or `null` when the result is empty or
unchanged. `null` means no `renameLayer`/`commit()` call, so no empty
undo entry is added. A `done` flag guards double-commit (Enter followed
by the blur that the re-render triggers). Escape sets the flag and
re-renders without committing.

## Risks / Trade-offs

- [The input is lost if something else re-renders the panel mid-edit,
  e.g. an undo shortcut] → Acceptable: the edit is discarded, the same
  as Escape. The `done` flag stops the detached input's late events from
  committing.
- [The 400 ms window may feel tight or loose] → The value matches
  common OS double-click defaults and lives in one place
  (`isDoubleTap`'s default).
- [The first click of a double-tap on an inactive layer also selects
  it] → This is intended: Photoshop and Procreate behave the same way.
