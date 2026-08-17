# UI reference — screens, tools, and controls

A catalog of every screen and control in Pixi's UI, kept as a reference for
UX audits (see `.claude/skills/auditing-tool-improvements/` and
`.claude/skills/web-design-guidelines/`) and onboarding.
Source of truth for behavior is `openspec/specs/`; this doc is a map of
*where things live in the DOM/UI*, not a restatement of requirements — when
the two disagree, the spec wins and this doc should be corrected.

Update this file when a control is added, removed, moved, or renamed —
same discipline as keeping `index.html`'s `icon_names` font subset in sync.

Findings from audit passes over this surface are tracked separately, one
row per finding with an id/severity/state, in `docs/audits/` (e.g.
[`docs/audits/2026-08-17-ui-polish-audit.md`](audits/2026-08-17-ui-polish-audit.md)) —
this file stays a pure map, not a running list of issues.

## Screens

| Screen | DOM id | Route | Spec |
|---|---|---|---|
| Gallery | `#screen-gallery` | `#/` | `gallery` |
| New Canvas | `#screen-new-canvas` | `#/new` | `canvas-creation` |
| Workspace | `#screen-workspace` | `#/project/<id>` | `pixel-drawing-engine`, `layers`, `canvas-navigation`, etc. |

Routing: `url-routing` spec, `js/router.js`.

---

## Gallery (`#screen-gallery`)

- `#gallery-new-canvas-button` — "+ New Canvas", primary button, top of
  header → navigates to New Canvas screen.
- `#gallery-grid` — grid of saved project cards (thumbnail + name),
  populated from IndexedDB via `js/gallery.js` / `js/persistence.js`.
- `#gallery-empty-state` — shown instead of the grid when no projects
  exist yet ("No projects yet — tap '+ New Canvas' to start one.").
- `#version-badge` — small build/version stamp, footer; cache sanity
  check only, not a feature (`js/version.js`, `scripts/stamp-version.sh`).

Spec: `gallery`. Implementation: `js/gallery.js`.

## New Canvas (`#screen-new-canvas`)

- **Size** (`#size-presets`): `.preset-button[data-size]` for 16/32/64/128,
  plus `#custom-width`/`#custom-height` number inputs (1–256) for a
  custom size.
- **Background** (`#background-choice`): radio group, `transparent`
  (default) or `white`.
- `#create-canvas-button` — "Create", primary button → creates the
  project and navigates to Workspace.

Spec: `canvas-creation`. Implementation: `js/new-canvas.js`.

## Workspace (`#screen-workspace`)

The main drawing screen. Layout: top bar → body (left tools sidebar +
canvas + bottom bar) → right sidebar, plus several popovers positioned
via `position: fixed` + JS (clamped to viewport) rather than living in
normal document flow.

### Top bar (`.workspace-topbar`)

Icon-only buttons, left-to-right, `magnetic-hover` class (iOS-only
magnetic cursor attraction, see `topbar-magnetic-hover` spec):

| id | Icon | Purpose | Notes |
|---|---|---|---|
| `#back-to-gallery-button` | home | Back to Gallery | |
| `#pixel-perfect-toggle` | grid_on | Pixel-perfect line toggle | on/off, no popover |
| `#symmetry-toggle` | flip | Symmetry/mirror drawing mode | 4-state cycle (off/horizontal/vertical/both) on each click, no popover - see below |
| `#layers-panel-toggle` | layers | Collapse/expand Layers panel | mirrors Layers panel header's own collapse state |
| `#canvas-settings-toggle` | settings | Open Canvas Settings popover | anchored popover, see below |
| `#export-button` | download | Open Export popover | anchored popover, see below |
| *(spacer)* | | | pushes the rest right |
| `#undo-button` | undo | Undo | disabled when nothing to undo |
| `#redo-button` | redo | Redo | disabled when nothing to redo |
| `#right-sidebar-toggle` | dock_to_right | Hide/show whole right sidebar | slides open/closed (AUD-11, 2026-08-17); respects `prefers-reduced-motion` |

