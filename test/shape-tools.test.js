import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PixelEngine } from '../lib/pixel-engine/engine.js';
import { drawRectangle, clipToSelection, registerRectangleDrawOverride } from '../js/shape-tools.js';

describe('drawRectangle', () => {
  test('outline-only: draws only the perimeter', () => {
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

  // Filled rectangles moved to pixi-pro (split-pixi-pro-repo) - see that
  // repo's test suite. This just proves the registerRectangleDrawOverride
  // hook is honored, via a stand-in override (not real filling) that any
  // Pro module could register the same shape of.
  test('honors a registered rectangleDrawOverride, skipping the outline fallback', () => {
    const engine = new PixelEngine(6, 6, 'transparent');
    let overrideCalledWith = null;
    registerRectangleDrawOverride((ovEngine, x0, y0, x1, y1, rgba) => {
      overrideCalledWith = { x0, y0, x1, y1, rgba };
      ovEngine.setPixel(2, 2, rgba); // stand-in for "drew something"
      return true;
    });
    try {
      drawRectangle(engine, 1, 1, 3, 3, [7, 7, 7, 255]);
      assert.deepEqual(overrideCalledWith, { x0: 1, y0: 1, x1: 3, y1: 3, rgba: [7, 7, 7, 255] });
      assert.deepEqual(engine.getPixel(2, 2), [7, 7, 7, 255]);
      // Outline fallback was skipped - the perimeter was never drawn.
      assert.deepEqual(engine.getPixel(1, 1), [0, 0, 0, 0]);
    } finally {
      registerRectangleDrawOverride(null); // don't leak into other tests
    }
  });

  test('falls through to outline when a registered override returns false', () => {
    const engine = new PixelEngine(6, 6, 'transparent');
    registerRectangleDrawOverride(() => false);
    try {
      drawRectangle(engine, 1, 1, 3, 3, [7, 7, 7, 255]);
      assert.deepEqual(engine.getPixel(1, 1), [7, 7, 7, 255]); // outline drawn
    } finally {
      registerRectangleDrawOverride(null);
    }
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
