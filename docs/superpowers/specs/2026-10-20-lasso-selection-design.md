# Lasso selection — design

Date: 2026-10-20. Asked for: "more free" selection tools, like Photoshop's lasso.

## Decisions (agreed in brainstorming)

- **Tools:** Ellipse Select, Lasso, Polygonal Lasso, plus New / Add /
  Subtract. Magic Wand and Intersect left for later.
- **Separate tools**, Photoshop-style, not one tool with a shape picker.
  Keys follow Aseprite: M Rectangle Select, Shift+M Ellipse Select, Q Lasso,
  Shift+Q Polygonal Lasso (L is Line). Lasso joins the default rail; the
  other two start in ⋯. Customized rails are left as they are.
- **Modes:** a sticky New / Add / Subtract picker in the tool-options bar,
  shared by all four tools. Shift at drag start adds, Alt/Option subtracts,
  for that shape only. Shift pressed mid-drag is still 1:1.
- **Model:** a full-canvas pixel mask (`Uint8Array`, ≤ 16 KB at 128²) with
  its bounding box cached as `x/y/width/height`, so box-only code (action
  bar, overlay position) is unchanged. Empty mask = no selection.

## Shape rules

- Ellipse Select uses the Ellipse tool's own rasteriser, filled.
- Lasso / polygon: every pixel the outline passes through, plus every
  pixel centre inside it (non-zero winding).
- Lasso click without drag: clears in New mode, otherwise nothing.
- Polygon: press places a corner, drag moves it; closes on the first or
  last corner again, or Enter. Escape or a tool switch drops it.

## Consumers

`js/selection-mask.js` (pure, tested) builds, combines, moves and outlines
masks. In `js/workspace.js`, `liftSelection` copies only the selected
pixels and `transformSelection` runs any `transform.js` region op on those
pixels and on the mask, so Move, flip, rotate, free rotate and align move
just the shape. Clipping, Delete, Cut/Copy use the mask. Select Content
selects the layer's exact pixels. The overlay draws non-rectangular masks
as SVG (fill + dashed edges).