`#symmetry-toggle` (5-add-symmetry-drawing-mode, 2026-08-17): each click
advances `state.symmetryMode` through `off → horizontal → vertical → both →
off`. `.active` (shared accent styling with every other topbar toggle) is
set whenever the mode isn't `off`; a small letter badge
(`data-symmetry-mode` attribute, styled in `style.css`) shows H/V/4 so the
three "on" states stay visually distinguishable from each other. The
button's `aria-label`/tooltip text updates with the current mode (e.g.
"Symmetry: horizontal"). While a mode is active, every pixel the Pencil,
Eraser, or Brush tool writes is mirrored live across the canvas's fixed
center axis/axes, committed as part of the same stroke/undo step as the
original - Bucket, Line, Rectangle, Selection, and Move are unaffected.
Session-only state, like `#pixel-perfect-toggle` - resets to `off` on
reload or reopening a project. Implementation: `js/symmetry.js`
(`mirrorApplyPixel`, the pure mirror/dedup helper), wired into
`js/workspace.js` (Pencil/Eraser) and `js/brushes.js` (`placeBrush`).
Spec: `symmetry-drawing`.

### Left tools sidebar (`#tools-sidebar`)

Vertical icon rail, Photoshop-style, `data-tool` + `data-shortcut`
attributes drive both click-to-select and the keyboard shortcut:

| Tool | `data-tool` | Shortcut | Icon |
|---|---|---|---|
| Move | `move` | V | arrow_selector_tool |
| Pencil | `pencil` | P | edit |
| Eraser | `eraser` | E | ink_eraser |
| Bucket | `bucket` | G | format_color_fill |
| Brush | `brush` | B | brush |
| Line | `line` | L | horizontal_rule |
| Rectangle | `rectangle` | R | rectangle |
| Select | `selection` | M | crop_free |
| Hand (pan) | `hand` | H | back_hand |
| Eyedropper | `eyedropper` | I | colorize |

Specs: `pixel-drawing-engine` (Pencil/Eraser/Bucket/pixel-perfect line),
`shape-tools` (Line/Rectangle/Selection/Move), `brushes` (Brush),
`canvas-navigation` (Hand), `color-library`/`pixel-drawing-engine`
(Eyedropper). Implementation: `js/workspace.js`, `js/shape-tools.js`,
`js/brushes.js`.

**Tool-scoped option surfaces** (shown/hidden based on active tool, all
in `js/workspace.js`):

- `#rectangle-options` (Rectangle only) — `#rectangle-fill-toggle`,
  outline/filled toggle using two swapped inline SVGs (not the webfont
  icon — the subsetted font only bakes one FILL-axis point).
- `#square-constraint-options` (Rectangle + Selection) —
  `#square-constraint-toggle`, "1:1" text button, on/off equivalent of
  holding Shift while dragging (for touch, which has no Shift key).
