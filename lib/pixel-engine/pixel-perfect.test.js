import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { removeRedundantCorners } from './pixel-perfect.js';

describe('removeRedundantCorners', () => {
  test('removes the redundant corner pixel on a clean diagonal', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
    assert.deepEqual(removeRedundantCorners(path), path);
  });

  test('thins an L-shaped corner produced by axis-aligned segments', () => {
    // Path goes right then up, producing a corner pixel at (1,0) between
    // (0,0) and (1,1) that pixel-perfect mode should drop.
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    assert.deepEqual(removeRedundantCorners(path), [{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  test('a path with no corners is returned unchanged', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    assert.deepEqual(removeRedundantCorners(path), path);
  });
});
