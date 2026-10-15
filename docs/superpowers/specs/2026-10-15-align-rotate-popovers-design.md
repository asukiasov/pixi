# Align and Rotate popovers - design

Replaces the single Transform popover
(`2026-10-12-pencil-and-transform-design.md`, part B) with two top-bar
buttons, Align and Rotate. Rotate gains a dial (bezel) for free-angle
rotation, resampled with RotSprite.

## 1. Top bar

`#transform-toggle` is removed. In its place, inside `.topbar-group` and
before Undo/Redo, sit two buttons:

- **Align**: `#align-toggle`, glyph `align_horizontal_center`, opens
  `#align-panel`.
- **Rotate**: `#rotate-toggle`, glyph `rotate_right`, opens
  `#rotate-panel`.

Both popovers use the existing anchoring (below the toggle, clamped to
the viewport) and close on their close button, Escape, or a press
outside. Only one is open at a time: opening one closes the other.

## 2. Align popover

The title is "Align Layer", or "Align Selection" while a selection
exists. It has the same six buttons as today in two rows (left, centre,
right / top, middle, bottom). The rules are unchanged: each action is one
undo step, the buttons are disabled when the target has no
non-transparent pixels or is the Background layer without a selection,
and an align that moves nothing adds no undo step.

## 3. Rotate popover

The title is "Rotate Layer", or "Rotate Selection" while a selection
exists.

```
  Rotate Layer            ✕
          ╭───●───╮
   [↶]    │   0°  │    [↷]
          ╰───────╯
       [⇆ Flip H] [⇅ Flip V]
     [ Reset ]   [ Apply ]
```

- **Dial.** A round bezel with a knob dot on its rim and the angle readout
  in the centre (for example `0°`, `-45°`). Dragging anywhere on the dial
  turns it: the angle follows the pointer's angle around the dial's
  centre, relative to where the drag started. The angle ranges from -180°
  to 180° and wraps. It snaps to a 15° multiple whenever it comes within
  3° of one. The dial is `role="slider"` with `aria-valuemin=-180`,
  `aria-valuemax=180`, `aria-valuenow` and `aria-valuetext` such as
  "45 degrees". The arrow keys change it by 1° and Shift+arrows by 15°.
  Positive angles turn clockwise.
- **↶ / ↷** (Rotate 90° left / right) change the dial's angle by -90° /
  +90°, wrapping. They preview the change; they don't apply it.
