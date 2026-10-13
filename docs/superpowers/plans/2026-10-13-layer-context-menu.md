# Layer Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Layers row ⋯ menu after Pixelmator Pro for iPad.
It gains a Cut/Copy/Paste capsule strip backed by the system clipboard, a
pixel Lock toggle, and Select Content, and its items are regrouped.

**Architecture:**

- `Layer.locked` is layer data in `lib/pixel-engine/layers.js`.
- `js/workspace.js` checks `activeLayerEditable()` wherever a
  pixel-changing action starts.
- A new `js/clipboard.js` holds pure crop, match and place helpers (tested
  in Node), the in-app record, and thin browser wrappers around
  `navigator.clipboard`.
- `js/layers-ui.js` gets a pure `layerMenuState()` and a `strip` item kind
  in `openContextMenu()`.

**Tech Stack:** Vanilla ES modules, no build step, `node --test`,
Playwright WebKit for browser checks.

Spec: `docs/superpowers/specs/2026-10-13-layer-context-menu-design.md`.

## Global Constraints

- No build step, no npm runtime dependencies.
- Hit targets are at least 44px. Strip segments are at least 52px.
- Every new Material Symbols glyph goes into `index.html`'s `icon_names=`
  list, in alphabetical order.
- Never put `.ghost-button` or `.glass-pill` in markup (`js/layout.js`
  toggles them).
- Toast copy, verbatim:
  - "Layer is locked"
  - "Nothing to paste"
  - "Can't paste: 8 layers is the maximum"
  - "Copied inside Pixi only"
- Never `git add -A`. Stage explicit paths only, because `node_modules`
  is a symlink in this worktree.

---

### Task 1: `LayerStack` lock flag, merge refusals, `insertLayerAbove`

**Files:**
- Modify: `lib/pixel-engine/layers.js`. Change the `Layer` constructor,
  `copyLayerFields`, `duplicateLayer`, `snapshot`, `toProjectRecord`,
  `mergeLayers` and `mergeDown`, and add `setLocked`, `insertLayerAbove`
  and `#copyName`. Export `MAX_LAYERS`.
- Test: `lib/pixel-engine/layers.test.js`

**Interfaces:**
- Produces:
  - `export const MAX_LAYERS`
  - `layer.locked: boolean`
  - `LayerStack.setLocked(index, locked) → boolean`
  - `LayerStack.insertLayerAbove(index, { data, name = 'Pasted', copyOf = null, opacity = 1, blendMode = 'normal' }) → Layer | null`

- [ ] **Step 1: Write the failing tests** (append to `layers.test.js`)

```js
describe('Layer lock (layer-context-menu)', () => {
  test('new layers start unlocked; setLocked toggles and survives snapshot/restore and project records', () => {
    const stack = new LayerStack(4, 4);
    assert.equal(stack.getActiveLayer().locked, false);
    assert.equal(stack.setLocked(0, true), true);
    assert.equal(stack.getActiveLayer().locked, true);
    const snap = stack.snapshot();
    stack.setLocked(0, false);
    stack.restore(snap);
    assert.equal(stack.getActiveLayer().locked, true);
    const loaded = LayerStack.fromProjectRecord(stack.toProjectRecord());
    assert.equal(loaded.getActiveLayer().locked, true);
  });

  test('a stored record without the field loads unlocked', () => {
    const record = new LayerStack(4, 4).toProjectRecord();
    delete record.layers[0].locked;
    assert.equal(LayerStack.fromProjectRecord(record).getActiveLayer().locked, false);
  });

  test('setLocked refuses a bad index and the reference layer', () => {
    const stack = new LayerStack(4, 4);
    stack.addReferenceImageLayer(new Uint8ClampedArray(64));
    const refIndex = stack.getLayers().findIndex((l) => l.isReferenceImage);
    assert.equal(stack.setLocked(refIndex, true), false);
    assert.equal(stack.setLocked(9, true), false);
  });

  test('duplicate of a locked layer is unlocked', () => {
    const stack = new LayerStack(4, 4);
    stack.setLocked(0, true);
    stack.duplicateLayer(0);
    assert.equal(stack.getActiveLayer().locked, false);
  });

  test('mergeDown and mergeLayers refuse a locked layer', () => {
    const stack = new LayerStack(4, 4);
    stack.addLayer();
    stack.setLocked(1, true);
    assert.equal(stack.mergeDown(1), false);
    assert.equal(stack.mergeLayers([0, 1]), false);
    stack.setLocked(1, false);
    stack.setLocked(0, true);
    assert.equal(stack.mergeDown(1), false);
  });
});

describe('insertLayerAbove (layer-context-menu Paste)', () => {
  test('adds the data above index, in its group, active, named Pasted', () => {
    const stack = new LayerStack(2, 2);
    stack.addLayer();
    stack.groupLayers([1]);
    const data = new Uint8ClampedArray(16).fill(200);
    const layer = stack.insertLayerAbove(1, { data });
    assert.equal(stack.getActiveIndex(), 2);
    assert.equal(layer.name, 'Pasted');
    assert.equal(layer.groupId, stack.getLayers()[1].groupId);
    assert.deepEqual([...layer.engine.data], [...data]);
  });

  test('copyOf names it like Duplicate and carries opacity and blend', () => {
    const stack = new LayerStack(2, 2);
    const layer = stack.insertLayerAbove(0, { data: new Uint8ClampedArray(16), copyOf: 'Layer 1', opacity: 0.5, blendMode: 'multiply' });
    assert.equal(layer.name, 'Layer 1 copy');
    assert.equal(layer.opacity, 0.5);
    assert.equal(layer.blendMode, 'multiply');
    assert.equal(stack.insertLayerAbove(1, { data: new Uint8ClampedArray(16), copyOf: 'Layer 1' }).name, 'Layer 1 copy 2');
  });

  test('refuses at MAX_LAYERS and for a bad index', () => {
    const stack = new LayerStack(2, 2);
    while (stack.getLayers().length < MAX_LAYERS) stack.addLayer();
    assert.equal(stack.insertLayerAbove(0, { data: new Uint8ClampedArray(16) }), null);
    assert.equal(new LayerStack(2, 2).insertLayerAbove(5, { data: new Uint8ClampedArray(16) }), null);
  });
});
```

