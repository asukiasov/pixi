import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PixelEngine } from '../lib/pixel-engine/engine.js';
import { drawRectangle, drawEllipse, clipToSelection, setShapeFilled } from '../js/shape-tools.js';
import { fillIconFor, initRectangleFill, syncRectangleFillTool } from '../js/rectangle-fill-ui.js';

describe('drawRectangle', () => {
  test('outline mode (default): draws only the perimeter', () => {
    const engine = new PixelEngine(6, 6, 'transparent');
    drawRectangle(engine, 1, 1, 4, 4, [255, 0, 0, 255]);
    // Corners and edges
    for (const [x, y] of [[1, 1], [4, 1], [1, 4], [4, 4], [2, 1], [1, 2]]) {
      assert.deepEqual(engine.getPixel(x, y), [255, 0, 0, 255], `(${x},${y})`);
    }
    // Interior untouched
    assert.deepEqual(engine.getPixel(2, 2), [0, 0, 0, 0]);
    assert.deepEqual(engine.getPixel(3, 3), [0, 0, 0, 0]);
  });

  test('normalizes corners regardless of drag direction', () => {
    const engineA = new PixelEngine(6, 6, 'transparent');
    drawRectangle(engineA, 4, 4, 1, 1, [1, 1, 1, 255]);
    const engineB = new PixelEngine(6, 6, 'transparent');
    drawRectangle(engineB, 1, 1, 4, 4, [1, 1, 1, 255]);
    assert.deepEqual(Array.from(engineA.data), Array.from(engineB.data));
  });

  test('a single-point rectangle (0-size drag) draws one pixel', () => {
    const engine = new PixelEngine(6, 6, 'transparent');
    drawRectangle(engine, 2, 2, 2, 2, [9, 9, 9, 255]);
    assert.deepEqual(engine.getPixel(2, 2), [9, 9, 9, 255]);
  });

  describe('Filled toggle (setShapeFilled)', () => {
    test('sets every pixel in the bounding box, not just the perimeter', () => {
      setShapeFilled(true);
      try {
        const engine = new PixelEngine(6, 6, 'transparent');
        drawRectangle(engine, 1, 1, 3, 3, [0, 255, 0, 255]);
        for (let y = 1; y <= 3; y++) {
          for (let x = 1; x <= 3; x++) {
            assert.deepEqual(engine.getPixel(x, y), [0, 255, 0, 255], `(${x},${y})`);
          }
        }
        assert.deepEqual(engine.getPixel(0, 0), [0, 0, 0, 0]);
        assert.deepEqual(engine.getPixel(4, 4), [0, 0, 0, 0]);
      } finally {
        setShapeFilled(false); // don't leak into other tests
      }
    });

    test('normalizes corners regardless of drag direction when filled', () => {
      setShapeFilled(true);
      try {
        const engineA = new PixelEngine(6, 6, 'transparent');
        drawRectangle(engineA, 4, 4, 1, 1, [1, 1, 1, 255]);
        const engineB = new PixelEngine(6, 6, 'transparent');
        drawRectangle(engineB, 1, 1, 4, 4, [1, 1, 1, 255]);
        assert.deepEqual(Array.from(engineA.data), Array.from(engineB.data));
      } finally {
        setShapeFilled(false);
      }
    });
  });
});

describe('clipToSelection', () => {
  test('restores pixels outside the selection from the backup', () => {
    const engine = new PixelEngine(5, 5, 'white');
    const backup = engine.data.slice(); // all white
    // Simulate an operation that painted the whole canvas black
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) engine.setPixel(x, y, [0, 0, 0, 255]);
    }
    clipToSelection(engine, backup, { x: 1, y: 1, width: 2, height: 2 });
    // Inside the selection: stays black (the "new" paint)
    assert.deepEqual(engine.getPixel(1, 1), [0, 0, 0, 255]);
    assert.deepEqual(engine.getPixel(2, 2), [0, 0, 0, 255]);
    // Outside the selection: restored to backup (white)
    assert.deepEqual(engine.getPixel(0, 0), [255, 255, 255, 255]);
    assert.deepEqual(engine.getPixel(4, 4), [255, 255, 255, 255]);
  });

  test('a null selection is a no-op', () => {
    const engine = new PixelEngine(3, 3, 'white');
    const backup = engine.data.slice();
    engine.setPixel(1, 1, [0, 0, 0, 255]);
    clipToSelection(engine, backup, null);
    assert.deepEqual(engine.getPixel(1, 1), [0, 0, 0, 255]);
  });
});

