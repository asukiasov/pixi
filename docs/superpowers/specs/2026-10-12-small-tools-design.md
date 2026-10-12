# Small tools: Ellipse, Duplicate/Merge layer, Brush cursor — design

From the iPad feedback batch (`docs/feature-ideas/2026-10-12-ipad-feedback.md`,
"Small — tools and layers"). Three independent changes, one branch, one plan:
`docs/superpowers/plans/2026-10-12-small-tools.md`.

## 1. Ellipse tool

**What.** A shape tool next to Rectangle that draws an ellipse fitted to
the dragged bounding box. Same interaction as Rectangle:

- Drag from corner to corner; live preview; commit on release (one undo
  step).
- **Filled** toggle — the *same* toggle Rectangle uses. One shared "shapes
  are filled" setting, so switching between Rectangle and Ellipse keeps it.
  The tool-options group becomes `data-tools="rectangle ellipse"` and the
  tooltip text becomes "Filled shape".
- **Shift / 1:1 toggle** constrains to a circle (reuses
  `squareDragCurrent` / `isSquareConstrained`, so the 1:1 toggle group
  becomes `rectangle ellipse selection`).
- Respects the selection clip, Rainbow is *not* applied (Rectangle doesn't
  either).
- Auto-hides the interface while drawing, like Rectangle.

**Identity.** Tool id `ellipse`, label **Ellipse**, shortcut **O**
(free; V P E G B L R M H I are taken), Material Symbols glyph `circle`
(added to both font `icon_names` lists). Rail position: right after
Rectangle in `TOOL_IDS`. `normalizeRailTools` already puts a tool missing
from a stored rail into ⋯, so existing users find it in the overflow menu
and can pin it via Customize Tools; new users get it on the rail.

**Algorithm.** `drawEllipse(engine, x0, y0, x1, y1, rgba)` in
`js/shape-tools.js`, beside `drawRectangle`. Rasterize with Zingl's
bounding-box midpoint ellipse (`plotEllipseRect`), which handles even and
odd widths/heights exactly, so a 4×4 box gives a symmetric 4×4 circle
rather than a lopsided 5×5. Outline: plot the four mirrored points per
step. Filled: for each row, fill the horizontal span between the
outermost outline pixels of that row. Degenerate boxes:
1×N or N×1 → a straight line; 1×1 → one pixel; 2×2 → the four pixels.

Tested properties (DOM-free, `test/shape-tools.test.js`): stays inside the
bounding box; touches all four sides; 4-way symmetric; drag direction
doesn't matter; filled ⊇ outline and has no interior holes; outline is
closed and 8-connected with no doubled corners (pixel-art clean).

## 2. Duplicate layer + tappable Merge

**Duplicate.** `LayerStack.duplicateLayer(index)`:

- Inserts a copy directly above `index` and makes it active.
- Copies pixels, opacity, blend mode, visibility. New `id`. Name:
  `"<name> copy"` (Photoshop/Pixelmator convention).
- Duplicating the Background layer gives an ordinary (unlocked,
  `isBackground: false`) layer.
- Refused (returns `null`, stack unchanged) for a reference-image layer
  and at `MAX_LAYERS` (8).

UI: a **Duplicate layer** button in the Layers panel header beside Add
layer (glyph `content_copy`), disabled when refused; shortcut
**Cmd/Ctrl+J** (Photoshop). Goes through `commit()`, so it's one undo
step and is persisted like any other layer change.

**Merge.** Merge already exists but only as Cmd/Ctrl+E — unreachable on
iPad. Add a **Merge** button (glyph `merge`) next to Duplicate that calls
the existing `mergeMarkedOrActiveDown()`: merges the marked layers if two
or more are marked, else merges the active layer down. Disabled when
neither is possible (single layer / active is the bottom layer and nothing
is marked). Tooltip reflects which: "Merge down" or "Merge N layers".

Embeds (`lib/pixi.js`) get the same two buttons in their Layers panel
markup; wiring uses optional lookups so a host without them still works.

## 3. Brush cursor (Prefs)

**What.** While a mouse or Apple Pencil *hovers* the canvas (or draws), an
outline of exactly the pixels the next dab would paint, snapped to the
pixel grid:

| Tool | Footprint |
|---|---|
| Pencil, Eraser | `circleOffsets(pencilSize)` — the real tip |
| Brush | the current brush's pixels at its current rotation |
| Line, Rectangle, Ellipse, Bucket, Eyedropper | one pixel |
| Move, Select, Hand | none |

Touch (finger) input never shows it — there's no hover, and the finger
covers it anyway. Hidden during a two-finger pinch/pan and when the
pointer leaves the canvas. Pencil hover works on iPads with Pencil hover
support (Safari reports it as `pointermove` with `pointerType: 'pen'` and
no buttons pressed); elsewhere it shows while drawing.

**Look.** A two-tone outline (1px dark line with a 1px light line under
it, non-scaling stroke) tracing the footprint's outer edge, so it reads on
both light and dark pixels at any zoom. An SVG overlay inside the canvas
wrapper, like the selection overlay, so pan/zoom move it for free.

**Pref.** New `brushCursor: boolean` in `js/prefs.js`, **default on**,
a "Show Brush Cursor" switch in the Prefs sheet. Applied as
`data-brush-cursor="on|off"` on the Workspace screen; CSS hides the
overlay when off.

**Split.**
- `js/brush-cursor.js` (DOM-free, unit-tested): `cursorFootprint(tool,
  { pencilSize, brush, angle })` → cell offsets or `null`;
  `footprintOutlinePath(cells)` → an SVG path `d` string tracing the
  boundary edges (an edge is drawn where a cell's neighbour isn't in the
  set; collinear edges joined).
- `js/canvas-view.js`: an `onHover(point | null)` handler, fired from
  pointer moves of non-touch pointers whether or not they're pressed, and
  with `null` on leave / cancel / second pointer down. Plus
  `setCursorPath(d, at)` to position the overlay.
- `js/workspace.js`: `onHover` → footprint for the current tool → path →
  `setCursorPath`. Also refreshed on tool, size or brush change.

## Out of scope

Palm rejection, view rotation, and everything in the feature-ideas note's
Medium/Large sections. No change to Rectangle's behaviour beyond sharing
its Filled/1:1 controls.
