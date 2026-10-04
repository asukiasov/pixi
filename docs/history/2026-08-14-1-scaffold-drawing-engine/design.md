## Context

Greenfield project — no code exists yet. See proposal.md for motivation and
scope. Target platform is mobile Android web (Chrome); no build step or
framework is used anywhere in the project by choice.

## Goals / Non-Goals

**Goals:**
- One canvas drawable and exportable to PNG on mobile Android web.
- A drawing engine that is DOM-free and directly unit-testable.
- Correct touch gesture handling on real phones (draw vs. pan vs. zoom).

**Non-Goals:**
- Layers, persistence, Gallery, custom color picker, symmetry/grid tools,
  auth/sync, payments, community feed — see proposal.md's out-of-scope list.
- Performance tuning beyond what flat typed-array buffers give for free at
  these canvas sizes (max 256×256).

## Decisions

**Plain HTML/CSS/JS, ES modules, no framework, no bundler.**
Keeps the project buildable by opening `index.html`; avoids tooling overhead
before the core interaction model is proven on a real device.

- **`index.html`** — shell containing both screens (New Canvas, Workspace); a
  tiny router in `app.js` shows/hides them (no URL routing needed at this
  stage).
- **`style.css`** — mobile-first; bottom tab bar layout for Workspace controls.
- **`js/engine.js`** — the pixel buffer and pure drawing operations. DOM-free
  and directly unit-testable.
  - Backed by a flat `Uint8ClampedArray` (RGBA per pixel), sized
    `width * height * 4`.
  - `setPixel(x, y, rgba)`.
  - `strokeFreehand(points, rgba, pixelPerfect)` — draws a freehand path; when
    `pixelPerfect` is true, applies Aseprite-style corner-pixel removal so
    diagonal strokes stay 1px thin. Shared by both pencil and eraser (eraser
    passes `rgba = [0,0,0,0]`).
  - `floodFill(x, y, rgba)` — 4-directional flood fill of the contiguous
    same-color region; no-ops if target color already equals fill color.
  - `toPNGBlob()` — serializes the buffer to a PNG Blob at native resolution.
- **`js/canvas-view.js`** — owns the `<canvas>` element and its 2D context.
  - Renders the engine's buffer scaled up via `image-rendering: pixelated`.
  - Sets `touch-action: none` on the canvas element (or its immediate
    container) — **required** so Chrome/mobile browsers don't intercept
    two-finger gestures as native page pinch-zoom/scroll before the app's own
    pan/zoom handlers see them. Without this, pinch and two-finger pan will
    appear broken only when tested on an actual phone.
  - Translates pointer events → grid coordinates.
  - One-finger drag → draw with current tool; two-finger drag → pan; pinch →
    zoom.
- **`js/undo.js`** — undo/redo stack of full buffer snapshots.
  - Push a snapshot after each completed stroke or fill (not per-pixel).
  - Capped at the last 50 snapshots (memory hygiene; trivial cost at these
    canvas sizes).
  - **Redo truncation**: committing a new action while the undo pointer is not
    at the top of the stack discards every snapshot ahead of the pointer
    before pushing the new one — otherwise a stale future state can resurface
    after undo → draw → redo.
- **`js/new-canvas.js`** — size preset picker + background choice (transparent
  / white) → allocates an `engine.js` instance, fills the background, switches
  to Workspace.
- **`js/workspace.js`** — wires the bottom tab bar (pencil, eraser, bucket,
  pixel-perfect toggle, ~16-swatch fixed palette row, undo/redo buttons,
  export button) to `engine.js` and `canvas-view.js`.
- **`js/app.js`** — bootstraps the app, owns screen switching between New
  Canvas and Workspace.

**Pointer Events API for input**, not separate mouse/touch handlers — one
unified code path for draw/pan/zoom across mouse and touch.

**Full-buffer undo snapshots, not per-pixel diffs.** Simpler to implement
correctly (no diff/patch logic) and cheap enough at ≤256×256 canvases; capped
at 50 snapshots to bound memory.

**Eraser always writes fully transparent pixels**, regardless of the canvas's
background setting. This is explicit, intentional behavior: there is no layer
compositing in this slice, background is just the initial fill of one flat
buffer, so erasing on a white-background canvas will punch a visible
transparent/checkerboard hole rather than restoring white. This matches
standard pixel-art-tool behavior and is what layers will expect when they're
added later.

## Risks / Trade-offs

- [Two-finger gestures may be intercepted by the browser as native
  pinch-zoom/scroll] → Mitigate with `touch-action: none` on the canvas
  container; verify with a manual test pass on an actual Android phone, since
  this class of bug does not surface in desktop devtools emulation.
- [No persistence in this slice — closing/reloading the tab loses the
  drawing] → Expected and accepted; resolved by a later save/load change
  (Dexie + Gallery), not a bug in this one.
- [Custom canvas size could be used to allocate a pathologically large buffer]
  → Mitigate by clamping custom width/height to 1–256px.

## Testing

- `engine.js` is DOM-free, so it's tested directly with Node's built-in test
  runner (`node --test`) — zero added dependencies, consistent with the
  no-bundler/no-build-step approach. Covers: pixel set, flood fill correctness
  (including no-op and fully-uniform cases), pixel-perfect corner-removal on
  known stroke paths, undo/redo stack behavior including redo truncation.
- Manual test pass on an actual Android phone in Chrome for touch/pinch/pan
  feel and to confirm `touch-action: none` is actually suppressing native
  gesture handling — this is the primary target device and the one place
  gesture bugs will actually surface.
