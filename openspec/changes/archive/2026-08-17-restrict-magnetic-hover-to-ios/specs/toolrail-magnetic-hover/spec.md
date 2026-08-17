## MODIFIED Requirements

### Requirement: Proximity-based pull on tool rail buttons
On iOS/iPadOS only, every tool-selection button in `.tools-sidebar`
(Move, Pencil, Eraser, Bucket, Brush, Line, Rectangle, Selection, Hand,
Eyedropper) SHALL react to a pointer (Apple Pencil or a touch-hover-
capable pointer) coming within 45px of the button's center by
translating up to 4.5px toward the pointer and scaling smoothly from
1.0x at the radius edge up to 1.05x when the pointer is directly over
the button's center, easing back to rest once the pointer moves back
outside that radius - identical mechanics to `topbar-magnetic-hover`'s
proximity-based pull. On any other platform (desktop mouse on
Mac/Windows/Linux), no tool rail button SHALL react to pointer
proximity at all.

#### Scenario: Pointer approaches a tool rail button
- **WHEN** a pointer moves to within 45px of a tool rail button's
  center, from any direction, on iOS/iPadOS
- **THEN** the button translates toward the pointer's position (up to
  4.5px at the radius edge, less as the pointer gets closer to center)
  and scales up smoothly (1.0x at the radius edge, growing to 1.05x as
  the pointer approaches the button's center)

#### Scenario: Pointer leaves proximity
- **WHEN** a pointer that was within 45px of a tool rail button moves
  beyond that radius, or leaves the document entirely, on iOS/iPadOS
- **THEN** the button eases back to its resting position and scale via a
  CSS transition

#### Scenario: Every tool rail button participates
- **WHEN** a pointer approaches any of the 10 tool-selection buttons in
  `.tools-sidebar` on iOS/iPadOS
- **THEN** that button reacts the same way as every other tool rail
  button - no button is excluded

#### Scenario: Mouse hover on a non-iOS platform
- **WHEN** a mouse pointer moves to within 45px of, or directly over, a
  tool rail button's center on a non-iOS/iPadOS platform
- **THEN** the button does not translate or scale - it stays completely
  at rest
