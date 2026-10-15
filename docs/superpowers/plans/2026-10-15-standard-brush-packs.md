# Standard Brush Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give brush pixels their own opacity, grow the always-on Core set to eight brushes, and add five Standard Brushes packs the user adds from a sheet, like Standard Libraries.

**Architecture:** Brush pixels become `[x, y]` or `[x, y, a]`; `placeBrush` blends partial pixels with the engine's existing `setPixelBlended`. Pack data lives in `js/default-brush-packs.js` (mirrored to `assets/brushes/standard.json`), parsed by a DOM-free `js/standard-brushes.js`. Adding a pack copies its brushes into the existing `customBrushes` IndexedDB table with pack metadata; the brush palette groups brushes into sections.

**Tech Stack:** Vanilla ES modules, no build step, Dexie over IndexedDB, `node --test` with `fake-indexeddb` for tests.

**Design:** `docs/superpowers/specs/2026-10-15-standard-brush-packs-design.md`

## Global Constraints

- No bundler, no npm runtime deps; plain ES modules imported by relative path.
- Brushes stay single-colour: every pixel is drawn in the current colour.
- A pixel's opacity `a` is in (0, 1]; missing `a` means 1. Store `a` only when below 1.
- String grids: `X` = 100%, `1`–`9` = 10%–90%, `.` = off.
- Pack brushes are 3 to 16 pixels on each side.
- A 100% pixel must give exactly today's result (use `setPixel`, not `setPixelBlended`).
- Overlapping stamps within one drag stack (no per-drag dedup).
- The Dexie schema version does not change (new record fields are not indexed).
- The docked embed (`lib/pixi.js`) gets the editor Opacity row but not the Standard Brushes button or sheet; every new DOM lookup must tolerate a missing element.
- Run the whole suite with `npm test`; single file with `node --test test/<file>.test.js`.
- Every commit message ends with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/brushes.js` | modify | Pixel opacity: `patternToPixels`, `brushFromRows`, `placeBrush`, rotation, `pixelsFromGrid`, `editorPaintValue`; Core set |
| `js/brush-import.js` | modify | `imageToOpacityGrid` (replaces `thresholdToGrid`) |
| `js/brush-import-ui.js` | modify | Call the renamed function |
| `js/brush-preview.js` | create | `drawBrushPreview(canvas, brush)` shared by palette, button, sheet |
| `js/default-brush-packs.js` | create | `DEFAULT_BRUSH_PACKS` raw data (five packs) |
| `assets/brushes/standard.json` | create | Same data, downloaded at runtime |
| `js/standard-brushes.js` | create | Parse, pack statuses, missing brushes, load, picker sections |
| `js/standard-brushes-ui.js` | create | Standard Brushes sheet rendering and wiring |
| `js/persistence.js` | modify | `createCustomBrush` takes optional pack info |
| `js/workspace.js` | modify | Editor opacity, preview helper, sectioned palette, sheet init |
| `index.html`, `lib/pixi.js` | modify | Editor Opacity row; (index only) toolbar button + sheet |
| `style.css` | modify | Editor cell shading, opacity row, section headings, sheet previews |
| `test/brushes.test.js`, `test/brush-import.test.js`, `test/persistence.test.js` | modify | |
| `test/default-brush-packs.test.js`, `test/standard-brushes.test.js` | create | |
| `docs/specs/brushes/spec.md`, `docs/ui-reference.md`, `docs/roadmap.md` | modify | |

---

### Task 1: Per-pixel opacity in the brush engine

**Files:**
- Modify: `js/brushes.js`
- Test: `test/brushes.test.js`

**Interfaces:**
- Produces:
  - `patternToPixels(rows: string[]) => Array<[x, y] | [x, y, a]>` (now exported)
  - `brushFromRows(id: string, name: string, rows: string[]) => { id, name, width, height, pixels }`
  - `placeBrush(engine, cx, cy, brush, rgba, angleDegrees = 0, applyPixelTransform = null)` — unchanged signature; calls the per-pixel function as `(x, y, alpha)`
  - `pixelsFromGrid(grid: Array<Array<number | boolean>>) => pixels` (numbers 0–1; `true` = 1)
  - `editorPaintValue(current: number, opacity: number) => number`

- [ ] **Step 1: Write the failing tests**

Change the import line at the top of `test/brushes.test.js` to:

```js
import { BRUSHES, placeBrush, rainbowColor, pixelsFromGrid, patternToPixels, brushFromRows, editorPaintValue } from '../js/brushes.js';
```

Append these blocks to the end of `test/brushes.test.js`:

```js
describe('patternToPixels', () => {
  test('reads X as full, 1-9 as 10%-90%, and skips dots', () => {
    assert.deepEqual(patternToPixels(['X5.', '.19']), [
      [0, 0],
      [1, 0, 0.5],
      [1, 1, 0.1],
      [2, 1, 0.9],
    ]);
  });
});

describe('brushFromRows', () => {
  test('builds a brush with size taken from the rows', () => {
    const brush = brushFromRows('dot', 'Dot', ['...', '.X.', '...']);
    assert.deepEqual(brush, { id: 'dot', name: 'Dot', width: 3, height: 3, pixels: [[1, 1]] });
  });
});

describe('pixelsFromGrid with opacity', () => {
  test('stores a below 1 as a third value, drops 0, rounds to 2 decimals', () => {
    const grid = [
      [1, 0.5, 0],
      [0.333333, true, false],
    ];
    assert.deepEqual(pixelsFromGrid(grid), [
      [0, 0],
      [1, 0, 0.5],
      [0, 1, 0.33],
      [1, 1],
    ]);
  });
});

describe('editorPaintValue', () => {
  test('paints the current opacity, or clears a cell that already holds it', () => {
    assert.equal(editorPaintValue(0, 0.5), 0.5);
    assert.equal(editorPaintValue(1, 0.5), 0.5);
    assert.equal(editorPaintValue(0.5, 0.5), 0);
    assert.equal(editorPaintValue(1, 1), 0);
  });
});

describe('placeBrush with opacity', () => {
  test('a 50% pixel blends over what is there', () => {
    const engine = new PixelEngine(5, 5, 'white');
    const brush = { id: 'p', name: 'P', width: 1, height: 1, pixels: [[0, 0, 0.5]] };
    placeBrush(engine, 2, 2, brush, [0, 0, 0, 255]);
    assert.deepEqual(engine.getPixel(2, 2), [128, 128, 128, 255]);
  });

  test('overlapping stamps build up', () => {
    const engine = new PixelEngine(5, 5, 'white');
    const brush = { id: 'p', name: 'P', width: 1, height: 1, pixels: [[0, 0, 0.5]] };
    placeBrush(engine, 2, 2, brush, [0, 0, 0, 255]);
    placeBrush(engine, 2, 2, brush, [0, 0, 0, 255]);
    assert.deepEqual(engine.getPixel(2, 2), [64, 64, 64, 255]);
  });

  test('a 100% pixel still writes the colour exactly, even a translucent one', () => {
    const engine = new PixelEngine(5, 5, 'white');
    const brush = { id: 'p', name: 'P', width: 1, height: 1, pixels: [[0, 0]] };
    placeBrush(engine, 2, 2, brush, [255, 0, 0, 128]);
    assert.deepEqual(engine.getPixel(2, 2), [255, 0, 0, 128]);
  });

  test('rotation keeps each pixel\'s opacity', () => {
    const engine = new PixelEngine(10, 10, 'transparent');
    // A 3x1 bar, soft at both ends, turned upright by 90 degrees.
    const brush = { id: 'bar', name: 'Bar', width: 3, height: 1, pixels: [[0, 0, 0.5], [1, 0], [2, 0, 0.5]] };
    placeBrush(engine, 5, 5, brush, [0, 0, 0, 255], 90);
    assert.deepEqual(engine.getPixel(5, 4), [0, 0, 0, 128]);
    assert.deepEqual(engine.getPixel(5, 5), [0, 0, 0, 255]);
    assert.deepEqual(engine.getPixel(5, 6), [0, 0, 0, 128]);
  });

  test('the transform hook receives each pixel\'s opacity', () => {
    const engine = new PixelEngine(10, 10, 'transparent');
    const brush = { id: 'p', name: 'P', width: 1, height: 1, pixels: [[0, 0, 0.5]] };
    const seen = [];
    const record = (applyPixel) => (x, y, alpha) => {
      seen.push(alpha);
      applyPixel(x, y, alpha);
    };
    placeBrush(engine, 3, 3, brush, [0, 0, 0, 255], 0, record);
    assert.deepEqual(seen, [0.5]);
    assert.deepEqual(engine.getPixel(3, 3), [0, 0, 0, 128]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/brushes.test.js`
Expected: FAIL — `patternToPixels`, `brushFromRows`, `editorPaintValue` are not exported (SyntaxError on import).

- [ ] **Step 3: Implement**

In `js/brushes.js`, replace the `patternToPixels` function with:

```js
const LEVEL_CHARS = '123456789';

/**
 * Reads a string grid into brush pixels: `X` is a full pixel `[x, y]`,
 * `1`-`9` a partial one `[x, y, a]` at 10%-90% opacity, `.` is off. Used
 * for the Core brushes here and for Standard Brushes packs
 * (js/standard-brushes.js).
 */
export function patternToPixels(rows) {
  const pixels = [];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === 'X') pixels.push([x, y]);
      else if (LEVEL_CHARS.includes(cell)) pixels.push([x, y, Number(cell) / 10]);
    });
  });
  return pixels;
}

