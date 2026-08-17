## Purpose

Gives the tool rail's buttons the same subtle, iOS-26-style magnetic
reaction to pointer proximity as the top bar, so both icon-button rows in
the workspace read as one consistent, responsive surface.

## ADDED Requirements

### Requirement: Proximity-based pull on tool rail buttons
Every tool-selection button in `.tools-sidebar` (Move, Pencil, Eraser,
Bucket, Brush, Line, Rectangle, Selection, Hand, Eyedropper) SHALL react
to any pointer (mouse or Pencil) coming within 45px of the button's
center by translating up to 4.5px toward the pointer and scaling
smoothly from 1.0x at the radius edge up to 1.05x when the pointer is
directly over the button's center, easing back to rest once the pointer
moves back outside that radius - identical mechanics to
`topbar-magnetic-hover`'s proximity-based pull.

#### Scenario: Pointer approaches a tool rail button
- **WHEN** a pointer moves to within 45px of a tool rail button's
  center, from any direction
- **THEN** the button translates toward the pointer's position (up to
  4.5px at the radius edge, less as the pointer gets closer to center)
  and scales up smoothly (1.0x at the radius edge, growing to 1.05x as
  the pointer approaches the button's center)

#### Scenario: Pointer leaves proximity
- **WHEN** a pointer that was within 45px of a tool rail button moves
  beyond that radius, or leaves the document entirely
- **THEN** the button eases back to its resting position and scale via a
  CSS transition

#### Scenario: Every tool rail button participates
- **WHEN** a pointer approaches any of the 10 tool-selection buttons in
  `.tools-sidebar`
- **THEN** that button reacts the same way as every other tool rail
  button - no button is excluded

### Requirement: No glow or halo
The magnetic-hover reaction on tool rail buttons SHALL consist only of
translation and scale. It SHALL NOT render any glow, halo, or other
lighting effect around the button.

#### Scenario: Pointer hovers a tool rail button
- **WHEN** a pointer is within proximity of a tool rail button
- **THEN** no additional glow, halo, or box is rendered around the
  button - only its own translate/scale changes
