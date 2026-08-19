import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PixelEngine, circleOffsets, strokeFreehandThick } from '../js/engine.js';

function fillRect(engine, x, y, w, h, rgba) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      engine.setPixel(x + dx, y + dy, rgba);
    }
  }
}

function px(engine, x, y) {
  return engine.getPixel(x, y);
}

describe('PixelEngine construction', () => {
  test('transparent background fills all pixels with alpha 0', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        assert.deepEqual(px(e, x, y), [0, 0, 0, 0]);
      }
    }
  });

  test('white background fills all pixels with opaque white', () => {
    const e = new PixelEngine(3, 3, 'white');
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        assert.deepEqual(px(e, x, y), [255, 255, 255, 255]);
      }
    }
  });

  test('buffer is sized width * height * 4', () => {
    const e = new PixelEngine(5, 7, 'transparent');
    assert.equal(e.data.length, 5 * 7 * 4);
  });
});

describe('setPixel', () => {
  test('sets a single pixel to the given color', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    e.setPixel(1, 2, [255, 0, 0, 255]);
    assert.deepEqual(px(e, 1, 2), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 0, 0), [0, 0, 0, 0]);
  });

  test('out-of-bounds setPixel is a no-op', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    assert.doesNotThrow(() => e.setPixel(-1, 0, [255, 0, 0, 255]));
    assert.doesNotThrow(() => e.setPixel(0, 4, [255, 0, 0, 255]));
  });
});

describe('strokeFreehand', () => {
  test('single point draws a single pixel', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    e.strokeFreehand([{ x: 1, y: 1 }], [10, 20, 30, 255]);
    assert.deepEqual(px(e, 1, 1), [10, 20, 30, 255]);
  });

  test('straight horizontal line fills every pixel between endpoints', () => {
    const e = new PixelEngine(5, 5, 'transparent');
    e.strokeFreehand([{ x: 0, y: 2 }, { x: 4, y: 2 }], [255, 255, 255, 255]);
    for (let x = 0; x <= 4; x++) {
      assert.deepEqual(px(e, x, 2), [255, 255, 255, 255], `x=${x}`);
    }
  });

  test('keeps the corner pixel of an L-shaped path when no Pro path transform is registered', () => {
    // Pixel-perfect corner removal itself moved to pixi-pro
    // (split-pixi-pro-repo) - see registerPathTransform in js/engine.js
    // and that repo's test suite for the algorithm's own coverage. This
    // just confirms the default (no transform registered) leaves the
    // corner pixel (1,0) untouched.
    const e = new PixelEngine(5, 5, 'transparent');
    e.strokeFreehand([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], [255, 0, 0, 255]);
    assert.deepEqual(px(e, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 1, 0), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 1, 1), [255, 0, 0, 255]);
  });

  test('eraser (transparent rgba) writes fully transparent pixels regardless of background', () => {
    const e = new PixelEngine(4, 4, 'white');
    e.strokeFreehand([{ x: 1, y: 1 }], [0, 0, 0, 0]);
    assert.deepEqual(px(e, 1, 1), [0, 0, 0, 0]);
    assert.deepEqual(px(e, 0, 0), [255, 255, 255, 255]);
  });
});

describe('floodFill', () => {
  test('fills a 4-directionally connected region of matching color', () => {
    const e = new PixelEngine(3, 3, 'transparent');
    // Isolate the center pixel's row from the rest via a border, then fill.
    e.floodFill(1, 1, [0, 255, 0, 255]);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        assert.deepEqual(px(e, x, y), [0, 255, 0, 255], `(${x},${y})`);
      }
    }
  });

  test('does not cross diagonal-only connections', () => {
    const e = new PixelEngine(3, 3, 'transparent');
    // Draw a plus-shaped wall of a different color splitting the corners.
    e.setPixel(1, 0, [0, 0, 0, 255]);
    e.setPixel(0, 1, [0, 0, 0, 255]);
    e.setPixel(1, 1, [0, 0, 0, 255]);
    e.setPixel(2, 1, [0, 0, 0, 255]);
    e.setPixel(1, 2, [0, 0, 0, 255]);
    e.floodFill(0, 0, [255, 0, 0, 255]);
    assert.deepEqual(px(e, 0, 0), [255, 0, 0, 255]);
    // Diagonal neighbor (2,0) is not 4-connected to (0,0), and unreachable
    // without crossing the wall, so it must remain untouched.
    assert.deepEqual(px(e, 2, 0), [0, 0, 0, 0]);
  });

  test('no-ops when target pixel already equals fill color', () => {
    const e = new PixelEngine(3, 3, 'white');
    e.floodFill(1, 1, [255, 255, 255, 255]);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        assert.deepEqual(px(e, x, y), [255, 255, 255, 255]);
      }
    }
  });

  test('fills an entirely uniform canvas completely', () => {
    const e = new PixelEngine(4, 4, 'white');
    e.floodFill(0, 0, [0, 0, 255, 255]);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        assert.deepEqual(px(e, x, y), [0, 0, 255, 255]);
      }
    }
  });
});

// setPixelBlended/erasePixelBlended (Pencil/Eraser Opacity) moved to
// pixi-pro (split-pixi-pro-repo) - see that repo's js/pro/pencil-opacity.js
// and test suite for the blending math's own coverage.