Also change the file's import to
`import { LayerStack, REFERENCE_MODES, MAX_LAYERS } from './layers.js';`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --test lib/pixel-engine/layers.test.js`

Expected: the new tests FAIL (`setLocked is not a function`, and so on).

- [ ] **Step 3: Implement**

```js
// const MAX_LAYERS = 8;  →
export const MAX_LAYERS = 8;

// Layer constructor, after this.groupId = null:
    // User-set pixel lock (layer-context-menu): refuses every action that
    // changes this layer's pixels (js/workspace.js's activeLayerEditable,
    // and the merges below). Unlike isBackground/isReferenceImage it
    // leaves reordering and grouping alone.
    this.locked = false;

// copyLayerFields, last line:
  to.locked = !!from.locked;

// snapshot() and toProjectRecord(), each layer object, after groupId:
        locked: l.locked,

// duplicateLayer: replace the naming lines with
    const layer = new Layer(this.#copyName(source.name), this.#width, this.#height, 'transparent');

  /** "<name> copy", then "<name> copy 2", "copy 3"... - never "copy copy". */
  #copyName(sourceName) {
    const base = `${sourceName.replace(/ copy(?: \d+)?$/, '')} copy`;
    const taken = new Set(this.#layers.map((l) => l.name));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
    return name;
  }

  /** Sets the user pixel lock. Refused (false) for a bad index or the reference layer. */
  setLocked(index, locked) {
    const layer = this.#layers[index];
    if (!layer || layer.isReferenceImage) return false;
    layer.locked = !!locked;
    return true;
  }

  /**
   * Paste's new layer (layer-context-menu): `data` (RGBA, width*height*4)
   * in a layer directly above `index`, in its group, made active. Named
   * `name`, or after `copyOf` the way duplicateLayer names copies.
   * Refused (null) for a bad index or at MAX_LAYERS.
   */
  insertLayerAbove(index, { data, name = 'Pasted', copyOf = null, opacity = 1, blendMode = 'normal' }) {
    const below = this.#layers[index];
    if (!below || this.#layers.length >= MAX_LAYERS) return null;
    const layer = new Layer(copyOf ? this.#copyName(copyOf) : name, this.#width, this.#height, 'transparent');
    layer.engine.data.set(data);
    layer.opacity = opacity;
    layer.blendMode = blendMode;
    layer.groupId = below.groupId;
    this.#layers.splice(index + 1, 0, layer);
    this.#activeIndex = index + 1;
    return layer;
  }

// mergeLayers: the locked check becomes
    if (sorted.some((i) => this.#isLocked(this.#layers[i]) || this.#layers[i].locked)) return false;
// mergeDown: the locked check becomes
    const pair = [this.#layers[index], this.#layers[index - 1]];
    if (pair.some((l) => this.#isLocked(l) || l.locked)) return false;
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/pixel-engine/layers.js lib/pixel-engine/layers.test.js
git commit -m "LayerStack: user pixel lock, merge refusals, insertLayerAbove"
```

### Task 2: `js/clipboard.js`

**Files:**
- Create: `js/clipboard.js`
- Test: `test/clipboard.test.js`

**Interfaces:**
- Consumes: `contentBounds(engine, rect)` from
  `lib/pixel-engine/transform.js`, which reads `.data` and `.width`.
- Produces:
  - Pure:
    - `cropToContent(source, rect) → { x, y, width, height, data } | null`
    - `matchesRecord(record, decoded) → boolean`
    - `placeOnCanvas(region, canvasWidth, canvasHeight) → Uint8ClampedArray`
  - State: `setRecord(record)`, `getRecord()`
  - Browser:
    - `regionToPngBlob(region) → Promise<Blob>`
    - `writeImage(blobOrPromise) → Promise<boolean>`
    - `readImage() → Promise<Blob | null>`
    - `imageFromPasteEvent(e) → File | null`
    - `imageToImageData(image) → ImageData`

- [ ] **Step 1: Write the failing tests**

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cropToContent, matchesRecord, placeOnCanvas, setRecord, getRecord } from '../js/clipboard.js';

// 3x3 RGBA source with one opaque red pixel at (1, 2) and one at (2, 1).
function source() {
  const data = new Uint8ClampedArray(3 * 3 * 4);
  data.set([255, 0, 0, 255], (2 * 3 + 1) * 4);
  data.set([255, 0, 0, 255], (1 * 3 + 2) * 4);
  return { data, width: 3, height: 3 };
}

describe('cropToContent', () => {
  test('crops tight to the content inside rect', () => {
    const r = cropToContent(source(), { x: 0, y: 0, width: 3, height: 3 });
    assert.deepEqual({ x: r.x, y: r.y, width: r.width, height: r.height }, { x: 1, y: 1, width: 2, height: 2 });
    assert.deepEqual([...r.data.slice(4, 8)], [255, 0, 0, 255]); // (2,1) is top-right of the crop
    assert.deepEqual([...r.data.slice(8, 12)], [255, 0, 0, 255]); // (1,2) is bottom-left
  });
  test('null for an empty area', () => {
    assert.equal(cropToContent(source(), { x: 0, y: 0, width: 1, height: 1 }), null);
  });
  test('clamps a rect hanging off the canvas', () => {
    const r = cropToContent(source(), { x: -2, y: -2, width: 10, height: 10 });
    assert.equal(r.width, 2);
  });
});

describe('matchesRecord', () => {
  const record = { width: 1, height: 2, data: new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0]) };
  test('exact match', () => {
    assert.equal(matchesRecord(record, { width: 1, height: 2, data: record.data.slice() }), true);
  });
  test('within rounding, colour ignored where alpha is 0', () => {
    assert.equal(matchesRecord(record, { width: 1, height: 2, data: new Uint8ClampedArray([11, 19, 30, 254, 9, 9, 9, 0]) }), true);
  });
  test('low alpha tolerates more colour drift', () => {
    const faint = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 10]) };
    assert.equal(matchesRecord(faint, { width: 1, height: 1, data: new Uint8ClampedArray([120, 90, 100, 10]) }), true);
  });
  test('different size or pixels, or no record', () => {
    assert.equal(matchesRecord(record, { width: 2, height: 1, data: record.data.slice() }), false);
    assert.equal(matchesRecord(record, { width: 1, height: 2, data: new Uint8ClampedArray([90, 20, 30, 255, 0, 0, 0, 0]) }), false);
    assert.equal(matchesRecord(null, record), false);
  });
});

describe('placeOnCanvas', () => {
  test('stamps the region at x, y and clips what hangs off', () => {
    const region = { x: 1, y: -1, width: 2, height: 2, data: new Uint8ClampedArray([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]) };
    const out = placeOnCanvas(region, 2, 2);
    assert.equal(out.length, 16);
    assert.deepEqual([...out.slice(4, 8)], [3, 3, 3, 3]); // region (0,1) lands at canvas (1,0)
    assert.deepEqual([...out.slice(0, 4)], [0, 0, 0, 0]);
  });
});

test('record store', () => {
  setRecord({ kind: 'layer' });
  assert.deepEqual(getRecord(), { kind: 'layer' });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/clipboard.test.js`

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `js/clipboard.js`**

```js
// Cut, Copy and Paste for layers (layer-context-menu). The pure helpers
// (crop, match, place) are unit-tested; the in-app record remembers where
// Pixi's own last copy came from, since a PNG on the system clipboard
// can't; the browser wrappers at the bottom are the only code that
// touches navigator.clipboard. js/workspace.js drives all of it.

import { contentBounds } from '../lib/pixel-engine/transform.js';

/**
 * The non-transparent pixels of `source` ({ data, width, height }) inside
 * `rect`, cropped tight, or null if there are none. `rect` is clamped to
 * the canvas first.
 */
export function cropToContent(source, rect) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(source.width, rect.x + rect.width);
  const y1 = Math.min(source.height, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return null;
  const bounds = contentBounds(source, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  if (!bounds) return null;
  const data = new Uint8ClampedArray(bounds.width * bounds.height * 4);
  for (let y = 0; y < bounds.height; y++) {
    const from = ((bounds.y + y) * source.width + bounds.x) * 4;
    data.set(source.data.subarray(from, from + bounds.width * 4), y * bounds.width * 4);
  }
  return { ...bounds, data };
}

/**
 * Whether `decoded` (ImageData-shaped) is Pixi's own last copy coming
 * back from the system clipboard. A PNG round trip through a canvas can
 * shift values by premultiplied-alpha rounding, more so the fainter the
 * pixel: alpha may differ by 1, colour by ceil(255 / alpha), and colour
 * is ignored where alpha is 0.
 */
export function matchesRecord(record, decoded) {
  if (!record || !decoded || record.width !== decoded.width || record.height !== decoded.height) return false;
  const a = record.data;
  const b = decoded.data;
  for (let i = 0; i < a.length; i += 4) {
    const alpha = a[i + 3];
    if (Math.abs(alpha - b[i + 3]) > 1) return false;
    if (alpha === 0) continue;
    const tolerance = Math.ceil(255 / alpha);
    for (let c = 0; c < 3; c++) {
      if (Math.abs(a[i + c] - b[i + c]) > tolerance) return false;
    }
  }
  return true;
}

/** A canvas-sized RGBA buffer with `region` stamped at its x, y; off-canvas parts are dropped. */
export function placeOnCanvas(region, canvasWidth, canvasHeight) {
  const out = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  for (let y = 0; y < region.height; y++) {
    const cy = region.y + y;
    if (cy < 0 || cy >= canvasHeight) continue;
    for (let x = 0; x < region.width; x++) {
      const cx = region.x + x;
      if (cx < 0 || cx >= canvasWidth) continue;
      const from = (y * region.width + x) * 4;
      out.set(region.data.subarray(from, from + 4), (cy * canvasWidth + cx) * 4);
    }
  }
  return out;
}

// Pixi's own last copy: { kind: 'layer' | 'selection', x, y, width,
// height, data } plus name/opacity/blendMode for 'layer'. Memory only.
let record = null;
export function setRecord(next) {
  record = next;
}
export function getRecord() {
  return record;
}

/** A PNG of an RGBA region ({ width, height, data }). */
export function regionToPngBlob(region) {
  const canvas = document.createElement('canvas');
  canvas.width = region.width;
  canvas.height = region.height;
  canvas.getContext('2d').putImageData(new ImageData(region.data, region.width, region.height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

/**
 * Writes a PNG (a Blob, or a Promise of one) to the system clipboard.
 * Call it synchronously from the click or keydown handler: the write
 * starts before the first await, and Safari accepts a promise inside
 * ClipboardItem, so the encode can finish after the gesture without
 * losing it. Resolves false when the API is missing or the write fails.
 */
export async function writeImage(blobOrPromise) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobOrPromise })]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first image on the system clipboard, or null (no image, no API,
 * refused, or Safari's Paste bubble dismissed). For the menu's Paste;
 * Cmd/Ctrl+V reads the paste event instead (imageFromPasteEvent).
 */
export async function readImage() {
  if (!navigator.clipboard?.read) return null;
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return await item.getType(type);
    }
  } catch {
    // Refused or dismissed - same as an empty clipboard.
  }
  return null;
}

/** The first image file in a `paste` event, or null. */
export function imageFromPasteEvent(e) {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
  }
  return null;
}

/** A decoded image's pixels at 1:1. */
export function imageToImageData(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height);
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `node --test test/clipboard.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/clipboard.js test/clipboard.test.js
git commit -m "Clipboard module: crop, match, place, and browser wrappers"
```

### Task 3: Workspace — Lock checks, Copy/Cut/Paste, Select Content, shortcuts

**Files:**
- Modify: `js/workspace.js`
  - imports
  - `onDrawStart` (~line 2474)
  - the selection Delete listener (~line 1930)
  - `getTransformTarget` (~line 2059)
  - the ⌘ keydown handler (~line 1773)
  - the bare-letter handler's text-field check (~line 1894)

**Interfaces:**
- Consumes:
  - Task 1: `MAX_LAYERS`, `insertLayerAbove`, `layer.locked`
  - Task 2: everything
  - `decodeImageFile` and `fitImageToCanvas` from `js/image-import.js`
  - `contentBounds` from `lib/pixel-engine/transform.js`
- Produces (exported for `layers-ui.js`):
  - `copyActive() → boolean`
  - `cutActive() → boolean`
  - `pasteFromClipboard() → Promise<boolean>` (the menu)
  - `pasteImage(blob | null) → Promise<boolean>`
  - `selectActiveContent() → boolean`
  - `getSelection() → rect | null`

This is browser wiring, with no Node-testable logic left after Tasks 1–2.
It's verified in Task 6.

- [ ] **Step 1: Imports.** Add these:

```js
import { cropToContent, matchesRecord, placeOnCanvas, setRecord, getRecord, regionToPngBlob, writeImage, readImage, imageFromPasteEvent, imageToImageData } from './clipboard.js';
import { MAX_LAYERS } from '../lib/pixel-engine/layers.js';
```

  Then add `decodeImageFile` and `fitImageToCanvas` to the existing
  `./image-import.js` import (or create that import), and `contentBounds`
  to the existing transform import.

- [ ] **Step 2: Add the helpers** next to `getTransformTarget`:

```js
/** Whether `el` takes typed text - shortcuts leave those keys to it. */
function isTextEntry(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/**
 * False when the active layer is user-locked (layer-context-menu), after
 * saying so. Every pixel-changing action calls this once as it starts,
 * so a refused gesture shows one toast and commits nothing.
 */
function activeLayerEditable() {
  if (!state.layerStack.getActiveLayer()?.locked) return true;
  showToast('Layer is locked');
  return false;
}

/** The active selection rect, or null. */
export function getSelection() {
  return state.selection;
}

/** Clears the selection's pixels on the active layer - selection Delete and Cut. One undo step. */
function deleteSelectionPixels() {
  if (!state.selection || !activeLayerEditable()) return false;
  const { x, y, width, height } = state.selection;
  state.layerStack.getActiveLayer().engine.clearRegion(x, y, width, height);
  state.canvasView.render();
  commit(); // commit() calls renderLayersPanel() directly, so a stale Layers thumbnail always gets refreshed
  return true;
}

/**
 * Copy (layer-context-menu): the selection's pixels on the active layer,
 * or with no selection the whole layer with its name, opacity and blend
 * mode, cropped to its content. Sets the in-app record and writes a PNG
 * to the system clipboard - call it synchronously from the user's click
 * or keydown (see clipboard.js's writeImage). False if there's nothing
 * to copy.
 */
export function copyActive() {
  const layer = state.layerStack.getActiveLayer();
  if (!layer || layer.isReferenceImage) return false;
  const engine = layer.engine;
  const region = cropToContent(engine, state.selection ?? { x: 0, y: 0, width: engine.width, height: engine.height });
  if (!region) return false;
  setRecord(state.selection
    ? { kind: 'selection', ...region }
    : { kind: 'layer', ...region, name: layer.name, opacity: layer.opacity, blendMode: layer.blendMode });
  writeImage(regionToPngBlob(region)).then((ok) => {
    if (!ok) showToast('Copied inside Pixi only');
  });
  return true;
}

/** Cut: Copy then clear, selection only - with no selection it does nothing. */
export function cutActive() {
  if (!state.selection || !activeLayerEditable()) return false;
  if (!copyActive()) return false;
  return deleteSelectionPixels();
}

/**
 * Paste (layer-context-menu): adds a new layer above the active one, as
 * one undo step. `blob` is the clipboard image, or null. Pixi's own last
 * copy comes back in place (and, for a whole layer, with its name,
 * opacity and blend); any other image is pasted 1:1 or scaled down to
 * fit, centred. With no image, Pixi's own last copy is used; with
 * neither, "Nothing to paste".
 */
export async function pasteImage(blob) {
  const stack = state.layerStack;
  if (stack.getLayers().length >= MAX_LAYERS) {
    showToast("Can't paste: 8 layers is the maximum");
    return false;
  }
  const record = getRecord();
  let from = null;
  let data = null;
  if (blob) {
    const image = await decodeImageFile(blob);
    if (!image) {
      showToast('Nothing to paste');
      return false;
    }
    const sameSize = record && image.width === record.width && image.height === record.height;
    if (sameSize && matchesRecord(record, imageToImageData(image))) from = record;
    else data = fitImageToCanvas(image, stack.width, stack.height, false).data;
  } else if (record) {
    from = record;
  } else {
    showToast('Nothing to paste');
    return false;
  }
  if (from) data = placeOnCanvas(from, stack.width, stack.height);
  const options = from?.kind === 'layer'
    ? { data, copyOf: from.name, opacity: from.opacity, blendMode: from.blendMode }
    : { data };
  if (!stack.insertLayerAbove(stack.getActiveIndex(), options)) return false;
  state.canvasView.render();
  commit();
  return true;
}

/** The menu's Paste: reads the system clipboard (Safari shows its Paste bubble), then pasteImage. */
export function pasteFromClipboard() {
  return readImage().then(pasteImage);
}

/** Select Content: the selection becomes the box around the active layer's pixels. */
export function selectActiveContent() {
  const engine = state.layerStack.getActiveLayer().engine;
  const bounds = contentBounds(engine, { x: 0, y: 0, width: engine.width, height: engine.height });
  if (!bounds) return false;
  state.selection = bounds;
  state.canvasView.setSelectionRect(bounds);
  updateSelectionControls();
  return true;
}
```

- [ ] **Step 3: Wire the existing paths**
  - The selection Delete listener body becomes
    `state.selectionDeleteButton.addEventListener('click', deleteSelectionPixels);`
  - In `getTransformTarget`, the disabled line becomes
    `const disabled = layer.isReferenceImage || !!layer.locked;`
  - In `onDrawStart`, directly after the eyedropper block (before
    `const activeEngine = ...`), add:

```js
      // Locked layer (layer-context-menu): every pixel-changing tool below
      // starts here, so one check refuses the whole gesture - strokeBackup
      // stays null, so onDrawMove/onDrawEnd do nothing.
      if (!activeLayerEditable()) return;
```

  - In the ⌘ keydown handler, before the `key === 'd'` block, add:

```js
      // Cmd/Ctrl+C and Cmd/Ctrl+X: copy or cut on the active layer
      // (layer-context-menu), left to a focused text field. Cmd/Ctrl+V is
      // the `paste` listener below - preventing its keydown would stop the
      // paste event that carries the image.
      if ((key === 'c' || key === 'x') && !isTextEntry(document.activeElement)) {
        e.preventDefault();
        if (key === 'c') copyActive();
        else cutActive();
        return;
      }
```

  - After that keydown listener (still inside `if (!globalListenersBound)`),
    add:

```js
    // Cmd/Ctrl+V (layer-context-menu): the paste event carries clipboard
    // files with no permission prompt, Safari included.
    document.addEventListener('paste', (e) => {
      if (root.querySelector('#screen-workspace').classList.contains('hidden')) return;
      if (isTextEntry(document.activeElement)) return;
      e.preventDefault();
      pasteImage(imageFromPasteEvent(e));
    });
```

  - Change the bare-letter handler's inline check to
    `if (isTextEntry(document.activeElement)) return;`.

- [ ] **Step 4: Run the tests**

Run: `npm test`

Expected: all pass. The tests import `workspace.js` with a stub
`document`, so this confirms nothing new runs at module load.

- [ ] **Step 5: Commit**

```bash
git add js/workspace.js
git commit -m "Workspace: lock checks, Copy/Cut/Paste, Select Content, shortcuts"
```

### Task 4: Menu — `layerMenuState`, strip, new order, Lock, row glyph, CSS, icons

**Files:**
- Modify: `js/layers-ui.js`
  - imports
  - `mergeButtonState`
  - `layerMenuItems`
  - `openContextMenu`
  - `buildLayerRow` (detail line)
- Modify: `style.css` (after the `.color-picker-action` block, and the
  layer-row block)
- Modify: `index.html` (`icon_names`)
- Test: `test/layer-menu.test.js`

**Interfaces:**
- Consumes: Task 3's exports, `contentBounds`, and `LayerStack.setLocked`.
- Produces:
  - `export function layerMenuState({ layer, layers, index, hasSelection, hasContent, selectionHasContent })`
  - It returns
    `{ cut, copy, paste, duplicate, lock, selectContent, merge, group, moveUp, moveDown, delete }`.
  - Each entry is `{ disabled }`. `lock` is `{ hidden, label, icon }`
    instead.

- [ ] **Step 1: Write the failing tests** (`test/layer-menu.test.js`)

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document ??= {}; // workspace.js reads `document` at load; see layers-marking.test.js
const { layerMenuState, mergeButtonState } = await import('../js/layers-ui.js');

const L = (over = {}) => ({ id: Math.random(), isBackground: false, isReferenceImage: false, locked: false, ...over });
const base = (over = {}) => {
  const layers = over.layers ?? [L(), L()];
  return { layer: layers[1], layers, index: 1, hasSelection: false, hasContent: true, selectionHasContent: false, ...over };
};

describe('layerMenuState', () => {
  test('Cut needs a selection with content, on an unlocked layer', () => {
    assert.equal(layerMenuState(base()).cut.disabled, true);
    assert.equal(layerMenuState(base({ hasSelection: true, selectionHasContent: true })).cut.disabled, false);
    const layers = [L(), L({ locked: true })];
    assert.equal(layerMenuState(base({ layers, layer: layers[1], hasSelection: true, selectionHasContent: true })).cut.disabled, true);
  });
  test('Copy needs content in the selection or the layer, and works when locked', () => {
    assert.equal(layerMenuState(base({ hasContent: false })).copy.disabled, true);
    assert.equal(layerMenuState(base({ hasSelection: true, selectionHasContent: false })).copy.disabled, true);
    const layers = [L(), L({ locked: true })];
    assert.equal(layerMenuState(base({ layers, layer: layers[1] })).copy.disabled, false);
  });
  test('Paste and Duplicate are disabled at 8 layers', () => {
    const layers = Array.from({ length: 8 }, () => L());
    const s = layerMenuState(base({ layers, layer: layers[1] }));
    assert.equal(s.paste.disabled, true);
    assert.equal(s.duplicate.disabled, true);
  });
  test('Lock flips to Unlock', () => {
    assert.deepEqual(layerMenuState(base()).lock, { hidden: false, label: 'Lock', icon: 'lock' });
    const layers = [L(), L({ locked: true })];
    assert.deepEqual(layerMenuState(base({ layers, layer: layers[1] })).lock, { hidden: false, label: 'Unlock', icon: 'lock_open' });
  });
  test('Select Content needs content', () => {
    assert.equal(layerMenuState(base({ hasContent: false })).selectContent.disabled, true);
  });
  test('Merge Down is disabled onto or from a locked layer', () => {
    const layers = [L({ locked: true }), L()];
    assert.equal(layerMenuState(base({ layers, layer: layers[1] })).merge.disabled, true);
  });
});

test('mergeButtonState: a locked layer among the marked disables Merge', () => {
  const layers = [L(), L({ locked: true }), L()];
  const marked = new Set([layers[1].id, layers[2].id]);
  assert.equal(mergeButtonState(layers, 2, marked).disabled, true);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/layer-menu.test.js`

Expected: FAIL (`layerMenuState` is not exported).

- [ ] **Step 3: Implement in `js/layers-ui.js`**

Imports:

```js
import { getLayerStack, renderCanvas, commit, onWorkspaceReset, bindPanelHeaderCollapse, copyActive, cutActive, pasteFromClipboard, selectActiveContent, getSelection } from './workspace.js';
import { BLEND_MODES, REFERENCE_MODES, MAX_LAYERS } from '../lib/pixel-engine/layers.js';
import { contentBounds } from '../lib/pixel-engine/transform.js';
```

Then delete the local `const MAX_LAYERS = 8;`.

`mergeButtonState`:

```js
export function mergeButtonState(layers, activeIndex, markedIds) {
  const marked = layers.filter((l) => markedIds.has(l.id));
  if (marked.length >= 2) return { disabled: marked.some((l) => l.locked), label: `Merge ${marked.length} layers` };
  const locked = (l) => !l || l.isBackground || l.isReferenceImage || l.locked;
  const disabled = activeIndex <= 0 || locked(layers[activeIndex]) || locked(layers[activeIndex - 1]);
  return { disabled, label: 'Merge down' };
}
```

`layerMenuState` and `layerMenuItems`:

```js
/**
 * Which layer ⋯ menu items are available (layer-context-menu). Pure:
 * `hasContent` (any non-transparent pixel on the layer) and
 * `selectionHasContent` (inside the selection) come precomputed from
 * layerMenuItems.
 */
export function layerMenuState({ layer, layers, index, hasSelection, hasContent, selectionHasContent }) {
  const atCap = layers.length >= MAX_LAYERS;
  const ref = !!layer.isReferenceImage;
  return {
    cut: { disabled: ref || !!layer.locked || !hasSelection || !selectionHasContent },
    copy: { disabled: ref || !(hasSelection ? selectionHasContent : hasContent) },
    paste: { disabled: atCap },
    duplicate: { disabled: atCap || ref },
    lock: { hidden: ref, label: layer.locked ? 'Unlock' : 'Lock', icon: layer.locked ? 'lock_open' : 'lock' },
    selectContent: { disabled: !hasContent },
    merge: { disabled: mergeButtonState(layers, index, new Set()).disabled },
    group: { disabled: !!layer.isBackground || ref },
    moveUp: { disabled: !!layer.isBackground },
    moveDown: { disabled: !!layer.isBackground },
    delete: { disabled: layers.length <= 1 },
  };
}

function layerMenuItems(layer, row) {
  const layerStack = getLayerStack();
  const layers = layerStack.getLayers();
  const index = indexOf(layer.id);
  const { engine } = layer;
  const selection = getSelection();
  const s = layerMenuState({
    layer,
    layers,
    index,
    hasSelection: !!selection,
    hasContent: !!contentBounds(engine, { x: 0, y: 0, width: engine.width, height: engine.height }),
    selectionHasContent: !!selection && !!contentBounds(engine, selection),
  });
  return [
    {
      type: 'strip',
      label: 'Edit',
      items: [
        { label: 'Cut', icon: 'content_cut', disabled: s.cut.disabled, onSelect: cutActive },
        { label: 'Copy', icon: 'content_copy', disabled: s.copy.disabled, onSelect: copyActive },
        { label: 'Paste', icon: 'content_paste', disabled: s.paste.disabled, onSelect: pasteFromClipboard },
      ],
    },
    { label: 'Duplicate', icon: 'library_add', shortcut: '⌘J', disabled: s.duplicate.disabled, onSelect: duplicateActiveLayer },
    ...(s.lock.hidden ? [] : [{ label: s.lock.label, icon: s.lock.icon, onSelect: () => apply(() => layerStack.setLocked(indexOf(layer.id), !layer.locked)) }]),
    { label: 'Rename', icon: 'edit', onSelect: () => startRename(row, layer.name, (name) => layerStack.renameLayer(indexOf(layer.id), name), { restoreFocus: true, key: layer.id }) },
    'separator',
    { label: 'Select Content', icon: 'select', disabled: s.selectContent.disabled, onSelect: selectActiveContent },
    'separator',
    { label: 'Merge Down', icon: 'merge', shortcut: '⌘E', disabled: s.merge.disabled, onSelect: () => apply(() => layerStack.mergeDown(indexOf(layer.id))) },
    layer.groupId
      ? { label: 'Remove from Group', icon: 'folder_off', onSelect: () => apply(() => removeFromGroup(layer.id)) }
      : { label: 'Group', icon: 'create_new_folder', shortcut: '⌘G', disabled: s.group.disabled, onSelect: () => apply(() => layerStack.groupLayers([indexOf(layer.id)])) },
    { label: 'Move Up', icon: 'arrow_upward', disabled: s.moveUp.disabled, onSelect: () => apply(() => layerStack.moveLayerUp(indexOf(layer.id))) },
    { label: 'Move Down', icon: 'arrow_downward', disabled: s.moveDown.disabled, onSelect: () => apply(() => layerStack.moveLayerDown(indexOf(layer.id))) },
    'separator',
    { label: 'Delete Layer', icon: 'delete', danger: true, disabled: s.delete.disabled, onSelect: () => deleteLayerWithConfirm(layer) },
  ];
}
```

`openContextMenu`: pull the button building into `menuButton(item, anchor,
className)` and handle the strip:

```js
/** One menu button: icon, label, optional shortcut; closes the menu, then runs onSelect. */
function menuButton(item, anchor, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('role', 'menuitem');
  button.disabled = !!item.disabled;
  button.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${item.icon}</span>`;
  const label = document.createElement('span');
  label.textContent = item.label;
  button.appendChild(label);
  if (item.shortcut) {
    const kbd = document.createElement('kbd');
    kbd.className = 'topbar-menu-shortcut';
    kbd.textContent = item.shortcut;
    button.appendChild(kbd);
  }
  button.addEventListener('click', () => {
    closeContextMenu({ restoreFocus: false });
    item.onSelect(anchor);
  });
  return button;
}

// in openContextMenu's loop, before the button code:
    if (item.type === 'strip') {
      // Cut/Copy/Paste capsule (layer-context-menu): icon over label.
      const strip = document.createElement('div');
      strip.className = 'action-capsule layer-menu-strip';
      strip.setAttribute('role', 'group');
      strip.setAttribute('aria-label', item.label);
      for (const segment of item.items) strip.appendChild(menuButton(segment, anchor, 'action-capsule-segment'));
      layerMenu.appendChild(strip);
      continue;
    }
    layerMenu.appendChild(menuButton(item, anchor, 'topbar-menu-item' + (item.danger ? ' topbar-menu-item-danger' : '')));
```

Also update `openContextMenu`'s doc comment to list `{ type: 'strip',
label, items }`.

The label moves into a `<span>`, where before it was a bare text node.
Check that `.topbar-menu-item` CSS doesn't depend on the bare text: it uses
flex with a gap, so it doesn't.

`buildLayerRow`: after `detail.textContent = layerDetail(layer);`:

```js
  if (layer.locked) {
    // User pixel lock (layer-context-menu): a glyph on the detail line,
    // clear of the name so renaming isn't in the way; read out as "Locked".
    detail.insertAdjacentHTML('afterbegin', '<span class="material-symbols-outlined layer-locked-glyph" aria-hidden="true">lock</span><span class="visually-hidden">Locked, </span>');
  }
```

- [ ] **Step 4: CSS (`style.css`).** Add after the
  `.color-picker-action .material-symbols-outlined` rule:

```css
/* One capsule of segments, icon over label (layer-context-menu's
   Cut/Copy/Paste strip). Its own radius, not .glass-pill, since
   js/layout.js adds and removes that class per layout. */
.action-capsule {
  display: flex;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ghost-hover);
}

.action-capsule-segment {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
  touch-action: manipulation;
}

.action-capsule-segment + .action-capsule-segment {
  border-inline-start: 1px solid var(--glass-border);
}

.action-capsule-segment:not(:disabled):hover {
  background: var(--ghost-hover);
}

.action-capsule-segment:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.action-capsule-segment:disabled {
  opacity: 0.4;
  cursor: default;
}

.action-capsule-segment .material-symbols-outlined {
  font-size: 1.3rem;
}

.layer-menu-strip {
  margin-bottom: 0.3rem;
}

.layer-locked-glyph {
  font-size: 0.85rem;
  vertical-align: -2px;
  margin-inline-end: 2px;
}
```

- [ ] **Step 5: Icons.** In `index.html`'s `icon_names=` list, add
  `content_cut`, `content_paste`, `lock_open` and `select` in alphabetical
  order. Then check the order:

```bash
grep -o 'icon_names=[^"&]*' index.html | cut -d= -f2 | tr ',' '\n' > /tmp/i && sort -c /tmp/i && echo sorted
```

- [ ] **Step 6: Run the tests**

Run: `npm test`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add js/layers-ui.js style.css index.html test/layer-menu.test.js
git commit -m "Layer menu: Cut/Copy/Paste strip, Lock, Select Content, regrouped"
```

### Task 5: Docs

**Files:**
- `docs/specs/layers/spec.md`
- Create `docs/specs/clipboard/spec.md`
- `docs/ui-reference.md`
- `docs/roadmap.md`

- [ ] **Step 1: `docs/specs/layers/spec.md`.** Add requirements, following
  the file's `### Requirement:` / `#### Scenario:` style:
  - Layer menu layout (the order from the design, section 1)
  - User pixel lock (the allowed and refused table, toast, row glyph,
    persistence, unlocked duplicate)
  - Select Content

  Update any existing requirement that lists the old menu order.
- [ ] **Step 2: `docs/specs/clipboard/spec.md`.** Requirements for Copy,
  Cut (selection only), Paste (new layer; in place vs fitted and centred;
  fallback rule; layer cap), the keyboard shortcuts with the text-field
  exception, and the system clipboard fallbacks. Take them from the
  design, section 2.
- [ ] **Step 3: `docs/ui-reference.md` and `docs/roadmap.md`.** Add the
  menu's new structure, `.action-capsule`, and `.layer-locked-glyph` where
  the layer ⋯ menu is described. Add a roadmap entry next to the
  2026-10-13 polish entries.
- [ ] **Step 4: Commit**

```bash
git add docs/specs/layers/spec.md docs/specs/clipboard/spec.md docs/ui-reference.md docs/roadmap.md
git commit -m "Docs: layer context menu, Lock, Select Content, clipboard"
```

### Task 6: Browser verification and review

- [ ] **Step 1: Serve the app and check it in Playwright WebKit**
  (persistent context):
  - Open the menu: check the order and disabled states (Cut disabled with
    no selection).
  - Lock, then a pencil stroke: the pixels don't change and the toast
    shows. The row shows the glyph.
  - Select Content: the selection rect equals the content bounds.
  - Copy, then dispatch a synthetic `paste` event with no files: a new
    layer appears with the same pixels in place (record fallback).
  - Dispatch a `paste` event carrying a foreign PNG `File`: a new centred
    layer appears.
  - Take a screenshot of the menu in light and dark.
- [ ] **Step 2: Run `web-design-guidelines`** over the menu and strip
  changes, then fix what it finds.
- [ ] **Step 3: Run `requesting-code-review`.** Fix what it finds and
  commit.
