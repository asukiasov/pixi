import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Same module-load-time `document` stub as test/layers-marking.test.js -
// importing js/layers-ui.js pulls in workspace.js, which references
// `document` at module scope. Nothing here touches it.
globalThis.document ??= {};

const { isDoubleTap, resolveLayerRename } = await import('../js/layers-ui.js');

describe('isDoubleTap', () => {
  const first = { layerId: 'a', time: 1000, x: 50, y: 20 };

  test('same layer, quick, close together → double', () => {
    assert.equal(isDoubleTap(first, { layerId: 'a', time: 1300, x: 54, y: 23 }), true);
  });

  test('no previous tap → not a double', () => {
    assert.equal(isDoubleTap(null, first), false);
  });

  test('different layer → not a double', () => {
    assert.equal(isDoubleTap(first, { layerId: 'b', time: 1100, x: 50, y: 20 }), false);
  });

  test('too slow → not a double', () => {
    assert.equal(isDoubleTap(first, { layerId: 'a', time: 1401, x: 50, y: 20 }), false);
  });

  test('too far apart → not a double', () => {
    assert.equal(isDoubleTap(first, { layerId: 'a', time: 1100, x: 61, y: 20 }), false);
  });
});

describe('resolveLayerRename', () => {
  test('returns the trimmed new name', () => {
    assert.equal(resolveLayerRename('  Sky  ', 'Layer 1'), 'Sky');
  });

  test('empty or whitespace-only → null (keep the old name)', () => {
    assert.equal(resolveLayerRename('', 'Layer 1'), null);
    assert.equal(resolveLayerRename('   ', 'Layer 1'), null);
  });

  test('unchanged (after trimming) → null (no undo entry)', () => {
    assert.equal(resolveLayerRename(' Layer 1 ', 'Layer 1'), null);
  });
});
