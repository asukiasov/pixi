# Align and Rotate Popovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Transform popover with two top-bar popovers. Align does the six align-to-canvas actions. Rotate has a dial for free-angle rotation (RotSprite), ±90° steps, flips, and Reset / Apply.

**Architecture:**
- The pixel maths is pure and unit-tested: `lib/pixel-engine/rotsprite.js` does the resampling, and `rotateRegionFree` is added to `lib/pixel-engine/transform.js`.
- The dial's angle maths is pure and unit-tested in `js/rotate-dial.js`. That file also holds its small DOM wiring.
- `js/workspace.js` previews the rotation in the active layer from a saved copy of its pixels, and commits only on Apply.
- `js/transform-ui.js` wires both popovers.

**Tech Stack:** Vanilla ES modules, no build step. Tests use `node --test` (`npm test`). The tests are static and DOM-free.

**Design:** `docs/superpowers/specs/2026-10-15-align-rotate-popovers-design.md`

## Global Constraints

- No bundler, no npm runtime deps: plain ES modules imported by relative path.
- Positive angles turn **clockwise** on screen. The dial range is -180..180 and wraps (`wrapAngle(-180) === 180`).
- The dial snaps to a 15° multiple when within **3°** of it. Arrow keys move it **1°**, Shift+arrows **15°**, and Home resets it to 0.
- Multiples of 90° always go through the existing exact `rotateRegion`.
- The rotated result adds no new colours. Its transparent pixels don't overwrite what's under them.
- Rotation centring rounds down. Pixels off the canvas are lost; Undo restores them.
- Every Apply is exactly one undo step. 0° never commits. Closing the popover (✕, Escape, outside press, workspace reset) with a rotation pending cancels it.
- Titles: "Align Layer" / "Align Selection" and "Rotate Layer" / "Rotate Selection".
- Copy uses Forma voice, sentence case, `°` for degrees.

## File map

| File | Change |
|---|---|
| `lib/pixel-engine/rotsprite.js` | **Create.** `scale2x`, `rotatedSize`, `rotateNearest`, `rotSprite` |
| `lib/pixel-engine/rotsprite.test.js` | **Create.** Unit tests |
| `lib/pixel-engine/transform.js` | **Modify.** Add `rotateRegionFree` |
| `lib/pixel-engine/transform.test.js` | **Modify.** Tests for `rotateRegionFree` |
| `js/rotate-dial.js` | **Create.** `wrapAngle`, `snapAngle`, `pointerAngle`, `angleDelta`, `initRotateDial` |
| `test/rotate-dial.test.js` | **Create.** Tests for the pure helpers |
| `js/workspace.js` | **Modify.** `previewRotate`, `applyRotate`, `cancelRotate`, `onRotateEnd`; undo/redo/commit end a pending rotation |
| `js/transform-ui.js` | **Rewrite.** Align and Rotate popovers |
| `index.html` | **Modify.** Two toggles, two panels; remove `#transform-toggle` / `#transform-panel` |
| `style.css` | **Modify.** Replace the Transform popover block with Align/Rotate + dial styles |
| `test/transform-markup.test.js` | **Create.** Static markup/CSS checks |
| `docs/specs/layer-transform/spec.md`, `docs/ui-reference.md`, `docs/roadmap.md` | **Modify.** Docs |

---

### Task 1: RotSprite resampling

**Files:**
- Create: `lib/pixel-engine/rotsprite.js`
- Test: `lib/pixel-engine/rotsprite.test.js`

**Interfaces:**
- Produces (all take/return RGBA `Uint8ClampedArray`, row-major, 4 bytes per pixel):
  - `scale2x(data, w, h) → { data, width: 2w, height: 2h }`
  - `rotatedSize(w, h, degrees) → { width, height }`
  - `rotateNearest(data, w, h, degrees) → { data, width, height }`
  - `rotSprite(data, w, h, degrees) → { data, width, height }`

- [ ] **Step 1: Write the failing tests**

`lib/pixel-engine/rotsprite.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scale2x, rotatedSize, rotateNearest, rotSprite } from './rotsprite.js';

// Rows of characters: '.' transparent, any other letter its own colour.
function fromRows(rows) {
  const w = rows[0].length;
  const data = new Uint8ClampedArray(w * rows.length * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') data.set([ch.charCodeAt(0), 0, 0, 255], (y * w + x) * 4);
  }));
  return { data, width: w, height: rows.length };
}
function toRows({ data, width, height }) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const i = (y * width + x) * 4;
    return data[i + 3] ? String.fromCharCode(data[i]) : '.';
  }).join(''));
}
const run = (fn, rows, ...args) => {
  const { data, width, height } = fromRows(rows);
  return toRows(fn(data, width, height, ...args));
};

describe('scale2x', () => {
  test('a flat colour just doubles', () => {
    assert.deepEqual(run(scale2x, ['a']), ['aa', 'aa']);
  });

  test('a lone pixel becomes a 2x2 block', () => {
    assert.deepEqual(run(scale2x, ['...', '.a.', '...']), [
      '......', '......', '..aa..', '..aa..', '......', '......',
    ]);
  });

  test('a diagonal gets its corners filled', () => {
    assert.deepEqual(run(scale2x, ['.a', 'a.']), ['..aa', '.a.a', 'a.a.', 'aa..']);
  });
});

describe('rotatedSize', () => {
  test('quarter turns are exact', () => {
    assert.deepEqual(rotatedSize(3, 2, 0), { width: 3, height: 2 });
    assert.deepEqual(rotatedSize(3, 2, 90), { width: 2, height: 3 });
    assert.deepEqual(rotatedSize(3, 2, -90), { width: 2, height: 3 });
    assert.deepEqual(rotatedSize(3, 2, 180), { width: 3, height: 2 });
  });

  test('other angles take the rotated box, parity matched to the source', () => {
    assert.deepEqual(rotatedSize(1, 1, 45), { width: 3, height: 3 });
    assert.deepEqual(rotatedSize(4, 4, 45), { width: 6, height: 6 });
    assert.deepEqual(rotatedSize(4, 4, -45), { width: 6, height: 6 });
    assert.deepEqual(rotatedSize(5, 5, 30), { width: 7, height: 7 });
  });
});

describe('rotateNearest', () => {
  test('0 degrees is a copy', () => {
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], 0), ['ab', 'c.']);
  });

  test('quarter turns match rotateRegion', () => {
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], 90), ['ca', '.b']);
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], -90), ['b.', 'ac']);
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], 180), ['.c', 'ba']);
    assert.deepEqual(run(rotateNearest, ['abc'], 90), ['a', 'b', 'c']);
  });

  test('a lone pixel survives 45 degrees, centred', () => {
    assert.deepEqual(run(rotateNearest, ['a'], 45), ['...', '.a.', '...']);
  });
});

describe('rotSprite', () => {
  const shape = ['......', '.aab..', '.abbc.', '..bcc.', '...c..', '......'];

  test('adds no new colours', () => {
    for (const deg of [15, 30, 45, -60, 135]) {
      const out = run(rotSprite, shape, deg).join('');
      for (const ch of out) assert.ok('.abc'.includes(ch), `${deg}°: unexpected ${ch}`);
    }
  });

  test('output size is rotatedSize', () => {
    const { data, width, height } = fromRows(shape);
    const out = rotSprite(data, width, height, 30);
    assert.deepEqual({ width: out.width, height: out.height }, rotatedSize(6, 6, 30));
  });

  test('quarter turns are exact', () => {
    assert.deepEqual(run(rotSprite, shape, 90), run(rotateNearest, shape, 90));
    assert.deepEqual(run(rotSprite, shape, 0), shape);
  });

  test('a solid square keeps its middle at 45 degrees', () => {
    const out = run(rotSprite, ['aaaa', 'aaaa', 'aaaa', 'aaaa'], 45);
    assert.equal(out[3][3], 'a');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test lib/pixel-engine/rotsprite.test.js`
