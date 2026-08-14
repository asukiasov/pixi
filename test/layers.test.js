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

describe('toProjectRecord / fromProjectRecord', () => {
  test('round-trips dimensions, layer settings, active index, and pixel data', () => {
    const stack = new LayerStack(3, 3, 'white');
    stack.addLayer('B');
    stack.setOpacity(1, 0.4);
    stack.setBlendMode(1, 'multiply');
    stack.setVisibility(1, false);
    stack.getActiveLayer().engine.setPixel(1, 1, [9, 8, 7, 255]);

    const record = stack.toProjectRecord();
    const restored = LayerStack.fromProjectRecord(record);

    assert.equal(restored.width, 3);
    assert.equal(restored.height, 3);
    assert.equal(restored.getActiveIndex(), 1);
    const layers = restored.getLayers();
    assert.equal(layers.length, 2);
    assert.equal(layers[0].name, 'Layer 1');
    assert.deepEqual(layers[0].engine.getPixel(0, 0), [255, 255, 255, 255]);
    assert.equal(layers[1].opacity, 0.4);
    assert.equal(layers[1].blendMode, 'multiply');
    assert.equal(layers[1].visible, false);
    assert.deepEqual(layers[1].engine.getPixel(1, 1), [9, 8, 7, 255]);
  });

  test('layer data is stored as a plain ArrayBuffer, not a typed array', () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const record = stack.toProjectRecord();
    assert.ok(record.layers[0].data instanceof ArrayBuffer);
  });

  test('record data is independent of the live stack', () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const record = stack.toProjectRecord();
    stack.getActiveLayer().engine.setPixel(0, 0, [1, 2, 3, 255]);
    const view = new Uint8ClampedArray(record.layers[0].data);
    assert.deepEqual(Array.from(view.slice(0, 4)), [0, 0, 0, 0]);
  });
});

describe('resize', () => {
  test('shrinking crops content beyond the new bounds, top-left anchored', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.getActiveLayer().engine.setPixel(0, 0, [1, 1, 1, 255]);
    stack.getActiveLayer().engine.setPixel(3, 3, [2, 2, 2, 255]); // will be cropped away
    stack.resize(2, 2);
    assert.equal(stack.width, 2);
    assert.equal(stack.height, 2);
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 0), [1, 1, 1, 255]);
  });

  test('growing pads new area transparently and preserves existing content position', () => {
    const stack = new LayerStack(2, 2, 'white');
    stack.resize(4, 4);
    assert.equal(stack.width, 4);
    assert.equal(stack.height, 4);
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 0), [255, 255, 255, 255]);
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(3, 3), [0, 0, 0, 0]);
  });

  test('resize applies to every layer and preserves layer settings', () => {
    const stack = new LayerStack(2, 2, 'transparent');
    stack.addLayer('B');
    stack.setOpacity(1, 0.5);
    stack.resize(4, 4);
    const layers = stack.getLayers();
    assert.equal(layers.length, 2);
    assert.equal(layers[1].name, 'B');
    assert.equal(layers[1].opacity, 0.5);
    assert.equal(layers[1].engine.width, 4);
  });
});

describe('rotate90', () => {
  test('clockwise rotation on a non-square canvas swaps dimensions and content', () => {
    const stack = new LayerStack(2, 1, 'transparent'); // 2 wide, 1 tall
    stack.getActiveLayer().engine.setPixel(0, 0, [10, 0, 0, 255]); // "A", left
    stack.getActiveLayer().engine.setPixel(1, 0, [20, 0, 0, 255]); // "B", right
    stack.rotate90('cw');
    assert.equal(stack.width, 1);
    assert.equal(stack.height, 2);
    // Rotating a rightward arrow [A,B] 90 CW points it down: A on top, B below.
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 0), [10, 0, 0, 255]);
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 1), [20, 0, 0, 255]);
  });

  test('counter-clockwise rotation on a non-square canvas', () => {
    const stack = new LayerStack(2, 1, 'transparent');
    stack.getActiveLayer().engine.setPixel(0, 0, [10, 0, 0, 255]); // "A", left
    stack.getActiveLayer().engine.setPixel(1, 0, [20, 0, 0, 255]); // "B", right
    stack.rotate90('ccw');
    assert.equal(stack.width, 1);
    assert.equal(stack.height, 2);
    // Rotating a rightward arrow [A,B] 90 CCW points it up: B on top, A below.
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 0), [20, 0, 0, 255]);
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 1), [10, 0, 0, 255]);
  });

  test('rotation on a square canvas keeps dimensions and applies to every layer', () => {
    const stack = new LayerStack(2, 2, 'transparent');
    stack.addLayer('B');
    stack.getActiveLayer().engine.setPixel(0, 0, [5, 5, 5, 255]);
    stack.rotate90('cw');
    assert.equal(stack.width, 2);
    assert.equal(stack.height, 2);
    assert.equal(stack.getLayers().length, 2);
    // (0,0) in a 2x2 rotates CW to (1,0).
    assert.deepEqual(stack.getLayers()[1].engine.getPixel(1, 0), [5, 5, 5, 255]);
  });
});