/** A brush from a string grid (see patternToPixels), sized to the grid. */
export function brushFromRows(id, name, rows) {
  return { id, name, width: rows[0].length, height: rows.length, pixels: patternToPixels(rows) };
}
```

Replace the `BRUSHES` export with:

```js
export const BRUSHES = [
  brushFromRows('heart', 'Heart', HEART_PATTERN),
  brushFromRows('circle', 'Circle', CIRCLE_PATTERN),
];
```

Replace `pixelsFromGrid` (keep its doc comment, updating the first line to say "a 2D grid of opacities (0 = off, 1 = full; `true`/`false` also accepted)"):

```js
export function pixelsFromGrid(grid) {
  const pixels = [];
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      const alpha = Math.round(Number(cell) * 100) / 100;
      if (alpha <= 0) return;
      pixels.push(alpha >= 1 ? [x, y] : [x, y, alpha]);
    });
  });
  return pixels;
}

/**
 * What a press on a brush-editor cell holding `current` paints: the
 * editor's `opacity`, or 0 (clear) when the cell already holds exactly
 * that opacity - so at 100% a press still toggles a cell on and off.
 */
export function editorPaintValue(current, opacity) {
  return current === opacity ? 0 : opacity;
}
```

In `rotatedBrushPixels`, replace the `seen`/`pixels` loop and return with (and add to its doc comment: "Each pixel keeps its opacity; when two land on the same cell the more opaque one wins."):

```js
  const byCell = new Map();
  for (const [x, y, alpha = 1] of brush.pixels) {
    const dx = x - cx;
    const dy = y - cy;
    const rx = Math.round(dx * cos - dy * sin + cx);
    const ry = Math.round(dx * sin + dy * cos + cy);
    const key = `${rx},${ry}`;
    const previous = byCell.get(key);
    if (!previous || alpha > previous[2]) byCell.set(key, [rx, ry, alpha]);
  }
  return [...byCell.values()];