describe('drawEllipse', () => {
  const INK = [255, 0, 0, 255];
  // The set of painted cells as "x,y" strings.
  function cells(w, h, x0, y0, x1, y1, { filled = false } = {}) {
    setShapeFilled(filled);
    try {
      const engine = new PixelEngine(w, h, 'transparent');
      drawEllipse(engine, x0, y0, x1, y1, INK);
      const out = new Set();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (engine.getPixel(x, y)[3]) out.add(`${x},${y}`);
      return out;
    } finally {
      setShapeFilled(false);
    }
  }
  const bitmap = (set, w, h) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (set.has(`${x},${y}`) ? '#' : '.')).join(''));

  test('a 5x5 box draws a round, symmetric circle', () => {
    assert.deepEqual(bitmap(cells(5, 5, 0, 0, 4, 4), 5, 5), [
      '.###.',
      '#...#',
      '#...#',
      '#...#',
      '.###.',
    ]);
  });

  test('an even 4x4 box stays 4x4 and symmetric', () => {
    assert.deepEqual(bitmap(cells(4, 4, 0, 0, 3, 3), 4, 4), [
      '.##.',
      '#..#',
      '#..#',
      '.##.',
    ]);
  });

  test('degenerate boxes: one pixel, a line, a 2x2 block', () => {
    assert.deepEqual([...cells(3, 3, 1, 1, 1, 1)], ['1,1']);
    assert.equal(cells(6, 3, 0, 1, 5, 1).size, 6);
    assert.equal(cells(3, 6, 1, 0, 1, 5).size, 6);
    assert.equal(cells(2, 2, 0, 0, 1, 1).size, 4);
  });

  for (const [w, h] of [[7, 4], [9, 9], [12, 5], [16, 11], [3, 8]]) {
    test(`${w}x${h}: inside the box, touches every side, symmetric, direction-independent`, () => {
      const set = cells(w + 2, h + 2, 1, 1, w, h);
      const pts = [...set].map((s) => s.split(',').map(Number));
      assert.ok(pts.every(([x, y]) => x >= 1 && x <= w && y >= 1 && y <= h));
      assert.ok(pts.some(([x]) => x === 1) && pts.some(([x]) => x === w));
      assert.ok(pts.some(([, y]) => y === 1) && pts.some(([, y]) => y === h));
      for (const [x, y] of pts) {
        assert.ok(set.has(`${w + 1 - x},${y}`), `mirror x of ${x},${y}`);
        assert.ok(set.has(`${x},${h + 1 - y}`), `mirror y of ${x},${y}`);
      }
      assert.deepEqual(cells(w + 2, h + 2, w, h, 1, 1), set);
    });

    test(`${w}x${h}: the outline is one closed 8-connected loop`, () => {
      const set = cells(w + 2, h + 2, 1, 1, w, h);
      // Every outline pixel has exactly 2 neighbours along the loop once
      // the shape is big enough to have an inside.
      if (w < 3 || h < 3) return;
      const [start] = set;
      const seen = new Set([start]);
      const stack = [start];
      while (stack.length) {
        const [x, y] = stack.pop().split(',').map(Number);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const k = `${x + dx},${y + dy}`;
          if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
      }
      assert.equal(seen.size, set.size, 'connected');
    });

    test(`${w}x${h}: filled covers the outline with one solid span per row`, () => {
      const outline = cells(w + 2, h + 2, 1, 1, w, h);
      const filled = cells(w + 2, h + 2, 1, 1, w, h, { filled: true });
      for (const k of outline) assert.ok(filled.has(k));
      for (let y = 1; y <= h; y++) {
        const xs = [...filled].map((s) => s.split(',').map(Number)).filter(([, py]) => py === y).map(([x]) => x).sort((a, b) => a - b);
        assert.ok(xs.length > 0, `row ${y} empty`);
        assert.equal(xs[xs.length - 1] - xs[0] + 1, xs.length, `row ${y} has a gap`);
      }
    });
  }
});

