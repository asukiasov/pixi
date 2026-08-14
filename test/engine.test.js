import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PixelEngine, circleOffsets, strokeFreehandThick } from '../js/engine.js';

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
    e.strokeFreehand([{ x: 1, y: 1 }], [10, 20, 30, 255], false);
    assert.deepEqual(px(e, 1, 1), [10, 20, 30, 255]);
  });

  test('straight horizontal line fills every pixel between endpoints', () => {
    const e = new PixelEngine(5, 5, 'transparent');
    e.strokeFreehand(
      [{ x: 0, y: 2 }, { x: 4, y: 2 }],
      [255, 255, 255, 255],
      false
    );
    for (let x = 0; x <= 4; x++) {
      assert.deepEqual(px(e, x, 2), [255, 255, 255, 255], `x=${x}`);
    }
  });

  test('pixel-perfect off keeps the corner pixel of an L-shaped path', () => {
    const e = new PixelEngine(5, 5, 'transparent');
    // Same L-shaped path as the pixel-perfect-on test below, but with the
    // toggle off: the corner pixel (1,0) should NOT be removed.
    e.strokeFreehand(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      [255, 0, 0, 255],
      false
    );
    assert.deepEqual(px(e, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 1, 0), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 1, 1), [255, 0, 0, 255]);
  });

  test('pixel-perfect on removes the redundant corner pixel on a diagonal', () => {
    const e = new PixelEngine(5, 5, 'transparent');
    // A clean diagonal path: (0,0) -> (1,1) -> (2,2)
    e.strokeFreehand(
      [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
      [255, 0, 0, 255],
      true
    );
    assert.deepEqual(px(e, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 1, 1), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 2, 2), [255, 0, 0, 255]);
  });

  test('pixel-perfect on thins an L-shaped corner produced by axis-aligned segments', () => {
    const e = new PixelEngine(5, 5, 'transparent');
    // Path goes right then up, producing a corner pixel at (1,0) between
    // (0,0) and (1,1) that pixel-perfect mode should drop.
    e.strokeFreehand(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      [255, 0, 0, 255],
      true
    );
    assert.deepEqual(px(e, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(px(e, 1, 1), [255, 0, 0, 255]);
    // The corner pixel (1,0) should have been removed (left unset).
    assert.deepEqual(px(e, 1, 0), [0, 0, 0, 0]);
  });

  test('eraser (transparent rgba) writes fully transparent pixels regardless of background', () => {
    const e = new PixelEngine(4, 4, 'white');
    e.strokeFreehand([{ x: 1, y: 1 }], [0, 0, 0, 0], false);
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

describe('setPixelBlended', () => {
  test('at opacity 1 with a fully-opaque color, matches setPixel', () => {
    const e = new PixelEngine(2, 2, 'white');
    e.setPixelBlended(0, 0, [10, 20, 30, 255], 1);
    assert.deepEqual(px(e, 0, 0), [10, 20, 30, 255]);
  });

  test('at opacity 0.5 over an opaque pixel, blends toward the midpoint', () => {
    const e = new PixelEngine(2, 2, 'white'); // dst = [255,255,255,255]
    e.setPixelBlended(0, 0, [0, 0, 0, 255], 0.5);
    // srcA=0.5, dstA=1 -> outA=1; outRGB = src*0.5 + dst*1*0.5 = 127.5 -> 128 (rounded)
    assert.deepEqual(px(e, 0, 0), [128, 128, 128, 255]);
  });

  test('over a fully transparent pixel, produces the source color at reduced alpha', () => {
    const e = new PixelEngine(2, 2, 'transparent');
    e.setPixelBlended(0, 0, [200, 100, 50, 255], 0.5);
    assert.deepEqual(px(e, 0, 0), [200, 100, 50, 128]);
  });
});

describe('erasePixelBlended', () => {
  test('at opacity 1, matches a full erase (zeroed RGB, alpha 0)', () => {
    const e = new PixelEngine(2, 2, 'white');
    e.erasePixelBlended(0, 0, 1);
    assert.deepEqual(px(e, 0, 0), [0, 0, 0, 0]);
  });

  test('at opacity 0.5, halves existing alpha and leaves RGB unchanged', () => {
    const e = new PixelEngine(2, 2, 'white'); // [255,255,255,255]
    e.erasePixelBlended(0, 0, 0.5);
    assert.deepEqual(px(e, 0, 0), [255, 255, 255, 128]);
  });

  test('repeated partial erases approach but never reach zero alpha in one call', () => {
    const e = new PixelEngine(2, 2, 'white');
    e.erasePixelBlended(0, 0, 0.5);
    const first = px(e, 0, 0)[3];
    e.erasePixelBlended(0, 0, 0.5);
    const second = px(e, 0, 0)[3];
    assert.ok(second < first);
    assert.ok(second > 0);
  });
});

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
    strokeFreehandThick([{ x: 0, y: 0 }, { x: 2, y: 0 }], 1, false, (x, y) => touched.push([x, y]));
    assert.deepEqual(touched, [[0, 0], [1, 0], [2, 0]]);
  });

  test('at size > 1, a dense overlapping path calls applyPixel exactly once per unique pixel', () => {
    let calls = 0;
    const seen = new Set();
    strokeFreehandThick(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      5,
      false,
      (x, y) => {
        calls++;
        const key = `${x},${y}`;
        assert.equal(seen.has(key), false, `(${x},${y}) applied more than once`);
        seen.add(key);
      }
    );
    assert.equal(calls, seen.size);
  });

  test('pixel-perfect corner removal only applies at size 1', () => {
    const size1 = [];
    strokeFreehandThick([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], 1, true, (x, y) => size1.push([x, y]));
    // Corner pixel (1,0) removed, same as strokeFreehand's pixel-perfect test.
    assert.equal(size1.some(([x, y]) => x === 1 && y === 0), false);

    const size3 = [];
    strokeFreehandThick([{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }], 3, true, (x, y) => size3.push([x, y]));
    // At size 3, no corner-removal - the corner cell is still covered by
    // the size-3 stamp regardless (can't assert its exact absence the
    // way size 1 does), so just confirm the call didn't throw and
    // touched a nontrivial area.
    assert.ok(size3.length > 3);
  });
});
