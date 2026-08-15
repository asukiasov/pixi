## Context

See proposal.md for motivation. Building on `js/engine.js` (`PixelEngine`),
`js/layers.js` (`LayerStack`/`Layer` — unchanged, Move operates on the
active layer's engine only, exactly like every other tool), and
`js/workspace.js`'s existing "backup the active layer's buffer at drag
start, redraw fresh from the backup on every move, commit on release"
pattern already established by Pencil's pixel-perfect mode and generalized
by `2c1` for Line/Rectangle (`drawShapePreview()`) and Brush
(`redrawBrushPath()`). `2c1`'s Selection tool already has the "clear a
rect to transparent" half of Move, in the selection Delete button's
handler; Move needs that plus "and re-stamp the extracted pixels
elsewhere."

## Goals / Non-Goals

**Goals:**
- Move content on the active layer only — with a selection, just the
  selected rect; with none, the whole layer.
- Live preview while dragging, same feel as Line/Rectangle.
- One drag = one undo step.
- No change to `engine.js`'s existing, tested methods.

**Non-Goals:**
- Cross-layer move, copy-drag (duplicate), arrow-key nudge.
- Non-rectangular selections (selections are rectangle-only; unchanged by
  this slice).
- Any change to how a selection is *made* (Selection tool, `M`, is
  untouched) — this only adds what happens when Move (`V`) drags existing
  selected or unselected content.

## Decisions

**Scope: selection-scoped when one exists, whole-layer otherwise, and
Move always operates on the current selection regardless of where the
drag starts.** Three options were on the table:
1. Move only works within an active selection (no selection = no-op).
2. No selection = whole layer moves; with a selection, Move only picks it
   up if the drag *starts* inside it — starting outside falls through to
   moving the whole layer (or is a no-op).
3. No selection = whole layer moves; with a selection, Move always
   operates on it, no matter where the drag starts (chosen).

(1) breaks the documented Photoshop-parity behavior this tool is explicit
about matching ("Move with no selection moves the whole layer"), so it's
out. (2) is more "faithful" to Photoshop in one narrow sense (Photoshop's
Move *can* pick up a different layer's content depending on where you
click, in Auto-Select mode) but this app has no such multi-target
ambiguity — there is exactly one active layer and at most one selection,
so "where inside the canvas the drag starts" doesn't disambiguate
*anything* here the way it does in Photoshop's multi-layer canvas. Adding
that condition would only introduce a footgun: start a drag a few pixels
outside a small selection by mistake, and the whole layer silently moves
instead of the selection's content, with nothing in the UI to explain why
a click 2px away behaved completely differently. (3) removes that
ambiguity entirely — a selection existing is a strong, visible, persistent
signal (the marching-rect overlay) that scopes every other tool already
(pencil/eraser/bucket/brush/line/rectangle all clip to it per `2c1`), so
having Move key off the same signal, unconditionally, is the most
consistent choice and the one implemented.

**Source area becomes fully transparent — `[0,0,0,0]`, matching Delete's
existing convention.** Not "reveals the Background color" the way Eraser
does on a Background layer (`2g-background-layer`) — Move's source-clear
is pixel-data manipulation, not user-facing erasing, and mixing in
`2g`'s Background-layer exception here would make Move's result depend on
layer type in a way nothing else about Move does. If this surprises users
on a Background layer later, it's a small, easy follow-up (route Move's
`clearRegion` call through the same Background-aware color
`pencilOrEraserApplyPixel` uses) — not addressed in this slice.

**Extraction happens once, at drag start, from the pre-drag backup — not
re-extracted every move.** The dragged content itself never changes
during a drag, only its on-canvas position does. `state.moveContent`
(a compact `width*height*4` buffer from the new `extractRegion`) is
computed once in `onDrawStart` and reused by every `onDrawMove` and the
final `onDrawEnd`; `redrawMovePreview()` just resets the engine from
`state.strokeBackup`, clears the region's *original* footprint (via
`clearRegion`), and stamps `state.moveContent` at the offset position
(via `stampRegion`) — an O(region size) redraw per move, same cost
profile as Brush's O(path length) full-path redraw already accepted in
`2c1`.