- **Flip horizontal / Flip vertical** apply immediately, as one undo step
  each, exactly as today. They're disabled while a rotation is pending
  (the angle isn't 0°).
- **Reset** sets the angle back to 0° and restores the original pixels.
  **Apply** commits the rotation as one undo step, then sets the dial back
  to 0° and keeps the popover open. Both are disabled at 0°.
- **Closing** the popover (✕, Escape, a press outside, a workspace reset)
  with a rotation pending cancels it: the original pixels and selection
  come back and nothing is committed.
- Every control is disabled for the reference image layer or a locked
  layer, as today.

### Live preview

The preview is drawn into the active layer itself, so what you see is
what Apply commits.

- When the angle first leaves 0°, the workspace snapshots the target
  region's pixels and the selection.
- While dragging (and on each arrow-key step), it restores the snapshot
  and draws a **nearest-neighbour** rotation of it (fast).
- On pointer release, on a key press that ends a run of steps, and on the
  ↶ / ↷ buttons, it redraws with **RotSprite** at the current angle.
- Apply commits whatever the last RotSprite draw produced. If a drag is
  still in progress, it runs RotSprite first.
- Angles that are a multiple of 90° use the existing exact
  `rotateRegion` (lossless) rather than RotSprite, both in the preview and
  on Apply.

## 4. Pixel rules (free angle)

- The target is the selection if there is one, otherwise the whole active
  layer.
- Its content turns about the target's centre. The result occupies the
  box around the rotated shape, centred on the same point (rounding
  down).
- Pixels landing off the canvas are lost; Undo restores them.
- The part of the original target area that the rotated content doesn't
  cover becomes transparent.
- With a selection, the selection becomes the result's box, clamped to
  the canvas. If that leaves nothing on the canvas, the selection clears
  (as today).
- The rotated result adds no new colours: every output pixel is either
  transparent or a colour from the source.
- An angle of 0° is a no-op and is never committed.

## 5. RotSprite

New `lib/pixel-engine/rotsprite.js`. Its functions are pure, take RGBA
`Uint8ClampedArray`s, and need no DOM.

- `scale2x(data, w, h)` → `{ data, width: 2w, height: 2h }`: the EPX /
  Scale2x rule, comparing whole RGBA pixels.
- `rotateNearest(data, w, h, degrees)` → `{ data, width, height }`: an
  inverse-mapped nearest-neighbour rotation about the centre. The output
  size is the rotated bounding box (`ceil` of `|w cos| + |h sin|`, and so
  on). Samples that fall outside the source are transparent.
- `rotSprite(data, w, h, degrees)` → `{ data, width, height }`:
  1. Run `scale2x` three times (8×).
  2. `rotateNearest` the 8× image.
  3. Downsample by 8, taking the **centre sample** of each 8×8 cell
     (the standard RotSprite downsample). Its output size matches
     `rotateNearest` at 1×.

`lib/pixel-engine/transform.js` gets
`rotateRegionFree(engine, rect, degrees, { quality })` →
`{ rect, data }`. It reads the region, rotates it (`'fast'` = nearest,
`'smooth'` = RotSprite), clears the source region, and writes the result
centred on the original centre, clipped to the canvas. It returns the
unclamped result rect, which the caller clamps.

Performance budget: 128×128 at 8× is 1024×1024, about 1M pixels per
nearest pass. That's acceptable on release but not per drag frame, which
is why drag frames use nearest at 1×.

## 6. Code layout

- `lib/pixel-engine/rotsprite.js` (+ `rotsprite.test.js`): the pure
  resampling.
- `lib/pixel-engine/transform.js`: `rotateRegionFree`.
- `js/rotate-dial.js` (+ test): pure helpers `angleFromPointer(cx, cy,
  x, y)`, `snapAngle(deg)` and `wrapAngle(deg)`, plus `initRotateDial(el,
  onInput, onCommit)`, which handles the pointer capture and keys.
- `js/workspace.js`: `beginRotatePreview()`,
  `previewRotate(degrees, quality)`, `applyRotate()`, `cancelRotate()`.
  `transformActiveLayer` stays for flip and align.
- `js/transform-ui.js`: wires both popovers (Align and Rotate) and their
  mutual exclusion. It keeps its file name.
- `index.html` / `css/`: the two toggles, the two panels, and the dial
  styles (a glass ring, a knob dot, the readout in the app's
  tabular-number style).

## 7. Testing

- Unit tests:
  - `scale2x` on known 3×3 patterns.
  - `rotateNearest` at 0°/90°/180° matches `rotateRegion`, and gives the
    expected output size at 45°.
  - `rotSprite` adds no new colours, and a 0° rotSprite equals its input.
  - `snapAngle` snaps within 3° and leaves other angles alone;
    `wrapAngle` wraps.
  - `rotateRegionFree` keeps the result centred and clips at the canvas.
- Browser check, on the local server: drag the dial, Reset, Apply (one
  undo step), cancel on close, a selection that follows the rotation, and
  keyboard control of the slider.

## 8. Docs

In this branch, update `docs/specs/layer-transform/spec.md` (Align and
Rotate popovers, the dial, free-angle rules, preview and cancel),
`docs/ui-reference.md` and `docs/roadmap.md`.

## Decisions

1. Two popovers, Align and Rotate, replace Transform.
2. Free angle, snapping to 15° marks.
3. RotSprite resampling; nearest-neighbour only as the drag preview.
4. Rotate previews, with Reset / Apply; closing cancels.
5. Flips stay in Rotate, apply immediately, and are disabled while a
   rotation is pending.
