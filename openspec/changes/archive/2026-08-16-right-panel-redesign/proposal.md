## Why

The right sidebar (Color Library + Layers) has grown three usability
problems as more panels landed there (2d, 2f, 2k): Layers sits above
Color Library even though color selection is used far more often while
drawing; there's no way to reclaim the sidebar's screen width entirely
(only the Layers panel has its own show/hide toggle - Color Library and
Brushes don't); Color Library's swatch grid greedily fills all leftover
vertical space instead of a bounded, predictable height; and a hover
tooltip on the Color Library header's action buttons gets clipped by the
viewport's right edge since tooltip positioning was only ever tuned for
the left tools sidebar.

## What Changes

- Reorder the right sidebar top-to-bottom: **Color Library → Brushes →
  Layers** (was Layers → Brushes → Color Library).
- Add a top-bar icon button that shows/hides the *entire* right sidebar
  at once (Color Library + Brushes + Layers together), independent of
  each panel's own state - VSCode "toggle sidebar" style. The canvas
  area reclaims the freed width when hidden.
- Make the Color Library and Layers panel headers themselves clickable
  (chevron icon) to collapse that one section down to its header row,
  Photoshop-accordion style - collapsing one lets the other section grow
  into the freed vertical space. The existing bottom-bar Layers toggle
  button keeps working, now driving/reflecting this same collapsed
  state instead of a separate hide/show.
- Give the Color Library panel a fixed maximum height (independent of
  window height) instead of stretching to fill all remaining sidebar
  space, with smaller swatches so more colors are visible within that
  bounded height; Layers becomes the section that fills remaining space
  instead.
- Compress the Layers panel's Blend mode + Opacity controls onto a
  single row: Blend mode dropdown sized to its own text instead of full
  width, Opacity as a small editable number field (rather than an
  always-visible slider) that opens a slider in a small popover on
  click for drag-to-set, matching how Photoshop's own panel handles
  this.
- Fix the hover tooltip on right-sidebar buttons (e.g. Color Library's
  "Add current color") so it renders to the *left* of the button instead
  of the right, keeping it fully on-screen. Implementation-only bug fix,
  no capability change.

## Capabilities

`openspec/specs/` (the archived main specs) doesn't yet contain
`color-library` or `canvas-navigation` - both only exist as delta specs
under the not-yet-archived `2f-color-library-panel` and
`2d-canvas-navigation` changes. Relative to the current archived specs,
this change therefore introduces those two as new capability paths (even
though, in the implemented app, they already exist) while `layers`
already exists in `openspec/specs/layers/` and is genuinely modified.

### New Capabilities
- `color-library`: adds requirements for the panel's position at the top
  of the right sidebar, a fixed maximum height with smaller swatches
  instead of filling all remaining space, and collapse-to-header
  behavior for the panel.
- `canvas-navigation`: adds a requirement for a single control that
  shows/hides the entire right sidebar (all three panels together),
  giving the canvas viewport the reclaimed width - distinct from each
  panel's own collapse state.

### Modified Capabilities
- `layers`: adds requirements for the Layers panel's position at the
  bottom of the right sidebar (after Color Library and Brushes),
  collapse-to-header behavior for the panel (superseding the prior
  fully-hide/show toggle from `2d-canvas-navigation`, not yet archived),
  and the one-line Blend mode + Opacity toolbar layout (superseding the
  always-visible slider from `2k-layers-panel-redesign`, not yet
  archived).

## Impact

- `index.html`: right-sidebar markup reordered; header chevrons added to
  `#color-library-panel` and `#layers-panel`; new top-bar toggle button;
  `.layers-panel-toolbar` markup restructured for the one-line
  blend/opacity row plus a popover for the opacity slider.
- `style.css`: `.right-sidebar` children reordered/restyled;
  `.color-library-panel` sizing changes from `flex:1` to a capped
  `max-height`; `.color-library-grid` swatch size reduced;
  `.layers-panel-toolbar` goes row instead of column; new collapsed-state
  and popover styles; `.tool-tooltip` gains a left-side/mirrored-arrow
  variant.
- `js/workspace.js`: `bindTooltips()` gains right-sidebar-aware
  positioning; new whole-sidebar toggle wiring; per-section collapse
  state and DOM sync for both panels; opacity control rewired from a
  slider to a number input + popover slider.
- Builds on top of `2d-canvas-navigation`, `2f-color-library-panel`, and
  `2k-layers-panel-redesign` (all implemented in code, not yet
  archived) - this change's deltas describe the right sidebar's final
  shape, superseding the relevant requirements those changes will
  contribute once archived, the same stacking pattern `2j-move-tool`
  used on top of `2c1`'s not-yet-archived capability.
- No persistence/IndexedDB changes - none of the new toggle/collapse
  states are persisted, matching the existing (session-only)
  `layersPanelVisible` behavior.