describe('fillIconFor', () => {
  test('Rectangle keeps the rectangle icons', () => {
    assert.equal(fillIconFor('rectangle', false), 'rectangle-outline');
    assert.equal(fillIconFor('rectangle', true), 'rectangle-filled');
  });

  test('Ellipse gets ellipse icons', () => {
    assert.equal(fillIconFor('ellipse', false), 'ellipse-outline');
    assert.equal(fillIconFor('ellipse', true), 'ellipse-filled');
  });
});

// A minimal stand-in for the docked #rectangle-options markup (no DOM in
// node --test): just the classList/dataset/attribute calls the module uses.
function fakeElement(attrs = {}) {
  const classes = new Set(attrs.hidden ? ['hidden'] : []);
  const attributes = {};
  return {
    dataset: { ...(attrs.dataset ?? {}) },
    classList: {
      contains: (c) => classes.has(c),
      toggle: (c, force) => { const on = force ?? !classes.has(c); if (on) classes.add(c); else classes.delete(c); return on; },
    },
    setAttribute: (n, v) => { attributes[n] = String(v); },
    getAttribute: (n) => attributes[n] ?? null,
    addEventListener: () => {},
  };
}

function fakeFillRoot() {
  const panel = fakeElement({ hidden: true });
  const icons = ['rectangle-outline', 'rectangle-filled', 'ellipse-outline', 'ellipse-filled']
    .map((key) => fakeElement({ dataset: { fillIcon: key } }));
  const toggle = { ...fakeElement(), querySelectorAll: () => icons };
  const root = {
    querySelector: (sel) => ({ '#rectangle-options': panel, '#rectangle-fill-toggle': toggle })[sel] ?? null,
    querySelectorAll: () => [],
  };
  const shown = () => icons.find((i) => !i.classList.contains('hidden')).dataset.fillIcon;
  return { root, panel, toggle, shown };
}

// Every tool change (rail click, O/R shortcut, overflow menu, start-up
// tool) goes through workspace.js's applyToolScopedUI, which calls this.
describe('syncRectangleFillTool', () => {
  test('Ellipse shows the Filled toggle with ellipse icons', () => {
    const { root, panel, shown } = fakeFillRoot();
    initRectangleFill(root);
    syncRectangleFillTool('ellipse');
    assert.equal(panel.classList.contains('hidden'), false);
    assert.equal(shown(), 'ellipse-outline');
  });

  test('Rectangle shows rectangle icons; other tools hide the toggle', () => {
    const { root, panel, shown } = fakeFillRoot();
    initRectangleFill(root);
    syncRectangleFillTool('ellipse');
    syncRectangleFillTool('rectangle');
    assert.equal(shown(), 'rectangle-outline');
    syncRectangleFillTool('pencil');
    assert.equal(panel.classList.contains('hidden'), true);
  });

  test('workspace.js calls it from applyToolScopedUI', async () => {
    const { readFileSync } = await import('node:fs');
    const ws = readFileSync(new URL('../js/workspace.js', import.meta.url), 'utf8');
    const body = ws.slice(ws.indexOf('function applyToolScopedUI()'));
    assert.match(body.slice(0, body.indexOf('\n}\n')), /syncRectangleFillTool\(state\.currentTool\)/);
  });
});