Expected: FAIL, with `Cannot find module` for `rotsprite.js`.

- [ ] **Step 3: Implement**

`lib/pixel-engine/rotsprite.js`:

```js
// Free-angle rotation for pixel art (the Rotate popover's dial,
// js/transform-ui.js). Pure functions over RGBA buffers - no DOM, no
// PixelEngine. rotSprite is the RotSprite method Aseprite uses: Scale2x
// the source up 8x, then rotate it and sample it back at 1x, so outlines
// stay clean and no new colours appear. rotateNearest is the fast version
// the dial previews with while dragging. Positive degrees turn clockwise
// on screen.

// Floating-point slack: cos(90°) is 6e-17, not 0.
const EPS = 1e-9;

function samePixel(d, i, j) {
  return d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3];
}

/** Scale2x (EPX): doubles the image, rounding off staircase corners. Edges repeat the border pixel. */
export function scale2x(data, w, h) {
  const width = w * 2;
  const height = h * 2;
  const out = new Uint8ClampedArray(width * height * 4);
  const at = (x, y) => (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
  const put = (x, y, from) => out.set(data.subarray(from, from + 4), (y * width + x) * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const b = at(x, y - 1);
      const d = at(x - 1, y);
      const f = at(x + 1, y);
      const hh = at(x, y + 1);
      const bd = samePixel(data, b, d);
      const bf = samePixel(data, b, f);
      const dh = samePixel(data, d, hh);
      const fh = samePixel(data, f, hh);
      put(2 * x, 2 * y, bd && !bf && !dh ? d : p);
      put(2 * x + 1, 2 * y, bf && !bd && !fh ? f : p);
      put(2 * x, 2 * y + 1, dh && !bd && !fh ? d : p);
      put(2 * x + 1, 2 * y + 1, fh && !bf && !dh ? f : p);
    }
  }
  return { data: out, width, height };
}

/**
 * The box a w x h image needs once turned by `degrees`. Exact at quarter
 * turns. Otherwise each side is bumped by one where needed to keep the
 * source's parity (w, or h when the turn is nearer a quarter than
 * upright), so output pixel centres line up with source pixel centres
 * and a lone pixel never falls between them.
 */
export function rotatedSize(w, h, degrees) {
  const turn = ((degrees % 360) + 360) % 360;
  if (turn === 0 || turn === 180) return { width: w, height: h };
  if (turn === 90 || turn === 270) return { width: h, height: w };
  const rad = (degrees * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  let width = Math.ceil(w * c + h * s - EPS);
  let height = Math.ceil(w * s + h * c - EPS);
  const upright = c >= s;
  if ((width - (upright ? w : h)) % 2) width += 1;
  if ((height - (upright ? h : w)) % 2) height += 1;
  return { width, height };
}

/**
 * Inverse-maps each output pixel's centre into `src` - the source scaled
 * up by `scale` to sw x sh - and copies that one sample. Outside the
 * source is transparent.
 */
function sampleRotated(src, sw, sh, scale, degrees) {
  const w = sw / scale;
  const h = sh / scale;
  const { width, height } = rotatedSize(w, h, degrees);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let oy = 0; oy < height; oy++) {
    for (let ox = 0; ox < width; ox++) {
      const dx = ox + 0.5 - width / 2;
      const dy = oy + 0.5 - height / 2;
      const sx = Math.floor((cos * dx + sin * dy + w / 2) * scale + EPS);
      const sy = Math.floor((-sin * dx + cos * dy + h / 2) * scale + EPS);
      if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue;
      const from = (sy * sw + sx) * 4;
      out.set(src.subarray(from, from + 4), (oy * width + ox) * 4);
    }
  }
  return { data: out, width, height };
}

/** Nearest-neighbour rotation about the centre - fast, used for the live drag preview. */
export function rotateNearest(data, w, h, degrees) {
  return sampleRotated(data, w, h, 1, degrees);
}

/** RotSprite: Scale2x three times (8x), then rotate and take one sample per 1x pixel. */
export function rotSprite(data, w, h, degrees) {
  if (degrees % 90 === 0) return rotateNearest(data, w, h, degrees);
  let big = { data, width: w, height: h };
  for (let i = 0; i < 3; i++) big = scale2x(big.data, big.width, big.height);
  return sampleRotated(big.data, big.width, big.height, 8, degrees);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test lib/pixel-engine/rotsprite.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add lib/pixel-engine/rotsprite.js lib/pixel-engine/rotsprite.test.js
git commit -m "Pixel engine: RotSprite free-angle rotation"
```

---

### Task 2: `rotateRegionFree`

**Files:**
- Modify: `lib/pixel-engine/transform.js`
- Test: `lib/pixel-engine/transform.test.js`

**Interfaces:**
- Consumes: `rotateNearest`, `rotSprite` from Task 1.
- Produces: `rotateRegionFree(engine, rect, degrees, quality = 'smooth') → rect | null`. It turns the pixels inside `rect` in place on the `PixelEngine` and returns the new rect clamped to the canvas, like `rotateRegion`. `quality` is `'fast'` (nearest) or `'smooth'` (RotSprite).

- [ ] **Step 1: Write the failing tests**

Change the import in `lib/pixel-engine/transform.test.js` to:

