# 5g — Prefs (design)

Roadmap item 5g, Phase 5. Approved 2026-10-04.

## Goal

A Prefs sheet, opened from the top bar's ⋯ More menu, styled like
Pixelmator Pro for iPad's Settings sheet
(`docs/Screenshots of other apps/other screens/pixelmator-pro-for-ipad-settings.avif`):
a centred modal glass sheet with a title, a ✓ close button in the top
corner, grouped sections with a muted heading each, and rows with a label
on the start side and a switch or select on the end side.

It holds:

| Section | Row | Control | Default |
|---|---|---|---|
| Layout | Tools side | select: Left / Right | Left |
| Layout | Panels side | select: Left / Right | Right |
| Panels | Colors / Brushes / Layers open on project open | switch each | on |
| Drawing | Hide interface while drawing | switch | off |

Changes apply as soon as they are made. ✓, Escape and a press outside the
sheet close it.

## Change from the roadmap: two sides instead of handedness

The roadmap described one "handedness" flag that mirrors the whole
layout. Instead there are two independent settings:

- **Tools side** moves the tool rail (with its FG/BG swatches).
- **Panels side** moves the `panels` slot: the mini-rail plus the
  Layers/Colors/Brushes card column.

When both are on the same side they stack from the screen edge inward:
**tool rail, mini-rail, cards**. Nothing overlaps. Pixelmator's
`pixelmator-pro-for-ipad-layers.avif` (Layers left, tools right) is the
"Tools: Right, Panels: Left" combination.

## Deferred: "how cards open"

The roadmap's "how cards open" setting (mini-rail / edge tabs /
contextual auto-open) is **deferred**. Edge tabs and contextual auto-open
are each a new interaction model, with their own markup, focus handling
and spec. That is more than a pref row. The mini-rail stays the only
mode. The roadmap lists the setting as a later, unscheduled item.

## Decisions

- **Order on the same side**: tool rail on the outer edge, then the
  mini-rail, then the cards. The mini-rail stays next to its cards.
- **No re-fit on a side change.** The rule that cards appearing or
  moving never move the artwork holds. Fit and the next project open use
  the new sides.
- **Auto-hide covers every floating card**: the top bar, both rails, the
  panel cards, the tool-options bar and the palette card (and the
  selection bar, already hidden during a selection drag). It is off by
  default. While a stroke with Pencil, Eraser, Brush, Line or Rectangle is
  in progress on the canvas, the cards fade out after a short delay
  (so a tap does not flicker) and are not hit-testable. On release or
  cancel they come back at once. Other tools (Select, Move, Hand, Bucket,
  Eyedropper) never auto-hide.
