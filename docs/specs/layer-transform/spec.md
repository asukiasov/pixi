# layer-transform Specification

## Purpose

Rotate, flip and align the pixels of the active layer, or of the current
selection, from a Transform popover - the per-layer counterpart to Canvas
Settings' Rotate, which turns the whole canvas. Pixel work lives in
`lib/pixel-engine/transform.js`; the popover is `js/transform-ui.js`.

## Requirements

### Requirement: Transform popover
The top bar SHALL offer a Transform button that opens a popover with two
labelled groups: Rotate & Flip (Rotate 90° left, Rotate 90° right, Rotate
180°, Flip horizontal, Flip vertical) and Align to Canvas (left, centre,
right, top, middle, bottom). Its title SHALL say what it acts on:
"Transform Selection" while a selection exists, otherwise "Transform
Layer". It SHALL stay open between actions and close on its close button,
Escape, or a press outside it. Every action SHALL be one undoable step.

#### Scenario: Title follows the target
- **WHEN** the user opens Transform with no selection
- **THEN** the title is "Transform Layer"; with a selection it is
  "Transform Selection"

#### Scenario: Reference image layer
- **WHEN** the active layer is the reference image layer
- **THEN** every Transform action is disabled

### Requirement: Rotate and flip
Flips SHALL mirror the target's pixels in place. Rotate 180° SHALL turn
them in place. A 90° rotation SHALL turn the target about its centre,
swapping its width and height; the turned area SHALL be centred on the
same point (rounding down), pixels landing off the canvas SHALL be lost
(Undo restores them), and the area the content left SHALL become
transparent. With a selection, the selection SHALL become the turned
area, clamped to the canvas.

#### Scenario: Flip a layer
- **WHEN** the user taps Flip horizontal with no selection
- **THEN** the whole active layer is mirrored left to right

#### Scenario: Rotate a selection
- **WHEN** a 6x8 selection is active and the user taps Rotate 90° left
- **THEN** its content turns a quarter left about the selection's centre
  and the selection becomes the 8x6 area it now occupies

#### Scenario: Four quarter turns
- **WHEN** the user rotates a square target 90° right four times
- **THEN** the pixels are back where they started

### Requirement: Align to canvas
Align SHALL move the target's content so the box around its
non-transparent pixels touches the chosen canvas edge, or is centred on
the canvas (an odd remainder rounds down). Without a selection the whole
layer moves; with one, the selection's contents move and the selection
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