- `#library-sequence-options` (Pencil + Brush only) —
  `#library-sequence-toggle` ("Color Library sequence", cycles through
  the active palette per pixel/stamp placed). **One shared control**
  (AUD-12, 2026-08-17) modeled directly on `#square-constraint-options`'s
  pattern — a single DOM instance whose panel is shown/hidden per active
  tool, replacing the former duplicated `#pencil-library-toggle` (inside
  `#pencil-options`) and `#brush-library-toggle` (inside
  `#brushes-panel`'s toolbar), which drove the same
  `state.colorLibrarySequence` flag from two places. Excluded for Eraser
  (Pencil-only behavior carried over unchanged).
- `#pencil-options` (Pencil + Eraser only, floats over canvas top-left
  corner) — `#pencil-size-slider`/`#pencil-size-readout` (1–20px),
  `#pencil-opacity-slider`/`#pencil-opacity-readout` (1–100%). The
  Color Library sequence toggle formerly here moved to
  `#library-sequence-options` above.
- `#brushes-panel` (Brush only, right sidebar — see below). The Color
  Library sequence toggle formerly in its toolbar row moved to
  `#library-sequence-options` above.

### Foreground/Background swatches (`.fg-bg-swatches`)

Bottom of the left tools sidebar, Photoshop-style overlapping stack:

- `#background-swatch` / `#foreground-swatch` — click either to open
  `#color-picker-popover` targeting that swatch.
- `#fg-bg-swap` (swap_horiz) — swap FG/BG.
- `#fg-bg-reset` (restart_alt) — reset to default black/white.

`#color-picker-popover` (opened by either swatch): `#color-picker-native`
(native `<input type=color>`), `#color-picker-hex` (hex text entry,
double-click to copy, `#color-picker-copied` "Copied!" flash), RGB
number inputs (`#color-picker-r/g/b`), `#color-picker-add` ("Add to
palette", adds to the active Color Library palette), `#color-picker-
generate-ramp` ("Generate ramp", opens `#ramp-preview-row` for whichever
swatch — foreground or background — this popover is currently editing).
**Does not exist on iOS** — `#add-current-color-button` in the Color
Library header (below) is the only add-to-palette path there; the ramp
generator's `#library-generate-ramp-button` (below) is likewise the only
ramp-generation path on iOS.

Spec: `color-library` (FG/BG model), `canvas-creation`/`layers`
(Background layer interaction, `2g`).

### Canvas area (`.workspace-main`)

- `#workspace-canvas-container` / `#workspace-canvas` — the drawing
  surface itself.
- `#canvas-settings-panel` — popover anchored to `#canvas-settings-toggle`:
  `#canvas-settings-name` (project name), `#canvas-settings-width/height`
  + `#canvas-settings-apply` ("Resize"), `#canvas-settings-rotate-ccw`/
  `-cw` (rotate_left/rotate_right). Spec: `canvas-settings`.
- `#export-panel` — popover anchored to `#export-button`: scale
  1x/2x/4x/8x (`.export-scale-option[data-scale]`), format PNG/WebP/JPG
  (`.export-format-option[data-format]`), `#export-transparent-background`
  checkbox, `#export-download` ("Export"). Transient state, resets to
  defaults each time it opens (not persisted with the project). Spec:
  `export`.
- `#palette-row` — the fixed preset palette swatches (Phase 1's
  original 16-swatch row, distinct from Color Library's persisted
  palettes).
- `#selection-controls` (Selection tool, active selection only) —
  `#selection-clear-button` ("Clear selection"), `#selection-delete-button`
  ("Delete").
- `.bottom-bar` (bottom-left) — `#zoom-out-button`/`#zoom-in-button`
  (remove/add icons, also Ctrl/Cmd +/-), `#zoom-readout` (percentage),
  `#zoom-preset-100`/`#zoom-preset-fit`/`#zoom-preset-fill` ("100%" /
  "Fit" / "Fill"). Spec: `canvas-navigation`.

### Right sidebar (`#right-sidebar`)

Order top→bottom: Color Library → Brushes → Layers (color selection
used most often while drawing, per `2l`'s ordering rationale). Each
panel has its own collapse-to-header state; the whole sidebar has its
own show/hide (`#right-sidebar-toggle` in the top bar), independent of
the per-panel states.

**Color Library** (`#color-library-panel`, spec `color-library`):
- `#color-library-header` (click to collapse/expand, chevron rotates) —
  `#add-current-color-button` (playlist_add, add current FG to active
  palette), `#add-palette-button` (add, new palette), `#import-palette-button`
  (image icon, opens `#color-library-import-input` file picker →
  `#import-preview-row` popover), `#library-generate-ramp-button`
  (gradient icon, generates a shading ramp from the current Foreground
  color → `#ramp-preview-row` popover, spec `color-library`,
  `7-add-palette-color-ramp-generator`), `#delete-palette-button` (delete
  current palette).
- `#color-library-select` — dropdown to switch palette once more than
  one exists (alphabetically sorted).
- `#new-palette-row` — inline `#new-palette-name` + Save/Cancel, shown
  when creating a palette.
- `#color-library-grid` — swatches of the active palette. Bounded
  height (doesn't fill all remaining sidebar space, per `2l`).
- `#import-preview-row` — popover anchored to `#import-palette-button`
  (fixed-position, not in-flow, so the color-count control below the
  swatch grid can't shift as the grid's row count changes — `2o` fixed
  an earlier version that still shifted). `#import-preview-grid` (live
  swatch preview), `#import-preview-count` (2–32 colors, re-extracts via
  median-cut on change), `#import-preview-name`, Save/Cancel.
- `#ramp-preview-row` — popover anchored to whichever button opened it
  (`#library-generate-ramp-button` in this header, or `#color-picker-
  generate-ramp` in `#color-picker-popover` above), same fixed-position/
  clamped-to-viewport pattern as `#import-preview-row`. Source color is
  the current Foreground color (header button) or whichever swatch
  `#color-picker-popover` is editing (popover button).
  `#ramp-preview-grid` (live swatch preview, `js/color-ramp.js`'s
  `generateColorRamp`, dark→light through the source hue with a hue/
  saturation shift at the extremes), `#ramp-preview-steps` (3–9 steps,
  default 5, regenerates live on change), Confirm/Cancel
  (`#ramp-preview-confirm`/`#ramp-preview-cancel`) — Confirm adds every
  previewed color to the active palette via `addColorToPalette` and
  refreshes the panel; Cancel discards the preview with no palette
  changes. Spec: `color-library` (`7-add-palette-color-ramp-generator`).

**Brushes** (`#brushes-panel`, spec `brushes`, shown only while Brush
tool is active):
- `#brush-spacing` (1–20px), `#brush-rotation` (0–359°).
- `#brushes-panel-grid` — saved brush thumbnails, click to select.
- `#add-brush-button` (opens `#brush-editor-panel`), `#delete-brush-button`
  (disabled unless a brush is selected). The Color Library sequence
  toggle for Brush lives in the shared `#library-sequence-options`
  (tools sidebar, see above), not in this panel.
- `#brush-editor-panel` (docked panel, not a popover — confirmed with
  user during `2o`, not converted): `#brush-editor-import` (image icon,
  opens `#brush-editor-import-input` file picker, pre-fills the grid via
  thresholding), `#brush-editor-name`, `#brush-editor-width/height`
  (min 3px), `#brush-editor-grid` (click-to-toggle pixel editor),
  Clear/Cancel/Save.

**Layers** (`#layers-panel`, spec `layers`):
- `#layers-panel-header` (click to collapse/expand) — `#add-layer-button`
  ("+ Layer").
- `.layers-panel-toolbar` — shared controls editing whichever layer is
  active (Photoshop-style, not per-row): `#layers-panel-blend-select`
  (blend mode dropdown), `#layers-panel-opacity-toggle` (shows current
  %, opens `#layers-panel-opacity-popover` — slider + number input,
  lives outside `.right-sidebar` so its own `overflow-y:auto` can't
  clip the popover).
- `#layers-panel-list` — compact rows: live pixel thumbnail, name,
  visibility toggle, reorder (tap, no drag-and-drop), delete. The
  Background layer (white-background canvases only, `2g`) is locked —
  reorder-disabled.

---

## Cross-cutting patterns worth knowing before auditing

- **Popover positioning**: `#color-picker-popover`, `#canvas-settings-panel`,
  `#export-panel`, `#import-preview-row`, `#ramp-preview-row`,
  `#layers-panel-opacity-popover` all use `position: fixed` + JS
  (`getBoundingClientRect`), clamped to the viewport — check each one's
  clamping at small viewport sizes / near screen edges.
- **Tool-scoped visibility**: `#rectangle-options`, `#square-constraint-options`,
  `#pencil-options`, `#brushes-panel`'s Brush-only controls all
  show/hide based on active tool in `js/workspace.js` — worth checking
  each tool switch doesn't leave a stale panel visible.
- **Two collapse mechanisms**: per-panel collapse-to-header (Color
  Library, Layers — click the header) vs. whole-sidebar hide/show
  (`#right-sidebar-toggle`) are independent and can compound (e.g.
  sidebar hidden while a panel inside it is individually collapsed).
- **Magnetic hover**: top bar and left tool rail buttons carry a
  `magnetic-hover` class (specs `topbar-magnetic-hover`,
  `toolrail-magnetic-hover`) — iOS-only per `2026-08-17-restrict-magnetic-hover-to-ios`;
  desktop/Android get plain hover.
