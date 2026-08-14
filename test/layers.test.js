import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LayerStack } from '../js/layers.js';

describe('LayerStack construction', () => {
  test('starts with exactly one layer at the chosen background, active', () => {
    const stack = new LayerStack(4, 4, 'white');
    const layers = stack.getLayers();
    assert.equal(layers.length, 1);
    assert.equal(stack.getActiveIndex(), 0);
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 0), [255, 255, 255, 255]);
  });

  test('transparent background starting layer', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 0), [0, 0, 0, 0]);
  });
});

describe('addLayer', () => {
  test('adds a transparent layer directly above the active one, and it becomes active', () => {
    const stack = new LayerStack(4, 4, 'white');
    const added = stack.addLayer('Sketch');
    assert.equal(stack.getLayers().length, 2);
    assert.equal(stack.getActiveIndex(), 1);
    assert.equal(stack.getActiveLayer(), added);
    assert.equal(added.name, 'Sketch');
    assert.deepEqual(added.engine.getPixel(0, 0), [0, 0, 0, 0]);
  });

  test('inserts above the active layer, not always at the top', () => {
    const stack = new LayerStack(4, 4, 'white'); // layer 0 active
    stack.addLayer('B'); // active now index 1
    stack.setActiveLayer(0);
    const c = stack.addLayer('C'); // should insert at index 1, between 0 and old B
    const layers = stack.getLayers();
    assert.equal(layers[1], c);
    assert.equal(layers.length, 3);
  });

  test('refuses to add past the 8-layer cap', () => {
    const stack = new LayerStack(4, 4, 'white');
    for (let i = 0; i < 7; i++) stack.addLayer(`L${i}`);
    assert.equal(stack.getLayers().length, 8);
    const result = stack.addLayer('overflow');
    assert.equal(result, null);
    assert.equal(stack.getLayers().length, 8);
  });

  test('every layer has a unique id', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    stack.addLayer('C');
    const ids = stack.getLayers().map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('deleteLayer', () => {
  test('cannot delete the only layer', () => {
    const stack = new LayerStack(4, 4, 'white');
    const result = stack.deleteLayer(0);
    assert.equal(result, false);
    assert.equal(stack.getLayers().length, 1);
  });

  test('deleting the active layer activates the one directly below it', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0
    stack.addLayer('B'); // index 1, active
    stack.addLayer('C'); // index 2, active
    stack.deleteLayer(2);
    assert.equal(stack.getLayers().length, 2);
    assert.equal(stack.getActiveIndex(), 1); // "B", directly below deleted "C"
  });

  test('deleting the active bottom layer activates the new topmost layer', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0, active
    stack.addLayer('B'); // index 1, active
    stack.setActiveLayer(0);
    stack.deleteLayer(0);
    assert.equal(stack.getLayers().length, 1);
    assert.equal(stack.getActiveIndex(), 0); // "B" is now the only (topmost) layer
  });

  test('deleting a non-active layer below the active one shifts the active index down', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0
    stack.addLayer('B'); // index 1, active
    stack.deleteLayer(0);
    assert.equal(stack.getLayers().length, 1);
    assert.equal(stack.getActiveIndex(), 0); // "B" stays active, now at index 0
    assert.equal(stack.getActiveLayer().name, 'B');
  });
});

describe('reordering', () => {
  test('moveLayerUp swaps with the layer above', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    const [a, b] = stack.getLayers();
    stack.setActiveLayer(0);
    const result = stack.moveLayerUp(0);
    assert.equal(result, true);
    assert.deepEqual(stack.getLayers(), [b, a]);
    assert.equal(stack.getActiveIndex(), 1); // followed the moved layer
  });

  test('moveLayerUp on the topmost layer is a no-op', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    const result = stack.moveLayerUp(1);
    assert.equal(result, false);
  });

  test('moveLayerDown swaps with the layer below', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    const [a, b] = stack.getLayers();
    const result = stack.moveLayerDown(1);
    assert.equal(result, true);
    assert.deepEqual(stack.getLayers(), [b, a]);
  });

  test('moveLayerDown on the bottommost layer is a no-op', () => {
    const stack = new LayerStack(4, 4, 'white');
    const result = stack.moveLayerDown(0);
    assert.equal(result, false);
  });
});

describe('per-layer settings', () => {
  test('renameLayer', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.renameLayer(0, 'Background');
    assert.equal(stack.getLayers()[0].name, 'Background');
  });

  test('setVisibility', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.setVisibility(0, false);
    assert.equal(stack.getLayers()[0].visible, false);
  });

  test('setOpacity clamps to 0-1', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.setOpacity(0, 0.5);
    assert.equal(stack.getLayers()[0].opacity, 0.5);
    stack.setOpacity(0, 5);
    assert.equal(stack.getLayers()[0].opacity, 1);
    stack.setOpacity(0, -5);
    assert.equal(stack.getLayers()[0].opacity, 0);
  });

  test('setBlendMode accepts a known mode and ignores an unknown one', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.setBlendMode(0, 'multiply');
    assert.equal(stack.getLayers()[0].blendMode, 'multiply');
    stack.setBlendMode(0, 'not-a-real-mode');
    assert.equal(stack.getLayers()[0].blendMode, 'multiply'); // unchanged
  });
});

describe('active-layer scoping', () => {
  test('drawing on the active layer only affects that layer', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B'); // active
    stack.getActiveLayer().engine.setPixel(1, 1, [255, 0, 0, 255]);
    assert.deepEqual(stack.getLayers()[1].engine.getPixel(1, 1), [255, 0, 0, 255]);
    assert.deepEqual(stack.getLayers()[0].engine.getPixel(1, 1), [0, 0, 0, 0]);
  });
});

describe('snapshot / restore', () => {
  test('round-trips full stack state, including a layer deletion', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    stack.getActiveLayer().engine.setPixel(0, 0, [10, 20, 30, 255]);
    const before = stack.snapshot();

    stack.deleteLayer(1);
    assert.equal(stack.getLayers().length, 1);

    stack.restore(before);
    const layers = stack.getLayers();
    assert.equal(layers.length, 2);
    assert.equal(layers[1].name, 'B');
    assert.deepEqual(layers[1].engine.getPixel(0, 0), [10, 20, 30, 255]);
    assert.equal(stack.getActiveIndex(), before.activeIndex);
  });

  test('snapshot copies pixel data, not a live reference', () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const snap = stack.snapshot();
    stack.getActiveLayer().engine.setPixel(0, 0, [1, 2, 3, 255]);
    assert.deepEqual(Array.from(snap.layers[0].data.slice(0, 4)), [0, 0, 0, 0]);
  });
});
