## Purpose

Gives the top bar's buttons a subtle, iOS-26-style magnetic reaction to
pointer proximity, so the toolbar reads as a single cohesive, responsive
surface rather than a set of static hit targets.

## ADDED Requirements

### Requirement: Proximity-based pull on top bar buttons
Every enabled button in `.workspace-topbar` SHALL react to any pointer
(mouse or Pencil) coming within 45px of the button's center by
translating up to 4.5px toward the pointer and scaling smoothly from
1.0x at the radius edge up to 1.05x when the pointer is directly over
the button's center, easing back to rest once the pointer moves back
outside that radius.

#### Scenario: Pointer approaches a top bar button
- **WHEN** a pointer moves to within 45px of an enabled top bar button's
  center, from any direction
- **THEN** the button translates toward the pointer's position (up to
  4.5px at the radius edge, less as the pointer gets closer to center)
  and scales up smoothly (1.0x at the radius edge, growing to 1.05x as
  the pointer approaches the button's center)

#### Scenario: Pointer leaves proximity
- **WHEN** a pointer that was within 45px of a top bar button moves
  beyond that radius, or leaves the document entirely
- **THEN** the button eases back to its resting position and scale via a
  CSS transition

#### Scenario: Every top bar button participates
- **WHEN** a pointer approaches any enabled button in `.workspace-topbar`
  (Gallery, Pixel-perfect, Layers, Canvas Settings, Export, Undo, Redo,
  Right panel toggle)
- **THEN** that button reacts the same way as every other enabled top bar
  button - no button is excluded

### Requirement: Exclusive activation
At most one top bar button SHALL be magnetic-active at a time. When a
pointer is within range of more than one button (their 45px radii
overlap), only the nearest in-range button SHALL react; every other
button SHALL be at rest, even one that is itself still within its own
45px radius.

#### Scenario: Pointer moves from one button's range into a closer button's range
- **WHEN** a pointer that was activating button A moves to a position
  that is within button B's 45px radius and closer to B than to A (A and
  B are adjacent, overlapping-radius top bar buttons)
- **THEN** button A immediately returns to rest (no translate/scale) and
  button B becomes the active, reacting button

#### Scenario: Pointer is in range of two buttons at once
- **WHEN** a pointer position falls within the 45px radius of two
  top bar buttons simultaneously
- **THEN** only the button whose center is closer to the pointer reacts;
  the farther button stays at rest

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
