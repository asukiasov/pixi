# Pencil, Transform and View rotation Implementation Plan

**Goal:** Palm rejection, a Transform popover (rotate/flip/align), view
rotation. Design: `docs/superpowers/specs/2026-10-12-pencil-and-transform-design.md`.
Each part ends with green `npm test`, a browser check and its own commit.

## Part A — Palm rejection

### Task A1: `js/pointer-policy.js` (TDD)
- `test/pointer-policy.test.js` first. `classifyPointerDown(...)`:
  - pencilOnly off → today's rules (first pointer draws, second gestures).
  - pen → `draw`; marks pen seen.
  - pencilOnly on, pen not yet seen → touch behaves as today.
  - pen seen, touch, pen down → `ignore`.
  - pen seen, first touch → `ignore` for drawing but kept as a candidate;
    second touch (no pen down) → `gesture`.
  - mouse → always today's rules.
- Implement.

### Task A2: CanvasView
- Track `#penSeen`, `#penDown`, a separate `#ignoredPointers` set.
  `#onPointerDown/Move/Up` consult the policy: ignored pointers never
  enter `#pointers`, so they can't trigger `#beginPinch` or cancel a
  stroke. `setPencilOnly(bool)`.
- Reset `#penSeen` never within a session (a page reload resets it).

### Task A3: Pref + docs + verify
- `pencilOnly` (default `true`) in `js/prefs.js` + tests; Prefs row "Draw
  Only With Apple Pencil" with a note; `js/app.js` passes it to the
  CanvasView on load and change.
- Specs: `pixel-drawing-engine` "Touch and pointer interaction" gains the
  Pencil scenarios; `floating-workspace` Prefs list; `ui-reference`.
- Playwright: synthetic PointerEvents — pen stroke + touch down mid-stroke
  → stroke completes, no zoom; touch alone after pen → no pixels; two
  touches → zoom changes; pref off → old behaviour.

## Part B — Transform popover

### Task B1: `lib/pixel-engine/transform.js` (TDD)
- `lib/pixel-engine/transform.test.js` first, on small hand-checked
  grids: `flipRegion(h|v)`, `rotateRegion180`, `rotateRegion90(cw|ccw)`
  (square and 3×2 regions; new rect centred, w↔h; out-of-canvas pixels
  dropped; vacated area transparent; 4× cw = identity for a square),
  `contentBounds` (empty → null), `alignOffset(bounds, canvas, edge)` for
  all six edges incl. odd remainders.
- Implement; document in `lib/pixel-engine/README.md`.

### Task B2: Workspace hook
- `js/workspace.js`: `applyLayerTransform(fn)` — refuses on the reference
  layer, backs up, runs `fn` on the active layer's data with the target
  rect (selection or whole canvas), updates `state.selection` /
  overlay from the returned rect, `render()`, `commit()`.

### Task B3: Popover UI
- `index.html`: `#transform-button` (glyph `transform`, add to
  `icon_names`) in `.topbar-group`; `#transform-popover` with the two
  labelled rows (icons: `rotate_left`, `rotate_right`, `flip` +
  rotated variant, `align_horizontal_left/center/right`,
  `align_vertical_top/center/bottom`), title "Transform Layer" /
  "Transform Selection".
- `js/transform-ui.js`: open/close (same clamped popover helper as Canvas
  Settings, Escape/outside closes), button → workspace hook, disabled
  states (reference layer; align when content empty or Background).
- CSS in `style.css`, 44px targets.

### Task B4: Docs + verify
- New spec `docs/specs/layer-transform/spec.md`; `ui-reference.md` top
  bar table.
- Playwright: draw an L shape, rotate/flip/align with and without a
  selection, compare pixels, undo each.

## Part C — View rotation

### Task C1: `js/view-transform.js` (TDD)
- `test/view-transform.test.js` first: `screenToLocal`/`localToScreen`
  round trip at 0/37/90/180/270°; `zoomAround` and `rotateAround` keep the
  anchor's local point fixed; `snapAngle` (within 6° of 90k snaps, else
  unchanged; normalises to [0, 360)); `rotatedBounds(w, h, θ)`.
- Implement.

### Task C2: CanvasView rotation
- `#rotation` (degrees). `#applyTransform` emits
  `translate() rotate() scale()`. `#toGridPoint` uses `screenToLocal`.
  `#zoomAroundPoint` and the presets use the helpers; Fit/Fill use
  `rotatedBounds`. `#beginPinch/#updatePinch` track the angle between the
  two pointers and rotate around the midpoint; snap on release.
  `gesturechange` → rotate (Safari). Public `rotateBy(deg)`,
  `resetRotation()`, `getRotation()`; `onZoomChange` also reports angle.
- Check every other `getBoundingClientRect()` use in canvas-view for
  rotation assumptions.

### Task C3: Menu + readout
- Zoom menu: Rotate View Left/Right, Reset Rotation (`data-keep-open` on
  the rotate items). Zoom pill readout "N% · θ°" when θ ≠ 0.
- Resetting on project open (`resetView`).

### Task C4: Docs + verify
- `canvas-navigation` spec: View rotation requirement + scenarios.
  `ui-reference` zoom menu.
- Playwright at 90°/180°/37°: click a pixel → the right pixel is painted;
  brush cursor and selection overlay line up; selection bar placed
  sensibly; Fit fits; Reset Rotation restores.

## Wrap-up
- `npm test`, code review, roadmap + feature-ideas updates, push.
- Ask the user to try Part A and C on the real iPad — synthetic events
  can't prove palm behaviour or Pencil hover.
