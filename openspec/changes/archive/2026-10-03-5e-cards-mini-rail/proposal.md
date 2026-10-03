## Why

In the floating layout the right side is still the docked sidebar dropped
onto the canvas. It is one tall glass card holding Color Library, Brushes
and Layers, and two top bar buttons control it:

- The Layers toggle collapses the Layers section to its header.
- The right-sidebar toggle hides or shows the whole card.

So the user can't keep Layers open and drop Colors, except by collapsing
Colors to a header strip that still takes space. The top bar also still
carries two buttons that 5b kept only "until 5e".

5e is the next roadmap step (`openspec/roadmap.md`, Phase 5). It adds the
target layout's right side: a mini-rail of Colors / Brushes / Layers icons
against the right edge, each opening its own floating card, with open
cards stacking down the edge.

## What Changes

All of this applies only in the floating layout (`?layout=floating`).
The docked layout and `Pixi.mount()` embeds look and work as before.

- **Mini-rail**: a slim vertical rail of three 44px icons, Colors,
  Brushes and Layers, against the right edge just below the top bar. It
  is only as tall as its icons. Each icon shows whether its card is open.
- **One card per panel**: Color Library, Brushes and Layers each become
  their own glass card. Open cards stack in one column beside the
  mini-rail (toward the canvas), in today's order: Colors, Brushes,
  Layers. The column ends above the bottom screen edge. When the open
  cards don't fit, they share the height and each scrolls inside itself.
  Card headers stay visible.
- **Open or closed, no collapse-to-header**: in the floating layout a
  card is either open or closed. The header's collapse chevron becomes a
  close (×) button. Pressing a mini-rail icon opens or closes its card.
  The existing per-panel collapsed state is that open/closed state, so
  nothing is stored twice.
- **Brushes card follows the Brush tool**: as today, the Brushes card is
  shown only while the Brush tool is active. The user can now close it,
  and it stays closed when they switch tools and come back, until they
  reopen it or open a project. With any other tool the Brushes icon is
  unavailable, and its tooltip says it is for the Brush tool. The card
  holds the brush grid and brush editor. 5d already moved Spacing and
  Rotation out.
- **Defaults per project open**: when a project opens, Colors and Layers
  are open, and Brushes is open (shown with the Brush tool). The
  open/closed state is not remembered across project opens or reloads.
  Remembering it is 5g's pinned-cards preference.
- **Top bar loses its last two panel buttons**: the Layers toggle and
  the right-sidebar toggle are no longer shown in the floating top bar.
  It becomes Back, title, zoom pill, Undo, Redo, More. The right-sidebar
  toggle has no floating replacement: each card closes on its own, and
  Hide interface still hides everything.
- **No canvas movement**: opening, closing or stacking cards does not
  move or re-fit the canvas. Fit at project open fits beside the
  mini-rail and the cards open at that moment.

Not in 5e: selection actions (5f); Prefs for pinned cards, open mode,
handedness and auto-hide (5g); switching the floating layout on by
default (5h); the palette merge (5i); phone widths.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `floating-workspace`:
  - Adds requirements for the panel mini-rail, the panel cards (open and
    close, stacking and shared height), the Brushes card's Brush-tool
    scoping, the per-open defaults, and their accessibility.
  - Modifies "Full-screen canvas with floating regions", "Placement
    slots" and "Fit to the clear area": the right sidebar becomes the
    mini-rail plus a column of cards in the `panels` slot.
  - Modifies "Slim top bar": the Layers and right-sidebar toggles leave
    the top bar. That ends the "until a later change" clause that 5b and
    5d left.
  - Modifies "Tool-options bar sits above the palette card" (added by
    5d): the bottom cards stay clear of the mini-rail and panel cards
    rather than "the right sidebar".

This delta assumes `5d-tool-options-bar` is archived first. Its MODIFIED
requirements are written against the 5d versions of "Full-screen canvas
with floating regions", "Placement slots", "Slim top bar" and "Tool-options
bar sits above the palette card".

`layers`, `color-library` and `brushes` are not modified. They describe
the docked sidebar, which is still the default. Each panel's own
collapse behaviour there is unchanged. `floating-workspace` states how the
same panels behave as floating cards, the same way 5b and 5d handled the
controls they moved. 5h updates those specs when the docked layout is
removed.

## Impact

- `index.html`:
  - a new `.floating-only` mini-rail (`#panel-rail`) in the `panels` slot,
    next to `#right-sidebar`
  - a `.floating-only` close button in each of the three card headers
  - `lib/pixi.js` gets no new markup, because embeds are always docked
- New `js/panel-rail.js`, wired once from `js/app.js` in the floating
  layout only. Rail icons and close buttons forward to the existing
  controls: `#color-library-header`, `#layers-panel-toggle` and the new
  Brushes open state. Each icon's state is mirrored back from its card.
- `js/workspace.js`: a small `setBrushesCardOpen()` that owns the Brushes
  card's closed flag (a `.collapsed` class, matching the other two
  panels), resets it on project open, and closes the brush editor when
  the card closes. `bindTooltips` gets a case for the mini-rail. The
  docked layout never sets the class.
- `style.css`: floating-only rules. `#right-sidebar` becomes a
  see-through column whose sections are the glass cards. A closed card
  is not displayed. There are rules for the mini-rail, the close
  buttons, and hiding the top bar's Layers and right-sidebar toggles.
  The `.slot-panels` glass selector moves to the cards and the rail.
- Tests: CSS scoping checks, `clearInsets` with two `panels` boxes (rail
  and column), and unit tests for the pure state-mirroring helper.
- `docs/ui-reference.md`: a floating cards and mini-rail paragraph, and
  updates to the 5a/5b paragraphs that mention the right sidebar and the
  top bar toggles.
- Depends on 5d being archived (see above).