describe('circleOffsets', () => {
  test('size 1 is a single pixel at the center', () => {
    assert.deepEqual(circleOffsets(1), [[0, 0]]);
  });

  test('size 5 reproduces the same shape as the Circle brush pattern', () => {
    // brushes.js's built-in Circle brush is '.XXX.' / 'XXXXX' x3 / '.XXX.',
    // i.e. rows -2..2 relative to center, row -2/2 missing the corners.
    const offsets = circleOffsets(5);
    const has = (dx, dy) => offsets.some(([x, y]) => x === dx && y === dy);
    assert.equal(has(-2, -2), false); // corner excluded
    assert.equal(has(2, -2), false);
    assert.equal(has(0, -2), true); // top-middle included
    assert.equal(has(-2, 0), true); // full middle row
    assert.equal(has(2, 0), true);
    assert.equal(offsets.length, 21); // 3 + 5 + 5 + 5 + 3
  });

  test('results are cached (same array reference on repeated calls)', () => {
    assert.equal(circleOffsets(7), circleOffsets(7));
  });
});

describe('strokeFreehandThick', () => {
  test('at size 1, touches exactly the same pixels a plain path would', () => {
    const touched = [];
    strokeFreehandThick([{ x: 0, y: 0 }, { x: 2, y: 0 }], 1, (x, y) => touched.push([x, y]));
    assert.deepEqual(touched, [[0, 0], [1, 0], [2, 0]]);
  });

  test('at size > 1, a dense overlapping path calls applyPixel exactly once per unique pixel', () => {
    let calls = 0;
    const seen = new Set();
    strokeFreehandThick(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      5,
      (x, y) => {
        calls++;
        const key = `${x},${y}`;
        assert.equal(seen.has(key), false, `(${x},${y}) applied more than once`);
        seen.add(key);
      }
    );
    assert.equal(calls, seen.size);
  });
});

describe('extractRegion', () => {
  test('copies an in-bounds rectangle pixel-for-pixel', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    fillRect(e, 1, 1, 2, 2, [10, 20, 30, 255]);
    const buffer = e.extractRegion(1, 1, 2, 2);
    assert.equal(buffer.length, 2 * 2 * 4);
    for (let i = 0; i < 4; i++) {
      assert.deepEqual([buffer[i * 4], buffer[i * 4 + 1], buffer[i * 4 + 2], buffer[i * 4 + 3]], [10, 20, 30, 255]);
    }
  });

  test('buffer layout is (dy*width+dx)*4, top-left of the region relative', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    e.setPixel(2, 3, [1, 2, 3, 4]); // region top-left (1,2), so this is (dx=1,dy=1)
    const buffer = e.extractRegion(1, 2, 3, 2);
    const i = (1 * 3 + 1) * 4;
    assert.deepEqual([buffer[i], buffer[i + 1], buffer[i + 2], buffer[i + 3]], [1, 2, 3, 4]);
  });

  test('out-of-canvas portion of the region reads as fully transparent', () => {
    const e = new PixelEngine(4, 4, 'white');
    const buffer = e.extractRegion(-1, -1, 3, 3);
    // (dx=0,dy=0) maps to canvas (-1,-1), out of bounds.
    assert.deepEqual([buffer[0], buffer[1], buffer[2], buffer[3]], [0, 0, 0, 0]);
    // (dx=2,dy=2) maps to canvas (1,1), in bounds, opaque white.
    const i = (2 * 3 + 2) * 4;
    assert.deepEqual([buffer[i], buffer[i + 1], buffer[i + 2], buffer[i + 3]], [255, 255, 255, 255]);
  });
});

describe('clearRegion', () => {
  test('defaults to filling the region with fully transparent pixels', () => {
    const e = new PixelEngine(4, 4, 'white');
    e.clearRegion(1, 1, 2, 2);
    for (let y = 1; y <= 2; y++) {
      for (let x = 1; x <= 2; x++) {
        assert.deepEqual(px(e, x, y), [0, 0, 0, 0]);
      }
    }
    // Untouched pixel outside the region is unaffected.
    assert.deepEqual(px(e, 0, 0), [255, 255, 255, 255]);
  });

  test('fills the region with an explicit color when given one', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    e.clearRegion(0, 0, 2, 2, [9, 9, 9, 255]);
    assert.deepEqual(px(e, 0, 0), [9, 9, 9, 255]);
    assert.deepEqual(px(e, 1, 1), [9, 9, 9, 255]);
  });

  test('a region straddling the canvas edge clips silently, does not throw', () => {
    const e = new PixelEngine(3, 3, 'white');
    assert.doesNotThrow(() => e.clearRegion(2, 2, 3, 3));
    assert.deepEqual(px(e, 2, 2), [0, 0, 0, 0]);
  });
});

describe('stampRegion', () => {
  test('writes a buffer back at the given offset', () => {
    const e = new PixelEngine(4, 4, 'transparent');
    const buffer = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]); // 2x1
    e.stampRegion(1, 1, 2, 1, buffer);
    assert.deepEqual(px(e, 1, 1), [1, 2, 3, 255]);
    assert.deepEqual(px(e, 2, 1), [4, 5, 6, 255]);
  });

  test('clips silently when the stamp lands partially off-canvas', () => {
    const e = new PixelEngine(3, 3, 'transparent');
    const buffer = new Uint8ClampedArray(2 * 2 * 4).fill(255);
    assert.doesNotThrow(() => e.stampRegion(2, 2, 2, 2, buffer));
    assert.deepEqual(px(e, 2, 2), [255, 255, 255, 255]);
  });

  test('round-trips with extractRegion for an in-bounds region', () => {
    const e = new PixelEngine(5, 5, 'transparent');
    fillRect(e, 1, 1, 3, 3, [7, 8, 9, 200]);
    const buffer = e.extractRegion(1, 1, 3, 3);
    const e2 = new PixelEngine(5, 5, 'transparent');
    e2.stampRegion(1, 1, 3, 3, buffer);
    assert.deepEqual(e2.data, e.data);
  });
});
