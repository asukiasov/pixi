# Glass and panel polish — design

Part A of the 2026-10-13 UI feedback (ten items, split into three specs):

- **A. Glass and panel polish** (this doc): items 1, 2, 3, 4, 9, 10.
- **B. Transform**: items 5 (Transform popover in categories, after
  Pixelmator Pro's Arrange and Curve's Style) and 6 (rotation dial).
  Separate spec, after A.
- **C. Edit actions**: items 7 (a visible Merge button) and 8 (Copy, Cut,
  Paste with icons). Separate spec, after B.

This change is CSS and markup only. It adds no new behaviour, except that
blend mode and opacity move from a popover into the Layers header.

## 1. Glass surfaces (feedback items 1, 2)

Forma's `.glass` (`forma-ui/components.css`) is the one frosted-glass
definition: tint, hairline border, inner top highlight, blur under
`@supports`, an opaque fallback, and `prefers-reduced-transparency`. The
surfaces below were built before it, with flat opaque fills.

**Approach:** add the `.glass` class to each surface (in `index.html`, or
where the JS builds it) and delete the surface's own `background`,
`border` and `box-shadow` rules. Its layout rules stay. Don't copy glass
tokens into per-surface CSS, because copies drift.

Surfaces:

- The confirm dialog (`js/confirm-dialog.js`, `.confirm-dialog`).
- Every `.topbar-menu`: More ⋯, palette menu, Zoom, layer ⋯ and the Layers
  header ⋯, tool overflow.
- Popovers: colour picker, Transform, Canvas Settings, Brushes, and the
  group Opacity popover.
- Sheets: Prefs, Customize Tools, Standard Libraries.

Details:

- **Menus:** 14px corner radius. Items get full-width rounded hover and
  focus fills (`--ghost-hover`) inset from the menu edge. Separators are
  `--glass-border` hairlines.
- **Confirm dialog:** 18px radius. Cancel is a `.ghost-button` pill; a
  destructive confirm is a solid red pill (`--color-danger`). The `::backdrop`
  is a dim plus a light blur.
- **WebKit:** a translucent modal `<dialog>` can leak cards in WebKit. If
  headless WebKit still shows a leak after this change, that surface uses
  the opaque tint (same colour at full alpha) there, through an
  `@supports` or class fallback. Glass stays everywhere else.

## 2. Layers panel (feedback items 3, 4)

After Pixelmator Pro's Layers panel, adopting only these traits. The row
cards stay.

- **Header row 2, blend and opacity inline:** a compact blend-mode select
  (`BLEND_MODES`) and an opacity slider with a % readout, bound to the
  **active layer**. They update when the active layer changes and after
  undo or redo. Both are disabled for a reference image. Changing them is
  undoable, as the popover is today.
- The header's **tune button and the layer ⋯ "Opacity & Blend…" item go
  away**: the controls are always visible. Groups have no active state, so
  the group ⋯ **Opacity…** item keeps its small popover (opacity only, now
  glass).
- **Visibility:** a round checkbox in the accent colour (checked = visible)
  replaces the toggle switch. Same `aria-label`, same handler, 44px hit
  area.
- **Drag grip:** the Material `drag_handle` glyph replaces
  `drag_indicator`.
- **Add layer:** the Material `add_circle` glyph replaces the masked
  `layers_add.svg`. Remove the `.layers-add-icon` rule and the asset, if
  nothing else uses it.

`drag_handle` and `add_circle` must be added to the Material Symbols
`icon_names` list in `index.html`'s font URL, which is subset to the
glyphs we use, and to `js/icon-font-fallback.js` if that file lists them.

## 3. Colour picker and swatches (feedback item 9)

- **Round swatches everywhere:** the picker's Palettes tab, History, the
  bottom colour bar, and the Standard Libraries sheet. The active swatch
  gets a ring with a gap (an outer ring in `--color-accent` and an inner ring in
  the surface colour), so it shows on any colour.
- **Tabs** (Disc, Classic, Value, Palettes): a glass-pill segmented
  control. The checked segment is a raised pill.
- **Header:** the current-colour chip is a circle. The close button is a
  small `.ghost-button` circle with `close`.
- **Actions** ("Add to palette", "Ramp"): one capsule with two segments,
  each an icon above a small label, Curve-style.
- **Classic and Value sliders:** thin rounded tracks with a round thumb,
  the same as the Forma `.slider`.

## 4. Ellipse fill icon (feedback item 10)

The Filled toggle (`#rectangle-fill-toggle`, `js/rectangle-fill-ui.js`)
is shared by Rectangle and Ellipse. With **Ellipse** active, it shows
ellipse outline and filled ellipse icons (inline SVG like the rectangle
pair). With **Rectangle** active, it keeps the rectangle icons. The
tooltip follows: "Filled ellipse" or "Filled rectangle". The icon choice is
a small pure function, `fillIconFor(tool, filled)`.

## Testing

- Unit tests (TDD): `fillIconFor`; the header's blend and opacity binding
  (values follow the active layer, disabled for a reference image, an edit
  is undoable).
- Visual check of every surface in §1–§4, in light and dark, at desktop and
  phone width, in Chromium and headless WebKit (persistent context, see
  memory). Each menu and the confirm dialog are checked over artwork, to
  see the glass.
- `web-design-guidelines` review before code review (this touches
  `index.html` and CSS).

## Docs to update in the same branch

`docs/specs/layers/spec.md` (header controls, visibility checkbox),
`docs/specs/color-library/spec.md` (round swatches),
`docs/specs/shape-tools/spec.md` (ellipse fill icon),
`docs/ui-reference.md`, and `docs/roadmap.md` (UI polish pass).