**Engine gains three small, generic primitives instead of one
Move-specific method.** `extractRegion(x, y, width, height)` (out-of-
canvas source pixels read as transparent, not an error — mirrors how
`setPixel` silently drops out-of-canvas writes rather than throwing),
`clearRegion(x, y, width, height, rgba = [0,0,0,0])`, and
`stampRegion(x, y, width, height, buffer)` (bounds-checked per pixel via
the existing `setPixel`, so a moved region that partially drags off-canvas
just loses the off-canvas portion, silently — same clipping behavior
`placeBrush` already relies on at canvas edges). None of them are
Move-specific in name or implementation; keeping them generic composable
region operations (rather than a single `moveRegion(...)` method) matches
this codebase's existing style of small primitives in `engine.js`
composed by `workspace.js` (see `strokeFreehandThick` composing
`interpolatePath` + `circleOffsets`), and leaves room for a future tool
(e.g. copy-drag) to reuse `extractRegion`/`stampRegion` without a new
method.

**Selection rect translates with the moved content, applied once on
`onDrawEnd`, not live during the drag.** The overlay div (`canvas-
view.js`'s `setSelectionRect`) already redraws cheaply, but there's no
reason to recompute `state.selection`'s coordinates on every
`onDrawMove` when nothing reads `state.selection` mid-drag (Move doesn't
re-clip against it — see below) — only the pixel content's live preview
needs to track the pointer every move. On release, `state.selection` is
replaced with the same rect shifted by the drag's final `(dx, dy)`, and
`canvasView.setSelectionRect()` is called once to match, so a second
Move drag immediately afterward continues moving the same (now-relocated)
content, per the proposal.

**Move does not run `clipToSelection`.** Every other tool's operation can
spill outside the selection and gets clipped back (`2c1`'s
`clipToSelection`, restoring backup pixels outside the rect). Move is
different: when a selection is active, `state.moveRegion` *is* the
selection rect, and the whole point is to relocate that rect's content
to a *different* rect — clipping the result back to the *original*
selection bounds would undo the move entirely (every moved pixel is, by
definition, outside the original rect once it's moved). So Move's
`redrawMovePreview()` intentionally skips the `clipToSelection` step every
other committed operation runs.

**Cursor: plain CSS `cursor: move`, no custom SVG.** Unlike the Hand
tool's custom paw cursors (open/closed-hand isn't a native browser
keyword with the right semantics), `move` is a standard cursor keyword
every browser already renders as a four-way-arrow — exactly the visual
Photoshop's Move tool uses. `CanvasView` gets a `setMoveMode(enabled)`
method mirroring `setPanMode`, toggling a `.move-mode` class; no
`.moving`-style pressed-state variant is needed (unlike Hand's
grab/grabbing distinction) since `move` doesn't have a meaningfully
different "actively dragging" glyph.

**Shortcut `V`, icon `open_with`.** `V` matches Photoshop/Illustrator
exactly, per the ask, and isn't taken by any existing `data-shortcut`
(P/E/G/B/L/R/M/H/I). `open_with` (Material Symbols' four-way-arrow-cross
glyph) is the closest match in the icon set already used throughout this
app to Photoshop's Move tool glyph — no new icon library, just one more
name added to `index.html`'s existing subsetting `icon_names=` list.

## Risks / Trade-offs

- [Moving the whole layer with no selection is a big, easy-to-trigger
  operation (one drag moves everything) with no separate confirmation] →
  Matches Photoshop's actual behavior exactly (no confirmation there
  either); it's one undo step like everything else, so `Cmd/Ctrl+Z`
  recovers it same as any other mistake.
- [Redrawing the whole moved region from backup on every pointer-move is
  O(region size) per move] → Fine at these canvas sizes (≤256×256, same
  bound `2c1`'s design.md already accepted for Brush's O(path length)
  full redraw); a whole-128×128-layer move redraws at most 16,384 pixels
  per move event, well within a single frame budget.
- [Dragging a selection's content most of the way off-canvas silently
  drops the off-canvas portion, with no visual "this part will be lost"
  warning] → Same silent-clip behavior `placeBrush` and every other tool
  already has at canvas edges; consistent with existing app conventions,
  not a new kind of surprise.

## Testing

- `js/engine.js`: DOM-free, tested with `node --test` — `extractRegion`
  (in-bounds copy, out-of-canvas reads as transparent, correct buffer
  layout), `clearRegion` (fills a rect with transparent by default and
  with an explicit color), `stampRegion` (writes a buffer at an offset,
  bounds-clips pixels that land outside the canvas without throwing).
- Playwright smoke pass (as used for `2a`/`2c1`): draw with Pencil, switch
  to Move (button click, then `V` key), drag with no selection — confirm
  the whole layer's content shifted and the original area is transparent
  (`getImageData` sampling before/after at the original and new spot);
  make a selection, drag with Move — confirm only the selected region
  moved and pixels outside it on the same layer are untouched; confirm
  Undo reverts a move in one step; zero console errors throughout.
