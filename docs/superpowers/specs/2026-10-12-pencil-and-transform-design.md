# Pencil, Transform and View rotation — design

The "Medium" items from the iPad feedback
(`docs/feature-ideas/2026-10-12-ipad-feedback.md`). Plan:
`docs/superpowers/plans/2026-10-12-pencil-and-transform.md`. Three parts,
in this order: palm rejection first (the biggest everyday pain on iPad,
smallest change), then the Transform popover (rotate/flip/align, mostly
pure pixel functions), then view rotation (the riskiest: it touches every
screen-to-pixel conversion).

## A. Palm rejection — "Draw only with Apple Pencil"

**Problem today.** Every pointer is treated the same. A palm resting on the
screen while the Pencil draws is a second pointer, which `CanvasView`
treats as the start of a pinch: it **cancels the stroke** and zooms. A
palm alone draws a stray line.

**Behaviour.** Once an Apple Pencil (`pointerType: 'pen'`) has touched the
canvas in this session, Pixi switches to Pencil mode:

- Only the Pencil draws. A single finger (or palm) on the canvas does
  nothing — no drawing, no panning.
- While the Pencil is down, every touch pointer is ignored completely: it
  can't cancel the stroke, pan or zoom.
- Two fingers (with no Pencil down) still pinch-zoom and pan, so
  navigation is unchanged.
- Mouse input is unaffected.

Devices that never see a Pencil (phones, finger-only iPads, desktops) never
enter Pencil mode, so nothing changes for them.

**Pref.** "Draw Only With Apple Pencil" switch in Prefs → Drawing, **on**
by default (`pencilOnly: boolean` in `js/prefs.js`). Off restores today's
behaviour exactly. The switch is the opt-out; the "Pencil seen" detection
is what keeps it harmless on devices without a Pencil.

**Where.** All in `js/canvas-view.js`'s pointer handlers, driven by a pure
decision function in a new `js/pointer-policy.js` (unit-tested):
`classifyPointerDown({ pointerType, penSeen, penDown, pencilOnly,
touchCount })` → `'draw' | 'gesture' | 'ignore'`. CanvasView gets
`setPencilOnly(bool)`.

## B. Transform popover — rotate, flip, align

**Entry point.** A Transform button (glyph `transform`) in the top bar's
button group, opening a popover like Canvas Settings. Two rows:

- **Rotate & Flip**: Rotate 90° left, Rotate 90° right, Rotate 180°, Flip
  horizontal, Flip vertical.
- **Align**: Left, Centre, Right, Top, Middle, Bottom.

**Target.** The active selection if there is one, otherwise the whole
active layer. Disabled for the reference image layer. Each action is one
undo step (`commit()`), so it persists and undoes like any edit. This is
different from Canvas Settings' Rotate, which rotates the *canvas* (all
layers, swapping width/height); the popover says "Layer" or "Selection"
in its title so the difference is visible.

**Rotate/flip semantics.**
- Flips mirror the target region in place.
- Rotate 180° rotates in place.
- Rotate 90° turns the region about its centre. For a non-square region
  the result's bounds are the rotated rectangle (w↔h), centred on the same
  point, rounded down; pixels that land outside the canvas are lost (undo
  brings them back). With a selection, the selection rectangle becomes the
  rotated bounds (clamped to the canvas), so a second rotate turns the
  same content again. Without a selection on a non-square canvas, the
  layer rotates about the canvas centre and corners can be cut off — said
  in the scenario, not prevented.
- The area the content left becomes transparent, the same rule Move uses.

**Align semantics.** The "object" is the bounding box of the non-transparent
pixels of the target (layer, or the selection's contents). Align moves that
content so its box touches the canvas's left/right/top/bottom edge, or is
centred (odd remainder rounds down). Align targets the **canvas**, not the
selection: "align to the selection's own edges" would only shuffle pixels
inside the box you already drew. With a selection, the selected content
moves to the canvas edge and the selection moves with it (like Move). Empty target → buttons disabled. Background layer:
fully opaque, so its box is the canvas and every align is a no-op — the
buttons are disabled for it rather than doing nothing silently.

**Where.** New `lib/pixel-engine/transform.js`, pure functions over
`(data, width, height, rect)`: `flipRegion`, `rotateRegion180`,
`rotateRegion90(dir)` → `{ data, rect }`, `contentBounds`, `alignOffset`.
Unit-tested without a DOM. `js/transform-ui.js` wires the popover;
`js/workspace.js` exposes `applyTransform(fn)` that runs it on the active
layer with a backup, updates `state.selection`, renders and commits.

## C. View rotation

**Behaviour.**
- Two-finger twist rotates the **view** (not the pixels) around the pinch
  midpoint, together with the existing pinch zoom/pan. On release the
  angle snaps to the nearest multiple of 90° when within 6° of it.
- Mac trackpad rotate (Safari `gesturechange` `rotation`, already
  `preventDefault`ed today) rotates the same way.
- Zoom menu gets **Rotate View Left** / **Rotate View Right** (90° steps)
  and **Reset Rotation**. The zoom pill shows the angle when it isn't 0
  ("2100% · 90°").
- Fit / Fill / 100% keep the current rotation and fit the rotated canvas's
  bounding box; Reset Rotation goes back to 0° and refits.
- Rotation is view state like zoom: not saved with the project, reset when
  a project opens.

**Math.** The wrapper's transform becomes
`translate(pan) rotate(θ) scale(s)` (origin 0 0). Every screen→canvas
conversion goes through one pure function instead of
`getBoundingClientRect()` ratios, which break under rotation:

- `screenToLocal(p, view) = R(−θ)(p − container − pan) / s`, then
  `/ baseScale` and `floor` for the grid point.
- Zooming/rotating around a screen point keeps the local point under it:
  `pan' = p − container − R(θ')(local · s')`.
- Fit uses the rotated canvas's bounding box.

These live in a new `js/view-transform.js` (pure, unit-tested: round trip
screen→local→screen at several angles, zoom-around-point keeps the anchor,
rotate-around-point keeps the anchor, snapping, rotated fit box).
`CanvasView` keeps `#rotation` and uses them in `#toGridPoint`,
`#zoomAroundPoint`, `#updatePinch`, the presets and `#applyTransform`.
The selection overlay, brush cursor and tile copies are already inside the
wrapper, so they rotate with it; the selection action bar already places
itself from the overlay's on-screen box.

## Decisions taken (change any before building)

1. Pencil mode is **on by default** and only kicks in after a Pencil touch.
2. One finger does **nothing** in Pencil mode (no pan) — so a resting palm
   can't move the canvas. Two-finger pan still works.
3. Transform is a **top-bar popover**, rotate/flip and align together.
4. Align is to the **canvas**, using the content's pixel bounds.
5. View rotation snaps to 90° steps within **6°**, and is not saved.

## Out of scope

Two-finger tap to undo, Pencil double-tap, arbitrary-angle *pixel*
rotation (pixel art rotates badly at non-right angles), distributing
multiple layers, the Layers/colour redesigns.