```js
import { flipRegion, rotateRegion, rotateRegionFree, contentBounds, alignOffset, moveRegion } from './transform.js';
```

Append:

```js
describe('rotateRegionFree', () => {
  test('0 degrees changes nothing', () => {
    const e = fromRows(['ab', 'c.']);
    assert.deepEqual(rotateRegionFree(e, all(e), 0), all(e));
    assert.deepEqual(toRows(e), ['ab', 'c.']);
  });

  test('quarter turns are rotateRegion', () => {
    for (const [deg, turn] of [[90, 'cw'], [-90, 'ccw'], [270, 'ccw'], [180, '180']]) {
      const a = fromRows(['abc', 'd..']);
      const b = fromRows(['abc', 'd..']);
      assert.deepEqual(rotateRegionFree(a, all(a), deg), rotateRegion(b, all(b), turn));
      assert.deepEqual(toRows(a), toRows(b));
    }
  });

  test('turns about the centre into the rotated box', () => {
    const e = fromRows(['.......', '.......', '.......', '...a...', '.......', '.......', '.......']);
    const next = rotateRegionFree(e, { x: 2, y: 2, width: 3, height: 3 }, 45, 'fast');
    assert.deepEqual(next, { x: 1, y: 1, width: 5, height: 5 });
    assert.equal(toRows(e)[3][3], 'a');
    assert.equal(toRows(e).join('').replaceAll('.', ''), 'a');
  });

  test("the rotated box's transparent corners don't erase what's under them", () => {
    const e = fromRows(['zzzzzzz', 'zzzzzzz', 'zz...zz', 'zz.a.zz', 'zz...zz', 'zzzzzzz', 'zzzzzzz']);
    rotateRegionFree(e, { x: 2, y: 2, width: 3, height: 3 }, 45, 'fast');
    const rows = toRows(e);
    assert.equal(rows[1][1], 'z');
    assert.equal(rows[3][3], 'a');
    assert.equal(rows[2][2], '.');
  });

  test('the returned rect is clamped to the canvas', () => {
    const e = fromRows(['abc', 'def', 'ghi']);
    assert.deepEqual(rotateRegionFree(e, all(e), 45), all(e));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test lib/pixel-engine/transform.test.js`
Expected: FAIL, because `rotateRegionFree` is not exported (a SyntaxError on the import).

- [ ] **Step 3: Implement**

At the top of `lib/pixel-engine/transform.js`, below the header comment:

```js
import { rotateNearest, rotSprite } from './rotsprite.js';
```

After `rotateRegion`:

```js
/**
 * Turns the pixels inside `rect` by any angle (degrees, clockwise) about
 * the rect's centre - the Rotate popover's dial. Quarter turns go through
 * rotateRegion (exact); other angles resample with RotSprite, or
 * nearest-neighbour when `quality` is 'fast' (the dial's drag preview).
 * The result fills the rotated box, centred on the same point (rounded
 * down); its transparent pixels leave what's under them alone. Returns
 * the new rect, clamped to the canvas (null if it fell entirely off).
 */
export function rotateRegionFree(engine, rect, degrees, quality = 'smooth') {
  const turn = ((degrees % 360) + 360) % 360;
  if (turn === 0) return clampRect(rect, engine.width, engine.height);
  if (turn === 90) return rotateRegion(engine, rect, 'cw');
  if (turn === 180) return rotateRegion(engine, rect, '180');
  if (turn === 270) return rotateRegion(engine, rect, 'ccw');
  const { x, y, width: w, height: h } = rect;
  const buffer = engine.extractRegion(x, y, w, h);
  const turned = (quality === 'fast' ? rotateNearest : rotSprite)(buffer, w, h, degrees);
  const next = {
    x: Math.floor(x + w / 2 - turned.width / 2),
    y: Math.floor(y + h / 2 - turned.height / 2),
    width: turned.width,
    height: turned.height,
  };
  engine.clearRegion(x, y, w, h);
  for (let py = 0; py < next.height; py++) {
    for (let px = 0; px < next.width; px++) {
      const i = (py * next.width + px) * 4;
      if (turned.data[i + 3] === 0) continue;
      engine.setPixel(next.x + px, next.y + py, [turned.data[i], turned.data[i + 1], turned.data[i + 2], turned.data[i + 3]]);
    }
  }
  return clampRect(next, engine.width, engine.height);
}
```

