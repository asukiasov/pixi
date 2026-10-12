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

## Large — redesigns (done 2026-10-12)

Built from `docs/superpowers/specs/2026-10-12-layers-and-colours-redesign-design.md`:

- **Layers panel like Pixelmator Pro for iPad**, **layers only on the
  right**, **layer groups** and **layer merge** (now reachable on touch:
  row ⋯ menu and Select mode).
- **Colour palette at the bottom**: the colour bar shows the active
  palette, with a palette menu for everything the Color Library card did.
- **Colour choosing like Procreate**: Disc, Classic, Value and Palettes
  tabs, previous/current colour, history.
- **Standard libraries**: a sheet to re-add any palette that ships with
  Pixi (Kit Kat, PICO-8, Pixi Basics…), downloaded from the site with an
  offline fallback; never touches the user's own palettes.
- **Brush palette**: the Brushes card became a popover from the
  tool-options bar.

Still open from this note: nothing. Follow-ups worth considering: nested
groups, isolated group compositing, syncing palettes through Supabase
(Phase 3).
