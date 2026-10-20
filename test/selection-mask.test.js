import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  rectSelection, ellipseSelection, polygonSelection, combineSelections, isSelected,
  isRectangular, translateSelection, alphaSelection, selectionToRGBA, selectionPaths, clampSelectionOffset,
} from '../js/selection-mask.js';

const p = (x, y) => ({ x, y });
const count = (sel) => sel.mask.reduce((n, v) => n + v, 0);

describe('selection shapes', () => {
  test('rect: bounds and every pixel, either drag direction, clamped to the canvas', () => {
    const sel = rectSelection(8, 8, p(5, 4), p(2, 1));
    assert.deepEqual([sel.x, sel.y, sel.width, sel.height], [2, 1, 4, 4]);
    assert.equal(count(sel), 16);
    assert.ok(isRectangular(sel));
    const clamped = rectSelection(4, 4, p(-2, -2), p(1, 1));
    assert.deepEqual([clamped.x, clamped.y, clamped.width, clamped.height], [0, 0, 2, 2]);
  });

  test('ellipse: corners of the box are left out', () => {
    const sel = ellipseSelection(8, 8, p(0, 0), p(5, 5));
    assert.deepEqual([sel.x, sel.y, sel.width, sel.height], [0, 0, 6, 6]);
    assert.ok(!isSelected(sel, 0, 0));
    assert.ok(isSelected(sel, 2, 2));
    assert.ok(!isRectangular(sel));
  });

  test('polygon: outline and inside, outside left out', () => {
    const sel = polygonSelection(10, 10, [p(1, 1), p(8, 1), p(1, 8)]);
    assert.ok(isSelected(sel, 1, 1) && isSelected(sel, 8, 1) && isSelected(sel, 1, 8));
    assert.ok(isSelected(sel, 3, 3));
    assert.ok(!isSelected(sel, 7, 7));
  });

  test('polygon: a single point or a line still selects the pixels traced', () => {
    assert.equal(count(polygonSelection(4, 4, [p(2, 2)])), 1);
    assert.equal(count(polygonSelection(6, 6, [p(0, 0), p(4, 0)])), 5);
  });

  test('polygon: both loops of a figure 8', () => {
    const sel = polygonSelection(12, 6, [p(0, 0), p(10, 5), p(10, 0), p(0, 5)]);
    assert.ok(isSelected(sel, 1, 2) && isSelected(sel, 9, 2));
  });
});

describe('combineSelections', () => {
  const a = rectSelection(8, 8, p(0, 0), p(3, 3));
  const b = rectSelection(8, 8, p(2, 2), p(5, 5));
  test('new replaces', () => assert.equal(combineSelections(a, b, 'new'), b));
  test('add unions', () => {
    const sel = combineSelections(a, b, 'add');
    assert.equal(count(sel), 16 + 16 - 4);
    assert.deepEqual([sel.width, sel.height], [6, 6]);
  });
  test('subtract removes; subtracting everything is no selection', () => {
    const sel = combineSelections(a, b, 'subtract');
    assert.equal(count(sel), 12);
    assert.ok(!isSelected(sel, 2, 2));
    assert.equal(combineSelections(a, a, 'subtract'), null);
    assert.equal(combineSelections(null, a, 'subtract'), null);
    assert.equal(combineSelections(null, a, 'add'), a);
  });
});

describe('helpers', () => {
  test('isSelected: everywhere with no selection, nowhere off canvas', () => {
    assert.ok(isSelected(null, 99, 99));
    assert.ok(!isSelected(rectSelection(4, 4, p(0, 0), p(3, 3)), 4, 0));
  });
  test('translate drops what leaves the canvas', () => {
    const sel = translateSelection(rectSelection(4, 4, p(0, 0), p(1, 1)), 3, 0);
    assert.deepEqual([sel.x, sel.width], [3, 1]);
    assert.equal(translateSelection(sel, 5, 0), null);
  });
  test('RGBA round trip', () => {
    const sel = ellipseSelection(6, 6, p(0, 0), p(4, 4));
    assert.deepEqual(alphaSelection(selectionToRGBA(sel), 6, 6).mask, sel.mask);
  });
  test('paths: a 2x1 selection is one run and a closed outline', () => {
    const { fill, outline } = selectionPaths(rectSelection(4, 4, p(1, 1), p(2, 1)));
    assert.equal(fill, 'M1 1h2v1h-2z');
    assert.equal(outline, 'M1 1H3M1 2H3M1 1V2M3 1V2');
  });
});

describe('clipToSelection with a shaped selection', () => {
  test('restores pixels in the box but outside the shape', async () => {
    const { PixelEngine } = await import('../lib/pixel-engine/engine.js');
    const { clipToSelection } = await import('../js/shape-tools.js');
    const engine = new PixelEngine(6, 6, 'transparent');
    const backup = engine.data.slice();
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) engine.setPixel(x, y, [255, 0, 0, 255]);
    clipToSelection(engine, backup, ellipseSelection(6, 6, p(0, 0), p(5, 5)));
    assert.deepEqual(engine.getPixel(0, 0), [0, 0, 0, 0]);
    assert.deepEqual(engine.getPixel(2, 2), [255, 0, 0, 255]);
  });
});

describe('clampSelectionOffset', () => {
  test('an offset that keeps a pixel on the canvas is left alone', () => {
    const sel = rectSelection(16, 16, p(2, 2), p(4, 4));
    assert.deepEqual(clampSelectionOffset(sel, 13, -4), { dx: 13, dy: -4 });
  });

  test('pushing the selection off the canvas stops with one row/column still on it', () => {
    const sel = rectSelection(16, 16, p(2, 2), p(4, 4));
    assert.deepEqual(clampSelectionOffset(sel, 20, -30), { dx: 13, dy: -4 });
    assert.ok(translateSelection(sel, 13, -4));
  });

  test('a shaped selection keeps an actual selected pixel, not just its box corner', () => {
    const sel = ellipseSelection(16, 16, p(0, 0), p(6, 6)); // (6, 6) itself is not selected
    const { dx, dy } = clampSelectionOffset(sel, 15, 15);
    assert.ok(translateSelection(sel, dx, dy));
    assert.ok(dx <= 15 && dy <= 15);
  });
});

describe('polygonSelection fill', () => {
  // The traced outline plus the per-pixel non-zero winding rule, as a slow reference.
  const reference = (w, h, pts) => {
    const inside = new Set();
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      let { x, y } = a;
      const dx = Math.abs(b.x - x);
      const dy = -Math.abs(b.y - y);
      let err = dx + dy;
      for (;;) {
        if (x >= 0 && y >= 0 && x < w && y < h) inside.add(y * w + x);
        if (x === b.x && y === b.y) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += x < b.x ? 1 : -1; }
        if (e2 <= dx) { err += dx; y += y < b.y ? 1 : -1; }
      }
    });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let winding = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
          if (a.y <= y) { if (b.y > y && side > 0) winding++; } else if (b.y <= y && side < 0) winding--;
        }
        if (winding) inside.add(y * w + x);
      }
    }
    return inside;
  };

  test('matches the winding rule for random self-crossing shapes, off-canvas corners included', () => {
    let seed = 7;
    const rand = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
    for (let round = 0; round < 40; round++) {
      const pts = Array.from({ length: 3 + rand(12) }, () => p(rand(30) - 5, rand(26) - 5));
      const sel = polygonSelection(20, 16, pts);
      const expected = reference(20, 16, pts);
      for (let i = 0; i < 20 * 16; i++) assert.equal(sel?.mask[i] ?? 0, expected.has(i) ? 1 : 0, `round ${round} pixel ${i}`);
    }
  });
});