(`setPixel` ignores out-of-bounds coordinates, as `stampRegion`'s doc comment notes.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test lib/pixel-engine/transform.test.js lib/pixel-engine/rotsprite.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pixel-engine/transform.js lib/pixel-engine/transform.test.js
git commit -m "Pixel engine: rotateRegionFree for any angle"
```

---

### Task 3: Rotate dial

**Files:**
- Create: `js/rotate-dial.js`
- Test: `test/rotate-dial.test.js`

**Interfaces:**
- Produces:
  - `wrapAngle(deg) → number` in (-180, 180]
  - `snapAngle(deg) → number` (snaps to a 15° multiple within 3°, wrapped)
  - `pointerAngle(cx, cy, x, y) → degrees` (0 = right, 90 = down)
  - `angleDelta(from, to) → wrapped difference`
  - `initRotateDial(el, { onInput(deg), onChange(deg) }) → { get value(), set(deg) }`. `onInput` fires on each drag move that changes the value. `onChange` fires on drag end and on each key step. `set()` fires neither.
- Markup it expects (Task 5): `el` is `[role=slider]` containing `.rotate-dial-value`. It writes `--dial-angle`, the readout text, `aria-valuenow` and `aria-valuetext`. It ignores input while `aria-disabled="true"`.

- [ ] **Step 1: Write the failing tests**

`test/rotate-dial.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { wrapAngle, snapAngle, pointerAngle, angleDelta } from '../js/rotate-dial.js';

describe('wrapAngle', () => {
  test('wraps into (-180, 180]', () => {
    assert.equal(wrapAngle(0), 0);
    assert.equal(wrapAngle(190), -170);
    assert.equal(wrapAngle(-190), 170);
    assert.equal(wrapAngle(-180), 180);
    assert.equal(wrapAngle(540), 180);
    assert.equal(wrapAngle(270), -90);
    assert.equal(wrapAngle(-360), 0);
  });
});

describe('snapAngle', () => {
  test('snaps within 3 degrees of a 15 degree mark', () => {
    assert.equal(snapAngle(44), 45);
    assert.equal(snapAngle(42), 45);
    assert.equal(snapAngle(-88), -90);
    assert.equal(snapAngle(178), 180);
    assert.equal(snapAngle(-178), 180);
    assert.equal(snapAngle(2), 0);
  });

  test('leaves other angles alone', () => {
    assert.equal(snapAngle(41), 41);
    assert.equal(snapAngle(7), 7);
    assert.equal(snapAngle(-23), -23);
  });
});

describe('pointerAngle', () => {
  test('0 is right, 90 is down (screen y grows down)', () => {
    assert.equal(pointerAngle(0, 0, 1, 0), 0);
    assert.equal(pointerAngle(0, 0, 0, 1), 90);
    assert.equal(pointerAngle(0, 0, -1, 0), 180);
    assert.equal(pointerAngle(0, 0, 0, -1), -90);
  });
});

describe('angleDelta', () => {
  test('takes the short way across the seam', () => {
    assert.equal(angleDelta(170, -170), 20);
    assert.equal(angleDelta(-170, 170), -20);
    assert.equal(angleDelta(10, 40), 30);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/rotate-dial.test.js`
Expected: FAIL, with `Cannot find module`.

- [ ] **Step 3: Implement**

`js/rotate-dial.js`:

```js
// The Rotate popover's dial (bezel), js/transform-ui.js. Dragged around
// its centre or stepped with the arrow keys; the angle is whole degrees
// in (-180, 180], positive clockwise, and sticks to every 15° mark from
// 3° away. The pure helpers are unit-tested (test/rotate-dial.test.js);
// initRotateDial wires them to the [role=slider] element.

const SNAP_STEP = 15;
const SNAP_WITHIN = 3;

/** `deg` wrapped into (-180, 180]. */
export function wrapAngle(deg) {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a + 0; // + 0 turns -0 into 0
}

/** `deg` moved onto the nearest 15° mark if it's within 3° of it. */
export function snapAngle(deg) {
  const mark = Math.round(deg / SNAP_STEP) * SNAP_STEP;
  return Math.abs(deg - mark) <= SNAP_WITHIN ? wrapAngle(mark) : deg;
}

/** The angle of (x, y) around (cx, cy) in degrees - 0 right, 90 down. */
export function pointerAngle(cx, cy, x, y) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

/** How far `to` is from `from`, the short way round. */
export function angleDelta(from, to) {
  return wrapAngle(to - from);
}

/**
 * Wires the dial. `onInput(deg)` fires on every drag move that changes
 * the angle (for a cheap preview), `onChange(deg)` when a drag ends and
 * on each key step (for the real one). `set(deg)` updates the dial
 * without firing either. Ignores input while aria-disabled="true".
 */
export function initRotateDial(el, { onInput, onChange }) {
  const readout = el.querySelector('.rotate-dial-value');
  let value = 0;
  // Unsnapped, unrounded angle while dragging, so snapping never sticks.
  let raw = 0;
  let lastPointer = null;
  let centre = null;

  function show() {
    el.style.setProperty('--dial-angle', `${value}deg`);
    readout.textContent = `${value}°`;
    el.setAttribute('aria-valuenow', String(value));
    el.setAttribute('aria-valuetext', `${value} degrees`);
  }

  function setValue(next) {
    if (next === value) return false;
    value = next;
    show();
    return true;
  }

  const disabled = () => el.getAttribute('aria-disabled') === 'true';

  el.addEventListener('pointerdown', (e) => {
    if (disabled()) return;
    const r = el.getBoundingClientRect();
    centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    lastPointer = pointerAngle(centre.x, centre.y, e.clientX, e.clientY);
    raw = value;
    el.setPointerCapture(e.pointerId);
    el.focus();
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (lastPointer === null) return;
    const now = pointerAngle(centre.x, centre.y, e.clientX, e.clientY);
    raw = wrapAngle(raw + angleDelta(lastPointer, now));
    lastPointer = now;
    if (setValue(snapAngle(Math.round(raw)))) onInput(value);
  });

  const endDrag = () => {
    if (lastPointer === null) return;
    lastPointer = null;
    onChange(value);
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  el.addEventListener('keydown', (e) => {
    if (disabled()) return;
    const step = e.shiftKey ? SNAP_STEP : 1;
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
    let next;
    if (delta !== undefined) next = wrapAngle(value + delta);
    else if (e.key === 'Home') next = 0;
    else return;
    e.preventDefault();
    if (setValue(next)) onChange(value);
  });

  show();
  return {
    get value() {
      return value;
    },
    set(deg) {
      setValue(wrapAngle(deg));
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/rotate-dial.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/rotate-dial.js test/rotate-dial.test.js
git commit -m "Rotate dial: angle maths and pointer/keyboard wiring"
```

---

### Task 4: Workspace rotate preview

**Files:**
- Modify: `js/workspace.js` (import at line 8; `commit()` ~line 301; `performUndo()` ~line 325 and `performRedo()` just below it; `transformActiveLayer` ~line 2087; new block after `onWorkspaceReset` ~line 2251)

**Interfaces:**
- Consumes: `rotateRegionFree` (Task 2).
- Produces (exported from `js/workspace.js`):
  - `previewRotate(degrees, quality)`. The first call saves the active layer's pixels and the selection. Every call redraws from that copy. `quality` is `'fast'` or `'smooth'`.
  - `applyRotate(degrees)`. Draws `'smooth'`, ends the preview, and commits one undo step unless `degrees % 360 === 0`.
  - `cancelRotate()`. Restores the copy and the selection and ends the preview. It fires the `onRotateEnd` listeners.
  - `onRotateEnd(fn)`. `fn()` runs whenever a pending rotation ends any way other than `applyRotate`: cancel, undo/redo, another action committing, or a workspace reset.

workspace.js is DOM-bound and has no unit tests. This task is verified in the browser in Task 6.

- [ ] **Step 1: Import**

Change line 8 to:

```js
import { flipRegion, rotateRegion, rotateRegionFree, contentBounds, alignOffset, moveRegion } from '../lib/pixel-engine/transform.js';
```

- [ ] **Step 2: Shared selection helper and `transformActiveLayer`**

Directly below `clearSelection()` (~line 447) add:

```js
/** Moves the selection to `next` (null clears it) after a transform moved its content. */
function followSelection(next) {
  state.selection = next;
  state.canvasView.setSelectionRect(next);
  updateSelectionControls();
}
```

In `transformActiveLayer`, replace

```js
  if (state.selection) {
    state.selection = next;
    state.canvasView.setSelectionRect(next);
    updateSelectionControls();
  }
```

with

```js
  if (state.selection) followSelection(next);
```

- [ ] **Step 3: The preview block**

Directly after `export function onWorkspaceReset(fn) { … }` add:

```js
// Rotate popover's dial (js/transform-ui.js). A free-angle rotation is
// drawn into the active layer itself, from a copy of its pixels taken on
// the first previewRotate, so what you see is what Apply commits. It
// becomes an undo step only on applyRotate; cancelRotate puts the copy
// back. Undo/redo and any other commit end it too (see commit(),
// performUndo()), and onRotateEnd tells the popover to reset its dial.
let rotatePreview = null;
const rotateEndListeners = [];

function endRotatePreview() {
  rotatePreview = null;
  for (const fn of rotateEndListeners) fn();
}

export function onRotateEnd(fn) {
  rotateEndListeners.push(fn);
}

/** Shows the target turned by `degrees`; `quality` 'fast' (dragging) or 'smooth'. */
export function previewRotate(degrees, quality) {
  if (!rotatePreview) {
    if (getTransformTarget().disabled) return;
    const engine = state.layerStack.getActiveLayer().engine;
    rotatePreview = { engine, pixels: engine.data.slice(), selection: state.selection };
  }
  const { engine, pixels, selection } = rotatePreview;
  engine.data.set(pixels);
  const rect = selection ?? { x: 0, y: 0, width: engine.width, height: engine.height };
  const next = rotateRegionFree(engine, rect, degrees, quality);
  if (selection) followSelection(next);
  state.canvasView.render();
}

/** Commits the rotation at `degrees` as one undo step (none at 0°). */
export function applyRotate(degrees) {
  if (!rotatePreview) return;
  previewRotate(degrees, 'smooth');
  rotatePreview = null;
  if (degrees % 360) commit();
}

/** Puts the pixels and selection back as they were before the preview. */
export function cancelRotate() {
  if (!rotatePreview) return;
  const { engine, pixels, selection } = rotatePreview;
  engine.data.set(pixels);
  if (selection) followSelection(selection);
  state.canvasView.render();
  endRotatePreview();
}

// A new project's engines replace the previewed one - nothing to restore.
onWorkspaceReset(() => {
  if (rotatePreview) endRotatePreview();
});
```

- [ ] **Step 4: End a pending rotation from undo/redo and other commits**

At the very top of `performUndo()` and of `performRedo()` add:

```js
  cancelRotate();
```

At the very top of `commit()` add:

```js
  // Another edit landed mid-preview (a shortcut while the dial has
  // focus): the previewed rotation stays, as part of that edit.
  if (rotatePreview) endRotatePreview();
```

(`applyRotate` clears `rotatePreview` before it calls `commit()`, so Apply doesn't trigger this.)

- [ ] **Step 5: Syntax and test check**

Run: `node --check js/workspace.js && npm test`
Expected: no syntax error; every test passes.

- [ ] **Step 6: Commit**

```bash
git add js/workspace.js
git commit -m "Workspace: preview, apply and cancel a free-angle rotation"
```

---

### Task 5: Align and Rotate popovers (markup, CSS, wiring)

**Files:**
- Modify: `index.html` (top-bar group ~lines 206-210; Transform panel ~lines 870-920)
- Modify: `style.css` (Transform popover block ~lines 4515-4548)
- Rewrite: `js/transform-ui.js`
- Test: `test/transform-markup.test.js`

**Interfaces:**
- Consumes: `getTransformTarget`, `transformActiveLayer`, `previewRotate`, `applyRotate`, `cancelRotate`, `onRotateEnd`, `onWorkspaceReset` (workspace.js); `initRotateDial` (Task 3).
- Produces: `initTransform(root = document)`. The name is unchanged, so `js/app.js:150` needs no edit.

- [ ] **Step 1: Write the failing markup test**

`test/transform-markup.test.js`:

```js
// Align and Rotate popovers (2026-10-15 align-rotate-popovers). Static,
// like test/export-markup.test.js: reads the files, renders nothing.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const css = read('../style.css').replace(/\/\*[\s\S]*?\*\//g, '');
const panel = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('<!--', html.indexOf(`id="${id}"`)));

describe('Align and Rotate popovers', () => {
  test('the top bar has Align and Rotate instead of Transform', () => {
    assert.doesNotMatch(html, /id="transform-toggle"|id="transform-panel"/);
    const group = html.slice(html.indexOf('class="topbar-group"'), html.indexOf('id="undo-button"'));
    assert.match(group, /id="align-toggle"[^>]*aria-label="Align"[^>]*aria-controls="align-panel"/);
    assert.match(group, /id="rotate-toggle"[^>]*aria-label="Rotate"[^>]*aria-controls="rotate-panel"/);
  });

  test('Align has its six actions', () => {
    const align = panel('align-panel');
    assert.match(align, /role="dialog"[^>]*aria-labelledby="align-title"/);
    for (const edge of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
      assert.match(align, new RegExp(`data-transform="align-${edge}"`));
    }
  });

  test('Rotate has the dial, quarter steps, flips, Reset and Apply', () => {
    const rotate = panel('rotate-panel');
    assert.match(rotate, /role="dialog"[^>]*aria-labelledby="rotate-title"/);
    assert.match(rotate, /id="rotate-dial"[^>]*role="slider"[^>]*tabindex="0"[^>]*aria-valuemin="-180"[^>]*aria-valuemax="180"[^>]*aria-valuenow="0"/);
    assert.match(rotate, /class="rotate-dial-value"/);
    assert.match(rotate, /data-rotate-step="-90"[^>]*aria-label="Rotate 90° left"/);
    assert.match(rotate, /data-rotate-step="90"[^>]*aria-label="Rotate 90° right"/);
    assert.match(rotate, /data-transform="flip-horizontal"/);
    assert.match(rotate, /data-transform="flip-vertical"/);
    assert.match(rotate, /id="rotate-reset"[^>]*disabled/);
    assert.match(rotate, /id="rotate-apply"[^>]*disabled/);
    assert.doesNotMatch(rotate, /data-transform="align-/);
  });

  test('the dial turns with --dial-angle and takes touch drags', () => {
    assert.match(css, /\.rotate-dial\s*\{[^}]*touch-action:\s*none/);
    assert.match(css, /\.rotate-dial-knob\s*\{[^}]*rotate\(var\(--dial-angle\)\)/);
  });
});
```

The `panel()` helper reads from the panel's id up to the next HTML comment. So each panel in Step 3 must be followed by a comment, which the existing Share popover comment already provides for the Rotate panel.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/transform-markup.test.js`
Expected: FAIL, because `#transform-toggle` still exists.

- [ ] **Step 3: Markup**

In `index.html`, replace the Transform comment and `#transform-toggle` button inside `.topbar-group` with:

```html
        <!-- Align and Rotate popovers (align / flip / rotate the selection
             or layer), js/transform-ui.js. -->
        <button type="button" id="align-toggle" class="tool-button icon-button" aria-label="Align" data-tooltip="Align" aria-haspopup="true" aria-expanded="false" aria-controls="align-panel">
          <span class="material-symbols-outlined" aria-hidden="true">align_horizontal_center</span>
        </button>
        <button type="button" id="rotate-toggle" class="tool-button icon-button" aria-label="Rotate" data-tooltip="Rotate" aria-haspopup="true" aria-expanded="false" aria-controls="rotate-panel">
          <span class="material-symbols-outlined" aria-hidden="true">rotate_right</span>
        </button>
```

Replace the whole `<!-- Transform popover … -->` comment and `#transform-panel` div with:

```html
      <!-- Align popover, anchored below #align-toggle (js/transform-ui.js).
           Acts on the selection if there is one, else the whole active
           layer; the title says which. -->
      <div id="align-panel" class="canvas-settings-panel transform-panel hidden" role="dialog" aria-labelledby="align-title">
        <div class="canvas-settings-row canvas-settings-header-row">
          <h2 id="align-title">Align Layer</h2>
          <button type="button" class="icon-button transform-close" aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="canvas-settings-row transform-row">
          <button type="button" class="tool-button icon-button" data-transform="align-left" aria-label="Align left" data-tooltip="Align left">
            <span class="material-symbols-outlined" aria-hidden="true">align_horizontal_left</span>
          </button>
          <button type="button" class="tool-button icon-button" data-transform="align-center" aria-label="Align centre" data-tooltip="Align centre">
            <span class="material-symbols-outlined" aria-hidden="true">align_horizontal_center</span>
          </button>
          <button type="button" class="tool-button icon-button" data-transform="align-right" aria-label="Align right" data-tooltip="Align right">
            <span class="material-symbols-outlined" aria-hidden="true">align_horizontal_right</span>
          </button>
        </div>
        <div class="canvas-settings-row transform-row">
          <button type="button" class="tool-button icon-button" data-transform="align-top" aria-label="Align top" data-tooltip="Align top">
            <span class="material-symbols-outlined" aria-hidden="true">align_vertical_top</span>
          </button>
          <button type="button" class="tool-button icon-button" data-transform="align-middle" aria-label="Align middle" data-tooltip="Align middle">
            <span class="material-symbols-outlined" aria-hidden="true">align_vertical_center</span>
          </button>
          <button type="button" class="tool-button icon-button" data-transform="align-bottom" aria-label="Align bottom" data-tooltip="Align bottom">
            <span class="material-symbols-outlined" aria-hidden="true">align_vertical_bottom</span>
          </button>
        </div>
      </div>

      <!-- Rotate popover, anchored below #rotate-toggle (js/transform-ui.js).
           The dial previews a free-angle rotation in the layer itself
           (js/rotate-dial.js, js/workspace.js's previewRotate); Apply
           commits it, Reset or closing puts the pixels back. Flips apply
           at once, and wait while a rotation is pending. -->
      <div id="rotate-panel" class="canvas-settings-panel transform-panel hidden" role="dialog" aria-labelledby="rotate-title">
        <div class="canvas-settings-row canvas-settings-header-row">
          <h2 id="rotate-title">Rotate Layer</h2>
          <button type="button" class="icon-button transform-close" aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="rotate-dial-row">
          <button type="button" class="tool-button icon-button" data-rotate-step="-90" aria-label="Rotate 90° left" data-tooltip="Rotate 90° left">
            <span class="material-symbols-outlined" aria-hidden="true">rotate_left</span>
          </button>
          <div id="rotate-dial" class="rotate-dial" role="slider" tabindex="0" aria-label="Rotation" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="0" aria-valuetext="0 degrees">
            <span class="rotate-dial-knob" aria-hidden="true"></span>
            <span class="rotate-dial-value" aria-hidden="true">0°</span>
          </div>
          <button type="button" class="tool-button icon-button" data-rotate-step="90" aria-label="Rotate 90° right" data-tooltip="Rotate 90° right">
            <span class="material-symbols-outlined" aria-hidden="true">rotate_right</span>
          </button>
        </div>
        <div class="canvas-settings-row transform-row rotate-flip-row">
          <button type="button" class="tool-button icon-button" data-transform="flip-horizontal" aria-label="Flip horizontal" data-tooltip="Flip horizontal">
            <span class="material-symbols-outlined" aria-hidden="true">flip</span>
          </button>
          <button type="button" class="tool-button icon-button" data-transform="flip-vertical" aria-label="Flip vertical" data-tooltip="Flip vertical">
            <span class="material-symbols-outlined transform-icon-quarter" aria-hidden="true">flip</span>
          </button>
        </div>
        <div class="action-capsule rotate-actions" role="group" aria-label="Rotation">
          <button type="button" id="rotate-reset" class="action-capsule-segment" disabled>Reset</button>
          <button type="button" id="rotate-apply" class="action-capsule-segment is-primary" disabled>Apply</button>
        </div>
      </div>
```

- [ ] **Step 4: CSS**

In `style.css`, replace the block from `/* Transform popover (js/transform-ui.js) …` through the `.transform-icon-quarter { … }` rule with:

```css
/* Align and Rotate popovers (js/transform-ui.js) - Canvas Settings'
   popover look with rows of 44px icon buttons, sized to their content
   rather than the shared 15rem. */
.transform-panel {
  width: auto;
}

.transform-row,
.rotate-flip-row {
  gap: 0.25rem;
}

.rotate-flip-row {
  justify-content: center;
}

.transform-row .tool-button,
.rotate-dial-row .tool-button {
  min-width: 44px;
  min-height: 44px;
}

/* "flip" mirrors left-right; turned a quarter it reads as top-bottom. */
.transform-icon-quarter {
  transform: rotate(90deg);
}

.rotate-dial-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
}

/* The bezel: a ring with a knob dot on its rim at --dial-angle (0 at the
   top, clockwise), the angle in the middle. Dragged around its centre
   (js/rotate-dial.js), so the page mustn't scroll or zoom under it. */
.rotate-dial {
  --dial-angle: 0deg;
  position: relative;
  display: grid;
  place-items: center;
  width: 7rem;
  height: 7rem;
  border-radius: 50%;
  background: var(--color-track);
  box-shadow: inset 0 0 0 1px var(--color-border);
  touch-action: none;
  cursor: grab;
  user-select: none;
}

.rotate-dial:active {
  cursor: grabbing;
}

.rotate-dial:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

.rotate-dial[aria-disabled="true"] {
  opacity: 0.4;
  cursor: default;
}

.rotate-dial-knob {
  position: absolute;
  inset: 0;
  transform: rotate(var(--dial-angle));
  pointer-events: none;
}

.rotate-dial-knob::before {
  content: '';
  position: absolute;
  top: 0.45rem;
  left: 50%;
  width: 0.75rem;
  height: 0.75rem;
  margin-left: -0.375rem;
  border-radius: 50%;
  background: var(--color-text);
}

.rotate-dial-value {
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.rotate-actions {
  align-self: stretch;
}

.rotate-actions .action-capsule-segment {
  flex: 1;
  justify-content: center;
}
```

- [ ] **Step 5: Rewrite `js/transform-ui.js`**

```js
// Align and Rotate popovers (2026-10-15 align-rotate-popovers): align,
// flip and rotate the selection or the active layer. js/workspace.js's
// transformActiveLayer runs align and flip; previewRotate / applyRotate /
// cancelRotate run the dial (js/rotate-dial.js). Pixel work is in
// lib/pixel-engine/transform.js and rotsprite.js. Opened from
// #align-toggle and #rotate-toggle in the top bar, one at a time
// (pressing the other toggle is a press outside); wired once from
// js/app.js. Standalone only - embeds have neither panel, so this returns
// without wiring anything.

import {
  getTransformTarget,
  transformActiveLayer,
  previewRotate,
  applyRotate,
  cancelRotate,
  onRotateEnd,
  onWorkspaceReset,
} from './workspace.js';
import { initRotateDial } from './rotate-dial.js';

// data-transform value -> transformActiveLayer op.
const OPS = {
  'flip-horizontal': { kind: 'flip', axis: 'horizontal' },
  'flip-vertical': { kind: 'flip', axis: 'vertical' },
  'align-left': { kind: 'align', edge: 'left' },
  'align-center': { kind: 'align', edge: 'center' },
  'align-right': { kind: 'align', edge: 'right' },
  'align-top': { kind: 'align', edge: 'top' },
  'align-middle': { kind: 'align', edge: 'middle' },
  'align-bottom': { kind: 'align', edge: 'bottom' },
};

/** Below the toggle, clamped to the viewport (flips above when there's no room). */
function positionPanel(panel, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const margin = 8;
  let top = rect.bottom + 8;
  if (top + panelRect.height > window.innerHeight - margin) top = rect.top - panelRect.height - 8;
  top = Math.max(margin, Math.min(top, window.innerHeight - panelRect.height - margin));
  const left = Math.max(margin, Math.min(rect.right - panelRect.width, window.innerWidth - panelRect.width - margin));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

/** Open/close for one popover: its toggle, close button, Escape, a press outside, a workspace reset. */
function wirePopover(toggle, panel, { onOpen, onClose = () => {} }) {
  const isOpen = () => !panel.classList.contains('hidden');
  function close() {
    if (!isOpen()) return;
    panel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    onClose();
  }
  function open() {
    onOpen();
    panel.classList.remove('hidden'); // unhide before measuring
    toggle.setAttribute('aria-expanded', 'true');
    positionPanel(panel, toggle);
  }
  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  panel.querySelector('.transform-close').addEventListener('click', close);
  document.addEventListener('pointerdown', (e) => {
    if (!isOpen() || panel.contains(e.target) || toggle.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });
  onWorkspaceReset(close);
}

/** Wires the panel's [data-transform] buttons to transformActiveLayer; returns them. */
function wireActions(panel, afterEach) {
  const buttons = [...panel.querySelectorAll('[data-transform]')];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      transformActiveLayer(OPS[button.dataset.transform]);
      afterEach();
    });
  }
  return buttons;
}

const targetNoun = () => (getTransformTarget().kind === 'selection' ? 'Selection' : 'Layer');

function initAlign(root) {
  const toggle = root.querySelector('#align-toggle');
  const panel = root.querySelector('#align-panel');
  if (!toggle || !panel) return;
  const title = panel.querySelector('#align-title');

  // Refreshed on open and after every action.
  function sync() {
    const { alignDisabled } = getTransformTarget();
    for (const button of buttons) button.disabled = alignDisabled;
  }
  const buttons = wireActions(panel, sync);

  wirePopover(toggle, panel, {
    onOpen: () => {
      title.textContent = `Align ${targetNoun()}`;
      sync();
    },
  });
}

function initRotate(root) {
  const toggle = root.querySelector('#rotate-toggle');
  const panel = root.querySelector('#rotate-panel');
  if (!toggle || !panel) return;
  const title = panel.querySelector('#rotate-title');
  const dialEl = panel.querySelector('#rotate-dial');
  const steps = [...panel.querySelectorAll('[data-rotate-step]')];
  const reset = panel.querySelector('#rotate-reset');
  const apply = panel.querySelector('#rotate-apply');

  const dial = initRotateDial(dialEl, {
    onInput: (deg) => {
      previewRotate(deg, 'fast');
      sync();
    },
    onChange: (deg) => {
      previewRotate(deg, 'smooth');
      sync();
    },
  });

  // Flips wait while a rotation is pending; Reset and Apply need one.
  function sync() {
    const { disabled } = getTransformTarget();
    const pending = dial.value !== 0;
    dialEl.setAttribute('aria-disabled', String(disabled));
    for (const button of steps) button.disabled = disabled;
    for (const button of flips) button.disabled = disabled || pending;
    reset.disabled = disabled || !pending;
    apply.disabled = disabled || !pending;
  }
  const flips = wireActions(panel, sync);

  for (const button of steps) {
    button.addEventListener('click', () => {
      dial.set(dial.value + Number(button.dataset.rotateStep));
      previewRotate(dial.value, 'smooth');
      sync();
    });
  }
  // Both disable themselves, so focus goes back to the dial.
  reset.addEventListener('click', () => {
    cancelRotate();
    dialEl.focus();
  });
  apply.addEventListener('click', () => {
    applyRotate(dial.value);
    dial.set(0);
    sync();
    dialEl.focus();
  });

  // Cancel, undo/redo, another edit or a new project ended the preview.
  onRotateEnd(() => {
    dial.set(0);
    sync();
  });

  wirePopover(toggle, panel, {
    onOpen: () => {
      title.textContent = `Rotate ${targetNoun()}`;
      sync();
    },
    onClose: cancelRotate,
  });
}

export function initTransform(root = document) {
  initAlign(root);
  initRotate(root);
}
```

`sync` refers to `flips` and `buttons` before their `const` lines. That's safe because `sync` only runs from event callbacks after `init*` has returned. Don't reorder it into an eager call.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS, including `test/transform-markup.test.js`. If an older test asserts `#transform-toggle`, grep for it (`grep -rn "transform-toggle" test`) and update that assertion to `#align-toggle` / `#rotate-toggle`.

- [ ] **Step 7: Commit**

```bash
git add index.html style.css js/transform-ui.js test/transform-markup.test.js
git commit -m "Top bar: Align and Rotate popovers with a rotate dial"
```

---

### Task 6: Docs, browser check, UI review

**Files:**
- Modify: `docs/specs/layer-transform/spec.md`
- Modify: `docs/ui-reference.md` (row at ~line 357, plus the top-bar sentence at ~line 150)
- Modify: `docs/roadmap.md` (~line 720)

- [ ] **Step 1: Spec**

In `docs/specs/layer-transform/spec.md`:

- Change the Purpose's "from a Transform popover" to "from the Align and Rotate popovers". Change "the popover is `js/transform-ui.js`" to "the popovers are `js/transform-ui.js`, the dial `js/rotate-dial.js`, RotSprite `lib/pixel-engine/rotsprite.js`".
- Replace `### Requirement: Transform popover` (with its scenarios) with:

```markdown
### Requirement: Align and Rotate popovers
The top bar SHALL offer an Align button and a Rotate button, each opening
its own popover; opening one SHALL close the other. Align SHALL hold
Align left, centre, right, top, middle and bottom. Rotate SHALL hold a
rotation dial between Rotate 90° left and Rotate 90° right, Flip
horizontal and Flip vertical below it, and Reset and Apply. Titles SHALL
say what they act on: "Align Selection" / "Rotate Selection" while a
selection exists, otherwise "Align Layer" / "Rotate Layer". A popover
SHALL stay open between actions and close on its close button, Escape,
or a press outside it. Every align, flip and Apply SHALL be one undoable
step.

#### Scenario: Title follows the target
- **WHEN** the user opens Rotate with no selection
- **THEN** the title is "Rotate Layer"; with a selection it is
  "Rotate Selection"

#### Scenario: Reference image layer
- **WHEN** the active layer is the reference image layer or locked
- **THEN** every Align and Rotate control is disabled

### Requirement: Rotation dial
The dial SHALL set an angle in whole degrees from -180 to 180, positive
clockwise, by dragging around its centre, or with the arrow keys (1°;
Shift, 15°; Home, 0°). It SHALL snap to a multiple of 15° within 3° of
it. Rotate 90° left and right SHALL change the angle by 90° without
applying it. While the angle is not 0° the target SHALL show the
rotation, and the flips SHALL be disabled. Apply SHALL commit it as one
undo step and return the dial to 0°. Reset SHALL restore the pixels and
selection and return the dial to 0°. Closing the popover, Undo or Redo
with a rotation pending SHALL do the same as Reset.

#### Scenario: Cancel by closing
- **WHEN** the user turns the dial to 30° and presses Escape
- **THEN** the layer is as it was and no undo step was added

#### Scenario: Snap
- **WHEN** the user drags the dial to 43°
- **THEN** it reads 45°
```

- Replace `### Requirement: Rotate and flip`'s first paragraph with the same rules plus free angles:

```markdown
### Requirement: Rotate and flip
Flips SHALL mirror the target's pixels in place. A rotation SHALL turn
the target about its centre; the turned content SHALL fill the box
around it, centred on the same point (rounding down). Quarter turns SHALL
be exact (a 90° turn swaps width and height). Other angles SHALL be
resampled with RotSprite and SHALL add no colours that weren't in the
target; transparent pixels of the result SHALL NOT overwrite what's
under them. Pixels landing off the canvas SHALL be lost (Undo restores
them), and the area the content left SHALL become transparent. With a
selection, the selection SHALL become the turned area, clamped to the
canvas.
```

  Keep its three existing scenarios, then add:

```markdown
#### Scenario: Free angle
- **WHEN** the user applies 45° to a selection holding one pixel
- **THEN** that pixel stays where it was, nothing else on the layer
  changes, and the selection grows to the rotated box
```

- [ ] **Step 2: ui-reference and roadmap**

In `docs/ui-reference.md`, replace the `#transform-toggle` row with:

```markdown
| `#align-toggle` | align_horizontal_center | Align popover (`#align-panel`, `js/transform-ui.js`) | align the selection or active layer to the canvas; spec `layer-transform` |
| `#rotate-toggle` | rotate_right | Rotate popover (`#rotate-panel`, `js/transform-ui.js`) | rotation dial (free angle, RotSprite, snaps to 15°), ±90°, flips, Reset/Apply; spec `layer-transform` |
```

and change `#transform-toggle` at ~line 150 to `#align-toggle`, `#rotate-toggle`.

In `docs/roadmap.md` ~line 720, change `Next: Transform categories and rotation dial, then Copy/Cut/Paste` to:

```markdown
    ~~Transform split into Align and Rotate popovers, with a rotation
    dial (2026-10-15).~~ Next: Copy/Cut/Paste
```

- [ ] **Step 3: Browser check**

Start the local server (`python3 -m http.server 8000` from the repo root, in the background) and open `http://localhost:8000/` in a 64px canvas. Check:

1. The top bar shows Align and Rotate. Each opens its popover, and opening one closes the other.
2. Draw a small shape. In Rotate, drag the dial: the shape turns live and the readout follows. Near 45° it snaps.
3. Release: the outline looks clean (RotSprite). Apply: one undo step (Undo restores the shape exactly).
4. Turn the dial to 30°, then press Escape: the shape is restored and Undo is unchanged.
5. With a rectangle selection, rotate 30° and Apply: the selection grows to the rotated box, and the pixels outside the selection are untouched.
6. Focus the dial with Tab: arrows step 1°, Shift+arrows 15°, Home goes to 0.
7. ±90° buttons move the dial by 90°; flips are disabled while the angle isn't 0°.
8. A locked layer or the reference layer: every control is disabled.
9. Undo (⌘Z) mid-preview: the preview is cancelled and the dial goes back to 0°.

- [ ] **Step 4: UI review**

Run the `web-design-guidelines` skill on `index.html` (the two panels), the `style.css` Align/Rotate block, `js/transform-ui.js` and `js/rotate-dial.js`. Fix what it finds.

- [ ] **Step 5: Final tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add docs/specs/layer-transform/spec.md docs/ui-reference.md docs/roadmap.md
git commit -m "Docs: Align and Rotate popovers, rotation dial"
```

(Add any files the UI review touched to the same commit.)
