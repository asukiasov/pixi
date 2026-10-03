## Why

5a gave the floating layout its base, but the top bar is still today's
row of 14 icon buttons in a glass card, and the zoom controls are a
separate card at the bottom. 5b is the next roadmap step
(`openspec/roadmap.md`, Phase 5). It turns the top bar into the slim bar
the target layout describes. Occasional actions move into one ⋯ More
menu, and zoom moves into a pill. The canvas gets more room, and the
bottom edge is left free for the tool-options bar (5d).

## What Changes

All of this applies only in the floating layout (`?layout=floating`).
The docked layout and `Pixi.mount()` embeds do not change.

- **Slim top bar**: Back to Gallery, the project title, the zoom pill,
  Undo/Redo, and a ⋯ More button.
- **Project title**: the project's name, shown read-only and truncated
  when long. It updates when the project is renamed in Canvas Settings.
- **Zoom pill**: shows the current zoom %. Tapping it opens a small menu
  with 100%, Fit, Fill, Zoom out (−) and Zoom in (+). The bottom zoom
  bar is hidden in the floating layout. Keyboard and pinch zoom work as
  before.
- **More menu** holds Canvas settings, Export, Record timelapse, Tile
  preview, Theme (Light / Dark / System) and Hide interface.
  - Canvas Settings, Export and the timelapse review popover open
    anchored to the More button. They used to anchor to their own top
    bar buttons, which are hidden in this layout.
  - While a timelapse is recording, the More button shows a red dot.
  - Prefs is not added yet. 5g adds it when the Prefs screen exists.
- **Controls kept for now**: Pixel-perfect, Symmetry, the Layers panel
  toggle and the right-sidebar toggle stay in the slim top bar as a
  separate group for now. 5d moves the first two into the tool-options
  bar, and 5e replaces the other two with the mini-rail. Until then,
  every feature stays reachable.
- Keyboard shortcuts (Tab for Hide interface, Ctrl/Cmd +/− for zoom,
  undo/redo) behave as before.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `floating-workspace`: adds requirements for the slim top bar, the zoom
  pill and the More menu. Updates "Full-screen canvas with floating
  regions" and "Placement slots" because the zoom bar no longer floats
  in the floating layout.

Other specs that say a control is "in the top bar" (`export`,
`canvas-settings`, `drawing-timelapse-recording`, `tile-preview`,
`hide-interface`, `canvas-navigation`) stay true: the More menu is part
of the top bar. 5h rewrites them when the docked layout is removed.

## Impact

- `index.html`: the title, zoom pill, More button, and menu markup inside
  `.workspace-topbar`. These are hidden in the docked layout.
- `style.css`: floating-only rules that hide the moved buttons and the
  bottom zoom bar, plus styles for the pill, the menu, and the
  recording dot on More.
- New `js/topbar-menu.js`: an accessible menu-button helper (open/close,
  arrow keys, Escape, outside click) used by both the zoom pill and More.
- `js/workspace.js`, `js/canvas-settings.js`, `js/export.js`: menu items
  trigger the existing actions. Popovers can anchor to the More button.
  The title and the pill's % stay in sync.
- `js/theme.js`: a way to set a specific theme preference, not only
  cycle through them.
- `js/layout.js`: a small helper that picks a visible anchor for
  popovers. Fit already ignores hidden cards, so the hidden zoom bar
  drops out of the clear-area calculation without any change.
- `lib/pixi.js`: gets the same new markup, so embeds stay in sync. They
  remain docked.
- Tests: menu-button keyboard/aria behaviour, theme set/read, and CSS
  checks that the moved controls are hidden only in the floating layout.
