# topbar-magnetic-hover Specification

## Purpose
Gives the top bar's buttons a subtle, iOS-26-style magnetic reaction to
pointer proximity, so the toolbar reads as a single cohesive, responsive
surface rather than a set of static hit targets.

## Requirements

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

### Requirement: Exclusive activation
At most one magnetic-hover button SHALL be active at a time, across the
top bar and tool rail together. When a pointer is within range of more
than one button - whether both are in the top bar, both in the tool
rail, or one in each - only the nearest in-range button SHALL react;
every other button SHALL be at rest, even one that is itself still
within its own 45px radius.

#### Scenario: Pointer moves from one button's range into a closer button's range
- **WHEN** a pointer that was activating button A moves to a position
  that is within button B's 45px radius and closer to B than to A (A and
  B are adjacent, overlapping-radius buttons, in the top bar, tool rail,
  or one in each)
- **THEN** button A immediately returns to rest (no translate/scale) and
  button B becomes the active, reacting button

#### Scenario: Pointer is in range of two buttons at once
- **WHEN** a pointer position falls within the 45px radius of two
  magnetic-hover buttons simultaneously, regardless of which container
  each belongs to
- **THEN** only the button whose center is closer to the pointer reacts;
  the farther button stays at rest

#### Scenario: A top bar button and a tool rail button are both in range
- **WHEN** a pointer position falls within the 45px radius of both a top
  bar button and a tool rail button at once
- **THEN** only the nearer of the two reacts; the other stays at rest -
  a top bar button and a tool rail button are never both active at the
  same time

### Requirement: No glow or halo
The magnetic-hover reaction SHALL consist only of translation and scale.
It SHALL NOT render any glow, halo, or other lighting effect around the
button.

#### Scenario: Pointer hovers a top bar button
- **WHEN** a pointer is within proximity of a top bar button
- **THEN** no additional glow, halo, or box is rendered around the
  button - only its own translate/scale changes

### Requirement: Disabled buttons do not react
A top bar button that is disabled (e.g. Undo/Redo before there is
undo/redo history) SHALL NOT react to pointer proximity.

#### Scenario: Pointer approaches a disabled button
- **WHEN** a pointer moves within 45px of a top bar button that is
  currently `disabled`
- **THEN** the button does not translate or scale

#### Scenario: Button becomes enabled while pointer is nearby
- **WHEN** a top bar button transitions from disabled to enabled (e.g.
  Undo becomes available after the first edit) while a pointer is
  already within its 45px radius
- **THEN** the button begins reacting to proximity from that point
  onward, without requiring the pointer to leave and re-enter the radius
