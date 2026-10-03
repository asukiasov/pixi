## Why

In the floating layout, a tool's settings are spread over four places:

- Size and Opacity are in a flyout beside the rail.
- Filled, 1:1 and the Color Library sequence toggles are in the rail,
  between the tools and the swatches.
- Pixel-perfect and Symmetry are in the top bar for every tool, even
  tools they don't affect.
- Brush Spacing and Rotation are in the Brushes panel in the right
  sidebar.

The user has to look in a different place for each tool. The rail is also
taller than it needs to be, and the top bar shows two buttons that do
nothing for most tools.

5d is the next roadmap step (`openspec/roadmap.md`, Phase 5). It adds the
target layout's tool-options bar: one floating pill at the bottom centre
whose contents follow the active tool.

## What Changes

All of this applies only in the floating layout (`?layout=floating`).
The docked layout and `Pixi.mount()` embeds look and work the same as
before.

- **One bar, contents follow the tool**: a floating pill at the bottom
  centre shows only the options for the active tool:

  | Tool | Bar contents |
  |---|---|
  | Pencil | Size, Opacity, Pixel-perfect, Symmetry, Color Library sequence |
  | Eraser | Size, Opacity, Pixel-perfect, Symmetry |
  | Brush | Spacing, Rotation, Symmetry, Color Library sequence |
  | Rectangle | Filled, 1:1 |
  | Select | 1:1 |
  | Move, Bucket, Line, Hand, Eyedropper | bar hidden |

  Pixel-perfect and Symmetry appear only for the tools they affect.
  Their on/off state carries over when switching tools, as it does
  today.
- **Horizontal sliders**: Size, Opacity, Spacing and Rotation are
  compact horizontal sliders with a value readout. Their ranges are the
  same as today. Spacing and Rotation were number fields in the Brushes
  panel.
- **Symmetry stays one button**: it cycles off → horizontal → vertical
  → both, with the same mode marker as the top bar button has today.
- **Controls leave their old places**: the Pencil/Eraser flyout, the
  rail's tool-scoped toggles, the top bar's Pixel-perfect and Symmetry
  buttons, and the Brushes panel's Spacing and Rotation rows are no
  longer shown. The top bar ends Layers, Undo, Redo, right sidebar,
  More. The rail holds only the tools and the swatches. The Brushes
  panel keeps its brush grid (5e moves it).
- **Palette row stays, under the bar**: the palette row keeps its own
  bottom-centre card. When the bar is shown, it floats just above that
  card. Selection Clear/Delete stay in the palette card (5f moves them).
  5i later removes the palette row.
- **No canvas movement**: switching to a tool that shows, changes or
  hides the bar does not move or re-fit the canvas.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `floating-workspace`:
  - Adds requirements for the tool-options bar: its per-tool contents,
    its controls, its placement above the palette card, and its
    accessibility.
  - Modifies "Full-screen canvas with floating regions" and "Placement
    slots": the Pencil/Eraser options card becomes the tool-options bar,
    in the `options` slot.
  - Modifies "Slim top bar": Pixel-perfect and Symmetry leave the top
    bar.
  - Modifies "Floating tool rail layout": the tool-scoped toggles leave
    the rail.

`brushes` ("The Brushes panel SHALL offer a Spacing/Rotation control"),
`symmetry-drawing`, `pixel-drawing-engine` and `shape-tools` are not
modified. They describe where these controls sit in the docked layout,
which is still the default. `floating-workspace` states where they sit
in the floating layout, the same way 5b handled the controls that moved
into More. 5h updates those specs when the docked layout is removed.
Each control keeps its behaviour. Only where it is shown changes.

## Impact

- `index.html`: a new `.floating-only` tool-options bar inside the
  `options` slot, and a wrapper card around the palette row and
  selection controls (`display: contents` in the docked layout).
  `lib/pixi.js` gets no new markup, because embeds are always docked.
- New `js/tool-options-bar.js`: wired once from `js/app.js`, only in the
  floating layout. Bar controls forward to the existing controls, and
  mirror their state back.
- `js/workspace.js`: `applyToolScopedUI()` also records the current tool
  as a `data-current-tool` attribute on the workspace screen, so CSS can
  show and hide the bar's groups. The docked layout doesn't use it.
- `style.css`: floating-only rules for the bar, the stacked options
  slot, horizontal sliders, and hiding the controls that moved.
- Tests: CSS checks that the new rules are scoped to
  `[data-layout="floating"]`. Unit tests for the pure per-tool mapping
  and the value-forwarding helper.
- `docs/ui-reference.md`: a section on the floating tool-options bar.
- Depends on 5b and 5c being merged (done).
