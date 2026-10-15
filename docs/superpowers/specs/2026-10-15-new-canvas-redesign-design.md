# New Canvas redesign — design + plan

Date: 2026-10-15. Roadmap: Phase 5, "New Canvas redesign" (planned
2026-10-05). Design and plan are kept together in this one doc, at the
user's request. Reference: `docs/Screenshots of other apps/other screens/create new doc.png`.

## Design

**Layout.** `.new-canvas-card.glass` widens to `min(100%, 52rem)` and holds a
header ("New Canvas") and a two-column body: a preset grid on the left and a
~260px inspector on the right. At ≤640px the two stack (grid first), and the
Cancel/Create row is pinned to the bottom of the screen (`position: sticky`
inside a scrolling card).

**Preset tiles** (`#size-presets`, `role="group"`, buttons with
`aria-pressed`): "Last used" first, then 16, 32, 64, 128, then a "Custom W×H"
tile shown only while the size matches neither a preset nor the last-used
size. Each tile has a preview (`.size-tile-preview`) with the chosen
background (checkerboard or white) and a pixel grid at the tile's size
(CSS gradients sized from `--cols`/`--rows`, aspect ratio from W/H), with the
name and size underneath. A selected tile gets an accent ring.

**Inspector**
- Preset summary row: the selected tile's name and `W × H px`.
- Size: `#custom-width` / `#custom-height` (1–256) and a swap button
  (`#swap-size`, `swap_horiz` ghost button) shown only when W ≠ H.
- Background (`#background-choice`): two picture tiles, Transparent
  (checkerboard) and White, same ring style, `aria-pressed`.
- Cancel (`#cancel-new-canvas`, ghost text button → Gallery) and Create
  (`#create-canvas-button`, primary).

**Remember last.** `prefs.newCanvas = { width, height, background }`
(default 32×32 transparent), normalized like the other prefs. Saved on
Create; read each time the screen opens, which selects "Last used".

**Selection logic** (pure, `js/new-canvas-state.js`, unit-tested):
- `initialState(last)` → last's size/background, `selected: 'last'`.
- `selectTile(state, tile)` → `'last'` or a preset size; sets W/H.
- `setSize(state, width, height)` → clamps 1–256; selected is the matching
  square preset, else `'last'` if it equals the last-used size, else
  `'custom'`. Used by typing and by swap.
- `swapSize(state)` → `setSize(state, h, w)`.
- `setBackground(state, bg)`.
- `tileLabel(state)` → summary text.

Typing: `input` updates state from valid numbers without rewriting the field;
`change` writes the clamped value back.

Forma UI: `.glass`, `.primary-button`, `.ghost-button.ghost-text`,
`.ghost-button` (icon), tokens for colours/radii. Out of scope: template
sidebar, search, units, resolution, colour depth.

## Plan

1. TDD `prefs.newCanvas` (default, normalize, round-trip) in
   `test/prefs.test.js`; implement in `js/prefs.js`.
2. TDD `js/new-canvas-state.js` in `test/new-canvas-state.test.js`.
3. Markup (`index.html`), CSS (`style.css`), rewrite `js/new-canvas.js` to
   render from state; `initNewCanvasScreen` returns `{ open() }`, takes
   `getLast`, `saveLast`, `onCancel`. Wire in `js/app.js` (call `open()`
   wherever the screen is shown). Markup test in `test/home-screen.test.js`.
4. Check in a browser (desktop + phone width), web-design-guidelines pass,
   code review.
5. Docs: `docs/specs/canvas-creation/spec.md`, `docs/ui-reference.md`,
   `docs/roadmap.md`.
