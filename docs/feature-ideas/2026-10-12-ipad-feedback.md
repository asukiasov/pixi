# iPad feedback — 2026-10-12

A batch of requests from using Pixi on iPad with Apple Pencil. Three were
small and unambiguous and shipped straight away; the rest are listed here
with what the code already has, so each can go through `brainstorming`
when it's picked up (CLAUDE.md's process).

## Done on this branch

- **Generate ramp doesn't work** — bug. Opened from the colour picker, the
  ramp popover painted *under* the picker (right sidebar stacking context
  z-index 20 vs the lifted tool rail at 25), hiding Steps/Confirm/Cancel.
  Fixed in `style.css`; Confirm now also scrolls the new colours into view.
- **No bounce on hover / selected** — removed the iOS magnetic hover and the
  hover "buzz" wiggle entirely.
- **Colour picker → back to previous tool** — a successful Eyedropper pick
  re-selects the tool that was active before it.

## Small — tools and layers (done 2026-10-12)

Built from `docs/superpowers/specs/2026-10-12-small-tools-design.md`:
**Ellipse tool** (O, shares Rectangle's Filled and 1:1), **Duplicate
layer** (button, Cmd/Ctrl+J) plus a **Merge** button (merge was
keyboard-only, so unreachable on iPad), and a **Brush cursor** with a
Show Brush Cursor switch in Prefs.

## Medium — Apple Pencil and canvas (done 2026-10-12)

Built from `docs/superpowers/specs/2026-10-12-pencil-and-transform-design.md`:
**palm rejection** (once the Pencil is used, only it draws; touches while
it's down are ignored; two-finger zoom/pan still work; Prefs switch, on by
default), a **Transform popover** in the top bar (rotate 90°/180°, flip,
align to canvas - the selection if any, else the layer), and **view
rotation** (two-finger twist, Safari trackpad, Zoom menu; snaps to right
angles within 6°).

## Large — redesigns (need a brainstorm with references)

- **Layers panel like Pixelmator Pro for iPad**, **layers on the right
  side only**, and **layer groups**. One redesign: groups change the layer
  model (`lib/pixel-engine/layers.js`), persistence format and compositing,
  so they belong with the panel redesign rather than bolted on. Reference:
  `docs/Screenshots of other apps/other screens/pixelmator-pro-for-ipad-layers.avif`.
- **Colour choosing like Procreate** — colour disc / classic square /
  harmony / value sliders, plus history. Replaces the current native
  `<input type="color">` + hex/RGB popover.
- **Colour palette at the bottom, where the colour strip is** — merge the
  Color Library palette into the bottom strip (Procreate-style: palette
  shown compactly along the bottom, switchable), freeing the right side
  for Layers. Pairs with the two items above.
- **Colour library: restore standard libraries** — the predefined palettes
  (Kit Kat, M&M's, Vaporwave, …) are seeded once and never return if
  deleted (`js/default-color-library.js`). Add a "Standard libraries"
  browser that lists them and re-adds any the user picks, never touching
  palettes the user created or edited. "Download from the server" means
  Supabase Storage — Phase 3+; a first version can ship the list in the
  app and move to the server later.
- **Brush palette** — no direction yet ("don't know what to do"). Worth a
  brainstorm once the colour and layers redesigns settle what the right
  side and bottom look like.
