import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// workspace.js reads `document` at module load (see layers-marking.test.js);
// these tests only call pure functions.
globalThis.document ??= {};
const { layerMenuState, mergeButtonState } = await import('../js/layers-ui.js');

let nextId = 0;
const L = (over = {}) => ({ id: ++nextId, isBackground: false, isReferenceImage: false, locked: false, ...over });
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
    assert.equal(layerMenuState(base()).paste.disabled, false);
  });

  test('Lock flips to Unlock', () => {
    assert.deepEqual(layerMenuState(base()).lock, { hidden: false, label: 'Lock', icon: 'lock' });
    const layers = [L(), L({ locked: true })];
    assert.deepEqual(layerMenuState(base({ layers, layer: layers[1] })).lock, { hidden: false, label: 'Unlock', icon: 'lock_open' });
  });

  test('Select Content needs content', () => {
    assert.equal(layerMenuState(base({ hasContent: false })).selectContent.disabled, true);
    assert.equal(layerMenuState(base()).selectContent.disabled, false);
  });

  test('Merge Down is disabled onto or from a locked layer', () => {
    assert.equal(layerMenuState(base()).merge.disabled, false);
    const layers = [L({ locked: true }), L()];
    assert.equal(layerMenuState(base({ layers, layer: layers[1] })).merge.disabled, true);
  });
});

test('mergeButtonState: a locked layer among the marked disables Merge', () => {
  const layers = [L(), L({ locked: true }), L()];
  assert.equal(mergeButtonState(layers, 2, new Set([layers[1].id, layers[2].id])).disabled, true);
  assert.equal(mergeButtonState(layers, 2, new Set([layers[0].id, layers[2].id])).disabled, false);
});
