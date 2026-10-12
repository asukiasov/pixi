import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { circleOffsets } from '../lib/pixel-engine/engine.js';
import { cursorFootprint, footprintOutlinePath } from '../js/brush-cursor.js';

const sorted = (cells) => cells.map(([x, y]) => `${x},${y}`).sort();

describe('cursorFootprint', () => {
  test('Pencil and Eraser use the real circular tip', () => {
    for (const tool of ['pencil', 'eraser']) {
      for (const size of [1, 2, 3, 8]) {
        assert.deepEqual(sorted(cursorFootprint(tool, { pencilSize: size })), sorted(circleOffsets(size)), `${tool} ${size}`);
      }
    }
  });

  test('Brush uses the brush pattern, centred the way placeBrush centres it', () => {
    // 3x2 brush: placeBrush puts its top-left at (cx - 1, cy - 1).
    const brush = { width: 3, height: 2, pixels: [[0, 0], [2, 0], [1, 1]] };
    assert.deepEqual(sorted(cursorFootprint('brush', { brush })), sorted([[-1, -1], [1, -1], [0, 0]]));
  });

  test('Brush with no brush chosen, and single-pixel tools, show one pixel', () => {
    assert.deepEqual(cursorFootprint('brush', {}), [[0, 0]]);
    for (const tool of ['line', 'rectangle', 'ellipse', 'bucket', 'eyedropper']) {
      assert.deepEqual(cursorFootprint(tool, { pencilSize: 8 }), [[0, 0]], tool);
    }
  });

  test('Move, Select and Hand show no cursor', () => {
    for (const tool of ['move', 'selection', 'hand']) assert.equal(cursorFootprint(tool, {}), null, tool);
  });
});

describe('footprintOutlinePath', () => {
  test('one cell is one square', () => {
    assert.equal(footprintOutlinePath([[0, 0]]), 'M0 0H1V1H0Z');
  });

  test('a 2x1 strip is one rectangle - collinear edges are joined', () => {
    assert.equal(footprintOutlinePath([[0, 0], [1, 0]]), 'M0 0H2V1H0Z');
  });

  test('negative offsets work the same', () => {
    assert.equal(footprintOutlinePath([[-1, -1]]), 'M-1 -1H0V0H-1Z');
  });

  test('a ring gives an outer and an inner loop', () => {
    const ring = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x !== 1 || y !== 1) ring.push([x, y]);
    const path = footprintOutlinePath(ring);
    assert.equal((path.match(/M/g) ?? []).length, 2);
    assert.match(path, /M0 0H3V3H0Z/);
  });

  test('an 8px pencil tip traces one closed loop', () => {
    const path = footprintOutlinePath(circleOffsets(8));
    assert.equal((path.match(/M/g) ?? []).length, 1);
    assert.ok(path.endsWith('Z'));
  });

  test('empty footprint gives an empty path', () => {
    assert.equal(footprintOutlinePath([]), '');
  });
});
