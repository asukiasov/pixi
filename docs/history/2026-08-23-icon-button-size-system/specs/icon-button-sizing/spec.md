## Purpose

Defines a shared, named icon-button size scale (XS–XL) that every icon-only
control in Pixi is sized from, and the rule that a container assigning a
size to its icon buttons must not let them (together with any adjacent
label) force horizontal overflow at the sidebar's normal width.

## ADDED Requirements

### Requirement: Icon button size scale
The system SHALL expose a five-step icon-button size scale (XS, S, M, L,
XL) as shared, reusable CSS values that any icon-only button's width and
height are assigned from, instead of ad hoc per-component fixed values.

#### Scenario: Icon button sized from the scale
- **WHEN** a component styles an icon-only button's dimensions
- **THEN** its width and height resolve to one of the five defined scale
  steps (XS/S/M/L/XL), not a one-off literal value

#### Scenario: Unmodified default resolves to XL
- **WHEN** an icon button uses the base `.icon-button` styling with no
  context-specific size override
- **THEN** it renders at the XL step, matching its size prior to this
  change (2.6rem)

### Requirement: Crowded containers stay within the sidebar without horizontal scroll
Any group of icon buttons (optionally alongside a text label) that sits
inside `.right-sidebar` SHALL fit within the sidebar's normal clamped width
without relying on horizontal scrolling to reach any control.

#### Scenario: Color Library header actions fit without horizontal scroll
- **WHEN** the Color Library panel is rendered at the right sidebar's
  normal clamped width
- **THEN** all of its header's icon buttons (new/import/add/delete
  controls) and the "COLOR LIBRARY" label are visible or legibly truncated
  without the header requiring horizontal scrolling to reach any button

#### Scenario: Reference image layer row fits without horizontal scroll
- **WHEN** a reference image layer's row is rendered in the Layers panel
  at the right sidebar's normal clamped width
- **THEN** its visibility toggle, thumbnail, name field, lock icon,
  smoothing toggle, and reorder/delete buttons are all visible or reachable
  (via wrapping, not horizontal scroll) without any control being hidden
  off-screen
