## MODIFIED Requirements

### Requirement: Proximity-based pull on top bar buttons
On iOS/iPadOS only, every enabled button in `.workspace-topbar` SHALL
react to a pointer (Apple Pencil or a touch-hover-capable pointer)
coming within 45px of the button's center by translating up to 4.5px
toward the pointer and scaling smoothly from 1.0x at the radius edge up
to 1.05x when the pointer is directly over the button's center, easing
back to rest once the pointer moves back outside that radius. On any
other platform (desktop mouse on Mac/Windows/Linux), no button in
`.workspace-topbar` SHALL react to pointer proximity at all.

#### Scenario: Pointer approaches a top bar button
- **WHEN** a pointer moves to within 45px of an enabled top bar button's
  center, from any direction, on iOS/iPadOS
- **THEN** the button translates toward the pointer's position (up to
  4.5px at the radius edge, less as the pointer gets closer to center)
  and scales up smoothly (1.0x at the radius edge, growing to 1.05x as
  the pointer approaches the button's center)

#### Scenario: Pointer leaves proximity
- **WHEN** a pointer that was within 45px of a top bar button moves
  beyond that radius, or leaves the document entirely, on iOS/iPadOS
- **THEN** the button eases back to its resting position and scale via a
  CSS transition

#### Scenario: Every top bar button participates
- **WHEN** a pointer approaches any enabled button in `.workspace-topbar`
  (Gallery, Pixel-perfect, Layers, Canvas Settings, Export, Undo, Redo,
  Right panel toggle) on iOS/iPadOS
- **THEN** that button reacts the same way as every other enabled top bar
  button - no button is excluded

#### Scenario: Mouse hover on a non-iOS platform
- **WHEN** a mouse pointer moves to within 45px of, or directly over, a
  top bar button's center on a non-iOS/iPadOS platform
- **THEN** the button does not translate or scale - it stays completely
  at rest
