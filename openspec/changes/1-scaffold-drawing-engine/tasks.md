## 1. Repo scaffold

- [x] 1.1 Create `index.html` shell with both screens (New Canvas, Workspace)
      and `<script type="module">` entry point
- [x] 1.2 Create `style.css` (mobile-first, bottom tab bar layout)
- [x] 1.3 Create `js/app.js` with a tiny screen router (show/hide, no URL
      routing)

## 2. Drawing engine (`js/engine.js`)

- [x] 2.1 Implement buffer allocation: flat `Uint8ClampedArray`, sized
      `width * height * 4`
- [x] 2.2 Implement `setPixel(x, y, rgba)`
- [x] 2.3 Implement `strokeFreehand(points, rgba, pixelPerfect)` with raw path
      writing
- [x] 2.4 Implement Aseprite-style pixel-perfect corner-pixel removal for
      `pixelPerfect: true`
- [x] 2.5 Implement `floodFill(x, y, rgba)` (4-directional, no-op when target
      color already equals fill color)
- [x] 2.6 Implement `toPNGBlob()` native-resolution PNG serialization
- [x] 2.7 Unit tests (`node --test`): pixel set, flood fill (including no-op
      and fully-uniform cases), pixel-perfect corner-removal on known stroke
      paths

## 3. Undo/redo (`js/undo.js`)

- [x] 3.1 Implement snapshot push on completed stroke/fill
- [x] 3.2 Cap stack at last 50 snapshots
- [x] 3.3 Implement redo-stack truncation when committing after an undo
- [x] 3.4 Unit tests: undo, redo, truncation-after-undo, 50-snapshot cap

## 4. Canvas view (`js/canvas-view.js`)

- [x] 4.1 Render engine buffer to `<canvas>` scaled with
      `image-rendering: pixelated`
- [x] 4.2 Set `touch-action: none` on the canvas element/container
- [x] 4.3 Translate pointer events to grid coordinates
- [x] 4.4 Implement one-finger drag → draw, two-finger drag → pan, pinch →
      zoom via the Pointer Events API

## 5. New Canvas screen (`js/new-canvas.js`)

- [x] 5.1 Build size preset picker (16/32/64/128) + custom width/height input
- [x] 5.2 Clamp custom width/height to 1–256px
- [x] 5.3 Build background choice (transparent / white)
- [x] 5.4 On confirm: allocate `engine.js` instance, fill background, switch to
      Workspace

## 6. Workspace screen (`js/workspace.js`)

- [x] 6.1 Wire pencil and eraser tools to `strokeFreehand` (eraser passes
      `rgba = [0,0,0,0]`)
- [x] 6.2 Wire bucket tool to `floodFill`
- [x] 6.3 Wire pixel-perfect toggle
- [x] 6.4 Build fixed ~16-swatch color palette row and current-color selection
- [x] 6.5 Wire undo/redo buttons to `undo.js`
- [x] 6.6 Wire "Export PNG" button to `engine.toPNGBlob()` and trigger download
- [x] 6.7 Add a "New" control to return to the New Canvas screen (with a
      confirm prompt, since there's no persistence yet), and make
      `canvas-view.js`/`workspace.js` reusable across multiple canvases in one
      session instead of re-binding DOM/pointer listeners on every creation

## 7. Manual device verification

- [ ] 7.1 Test draw/pan/pinch-zoom feel on an actual Android phone in Chrome
- [ ] 7.2 Confirm `touch-action: none` suppresses native gesture handling on
      that device