- **Pinned cards** replace the "every card opens" default. At ≥600px
  width a project opens with exactly the pinned cards open. Below 600px
  it still opens with every card closed (5h's narrow rule wins). Brushes
  still only shows while the Brush tool is active.
- **Standalone only.** The prefs module is wired from `js/app.js`, which
  `Pixi.mount()` embeds never load, so embeds are unchanged.
- **Persistence**: one `localStorage` key, `pixi-prefs`, holding JSON,
  the same mechanism as the theme preference (`js/theme.js`). Unknown,
  missing or corrupt values fall back to the defaults field by field.
  Storage errors are swallowed, so prefs then last for the session only.

## Architecture

### `js/prefs.js` (pure, unit-tested)

- `DEFAULT_PREFS`:
  `{ toolsSide: 'left', panelsSide: 'right', pinned: { colors: true, brushes: true, layers: true }, autoHide: false }`.
- `normalizePrefs(raw)` validates field by field.
- `loadPrefs(storage)` and `savePrefs(storage, prefs)` take a
  Storage-like object, so tests use a fake.
- `applyPrefsToScreen(screenEl, prefs)` sets `data-tools-side`,
  `data-panels-side` and `data-auto-hide` on `#screen-workspace`.
- `isAutoHideTool(tool)` is true for pencil, eraser, brush, line and
  rectangle.

### `js/prefs-sheet.js` (DOM)

- `initPrefsSheet({ getPrefs, setPrefs })` wires the markup in
  `index.html`. The sheet is a native `<dialog>` opened with
  `showModal()`, which gives focus containment, Escape, an inert
  background and the top layer for free. The More menu gets a **Prefs**
  item (icon `tune`) after Tile preview. Choosing it closes the menu and
  opens the sheet. Closing the sheet returns focus to More.
- The selects are native `<select>` elements, styled as Pixelmator's
  value-plus-chevrons. The switches are `<input type="checkbox"
  role="switch">`, styled as iOS switches. Every row is a `<label>`, so
  the whole row is the hit target (≥44px tall).

### Layout: CSS variables per side

The slots already position by `inset-inline-start/end` from variables
(`--slot-tools-start/end`, `--slot-panels-start/end`,
`--slot-cards-start/end`). Four attribute combinations on the screen set
those pairs. The app is LTR, so left is start.

With `E` = edge inset, `R` = rail width and `G` = gap:

| Tools | Panels | tool rail | mini-rail | cards |
|---|---|---|---|---|
| left | right | start E | end E | end E+R+G |
| right | left | end E | start E | start E+R+G |
| left | left | start E | start E+R+G | start E+2(R+G) |
| right | right | end E | end E+R+G | end E+2(R+G) |

`--slot-cards-room` (the width available to the card column) becomes
`100% − cards offset − far-side reserve − G`, where the far-side reserve
is `E+R+G` when the tool rail is on the other side, and `E` otherwise.
The bottom slot's max-width uses the larger of the two sides' rail
reserves on both sides, so it stays centred and clear of the rails.

### Clear area and Fit follow the side

`clearInsets` classified `tools`/`panels` cards by comparing their centre
with the container's midpoint. That breaks when both are on one side and
the card column is wide relative to the window (at 390px its centre
passes the midpoint). Cards now carry an explicit `side`
(`'left'|'right'`). `measureClearInsets` reads it from the screen's
`data-tools-side` / `data-panels-side`, and the midpoint stays as the
fallback for callers that pass no side (embeds have no slots anyway).
Fit, the initial view and the selection action bar's clear area all go
through this, so they follow the sides.

### Popovers and tooltips open toward the canvas

- The tool rail tooltips, the colour picker and the mini-rail tooltips
  already use `canvasSide()` (measured from the rail's position), so they
  follow the side.
- The card column's own tooltips were hard-coded to open to the left
  (`isRightSidebar`). They now use `canvasSide()` of the column too, so
  with Panels on the left they open to the right, on screen.
- Card popovers (palette import/ramp preview, layer opacity) open below
  their anchor, clamped to the viewport, and are side-neutral already.

### Auto-hide

`js/workspace.js` sets `data-stroking` on the screen in `onDrawStart`
when `isAutoHideTool(currentTool)`, and clears it in
`onDrawEnd`/`onDrawCancel`. The CSS rule
`[data-auto-hide="on"][data-stroking]` fades the floating cards with
`opacity: 0; pointer-events: none` and a short `transition-delay`, and
does it instantly under `prefers-reduced-motion`. The canvas never moves.
`measureClearInsets` is not called during a stroke.

### Pinned cards

`openCardDefaults(width, pinned)` returns `pinned[x] && width ≥ 600` per
card. `applyOpenCardDefaults` takes the pinned map from the current
prefs. Changing a pin does not open or close cards in the current
project. It applies on the next project open, as the row's hint says.

## Error handling

- Corrupt or missing storage falls back to the defaults per field.
- Storage write failure keeps the change for the session, silently. This
  is a preference, not user data, so it follows the code standards'
  silent rule for non-critical persistence. The theme does the same.

## Testing

- Unit (`node --test`): `normalizePrefs`, `loadPrefs`/`savePrefs`
  round-trip and corruption, `applyPrefsToScreen` attributes,
  `isAutoHideTool`, `clearInsets` with explicit sides (including both
  sides on the same side, with a wide column past the midpoint), and
  `openCardDefaults` with pins.
- CSS guard tests (pattern of `test/floating-layout-css.test.js`): the
  four side combinations define the slot variables, and no floating rule
  sets physical `left`/`right` for slots.
- Manual/headless: screenshots of all four side combinations in Chromium
  and WebKit at 1180×820 and 768×1024, checking that nothing overlaps,
  Fit sits in the clear area, and tooltips open toward the canvas. Also
  the Prefs sheet in light and dark.

## Docs

- `docs/specs/floating-workspace/spec.md`: Placement slots (sides from
  prefs, same-side stacking), More menu (Prefs item), new requirements
  for the Prefs sheet, Tools/Panels side, Pinned cards (amends "Panel
  cards on project open") and Hide while drawing. Tool rail and mini-rail
  tooltip requirements gain the card-column case.
- `docs/ui-reference.md`: the Prefs sheet and its More item.
- `docs/roadmap.md`: 5g done, the handedness → two-sides change, and the
  deferral of "how cards open".