```

Replace the body of `placeBrush` (add to its doc comment: "Each pixel is drawn at its own opacity: a full pixel replaces what is there with `rgba` exactly, a partial one blends over it with setPixelBlended, so overlapping stamps build up. The per-pixel function is called as `(x, y, alpha)`; symmetry's wrapper passes the third argument through."):

```js
export function placeBrush(engine, centerX, centerY, brush, rgba, angleDegrees = 0, applyPixelTransform = null) {
  const topLeftX = centerX - Math.floor(brush.width / 2);
  const topLeftY = centerY - Math.floor(brush.height / 2);
  const setPixel = (x, y, alpha = 1) =>
    alpha >= 1 ? engine.setPixel(x, y, rgba) : engine.setPixelBlended(x, y, rgba, alpha);
  const place = applyPixelTransform ? applyPixelTransform(setPixel, engine) : setPixel;
  for (const [dx, dy, alpha = 1] of rotatedBrushPixels(brush, angleDegrees)) {
    place(topLeftX + dx, topLeftY + dy, alpha);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/brushes.test.js test/brush-cursor.test.js test/symmetry.test.js`
Expected: PASS (all existing tests still pass too).

- [ ] **Step 5: Commit**

```bash
git add js/brushes.js test/brushes.test.js
git commit -m "Brushes: per-pixel opacity in patterns and placement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Core brush set

**Files:**
- Modify: `js/brushes.js`
- Test: `test/brushes.test.js`

**Interfaces:**
- Consumes: `brushFromRows` (Task 1)
- Produces: `BRUSHES` — eight brushes, ids in order `heart, circle, square, diamond, star, plus, soft-round, spray`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe('BRUSHES registry', ...)` block:

```js
  test('is the eight Core brushes, in order', () => {
    assert.deepEqual(BRUSHES.map((b) => b.id), ['heart', 'circle', 'square', 'diamond', 'star', 'plus', 'soft-round', 'spray']);
  });

  test('every Core brush is 3-16 px, in bounds, and has pixels', () => {
    for (const brush of BRUSHES) {
      assert.ok(brush.width >= 3 && brush.width <= 16, `${brush.id} width`);
      assert.ok(brush.height >= 3 && brush.height <= 16, `${brush.id} height`);
      assert.ok(brush.pixels.length > 0, `${brush.id} has pixels`);
      for (const [x, y, a = 1] of brush.pixels) {
        assert.ok(x >= 0 && x < brush.width && y >= 0 && y < brush.height, `${brush.id} (${x},${y}) in bounds`);
        assert.ok(a > 0 && a <= 1, `${brush.id} opacity ${a}`);
      }
    }
  });

  test('Soft Round has partial pixels and a full centre', () => {
    const soft = BRUSHES.find((b) => b.id === 'soft-round');
    assert.ok(soft.pixels.some(([, , a]) => a !== undefined && a < 1));
    assert.ok(soft.pixels.some(([x, y, a]) => x === 3 && y === 3 && a === undefined));
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/brushes.test.js`
Expected: FAIL — ids are `['heart', 'circle']`.

- [ ] **Step 3: Implement**

In `js/brushes.js`, after `CIRCLE_PATTERN`, add:

```js
const SQUARE_PATTERN = ['XXXXX', 'XXXXX', 'XXXXX', 'XXXXX', 'XXXXX'];

const DIAMOND_PATTERN = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'];

const STAR_PATTERN = [
  '...X...',
  '..XXX..',
  'XXXXXXX',
  '.XXXXX.',
  '..XXX..',
  '.XX.XX.',
  'XX...XX',
];

const PLUS_PATTERN = ['..X..', '..X..', 'XXXXX', '..X..', '..X..'];

// Opacity falls off from a solid centre (digits are 10%-90%).
const SOFT_ROUND_PATTERN = [
  '..121..',
  '.35653.',
  '158X851',
  '26XXX62',
  '158X851',
  '.35653.',
  '..121..',
];

// Scattered dots, some partial, for an airbrush-like spray.
const SPRAY_PATTERN = [
  '.5..X..',
  '...7..X',
  'X.....5',
  '..X.4..',
  '6.....X',
  '..5.X..',
  'X...6..',
];
```

Replace `BRUSHES` with:

```js
// The Core set: always in the brush palette, can't be deleted. Themed
// packs are added separately (js/standard-brushes.js).
export const BRUSHES = [
  brushFromRows('heart', 'Heart', HEART_PATTERN),
  brushFromRows('circle', 'Circle', CIRCLE_PATTERN),
  brushFromRows('square', 'Square', SQUARE_PATTERN),
  brushFromRows('diamond', 'Diamond', DIAMOND_PATTERN),
  brushFromRows('star', 'Star', STAR_PATTERN),
  brushFromRows('plus', 'Plus', PLUS_PATTERN),
  brushFromRows('soft-round', 'Soft Round', SOFT_ROUND_PATTERN),
  brushFromRows('spray', 'Spray', SPRAY_PATTERN),
];
```

Update the file's header comment: "Predefined (the Core set, or added Standard Brushes packs) or user-drawn custom pixel-art patterns ... each pixel full or partly opaque".

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/brushes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/brushes.js test/brushes.test.js
git commit -m "Brushes: Core set grows to eight, with Soft Round and Spray

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Image import keeps opacity

**Files:**
- Modify: `js/brush-import.js`, `js/brush-import-ui.js`
- Test: `test/brush-import.test.js`

**Interfaces:**
- Produces: `imageToOpacityGrid(imageData, width, height, useAlpha) => number[][]` (each cell 0, or 0.05–1 rounded to 2 decimals). Replaces `thresholdToGrid`.

- [ ] **Step 1: Rewrite the tests**

In `test/brush-import.test.js`, keep the `fakeImageData` helper, change the import to `import { imageToOpacityGrid } from '../js/brush-import.js';`, and replace every `describe`/`test` block with:

```js
describe('imageToOpacityGrid', () => {
  test('alpha mode: each cell takes the pixel\'s alpha as its opacity', () => {
    const imageData = fakeImageData(3, 1, [
      [0, 0, 0, 255],
      [0, 0, 0, 128],
      [0, 0, 0, 0],
    ]);
    assert.deepEqual(imageToOpacityGrid(imageData, 3, 1, true), [[1, 0.5, 0]]);
  });

  test('brightness mode: darker is more opaque', () => {
    const imageData = fakeImageData(2, 1, [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ]);
    assert.deepEqual(imageToOpacityGrid(imageData, 2, 1, false), [[1, 0]]);
  });

  test('brightness mode uses perceptual luminance weights', () => {
    // Pure green: luminance 0.587 * 255 = 149.685, so opacity 1 - 149.685/255 = 0.41.
    const imageData = fakeImageData(1, 1, [[0, 255, 0, 255]]);
    assert.deepEqual(imageToOpacityGrid(imageData, 1, 1, false), [[0.41]]);
  });

  test('cells under 5% become off', () => {
    const imageData = fakeImageData(2, 1, [
      [0, 0, 0, 10], // 0.04 -> off
      [0, 0, 0, 13], // 0.05 -> kept
    ]);
    assert.deepEqual(imageToOpacityGrid(imageData, 2, 1, true), [[0, 0.05]]);
  });

  test('produces a grid[y][x] shape matching the requested width/height', () => {
    const imageData = fakeImageData(3, 2, Array(6).fill([0, 0, 0, 255]));
    const grid = imageToOpacityGrid(imageData, 3, 2, false);
    assert.equal(grid.length, 2);
    assert.equal(grid[0].length, 3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/brush-import.test.js`
Expected: FAIL — `imageToOpacityGrid` is not exported.

- [ ] **Step 3: Implement**

Replace everything below the header comment in `js/brush-import.js` with (and update the header's "Thresholding step" wording to "Opacity step"):

```js
const MIN_OPACITY = 0.05; // fainter cells are noise, not part of the brush

/**
 * Converts a downsampled ImageData into a grid[y][x] of opacities (0 =
 * off, up to 1) for the brush editor - one cell per source pixel.
 * `useAlpha` (images with any transparency) uses each pixel's alpha;
 * otherwise (fully opaque images) darker pixels are more opaque, using
 * perceptual luminance `0.299r + 0.587g + 0.114b`. Values are rounded to
 * 2 decimals and anything under 5% becomes off.
 */
export function imageToOpacityGrid(imageData, width, height, useAlpha) {
  const { data } = imageData;
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const raw = useAlpha
        ? data[i + 3] / 255
        : 1 - (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const opacity = Math.round(raw * 100) / 100;
      row.push(opacity < MIN_OPACITY ? 0 : opacity);
    }
    grid.push(row);
  }
  return grid;
}
```

In `js/brush-import-ui.js`: change the import to `import { imageToOpacityGrid } from './brush-import.js';`, replace the call `thresholdToGrid(imageData, width, height, useAlpha)` with `imageToOpacityGrid(imageData, width, height, useAlpha)`, and in the header comment replace `thresholdToGrid` with `imageToOpacityGrid`. Then run `grep -rn thresholdToGrid js test lib` and update any remaining comment mentions (e.g. in `js/workspace.js`) to `imageToOpacityGrid`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/brush-import.test.js && grep -rn thresholdToGrid js test lib`
Expected: tests PASS; grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add js/brush-import.js js/brush-import-ui.js js/workspace.js test/brush-import.test.js
git commit -m "Brush import: map image alpha or darkness to cell opacity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Soft previews and the editor's Opacity row

**Files:**
- Create: `js/brush-preview.js`
- Modify: `js/workspace.js`, `index.html`, `lib/pixi.js`, `style.css`

**Interfaces:**
- Consumes: `editorPaintValue`, `pixelsFromGrid` (Task 1)
- Produces: `drawBrushPreview(canvas: HTMLCanvasElement, brush) => HTMLCanvasElement` (sizes the canvas to the brush, returns it)

This task is DOM wiring; it is verified in the browser, not by unit tests.

- [ ] **Step 1: Create `js/brush-preview.js`**

```js
// Brush preview: the brush's pattern drawn black on white, each pixel at
// its own opacity, into a canvas sized to the brush (CSS scales it up with
// image-rendering: pixelated). Shared by the brush palette, the
// tool-options brush button and the Standard Brushes sheet.

export function drawBrushPreview(canvas, brush) {
  canvas.width = brush.width;
  canvas.height = brush.height;
  const ctx = canvas.getContext('2d');
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, brush.width, brush.height);
  ctx.fillStyle = '#000000';
  for (const [x, y, alpha = 1] of brush.pixels) {
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  return canvas;
}
```

- [ ] **Step 2: Use it in `js/workspace.js`**

Add `import { drawBrushPreview } from './brush-preview.js';` next to the `./brushes.js` import, and add `editorPaintValue` to that import: `import { BRUSHES, placeBrush, rainbowColor, pixelsFromGrid, editorPaintValue } from './brushes.js';`

Replace the body of `buildBrushPreviewCanvas(brush)` with:

```js
  const canvas = drawBrushPreview(document.createElement('canvas'), brush);
  canvas.className = 'brush-swatch-preview';
  return canvas;
```

and update its doc comment's first line to "Draws a black-on-white preview of `brush`'s pattern, each pixel at its opacity (js/brush-preview.js), ...".

In `syncBrushPickerButton()`, replace the three lines

```js
  preview.width = brush.width;
  preview.height = brush.height;
  preview.getContext('2d').drawImage(buildBrushPreviewCanvas(brush), 0, 0);
```

with

```js
  drawBrushPreview(preview, brush);
```

- [ ] **Step 3: Editor grid holds opacities**

In `js/workspace.js`:

`makeEmptyBrushEditorGrid` fills with `0` instead of `false`:

```js
function makeEmptyBrushEditorGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(0));
}
```

Replace `let brushEditorPaintValue = true;` with:

```js
let brushEditorPaintValue = 1;
// The editor's Opacity row (#brush-editor-opacity): what a press paints.
let brushEditorOpacity = 1;
```

Add, directly above `setBrushEditorGrid`:

```js
/** Shows a cell's opacity: `.on` when painted, shaded by --cell-alpha. */
function paintBrushEditorCell(cell, value) {
  cell.classList.toggle('on', value > 0);
  cell.style.setProperty('--cell-alpha', String(value));
}
```

In `setBrushEditorGrid`, update the doc comment's shape note to "grid[y][x] opacity, 0 = off" and replace `cell.classList.toggle('on', brushEditorGridState[y][x]);` with `paintBrushEditorCell(cell, brushEditorGridState[y][x]);`.

In `bindBrushEditorOnce`, `setCellFromEvent`: replace

```js
    if (isFirst) brushEditorPaintValue = !brushEditorGridState[y][x];
    brushEditorGridState[y][x] = brushEditorPaintValue;
    cell.classList.toggle('on', brushEditorPaintValue);
```

with

```js
    if (isFirst) brushEditorPaintValue = editorPaintValue(brushEditorGridState[y][x], brushEditorOpacity);
    brushEditorGridState[y][x] = brushEditorPaintValue;
    paintBrushEditorCell(cell, brushEditorPaintValue);
```

In the Clear handler, replace `grid.querySelectorAll('.brush-editor-cell').forEach((c) => c.classList.remove('on'));` with `grid.querySelectorAll('.brush-editor-cell').forEach((c) => paintBrushEditorCell(c, 0));`.

At the top of `bindBrushEditorOnce`, after the `saveButton` lookup, add:

```js
  const opacityInput = root.querySelector('#brush-editor-opacity');
  const opacityReadout = root.querySelector('#brush-editor-opacity-readout');
  if (opacityInput) {
    opacityInput.addEventListener('input', () => {
      brushEditorOpacity = Number(opacityInput.value) / 100;
      if (opacityReadout) opacityReadout.textContent = `${opacityInput.value}%`;
    });
    bindSliderWheel(opacityInput);
  }
```

- [ ] **Step 4: Markup**

In `index.html`, inside `#brush-editor-panel`, directly after the `<div class="brush-editor-row">` holding the W/H labels, add:

```html
          <div class="brush-editor-row">
            <label class="brush-editor-opacity-label" for="brush-editor-opacity">Opacity</label>
            <input type="range" id="brush-editor-opacity" min="1" max="100" value="100" />
            <span id="brush-editor-opacity-readout" class="brush-editor-opacity-readout" aria-hidden="true">100%</span>
          </div>
```

In `lib/pixi.js`, add the same row at the same place in its `#brush-editor-panel` markup (six-space indentation to match that file).

- [ ] **Step 5: CSS**

In `style.css`, replace the `.brush-editor-cell.on` rule with:

```css
/* Each painted cell is shaded by its own opacity (--cell-alpha, 0-1). */
.brush-editor-cell.on {
  background: color-mix(in srgb, var(--color-accent) calc(var(--cell-alpha, 1) * 100%), var(--color-surface));
}
```

After the `.brush-editor-row:last-child` rule add:

```css
.brush-editor-opacity-label {
  font-size: 0.85rem;
}

#brush-editor-opacity {
  flex: 1;
  min-width: 0;
}

.brush-editor-opacity-readout {
  min-width: 4ch;
  text-align: end;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: Verify in the browser**

Run `npm test` (expect PASS), then serve the worktree root with `python3 -m http.server 8123` (background) and open `http://localhost:8123/`. Open a project, pick the Brush tool, open the brush palette:
- Soft Round and Spray thumbnails show grey partial pixels; the tool-options brush button matches.
- Add brush: set Opacity to 40%, press cells — they are lighter than at 100%; pressing a 40% cell again at 40% clears it; dragging paints 40%.
- Save, select the new brush, drag on the canvas: the trail builds up where stamps overlap.
- Import a PNG with soft edges: the grid shows graded cells.
- Rotation 30 and symmetry on: soft brushes still draw.

- [ ] **Step 7: Commit**

```bash
git add js/brush-preview.js js/workspace.js index.html lib/pixi.js style.css
git commit -m "Brush editor: Opacity row, graded cells, soft previews

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pack data

**Files:**
- Create: `js/default-brush-packs.js`, `assets/brushes/standard.json`
- Test: `test/default-brush-packs.test.js`

**Interfaces:**
- Produces: `DEFAULT_BRUSH_PACKS: Array<{ id, name, brushes: Array<{ id, name, rows: string[] }> }>` — pack ids in order `shapes, nature, texture, soft, game`

- [ ] **Step 1: Write the failing test**

Create `test/default-brush-packs.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_BRUSH_PACKS } from '../js/default-brush-packs.js';

describe('DEFAULT_BRUSH_PACKS', () => {
  test('is the five packs, in order', () => {
    assert.deepEqual(DEFAULT_BRUSH_PACKS.map((p) => p.id), ['shapes', 'nature', 'texture', 'soft', 'game']);
  });

  test('every brush is a well-formed 3-16 px grid with at least one pixel, ids unique per pack', () => {
    for (const pack of DEFAULT_BRUSH_PACKS) {
      const ids = new Set();
      for (const brush of pack.brushes) {
        const where = `${pack.id}/${brush.id}`;
        assert.ok(!ids.has(brush.id), `${where} unique`);
        ids.add(brush.id);
        assert.match(brush.id, /^[a-z0-9-]+$/, `${where} id`);
        assert.ok(brush.name.trim(), `${where} name`);
        const width = brush.rows[0].length;
        assert.ok(width >= 3 && width <= 16, `${where} width ${width}`);
        assert.ok(brush.rows.length >= 3 && brush.rows.length <= 16, `${where} height`);
        for (const row of brush.rows) {
          assert.equal(row.length, width, `${where} row "${row}" length`);
          assert.match(row, /^[.X1-9]+$/, `${where} row "${row}" characters`);
        }
        assert.ok(brush.rows.some((r) => /[X1-9]/.test(r)), `${where} has pixels`);
      }
    }
  });

  test('assets/brushes/standard.json is the same list', () => {
    const json = JSON.parse(readFileSync(new URL('../assets/brushes/standard.json', import.meta.url), 'utf8'));
    assert.deepEqual(json, DEFAULT_BRUSH_PACKS);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/default-brush-packs.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `js/default-brush-packs.js`**

```js
// The Standard Brushes packs (js/standard-brushes.js) as shipped: the
// built-in copy used offline or when assets/brushes/standard.json can't be
// downloaded. Keep the two identical (test/default-brush-packs.test.js
// checks). Rows use the brush string-grid format: X = full, 1-9 = 10%-90%
// opacity, . = off.

export const DEFAULT_BRUSH_PACKS = [
  {
    id: 'shapes',
    name: 'Shapes',
    brushes: [
      { id: 'triangle', name: 'Triangle', rows: ['...X...', '..XXX..', '..XXX..', '.XXXXX.', '.XXXXX.', 'XXXXXXX'] },
      { id: 'ring', name: 'Ring', rows: ['..XXX..', '.X...X.', 'X.....X', 'X.....X', 'X.....X', '.X...X.', '..XXX..'] },
      { id: 'crescent', name: 'Crescent', rows: ['..XXX..', '.XX....', 'XX.....', 'XX.....', 'XX.....', '.XX....', '..XXX..'] },
      { id: 'arrow', name: 'Arrow', rows: ['...X...', '...XX..', 'XXXXXX.', 'XXXXXXX', 'XXXXXX.', '...XX..', '...X...'] },
      { id: 'lightning', name: 'Lightning', rows: ['..XXX', '.XXX.', '.XX..', 'XXXXX', '..XX.', '..X..', '.X...', 'X....'] },
      { id: 'music-note', name: 'Music Note', rows: ['..XXX', '..X.X', '..X..', '..X..', '.XX..', 'XXX..', 'XXX..', '.X...'] },
      { id: 'sparkle', name: 'Sparkle', rows: ['...X...', '...X...', '..5X5..', 'XXXXXXX', '..5X5..', '...X...', '...X...'] },
    ],
  },
  {
    id: 'nature',
    name: 'Nature',
    brushes: [
      { id: 'grass-tuft', name: 'Grass Tuft', rows: ['X..X..X', '.X.X.X.', '.X.X.X.', '..XXX..', '..XXX..'] },
      { id: 'leaf', name: 'Leaf', rows: ['....XX', '..XXXX', '.XXXXX', 'XXXXX.', 'XXXX..', 'XXX...', 'X.....'] },
      { id: 'flower', name: 'Flower', rows: ['..X.X..', '.XXXXX.', 'XXX.XXX', '.XXXXX.', '..X.X..', '...X...', '...X...'] },
      { id: 'cloud', name: 'Cloud', rows: ['...XXX...', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', '.7777777.'] },
      { id: 'tree', name: 'Tree', rows: ['...X...', '..XXX..', '.XXXXX.', '..XXX..', '.XXXXX.', 'XXXXXXX', '...X...', '...X...'] },
      { id: 'snowflake', name: 'Snowflake', rows: ['X..X..X', '.X.X.X.', '..XXX..', 'XXXXXXX', '..XXX..', '.X.X.X.', 'X..X..X'] },
      { id: 'raindrop', name: 'Raindrop', rows: ['..X..', '..X..', '.XXX.', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'] },
    ],
  },
  {
    id: 'texture',
    name: 'Texture & Dither',
    brushes: [
      { id: 'checker', name: 'Checker 50%', rows: ['X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X'] },
      { id: 'bayer-25', name: 'Bayer 25%', rows: ['X.X.X.X.', '........', 'X.X.X.X.', '........', 'X.X.X.X.', '........', 'X.X.X.X.', '........'] },
      { id: 'bayer-75', name: 'Bayer 75%', rows: ['XXXXXXXX', '.X.X.X.X', 'XXXXXXXX', '.X.X.X.X', 'XXXXXXXX', '.X.X.X.X', 'XXXXXXXX', '.X.X.X.X'] },
      { id: 'hatching', name: 'Hatching', rows: ['X...X...', '.X...X..', '..X...X.', '...X...X', 'X...X...', '.X...X..', '..X...X.', '...X...X'] },
      { id: 'crosshatch', name: 'Crosshatch', rows: ['X...X...', '.X.X.X.X', '..X...X.', '.X.X.X.X', 'X...X...', '.X.X.X.X', '..X...X.', '.X.X.X.X'] },
      { id: 'noise', name: 'Noise', rows: ['3.7..5.2', '.6..X..4', '5..2.8..', '..X...3.', '7.3.6..5', '.4...2.X', '2..9..6.', '.5.3..4.'] },
      { id: 'brick', name: 'Brick', rows: ['XXXXXXXX', '...X....', '...X....', '...X....', 'XXXXXXXX', '.......X', '.......X', '.......X'] },
      { id: 'stipple', name: 'Stipple', rows: ['X.......', '....X...', '......X.', '.X......', '.....X..', '..X.....', '.......X', '...X....'] },
    ],
  },
  {
    id: 'soft',
    name: 'Soft',
    brushes: [
      { id: 'soft-round-s', name: 'Soft Round S', rows: ['.131.', '15851', '38X83', '15851', '.131.'] },
      { id: 'soft-round-m', name: 'Soft Round M', rows: ['...111...', '.1344431.', '.3567653.', '1469X9641', '147XXX741', '1469X9641', '.3567653.', '.1344431.', '...111...'] },
      { id: 'soft-round-l', name: 'Soft Round L', rows: ['.....111.....', '...1233321...', '..234555432..', '.13567776531.', '.24679997642.', '13579XXX97531', '13579XXX97531', '13579XXX97531', '.24679997642.', '.13567776531.', '..234555432..', '...1233321...', '.....111.....'] },
      { id: 'glow', name: 'Glow', rows: ['....121....', '..2355532..', '.246888642.', '.369XXX963.', '158XXXXX851', '258XXXXX852', '158XXXXX851', '.369XXX963.', '.246888642.', '..2355532..', '....121....'] },
      { id: 'soft-square', name: 'Soft Square', rows: ['4444444', '4888884', '48XXX84', '48XXX84', '48XXX84', '4888884', '4444444'] },
      { id: 'feather', name: 'Feather', rows: ['.........', '.11......', '.1441....', '..4751...', '..15X51..', '...1574..', '....1441.', '......11.', '.........'] },
      { id: 'smudge', name: 'Smudge', rows: ['2221111..', '655433211', 'X87654321', '655433211', '2221111..'] },
    ],
  },
  {
    id: 'game',
    name: 'Game & UI',
    brushes: [
      { id: 'coin', name: 'Coin', rows: ['..XXX..', '.X...X.', 'X..X..X', 'X..X..X', 'X..X..X', '.X...X.', '..XXX..'] },
      { id: 'gem', name: 'Gem', rows: ['.XXXXX.', 'X.X.X.X', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'] },
      { id: 'key', name: 'Key', rows: ['.XX......', 'X..X.....', 'X..XXXXXX', 'X..X..X.X', '.XX......'] },
      { id: 'skull', name: 'Skull', rows: ['.XXXXX.', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXX.XXX', '.XXXXX.', '.X.X.X.'] },
      { id: 'sword', name: 'Sword', rows: ['......X', '.....XX', '....XX.', 'X..XX..', '.XXX...', '.XX....', 'X.X....'] },
      { id: 'potion', name: 'Potion', rows: ['..XXX..', '...X...', '..X.X..', '.X...X.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.'] },
      { id: 'hud-heart', name: 'HUD Heart', rows: ['.XX.XX.', 'X..X..X', 'X.....X', '.X...X.', '..X.X..', '...X...'] },
    ],
  },
];
```

- [ ] **Step 4: Generate the JSON copy**

Run:

```bash
mkdir -p assets/brushes
node --input-type=module -e "import('./js/default-brush-packs.js').then((m) => process.stdout.write(JSON.stringify(m.DEFAULT_BRUSH_PACKS, null, 2) + '\n'))" > assets/brushes/standard.json
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test test/default-brush-packs.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/default-brush-packs.js assets/brushes/standard.json test/default-brush-packs.test.js
git commit -m "Brushes: Standard Brushes pack data (Shapes, Nature, Texture, Soft, Game)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `js/standard-brushes.js`

**Files:**
- Create: `js/standard-brushes.js`
- Test: `test/standard-brushes.test.js`

**Interfaces:**
- Consumes: `patternToPixels` (Task 1), `DEFAULT_BRUSH_PACKS` (Task 5)
- Produces:
  - `STANDARD_BRUSHES_URL = 'assets/brushes/standard.json'`
  - `parseStandardBrushes(json) => Array<{ id, name, brushes: Array<{ id, name, width, height, pixels }> }> | null`
  - `BUILT_IN_BRUSH_PACKS` — `parseStandardBrushes(DEFAULT_BRUSH_PACKS)`
  - `standardBrushRows(packs, existingBrushes) => Array<pack & { status: 'add' | 'restore' | 'added' }>`
  - `missingPackBrushes(pack, existingBrushes) => Array<{ name, width, height, pixels, packInfo: { pack, packName, packBrushId, packIndex } }>`
  - `loadStandardBrushes(fetchFn = globalThis.fetch) => Promise<packs>`
  - `brushSections(coreBrushes, customBrushes, packOrder: string[]) => Array<{ id, title, brushes }>`

`existingBrushes`/`customBrushes` are custom-brush records; pack ones carry `pack`, `packName`, `packBrushId`, `packIndex` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `test/standard-brushes.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStandardBrushes,
  BUILT_IN_BRUSH_PACKS,
  standardBrushRows,
  missingPackBrushes,
  loadStandardBrushes,
  brushSections,
} from '../js/standard-brushes.js';
import { DEFAULT_BRUSH_PACKS } from '../js/default-brush-packs.js';

const DOT = { id: 'dot', name: 'Dot', rows: ['...', '.X.', '...'] };
const SOFT = { id: 'soft', name: 'Soft', rows: ['...', '.5.', '...'] };

describe('parseStandardBrushes', () => {
  test('turns rows into width, height and pixels', () => {
    assert.deepEqual(parseStandardBrushes([{ id: 'p', name: ' P ', brushes: [DOT, SOFT] }]), [
      {
        id: 'p',
        name: 'P',
        brushes: [
          { id: 'dot', name: 'Dot', width: 3, height: 3, pixels: [[1, 1]] },
          { id: 'soft', name: 'Soft', width: 3, height: 3, pixels: [[1, 1, 0.5]] },
        ],
      },
    ]);
  });

  test('drops malformed brushes, then packs left empty; null for a non-list', () => {
    const parsed = parseStandardBrushes([
      {
        id: 'p',
        name: 'P',
        brushes: [
          DOT,
          { ...DOT }, // duplicate id
          { id: 'ragged', name: 'R', rows: ['XXX', 'XX', 'XXX'] },
          { id: 'bad-char', name: 'B', rows: ['XXX', 'XoX', 'XXX'] },
          { id: 'tiny', name: 'T', rows: ['XX', 'XX'] },
          { id: 'huge', name: 'H', rows: Array(17).fill('X'.repeat(17)) },
          { id: 'empty', name: 'E', rows: ['...', '...', '...'] },
          { id: 'Bad Id', name: 'I', rows: ['XXX', 'XXX', 'XXX'] },
          { id: 'no-name', name: ' ', rows: ['XXX', 'XXX', 'XXX'] },
        ],
      },
      { id: 'all-bad', name: 'All bad', brushes: [{ id: 'x', name: 'X', rows: [] }] },
      { id: 'p', name: 'Duplicate pack', brushes: [DOT] },
      { id: '', name: 'No id', brushes: [DOT] },
      'nope',
    ]);
    assert.deepEqual(parsed.map((p) => [p.id, p.brushes.map((b) => b.id)]), [['p', ['dot']]]);
    assert.equal(parseStandardBrushes({ id: 'x' }), null);
  });

  test('the built-in packs all parse in full', () => {
    assert.equal(BUILT_IN_BRUSH_PACKS.length, DEFAULT_BRUSH_PACKS.length);
    BUILT_IN_BRUSH_PACKS.forEach((pack, i) => assert.equal(pack.brushes.length, DEFAULT_BRUSH_PACKS[i].brushes.length, pack.id));
  });
});

const PACK = parseStandardBrushes([{ id: 'p', name: 'P', brushes: [DOT, SOFT] }])[0];
const record = (packBrushId, extra = {}) => ({ id: `r-${packBrushId}`, pack: 'p', packName: 'P', packBrushId, ...extra });

describe('standardBrushRows', () => {
  test('add when none present, restore when some, added when all', () => {
    const status = (existing) => standardBrushRows([PACK], existing)[0].status;
    assert.equal(status([]), 'add');
    assert.equal(status([record('dot')]), 'restore');
    assert.equal(status([record('dot'), record('soft')]), 'added');
  });

  test('ignores user brushes and other packs\' brushes', () => {
    const existing = [{ id: 'mine', name: 'dot' }, { id: 'o', pack: 'other', packBrushId: 'dot' }];
    assert.equal(standardBrushRows([PACK], existing)[0].status, 'add');
  });
});

describe('missingPackBrushes', () => {
  test('returns only the absent brushes, with pack info and their position', () => {
    assert.deepEqual(missingPackBrushes(PACK, [record('dot')]), [
      {
        name: 'Soft',
        width: 3,
        height: 3,
        pixels: [[1, 1, 0.5]],
        packInfo: { pack: 'p', packName: 'P', packBrushId: 'soft', packIndex: 1 },
      },
    ]);
  });
});

describe('loadStandardBrushes', () => {
  test('uses the downloaded list when it parses', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => [{ id: 'r', name: 'Remote', brushes: [DOT] }] });
    const packs = await loadStandardBrushes(fetchFn);
    assert.deepEqual(packs.map((p) => p.id), ['r']);
  });

  test('falls back to the built-in packs when offline, on a bad status, or bad JSON', async () => {
    for (const fetchFn of [
      async () => {
        throw new Error('offline');
      },
      async () => ({ ok: false, json: async () => [] }),
      async () => ({ ok: true, json: async () => ({ not: 'a list' }) }),
      async () => ({ ok: true, json: async () => [] }),
    ]) {
      assert.deepEqual(await loadStandardBrushes(fetchFn), BUILT_IN_BRUSH_PACKS);
    }
  });
});

describe('brushSections', () => {
  const core = [{ id: 'heart', name: 'Heart' }];

  test('Core, then packs in pack order, then My Brushes; empty sections hidden', () => {
    const custom = [
      { id: 'm1', name: 'Mine', createdAt: 2 },
      { id: 'b', pack: 'b', packName: 'Bee', packBrushId: 'x', packIndex: 0 },
      { id: 'a2', pack: 'a', packName: 'Ay', packBrushId: 'y', packIndex: 1 },
      { id: 'a1', pack: 'a', packName: 'Ay', packBrushId: 'x', packIndex: 0 },
      { id: 'm0', name: 'Older', createdAt: 1 },
    ];
    const sections = brushSections(core, custom, ['a', 'b']);
    assert.deepEqual(
      sections.map((s) => [s.id, s.title, s.brushes.map((b) => b.id)]),
      [
        ['core', 'Core', ['heart']],
        ['pack:a', 'Ay', ['a1', 'a2']],
        ['pack:b', 'Bee', ['b']],
        ['mine', 'My Brushes', ['m0', 'm1']],
      ],
    );
    assert.deepEqual(brushSections(core, [], ['a']).map((s) => s.id), ['core']);
  });

  test('packs no longer in the list come after the known ones, by name', () => {
    const custom = [
      { id: 'z', pack: 'zed', packName: 'Zed', packBrushId: 'x', packIndex: 0 },
      { id: 'o', pack: 'old', packName: 'Old', packBrushId: 'x', packIndex: 0 },
      { id: 'a', pack: 'a', packName: 'Ay', packBrushId: 'x', packIndex: 0 },
    ];
    assert.deepEqual(brushSections(core, custom, ['a']).map((s) => s.title), ['Core', 'Ay', 'Old', 'Zed']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/standard-brushes.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `js/standard-brushes.js`**

```js
// Standard Brushes: the brush packs that ship with Pixi (Shapes, Nature,
// Texture & Dither, Soft, Game & UI), added to the user's brushes from the
// Standard Brushes sheet the way Standard Libraries adds palettes. The
// list is downloaded from the site (assets/brushes/standard.json), falling
// back to the built-in copy (js/default-brush-packs.js) offline. Added
// brushes are copied into customBrushes with pack, packName, packBrushId
// and packIndex, so they can be deleted one by one and restored. DOM-free,
// unit-tested (test/standard-brushes.test.js); js/standard-brushes-ui.js
// renders the sheet.

import { patternToPixels } from './brushes.js';
import { DEFAULT_BRUSH_PACKS } from './default-brush-packs.js';

export const STANDARD_BRUSHES_URL = 'assets/brushes/standard.json';

const ID = /^[a-z0-9-]+$/;
const ROW = /^[.X1-9]+$/;
const MIN_SIZE = 3;
const MAX_SIZE = 16;

const isName = (value) => typeof value === 'string' && value.trim() !== '';
const isId = (value) => typeof value === 'string' && ID.test(value);

/** One pack brush as `{ id, name, width, height, pixels }`, or null if malformed. */
function parseBrush(raw) {
  if (!raw || !isId(raw.id) || !isName(raw.name) || !Array.isArray(raw.rows)) return null;
  const { rows } = raw;
  const width = typeof rows[0] === 'string' ? rows[0].length : 0;
  const height = rows.length;
  if (width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE) return null;
  if (!rows.every((row) => typeof row === 'string' && row.length === width && ROW.test(row))) return null;
  const pixels = patternToPixels(rows);
  if (pixels.length === 0) return null;
  return { id: raw.id, name: raw.name.trim(), width, height, pixels };
}

/**
 * The well-formed packs of a downloaded list, each brush turned into
 * pixels, or null if it isn't a list. Drops malformed or duplicate brushes,
 * then packs left with none (or a duplicate pack id).
 */
export function parseStandardBrushes(json) {
  if (!Array.isArray(json)) return null;
  const packs = [];
  const packIds = new Set();
  for (const raw of json) {
    if (!raw || !isId(raw.id) || !isName(raw.name) || !Array.isArray(raw.brushes) || packIds.has(raw.id)) continue;
    const brushIds = new Set();
    const brushes = [];
    for (const rawBrush of raw.brushes) {
      const brush = parseBrush(rawBrush);
      if (!brush || brushIds.has(brush.id)) continue;
      brushIds.add(brush.id);
      brushes.push(brush);
    }
    if (brushes.length === 0) continue;
    packIds.add(raw.id);
    packs.push({ id: raw.id, name: raw.name.trim(), brushes });
  }
  return packs;
}

export const BUILT_IN_BRUSH_PACKS = parseStandardBrushes(DEFAULT_BRUSH_PACKS);

/** `pack/packBrushId` of every pack brush the user already has. */
function presentKeys(existingBrushes) {
  return new Set(existingBrushes.filter((b) => b.pack).map((b) => `${b.pack}/${b.packBrushId}`));
}

/** Each pack with `status`: 'add' (none of its brushes present), 'restore' (some), 'added' (all). */
export function standardBrushRows(packs, existingBrushes) {
  const present = presentKeys(existingBrushes);
  return packs.map((pack) => {
    const count = pack.brushes.filter((b) => present.has(`${pack.id}/${b.id}`)).length;
    const status = count === 0 ? 'add' : count === pack.brushes.length ? 'added' : 'restore';
    return { ...pack, status };
  });
}

/** The pack's brushes the user doesn't have, ready for createCustomBrush. */
export function missingPackBrushes(pack, existingBrushes) {
  const present = presentKeys(existingBrushes);
  return pack.brushes
    .map((brush, packIndex) => ({ brush, packIndex }))
    .filter(({ brush }) => !present.has(`${pack.id}/${brush.id}`))
    .map(({ brush, packIndex }) => ({
      name: brush.name,
      width: brush.width,
      height: brush.height,
      pixels: brush.pixels,
      packInfo: { pack: pack.id, packName: pack.name, packBrushId: brush.id, packIndex },
    }));
}

/** Downloads the list, or returns the built-in packs when that fails or the file is unusable. */
export async function loadStandardBrushes(fetchFn = globalThis.fetch) {
  try {
    const response = await fetchFn(STANDARD_BRUSHES_URL, { cache: 'no-cache' });
    if (!response.ok) return BUILT_IN_BRUSH_PACKS;
    const parsed = parseStandardBrushes(await response.json());
    return parsed?.length ? parsed : BUILT_IN_BRUSH_PACKS;
  } catch {
    return BUILT_IN_BRUSH_PACKS;
  }
}

/**
 * The brush palette's sections: Core, then each added pack (in
 * `packOrder`, unknown packs after by name, brushes by packIndex), then My
 * Brushes (user-made, oldest first). Empty sections are left out.
 */
export function brushSections(coreBrushes, customBrushes, packOrder) {
  const packs = new Map();
  const mine = [];
  for (const brush of customBrushes) {
    if (!brush.pack) {
      mine.push(brush);
      continue;
    }
    if (!packs.has(brush.pack)) packs.set(brush.pack, { id: `pack:${brush.pack}`, pack: brush.pack, title: brush.packName || brush.pack, brushes: [] });
    packs.get(brush.pack).brushes.push(brush);
  }
  const rank = (pack) => {
    const index = packOrder.indexOf(pack);
    return index === -1 ? Infinity : index;
  };
  const packSections = [...packs.values()]
    .sort((a, b) => rank(a.pack) - rank(b.pack) || a.title.localeCompare(b.title))
    .map(({ id, title, brushes }) => ({ id, title, brushes: brushes.sort((a, b) => (a.packIndex ?? 0) - (b.packIndex ?? 0)) }));
  mine.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return [
    { id: 'core', title: 'Core', brushes: coreBrushes },
    ...packSections,
    { id: 'mine', title: 'My Brushes', brushes: mine },
  ].filter((section) => section.brushes.length > 0);
}
```

Note: `rank(a.pack) - rank(b.pack)` is `NaN` when both are `Infinity`; `NaN || compare` falls through to the name comparison, which is what we want.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/standard-brushes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/standard-brushes.js test/standard-brushes.test.js
git commit -m "Standard Brushes: parse, pack status, missing brushes, palette sections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Pack info on custom brushes

**Files:**
- Modify: `js/persistence.js` (`createCustomBrush`, around line 271)
- Test: `test/persistence.test.js`

**Interfaces:**
- Produces: `createCustomBrush(name, width, height, pixels, packInfo = null)` — when `packInfo` (`{ pack, packName, packBrushId, packIndex }`) is given, those four fields are saved on the record.

- [ ] **Step 1: Write the failing test**

Add inside `describe('createCustomBrush', ...)` in `test/persistence.test.js`:

```js
  test('saves pack info when given, and nothing extra when not', async () => {
    const packInfo = { pack: 'nature', packName: 'Nature', packBrushId: 'leaf', packIndex: 1 };
    const fromPack = await createCustomBrush('Leaf', 3, 3, [[1, 1, 0.5]], packInfo);
    const [stored] = (await listCustomBrushes()).filter((b) => b.id === fromPack.id);
    assert.equal(stored.pack, 'nature');
    assert.equal(stored.packName, 'Nature');
    assert.equal(stored.packBrushId, 'leaf');
    assert.equal(stored.packIndex, 1);
    assert.deepEqual(stored.pixels, [[1, 1, 0.5]]);

    const plain = await createCustomBrush('Mine', 3, 3, [[0, 0]]);
    assert.equal('pack' in plain, false);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/persistence.test.js`
Expected: FAIL — `stored.pack` is `undefined`.

- [ ] **Step 3: Implement**

In `js/persistence.js`, change `createCustomBrush` to (and add to its doc comment: "`packInfo`, when the brush comes from a Standard Brushes pack (js/standard-brushes.js), adds pack, packName, packBrushId and packIndex - not indexed, so no schema change."):

```js
export async function createCustomBrush(name, width, height, pixels, packInfo = null) {
  const record = {
    id: generateId(),
    name,
    width,
    height,
    pixels,
    userId: null,
    createdAt: Date.now(),
  };
  if (packInfo) {
    const { pack, packName, packBrushId, packIndex } = packInfo;
    Object.assign(record, { pack, packName, packBrushId, packIndex });
  }
  await db.customBrushes.put(record);
  return record;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/persistence.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/persistence.js test/persistence.test.js
git commit -m "Persistence: custom brushes can carry Standard Brushes pack info

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sectioned palette and the Standard Brushes sheet

**Files:**
- Create: `js/standard-brushes-ui.js`
- Modify: `js/workspace.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `brushSections`, `BUILT_IN_BRUSH_PACKS`, `loadStandardBrushes`, `standardBrushRows`, `missingPackBrushes` (Task 6); `createCustomBrush(…, packInfo)`, `listCustomBrushes` (Task 7); `drawBrushPreview` (Task 4); `showToast(message, { type })` from `js/toast.js`.
- Produces: `initStandardBrushes(root, { onBrushesChanged: () => Promise<void> })`

DOM wiring; verified in the browser.

- [ ] **Step 1: Sectioned palette in `js/workspace.js`**

Add the import: `import { brushSections, BUILT_IN_BRUSH_PACKS } from './standard-brushes.js';`

Above `renderBrushesPanel`, add:

```js
// Pack sections in the palette follow the shipped pack order.
const BRUSH_PACK_ORDER = BUILT_IN_BRUSH_PACKS.map((pack) => pack.id);
```

Replace `renderBrushesPanel` with:

```js
/**
 * Rebuilds the brush palette from `allBrushes` in sections (Core, each
 * added Standard Brushes pack, My Brushes - js/standard-brushes.js's
 * brushSections), marking the current one active. Pack and user brushes
 * are both `isCustom` (stored in customBrushes), so both can be deleted.
 */
function renderBrushesPanel() {
  brushesPanelGrid.innerHTML = '';
  const sections = brushSections(BRUSHES, allBrushes.filter((b) => b.isCustom), BRUSH_PACK_ORDER);
  for (const section of sections) {
    const heading = document.createElement('h3');
    heading.className = 'brush-section-heading';
    heading.textContent = section.title;
    brushesPanelGrid.appendChild(heading);
    for (const brush of section.brushes) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'brush-swatch' + (brush.id === state.currentBrush?.id ? ' active' : '');
      swatch.title = brush.name;
      swatch.setAttribute('aria-label', brush.name);
      swatch.setAttribute('aria-pressed', String(brush.id === state.currentBrush?.id));
      swatch.appendChild(buildBrushPreviewCanvas(brush));
      swatch.addEventListener('click', () => {
        state.currentBrush = brush;
        refreshBrushCursor();
        syncBrushPickerButton();
        brushesPanelGrid.querySelectorAll('.brush-swatch').forEach((s) => {
          s.classList.toggle('active', s === swatch);
          s.setAttribute('aria-pressed', String(s === swatch));
        });
        deleteBrushButton.disabled = !brush.isCustom;
      });
      brushesPanelGrid.appendChild(swatch);
    }
  }
  deleteBrushButton.disabled = !state.currentBrush?.isCustom;
  syncBrushPickerButton();
}
```

Add `import { initStandardBrushes } from './standard-brushes-ui.js';` next to the `initBrushImport` import, and directly after `initBrushImport(root);` (around line 1963) add:

```js
  initStandardBrushes(root, { onBrushesChanged: loadCustomBrushes });
```

- [ ] **Step 2: Create `js/standard-brushes-ui.js`**

```js
// Standard Brushes sheet (#standard-brushes-sheet): each pack from
// js/standard-brushes.js with a strip of its brushes and Add, Restore
// (some were deleted) or Added. Adding copies the pack's missing brushes
// into customBrushes (js/persistence.js) and calls onBrushesChanged so the
// brush palette re-reads them. Opened from the brush palette's toolbar
// (#standard-brushes-button); not in the docked embed (lib/pixi.js).

import { createCustomBrush, listCustomBrushes } from './persistence.js';
import { loadStandardBrushes, standardBrushRows, missingPackBrushes } from './standard-brushes.js';
import { drawBrushPreview } from './brush-preview.js';
import { showToast } from './toast.js';

const BUTTON_TEXT = { add: 'Add', restore: 'Restore', added: 'Added' };

function buttonLabel(row) {
  if (row.status === 'added') return `${row.name} is in your brushes`;
  if (row.status === 'restore') return `Restore deleted ${row.name} brushes`;
  return `Add ${row.name}`;
}

async function addPack(row) {
  for (const brush of missingPackBrushes(row, await listCustomBrushes())) {
    await createCustomBrush(brush.name, brush.width, brush.height, brush.pixels, brush.packInfo);
  }
}

async function renderPacks(listEl, packs, onBrushesChanged) {
  const rows = standardBrushRows(packs, await listCustomBrushes());
  listEl.innerHTML = '';
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'prefs-row standard-library-row';
    const label = document.createElement('div');
    label.className = 'standard-library-label';
    const name = document.createElement('span');
    name.className = 'prefs-row-label';
    name.textContent = row.name;
    const previews = document.createElement('span');
    previews.className = 'standard-brush-previews';
    previews.setAttribute('aria-hidden', 'true');
    for (const brush of row.brushes) previews.appendChild(drawBrushPreview(document.createElement('canvas'), brush));
    label.append(name, previews);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-button standard-library-add';
    button.textContent = BUTTON_TEXT[row.status];
    button.disabled = row.status === 'added';
    button.setAttribute('aria-label', buttonLabel(row));
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await addPack(row);
        showToast(row.status === 'restore' ? `Restored ${row.name}` : `Added ${row.name}`);
      } catch {
        showToast(`Couldn't add ${row.name}. Try again.`, { type: 'error' });
      }
      await onBrushesChanged();
      await renderPacks(listEl, packs, onBrushesChanged);
      listEl.querySelector('.standard-library-add:not(:disabled)')?.focus();
    });
    item.append(label, button);
    listEl.appendChild(item);
  }
}

export function initStandardBrushes(root, { onBrushesChanged }) {
  const openButton = root.querySelector('#standard-brushes-button');
  const sheet = root.querySelector('#standard-brushes-sheet');
  if (!openButton || !sheet) return; // standalone-only (absent from lib/pixi.js's embed markup)
  const listEl = sheet.querySelector('#standard-brushes-list');
  openButton.addEventListener('click', async () => {
    listEl.textContent = 'Loading…';
    sheet.showModal();
    await renderPacks(listEl, await loadStandardBrushes(), onBrushesChanged);
  });
  sheet.querySelector('#standard-brushes-done').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close(); // backdrop
  });
}
```

- [ ] **Step 3: Markup in `index.html`**

In `#brushes-panel`'s `.brushes-panel-toolbar`, after `#delete-brush-button`, add:

```html
          <button type="button" id="standard-brushes-button" class="tool-button icon-button" aria-label="Standard Brushes" aria-haspopup="dialog" data-tooltip="Standard Brushes">
            <span class="material-symbols-outlined" aria-hidden="true">library_add</span>
          </button>
```

Directly after the closing `</dialog>` of `#standard-libraries-sheet`, add:

```html
    <!-- Standard Brushes (js/standard-brushes-ui.js, packs from
         js/standard-brushes.js): brush packs that ship with Pixi, added to
         the brush palette; Restore brings back deleted ones. -->
    <dialog id="standard-brushes-sheet" class="prefs-sheet" aria-labelledby="standard-brushes-title">
      <div class="prefs-sheet-inner">
        <header class="prefs-header">
          <h2 id="standard-brushes-title" class="prefs-title">Standard Brushes</h2>
          <button type="button" id="standard-brushes-done" class="prefs-done" aria-label="Done">
            <span class="material-symbols-outlined" aria-hidden="true">check</span>
          </button>
        </header>
        <div class="prefs-body">
          <p class="prefs-note">Adds a pack's brushes to your brush palette. Restore brings back ones you deleted.</p>
          <div id="standard-brushes-list" class="prefs-group standard-brushes-list" aria-live="polite"></div>
        </div>
      </div>
    </dialog>
```

- [ ] **Step 4: CSS in `style.css`**

After the `.brushes-panel-grid` rule add:

```css
/* Section titles (Core, each added pack, My Brushes) span the grid. */
.brush-section-heading {
  grid-column: 1 / -1;
  margin: 0.35rem 0 0;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.brush-section-heading:first-child {
  margin-top: 0;
}
```

After the `.standard-library-add` rule add:

```css
.standard-brush-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

/* Sized to the brush in pixels; scaled up crisply and letterboxed. */
.standard-brush-previews canvas {
  width: 20px;
  height: 20px;
  object-fit: contain;
  image-rendering: pixelated;
  background: #ffffff;
  border-radius: 3px;
  outline: 1px solid rgb(0 0 0 / 0.12);
}
```

Then check the floating popover: with ~50 brushes, `.brushes-panel-grid` must scroll inside the popover instead of the popover running off screen. The rule `.workspace-screen[data-layout="floating"] :is(… .brushes-panel-grid …)` already sets `overflow-y: auto; min-height: 0`; confirm in the browser that `#brushes-panel.brush-popover` has a bounded height. If it grows past the viewport, add:

```css
.workspace-screen[data-layout="floating"] .brush-popover {
  max-height: min(70vh, 32rem);
  display: flex;
  flex-direction: column;
}
```

(check the existing `.brush-popover` rules first and merge rather than duplicate `display`/`flex-direction` if already set).

- [ ] **Step 5: Verify in the browser**

Run `npm test` (expect PASS). Serve with `python3 -m http.server 8123` and open `http://localhost:8123/`. With a project open and the Brush tool active:
- The palette shows a "Core" heading and eight brushes; Delete is disabled on Core.
- Standard Brushes button opens the sheet: five packs, each with previews and Add.
- Add Nature: toast "Added Nature", the row turns to Added, the palette shows a Nature section in pack order after Core.
- Delete Leaf from the palette; reopen the sheet: Nature shows Restore; Restore brings Leaf back in its original position; no duplicates after pressing Add on another pack twice quickly.
- Add brush (editor): the new brush appears under My Brushes.
- Done, Escape and a backdrop click close the sheet; focus returns sensibly; the brush popover still behaves afterwards.
- Offline check: stop the server's access to `assets/brushes/standard.json` (rename it temporarily), reopen the sheet: the built-in packs still show. Rename it back.
- Reload: added packs persist.

- [ ] **Step 6: Commit**

```bash
git add js/standard-brushes-ui.js js/workspace.js index.html style.css
git commit -m "Brush palette: sections and the Standard Brushes sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs, UI review

**Files:**
- Modify: `docs/specs/brushes/spec.md`, `docs/ui-reference.md`, `docs/roadmap.md`, `docs/superpowers/specs/2026-10-15-standard-brush-packs-design.md` (only if anything changed during implementation)

- [ ] **Step 1: Update `docs/specs/brushes/spec.md`**

- In "Brush picker": replace "The system ships with two built-in shapes (Heart, Circle)." with "The system ships with eight Core brushes (Heart, Circle, Square, Diamond, Star, Plus, Soft Round, Spray), always present. The picker groups brushes into sections: Core, then each added Standard Brushes pack in pack order, then My Brushes (user-made or imported); empty sections are hidden." Add a scenario: **WHEN** the user has added the Nature pack and made one brush **THEN** the picker shows Core, Nature and My Brushes sections in that order.
- "Brush thumbnails show the pattern, not the name": add "Partial pixels are drawn at their own opacity, so soft brushes read as grey."
- "Place a brush": replace "every "on" pixel of the pattern set to the current draw color" with "every pixel of the pattern drawn in the current draw color at that pixel's own opacity: a full pixel replaces what is there, a partial pixel blends over it". Add a scenario for a 50% pixel over white giving mid grey.
- "Continuous brush placement while dragging": add "Overlapping placements within one drag build up (each blends over the last); there is no per-drag limit."
- "Brush rotation": add "Each pixel keeps its opacity when rotated; when two pixels land on one cell, the more opaque wins."
- "Custom brush creation": add the editor Opacity row (1–100%, default 100%; a press sets a cell to that opacity, or clears it if it already holds exactly that; a drag paints what the first press did). Replace the thresholding description of Import with: alpha (images with transparency) or darkness (fully opaque images) sets each cell's opacity; cells under 5% are off. Update the two import scenarios ("pre-fills with cells whose opacity follows the image's alpha/darkness").
- "Custom brushes persist across projects": change "Built-in brushes (Heart, Circle) cannot be deleted" to "Core brushes cannot be deleted; pack brushes and the user's own can".
- Add a new requirement **Standard Brushes** with: five packs (Shapes, Nature, Texture & Dither, Soft, Game & UI) downloaded from `assets/brushes/standard.json`, built-in copy offline; a sheet opened from the brush palette's toolbar listing each pack with previews and Add / Restore / Added; adding copies only missing brushes (never duplicates); deleted pack brushes can be restored; nothing is added automatically. Scenarios: adding a pack; restoring after deleting one brush; offline fallback.

- [ ] **Step 2: Update `docs/ui-reference.md`**

In the "Floating panel cards + mini-rail" paragraph's brush palette sentence, add: the palette's grid has section headings (`.brush-section-heading`: Core, each added pack, My Brushes); its toolbar has Add, Delete and Standard Brushes (`#standard-brushes-button`, opens `#standard-brushes-sheet`, `js/standard-brushes-ui.js`); the brush editor has an Opacity row (`#brush-editor-opacity`). Where Standard Libraries' sheet is described, add a matching line for `#standard-brushes-sheet` (rows reuse `.standard-library-row`/`.standard-library-add`; previews in `.standard-brush-previews`).

- [ ] **Step 3: Update `docs/roadmap.md`**

In Phase 5's list, after the "Layer context menu" bullet, add:

```markdown
- ~~**Standard brush packs**~~ — **done** 2026-10-15: brush pixels have
  their own opacity (editor Opacity row, soft image import, overlapping
  stamps build up); the Core set grows to eight; five Standard Brushes
  packs (Shapes, Nature, Texture & Dither, Soft, Game & UI) are added
  from a sheet in the brush palette, like Standard Libraries; the palette
  groups brushes into sections. Design:
  `docs/superpowers/specs/2026-10-15-standard-brush-packs-design.md`.
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, no failures.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/brushes/spec.md docs/ui-reference.md docs/roadmap.md docs/superpowers/specs/2026-10-15-standard-brush-packs-design.md
git commit -m "Docs: brushes spec, UI reference and roadmap for standard brush packs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: UI review**

Run the `web-design-guidelines` skill on the diff's UI parts (`index.html`, `style.css`, `js/standard-brushes-ui.js`, the brush palette and editor code in `js/workspace.js`). Fix findings, commit, then proceed to `requesting-code-review`.
