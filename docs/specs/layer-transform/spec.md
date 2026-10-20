---
title: "layer-transform specification"
description: "Rotating, flipping, and aligning the active layer or selection from the Align and Rotate popovers."
type: spec
status: active
---

# layer-transform Specification

## Purpose

Rotate, flip and align the pixels of the active layer, or of the current
selection, from the Align and Rotate popovers - the per-layer counterpart to Canvas
Settings' Rotate, which turns the whole canvas. Pixel work lives in
`lib/pixel-engine/transform.js`; the popovers are `js/transform-ui.js`,
the dial `js/rotate-dial.js`, RotSprite `lib/pixel-engine/rotsprite.js`.

## Requirements

### Requirement: Align and Rotate popovers
The top bar SHALL offer an Align button and a Rotate button, each opening
its own popover; opening one SHALL close the other. Align SHALL hold
Align left, centre, right, top, middle and bottom. Rotate SHALL hold a
rotation dial between Rotate 90° left and Rotate 90° right, Flip
horizontal and Flip vertical below it, and Reset and Apply. Titles SHALL
say what they act on: "Align Selection" / "Rotate Selection" while a
selection exists, otherwise "Align Layer" / "Rotate Layer". A popover
SHALL stay open between actions and close on its close button, Escape,
or a press outside it. Every align, flip and Apply SHALL be one undoable
step.

#### Scenario: Title follows the target
- **WHEN** the user opens Rotate with no selection
- **THEN** the title is "Rotate Layer"; with a selection it is
  "Rotate Selection"

#### Scenario: Reference image layer
- **WHEN** the active layer is the reference image layer or locked
- **THEN** every Align and Rotate control is disabled

### Requirement: Rotation dial
The dial SHALL set an angle in whole degrees from -180 to 180, positive
clockwise, by dragging around its centre, or with the arrow keys (1°;
Shift, 15°; Home, 0°). It SHALL snap to a multiple of 15° within 3° of
it. Rotate 90° left and right SHALL change the angle by 90° without
applying it. While the angle is not 0° the target SHALL show the
rotation, and the flips SHALL be disabled. Apply SHALL commit it as one
undo step and return the dial to 0°. Reset SHALL restore the pixels and
selection and return the dial to 0°. Closing the popover, Undo or Redo
with a rotation pending SHALL do the same as Reset.

#### Scenario: Cancel by closing
- **WHEN** the user turns the dial to 30° and presses Escape
- **THEN** the layer is as it was and no undo step was added

#### Scenario: Snap
- **WHEN** the user drags the dial to 43°
- **THEN** it reads 45°

### Requirement: Rotate and flip
Flips SHALL mirror the target's pixels in place. A rotation SHALL turn
the target about its centre; the turned content SHALL fill the box
around it, centred on the same point (rounding down). Quarter turns SHALL
be exact (a 90° turn swaps width and height). Other angles SHALL be
resampled with RotSprite and SHALL add no colours that weren't in the
target; transparent pixels of the result SHALL NOT overwrite what's
under them. Pixels landing off the canvas SHALL be lost (Undo restores
them), and the area the content left SHALL become transparent. With a
selection, the selection SHALL become the turned area, clamped to the
canvas.

#### Scenario: Flip a layer
- **WHEN** the user taps Flip horizontal with no selection
- **THEN** the whole active layer is mirrored left to right

#### Scenario: Rotate a selection
- **WHEN** a 6x8 selection is active and the user taps Rotate 90° left, then
  Apply
- **THEN** its content turns a quarter left about the selection's centre
  and the selection becomes the 8x6 area it now occupies

#### Scenario: Four quarter turns
- **WHEN** the user rotates a square target 90° right four times
- **THEN** the pixels are back where they started

#### Scenario: Free angle
- **WHEN** the user applies 45° to a selection holding one pixel
- **THEN** that pixel stays where it was, nothing else on the layer
  changes, and the selection grows to the rotated box

### Requirement: Align to canvas
Align SHALL move the target's content so the box around its
non-transparent pixels touches the chosen canvas edge, or is centred on
the canvas (an odd remainder rounds down). Without a selection the whole
layer moves; with one, the selection's contents (only its selected
pixels, for a non-rectangular one) move and the selection
moves with them, like the Move tool. Align SHALL be disabled when the
target has no non-transparent pixels, and for the Background layer
without a selection (its content always fills the canvas). An align that
moves nothing SHALL NOT add an undo step.

#### Scenario: Align a layer right
- **WHEN** a layer's only content is a 4px-wide shape at x 4-7 on a 32px
  canvas and the user taps Align right
- **THEN** the shape is at x 28-31, unchanged otherwise

#### Scenario: Centre with an odd remainder
- **WHEN** a 4px-wide shape is centred on a 31px-wide canvas
- **THEN** it starts at x 13

#### Scenario: Align a selection
- **WHEN** a selection is active and the user taps Align left
- **THEN** the selected content moves so its leftmost pixel is at x 0,
  and the selection moves by the same amount
