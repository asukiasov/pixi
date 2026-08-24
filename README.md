# Pixi

A browser-based pixel art drawing tool. Fixed small canvas sizes
(16/32/64/128px, or custom up to 256px), layers, a full drawing toolset,
local persistence, and export — no animation/frame timeline in this phase.

This is primarily a standalone web app — no npm package, no build step, no
framework. Run it as-is (see Quick Start below) or fork the repo. Two parts
of it are also usable as an embeddable library, independent of the app
shell: [`lib/pixel-engine/`](lib/pixel-engine/README.md) (the pixel data
model — engine, layers, undo — with no other Pixi files required) and
[`lib/pixi.js`](lib/README.md) (`Pixi.mount()`, a full drawing editor you
can mount into another page's container element).

![Pixi's Workspace screen: a pixel art scene open with the Layers panel and Color Library visible in the right sidebar](docs/screen.png)

**Live demo:** https://asukiasov.github.io/pixi/ — no install, try it now.

For the full feature set, current phase, and what's built vs. planned, see
[`openspec/roadmap.md`](openspec/roadmap.md). For exactly what each shipped
feature does, [`openspec/specs/`](openspec/specs/) is the source of truth —
this README stays high-level on purpose rather than duplicating that.

## Key Capabilities

- Draw with Pencil, Eraser, Bucket fill, Line, and Rectangle, on fixed
  16/32/64/128px canvases or a custom size up to 256px
- Undo/redo, 20 steps deep
- Predefined and custom brush stamps, click or drag to place
- Export finished art to PNG, at native or scaled resolution, with a
  transparent-background toggle
- Projects save to IndexedDB automatically — usable fully offline, no
  account or sign-in required
- Layers, named/persisted color palettes, symmetry drawing, pixel-perfect
  drawing, and more — see [Features](#features) below

## Features

Everything below is shipped and usable today, free, in this one repo — see
[`openspec/specs/`](openspec/specs/) for the full behavior of each.

| Area | What it does |
|---|---|
| [Canvas creation](openspec/specs/canvas-creation/spec.md) | Fixed size presets (16/32/64/128px) or custom up to 256px, transparent or white background |
| [Drawing engine](openspec/specs/pixel-drawing-engine/spec.md) | Pencil, eraser, bucket fill, undo/redo, pixel-perfect drawing toggle |
| [Brushes](openspec/specs/brushes/spec.md) | Predefined and custom pixel-pattern stamps (including import from image), click or drag to place |
| [Shape tools](openspec/specs/shape-tools/spec.md) | Line, rectangle (fill/outline toggle), and a rectangular selection tool (move/copy/delete a region) |
| [Symmetry drawing](openspec/specs/symmetry-drawing/spec.md) | Mirror drawing mode across a horizontal/vertical/both axis |
| [Layers](openspec/specs/layers/spec.md) | Add/delete/reorder layers, visibility, blend mode, opacity, background layer, reference image layer, merge layers |
| [Color Library](openspec/specs/color-library/spec.md) | Named/persisted color palettes, add-to-palette, import from image, ramp generator |
| [Canvas settings](openspec/specs/canvas-settings/spec.md) | Rename, resize, and rotate an existing project |
| [Canvas navigation](openspec/specs/canvas-navigation/spec.md) | Zoom in/out, Fit/Fill Screen presets, pan (Hand tool) |
| [Local persistence](openspec/specs/local-persistence/spec.md) | Projects save to IndexedDB automatically — usable fully offline, no account required |
| [Gallery](openspec/specs/gallery/spec.md) | Home screen listing saved projects with thumbnails |
| [Export](openspec/specs/export/spec.md) | PNG export at native or scaled resolution, with a transparent-background toggle |
| [URL routing](openspec/specs/url-routing/spec.md) | Hash-based routes per screen — reload or Back/Forward preserves the open project |

## Stack

Vanilla HTML/CSS/JS with ES modules — **no build step, no bundler, no
framework**. `js/*.js` files are loaded directly by the browser;
CDN-hosted packages are resolved via an [import map](index.html) rather
than npm. Rendering is plain HTML5 Canvas 2D (`getContext('2d')`) — no
WebGL, no WebGPU.

- **Storage**: [Dexie.js](https://dexie.org/) over IndexedDB as the
  offline-first local cache — pixel art projects are saved locally and the
  app is fully usable signed out.
- **`package.json`** exists only to declare test-only dependencies
  (`dexie`, `fake-indexeddb`) for running the test suite under Node — the
  shipped app itself has no npm dependencies.

## Quick Start

Fastest path: open the live demo at
https://asukiasov.github.io/pixi/ — no install. To run it locally
instead, no build/dev server is required — serve the repo root as static
files and open it:

```bash
git clone https://github.com/asukiasov/pixi.git
cd pixi
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works equally well (`npx serve`, VS Code's Live
Server, etc.) — the app just needs to be served over HTTP rather than
opened as a `file://` URL, since ES module imports require it.

## Usage Examples

- **New pixel art sprite:** Gallery → New Canvas, pick a size preset
  (16/32/64/128px) or a custom size up to 256px, then draw with Pencil,
  Bucket fill, and the Shape tools. See
  [Canvas creation](openspec/specs/canvas-creation/spec.md).
- **Reusable stamps:** build a custom brush from a repeated pixel pattern
  and place it with click or drag, instead of redrawing it by hand each
  time. See [Brushes](openspec/specs/brushes/spec.md).
- **Copy/move part of a sprite:** use the rectangular selection tool to
  move, copy, or delete a region without affecting the rest of the
  canvas. See [Shape tools](openspec/specs/shape-tools/spec.md).
- **Multi-layer illustration:** add Layers, draw each part (background,
  outline, shading) on its own layer, adjust per-layer opacity and blend
  mode, then Export a single flattened PNG. See
  [Layers](openspec/specs/layers/spec.md).

For the full control-by-control reference, see
[`docs/ui-reference.md`](docs/ui-reference.md).

## Testing

```bash
npm install   # first time only - installs test-only dependencies
npm test      # runs node --test test/**/*.test.js
```

Tests cover DOM-free logic (e.g. engine, layers, undo, persistence,
routing, brushes, shape tools, symmetry, color library — see `test/` for
the full, current list) directly under Node. Anything requiring a real
`<canvas>`/DOM (compositing, rendering) is verified with a Playwright
smoke pass instead — see individual OpenSpec changes'
`tasks.md` under `openspec/changes/archive/` for what was checked.

## Project structure

```
index.html   Single-page shell: Gallery / New Canvas / Workspace screens
style.css    All styles, no preprocessor
js/          ES modules, one per concern (engine, layers, workspace, ...)
test/        node --test unit tests, mirrors js/
lib/         Embeddable library: pixel-engine/ (pixel data model),
             storage-adapter.js and pixi.js (Pixi.mount()), and a worked
             example (pixi-embed-example.html) - see lib/README.md and
             lib/pixel-engine/README.md
openspec/    Requirements (specs/), in-flight change proposals (changes/),
             and the phase-by-phase roadmap.md - see CLAUDE.md for the process
docs/        Reference docs that don't belong in openspec/
scripts/     One-off maintenance scripts (version stamping)
```

For a map of every screen and pixel art tool in the UI (what each control
does, where it lives in the DOM), see
[`docs/ui-reference.md`](docs/ui-reference.md).

## Support the Project

Pixi is solo-built, free, and open-source — every feature above, no tiers.
If you're enjoying it, you can buy me a beer:
https://paypal.me/asukiasov. Appreciated, never required.

## Contributing

Bug reports and pull requests are welcome. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the process (OpenSpec proposals
for feature/behavior changes, direct PRs for bug fixes) and
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
