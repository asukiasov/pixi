# Pixi — Slice 1: Scaffold + Core Drawing Engine

## Goal

Get one canvas drawable and exportable to PNG, on mobile Android web, before building anything else. This is build-order steps 1–2 from the top-level project brief (repo scaffold, New Canvas flow, core drawing engine).

## Explicit scope

In scope:
- Repo scaffold (`index.html`, `style.css`, `js/` modules), no build step, ES modules via `<script type="module">`
- New Canvas screen: size presets (16/32/64/128 + custom width/height), background type (transparent or white)
- Workspace screen: pencil, eraser, bucket fill, pixel-perfect freehand mode, undo/redo, fixed starter color palette, simple PNG export
- Touch/pointer interaction: draw, pinch-zoom, two-finger pan
- Unit tests for the drawing engine

Out of scope (deferred to later slices per the project brief):
- Layers, local save/load (IndexedDB/Dexie), Gallery screen
- Custom color picker, symmetry/grid tools
- Firebase auth/sync, Stripe, community feed
- Scale multiplier / transparent-toggle Export screen (this slice ships a single "Export PNG" button at native resolution only)
- Adjustable brush size (fixed at 1px)
- Gesture-based undo/redo (buttons only)

## Architecture

Plain HTML/CSS/JS, ES modules, no framework, no bundler.

- **`index.html`** — shell containing both screens (New Canvas, Workspace); a tiny router in `app.js` shows/hides them (no URL routing needed at this stage).
- **`style.css`** — mobile-first; bottom tab bar layout for Workspace controls.
- **`js/engine.js`** — the pixel buffer and pure drawing operations. DOM-free and directly unit-testable.
  - Backed by a flat `Uint8ClampedArray` (RGBA per pixel), sized `width * height * 4`
  - `setPixel(x, y, rgba)`
  - `strokeFreehand(points, rgba, pixelPerfect)` — draws a freehand path; when `pixelPerfect` is true, applies Aseprite-style corner-pixel removal so diagonal strokes stay 1px thin. Shared by both pencil and eraser (eraser passes `rgba = [0,0,0,0]`).
  - `floodFill(x, y, rgba)` — 4-directional flood fill of the contiguous same-color region; no-ops if target color already equals fill color
  - `toPNGBlob()` — serializes the buffer to a PNG Blob at native resolution
- **`js/canvas-view.js`** — owns the `<canvas>` element and its 2D context.
  - Renders the engine's buffer scaled up via `image-rendering: pixelated`
  - Sets `touch-action: none` on the canvas element (or its immediate container) — **required** so Chrome/mobile browsers don't intercept two-finger gestures as native page pinch-zoom/scroll before the app's own pan/zoom handlers see them. Without this, pinch and two-finger pan will appear broken only when tested on an actual phone.
  - Translates pointer events → grid coordinates
  - One-finger drag → draw with current tool; two-finger drag → pan; pinch → zoom
- **`js/undo.js`** — undo/redo stack of full buffer snapshots.
  - Push a snapshot after each completed stroke or fill (not per-pixel)
  - Capped at the last 50 snapshots (memory hygiene; trivial cost at these canvas sizes)
  - **Redo truncation**: committing a new action while the undo pointer is not at the top of the stack discards every snapshot ahead of the pointer before pushing the new one — otherwise a stale future state can resurface after undo → draw → redo
- **`js/new-canvas.js`** — size preset picker + background choice (transparent / white) → allocates an `engine.js` instance, fills the background, switches to Workspace.
- **`js/workspace.js`** — wires the bottom tab bar (pencil, eraser, bucket, pixel-perfect toggle, ~16-swatch fixed palette row, undo/redo buttons, export button) to `engine.js` and `canvas-view.js`.
- **`js/app.js`** — bootstraps the app, owns screen switching between New Canvas and Workspace.

## Interaction model

- **Pointer Events API** (unified mouse/touch input).
- **Pixel-perfect toggle** applies to both pencil and eraser, since both use the same freehand stroke path in `engine.js` — only the write color differs. Off = raw pixel path (jaggy diagonals allowed); on = corner-pixel removal for 1px-thin diagonals.
- **Eraser always writes fully transparent pixels** (`rgba = [0,0,0,0]`), regardless of the canvas's background setting. This is explicit, intentional behavior: there is no layer compositing in this slice, background is just the initial fill of one flat buffer, so erasing on a white-background canvas will punch a visible transparent/checkerboard hole rather than restoring white. This matches standard pixel-art-tool behavior and is what layers will expect when they're added later.
- **Bucket** = flood fill, 4-directional, bounded by canvas edges.
- **Brush size**: fixed 1px for all tools this slice.
- **Color**: fixed starter palette (~16 swatches), tap to select current draw color. No custom color input yet.
- **Undo/redo**: visible buttons only, no gesture shortcuts.

## Data flow

1. New Canvas screen → user picks size + background → `engine.js` allocates the buffer and fills the background → Workspace screen shown.
2. Workspace: pointer events → `canvas-view.js` converts screen coords to grid coords → calls the appropriate `engine.js` mutation method → on stroke/fill completion, `undo.js` pushes a snapshot (with redo-stack truncation) → `canvas-view.js` re-renders from the buffer.
3. Export button → `engine.toPNGBlob()` → triggers a browser download at native pixel resolution (no scale multiplier or transparency toggle in this slice — that's the full Export screen, deferred).

## Error handling / edge cases

- Custom canvas size input clamped to a sane range (1–256px) to avoid pathological buffer sizes.
- Undo stack capped at 50 snapshots.
- Flood fill on a fully uniform canvas fills everything (expected); no-ops if the target pixel's color already equals the fill color.
- No persistence in this slice — closing/reloading the tab loses the drawing. This is expected and will be resolved by Slice 3 (local save/load via Dexie + Gallery), not a bug in this slice.

## Testing

- `engine.js` is DOM-free, so it's tested directly with Node's built-in test runner (`node --test`) — zero added dependencies, consistent with the no-bundler/no-build-step approach. Covers: pixel set, flood fill correctness (including no-op and fully-uniform cases), pixel-perfect corner-removal on known stroke paths, undo/redo stack behavior including redo truncation.
- Manual test pass on an actual Android phone in Chrome for touch/pinch/pan feel and to confirm `touch-action: none` is actually suppressing native gesture handling — this is the primary target device and the one place gesture bugs will actually surface.
