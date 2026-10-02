## MODIFIED Requirements

### Requirement: Color Library sequence mode (Pencil and Brush)
The Pencil tool and the Brush tool SHALL share one Color Library
sequence toggle (an explicit on/off control, the same "toggle"
interaction as Rectangle's Filled control — not tied to which regular
color is currently selected, and distinct from Rainbow's palette-entry
selection model). It is a single on-screen control in the tool options
area, shown while Pencil or Brush is the active tool and hidden for
every other tool, driving one on/off state that persists across switches
between Pencil and Brush. Revised from this requirement's original
Pencil-only scope, once "Brush should have the same functionality as
Pencil" was requested directly, and later consolidated from one control
per tool's panel into this single shared control (AUD-12).
While enabled, each unique pixel placed along a Pencil stroke, or each
brush placed (single tap or dragged trail) with the Brush tool, SHALL
use the next color in the active Color Library palette's color list
(from `2f-color-library-panel`), cycling in list order and wrapping
around, respecting Pencil's Size and Opacity (for Pencil) exactly as
Rainbow does. It is mutually exclusive with Rainbow: enabling one turns
the other off. If the active palette has no colors, Pencil/Brush fall
back to the plain foreground color as if the toggle were off. Eraser,
Line, and every other tool are unaffected regardless of this toggle's
state.

#### Scenario: Drawing with the Color Library sequence enabled
- **WHEN** the toggle is on and the user draws a Pencil stroke, or places
  brushes with the Brush tool (single tap or dragged trail)
- **THEN** consecutive unique pixels (Pencil) or consecutive brush
  placements (Brush) use consecutive colors from the active palette, in
  list order, wrapping around

#### Scenario: Enabling it turns off Rainbow, and vice versa
- **WHEN** the user enables the Color Library sequence while Rainbow is
  selected (or selects Rainbow while the sequence is enabled)
- **THEN** the other mode turns off, so exactly one (or neither) is active
  at a time

#### Scenario: Toggling off returns to the plain foreground color
- **WHEN** the user turns the toggle off
- **THEN** Pencil/Brush go back to drawing with the current foreground
  color, unaffected by which palette was active

#### Scenario: Empty active palette falls back gracefully
- **WHEN** the toggle is on but the active Color Library palette has no
  colors
- **THEN** Pencil/Brush draw with the plain foreground color instead of
  failing or drawing nothing

#### Scenario: Toggling in one tool's panel is reflected in the other's
- **WHEN** the user turns the toggle on while Brush is active, then
  switches to the Pencil tool
- **THEN** the same toggle is still shown and still enabled - one
  control and one shared state, not two independent ones

#### Scenario: Not shown for Eraser
- **WHEN** the Eraser (or any tool other than Pencil and Brush) is
  active
- **THEN** no Color Library sequence toggle is shown
