## MODIFIED Requirements

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
