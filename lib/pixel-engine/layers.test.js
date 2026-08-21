import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LayerStack } from './layers.js';

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

describe('Background layer (2g-background-layer)', () => {
  test('white background flags the starting layer as Background', () => {
    const stack = new LayerStack(4, 4, 'white');
    assert.equal(stack.getActiveLayer().isBackground, true);
  });

  test('transparent background does not flag the starting layer', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    assert.equal(stack.getActiveLayer().isBackground, false);
  });

  test('a newly added layer is never the Background layer', () => {
    const stack = new LayerStack(4, 4, 'white');
    const added = stack.addLayer('B');
    assert.equal(added.isBackground, false);
  });

  test('moveLayerUp/moveLayerDown are no-ops on the Background layer', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    const before = stack.getLayers();
    assert.equal(stack.moveLayerUp(0), false);
    assert.deepEqual(stack.getLayers(), before);
    // Move 'B' up above nothing (already topmost) is unaffected by this;
    // confirm moveLayerDown on 'B' (index 1) into the Background layer's
    // slot is also refused, purely because the *target* slot (0) holds
    // the Background layer.
    assert.equal(stack.moveLayerDown(1), false);
    assert.deepEqual(stack.getLayers(), before);
  });

  test('moveLayerUp/moveLayerDown work normally on non-Background layers', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    stack.addLayer('C');
    // B (1) and C (2) are both regular layers - reordering between them
    // is unaffected by the Background layer at index 0.
    const result = stack.moveLayerUp(1);
    assert.equal(result, true);
    assert.equal(stack.getLayers()[2].name, 'B');
  });

  test('snapshot/restore preserves isBackground', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    const snap = stack.snapshot();
    stack.restore(snap);
    const layers = stack.getLayers();
    assert.equal(layers[0].isBackground, true);
    assert.equal(layers[1].isBackground, false);
  });

  test('toProjectRecord/fromProjectRecord round-trips isBackground', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    const record = stack.toProjectRecord();
    const restored = LayerStack.fromProjectRecord(record);
    const layers = restored.getLayers();
    assert.equal(layers[0].isBackground, true);
    assert.equal(layers[1].isBackground, false);
  });

  test('a record with no isBackground field defaults to false', () => {
    const stack = new LayerStack(4, 4, 'white');
    const record = stack.toProjectRecord();
    delete record.layers[0].isBackground; // simulate a pre-existing saved project
    const restored = LayerStack.fromProjectRecord(record);
    assert.equal(restored.getLayers()[0].isBackground, false);
  });
});

describe('reference image layer (reference-image-layer)', () => {
  test('addReferenceImageLayer adds a locked layer to the top of the stack from pixel data', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    pixels.set([9, 8, 7, 255], 0); // pixel (0,0)
    const added = stack.addReferenceImageLayer(pixels, 'My Reference');
    const layers = stack.getLayers();
    assert.equal(layers.length, 2);
    assert.equal(layers[1], added);
    assert.equal(added.isReferenceImage, true);
    assert.equal(added.name, 'My Reference');
    assert.deepEqual(added.engine.getPixel(0, 0), [9, 8, 7, 255]);
  });

  test('addReferenceImageLayer does not make the new layer active', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0 active
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref');
    assert.equal(stack.getActiveIndex(), 0); // unchanged - Background layer stays active
  });

  test('refuses a second reference image layer on the same canvas', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const first = stack.addReferenceImageLayer(pixels, 'Ref 1');
    const second = stack.addReferenceImageLayer(pixels, 'Ref 2');
    assert.equal(second, null);
    assert.equal(stack.getLayers().length, 2);
    assert.equal(stack.getLayers()[1], first);
  });

  test('counts toward the 8-layer cap', () => {
    const stack = new LayerStack(4, 4, 'white');
    for (let i = 0; i < 7; i++) stack.addLayer(`L${i}`);
    assert.equal(stack.getLayers().length, 8);
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const result = stack.addReferenceImageLayer(pixels, 'Ref');
    assert.equal(result, null);
    assert.equal(stack.getLayers().length, 8);
  });

  test('updateReferenceImageData overwrites the reference image layer in place', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const added = stack.addReferenceImageLayer(pixels, 'Ref');
    const newPixels = new Uint8ClampedArray(4 * 4 * 4);
    newPixels.set([1, 2, 3, 255], 0);
    const result = stack.updateReferenceImageData(newPixels);
    assert.equal(result, true);
    assert.deepEqual(added.engine.getPixel(0, 0), [1, 2, 3, 255]);
    // Position/name/id untouched.
    const layers = stack.getLayers();
    assert.equal(layers[1], added);
    assert.equal(layers[1].name, 'Ref');
  });

  test('updateReferenceImageData refuses when there is no reference image layer', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    assert.equal(stack.updateReferenceImageData(pixels), false);
  });

  test('setActiveLayer refuses to activate a reference image layer', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0 active
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref'); // index 1, locked
    stack.setActiveLayer(1);
    assert.equal(stack.getActiveIndex(), 0); // refused, stayed on 0
  });

  test('setActiveLayer still works normally for regular layers', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B'); // index 1, active
    stack.setActiveLayer(0);
    assert.equal(stack.getActiveIndex(), 0);
  });

  // Unlike Background, the reference image layer is NOT position-locked -
  // it's freely reorderable so the user can move it out from between
  // their drawing layers and the canvas view, instead of it permanently
  // sitting on top. See moveLayerUp/moveLayerDown's doc comment.
  test('moveLayerDown works normally on the reference image layer', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B'); // index 1
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref'); // index 2, topmost
    const result = stack.moveLayerDown(2);
    assert.equal(result, true);
    const layers = stack.getLayers();
    assert.equal(layers[1].isReferenceImage, true);
    assert.equal(layers[2].name, 'B');
  });

  test('a regular layer can move up past the reference image layer', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B'); // index 1
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref'); // index 2, topmost
    const result = stack.moveLayerUp(1); // 'B' swaps with the reference layer
    assert.equal(result, true);
    const layers = stack.getLayers();
    assert.equal(layers[1].isReferenceImage, true);
    assert.equal(layers[2].name, 'B');
  });

  test('moveLayerUp/moveLayerDown still refuse a swap into the Background layer slot', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0 is Background
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref'); // index 1, topmost
    const before = stack.getLayers();
    // Moving the reference layer down would swap into Background's slot,
    // relocating it - must still be refused.
    assert.equal(stack.moveLayerDown(1), false);
    assert.deepEqual(stack.getLayers(), before);
  });

  test('reference image layer can be deleted', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref');
    const result = stack.deleteLayer(1);
    assert.equal(result, true);
    assert.equal(stack.getLayers().length, 1);
  });

  test('a canvas can accept a new reference image layer after the old one is deleted', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref 1');
    stack.deleteLayer(1);
    const second = stack.addReferenceImageLayer(pixels, 'Ref 2');
    assert.notEqual(second, null);
  });

  test('snapshot/restore preserves isReferenceImage', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref');
    const snap = stack.snapshot();
    stack.restore(snap);
    const layers = stack.getLayers();
    assert.equal(layers[0].isReferenceImage, false);
    assert.equal(layers[1].isReferenceImage, true);
  });

  test('toProjectRecord/fromProjectRecord round-trips isReferenceImage and pixel data', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    pixels.set([1, 2, 3, 255], 0);
    stack.addReferenceImageLayer(pixels, 'Ref');
    const record = stack.toProjectRecord();
    const restored = LayerStack.fromProjectRecord(record);
    const layers = restored.getLayers();
    assert.equal(layers[0].isReferenceImage, false);
    assert.equal(layers[1].isReferenceImage, true);
    assert.deepEqual(layers[1].engine.getPixel(0, 0), [1, 2, 3, 255]);
  });

  test('a record with no isReferenceImage field defaults to false', () => {
    const stack = new LayerStack(4, 4, 'white');
    const record = stack.toProjectRecord();
    delete record.layers[0].isReferenceImage; // simulate a pre-existing saved project
    const restored = LayerStack.fromProjectRecord(record);
    assert.equal(restored.getLayers()[0].isReferenceImage, false);
  });

  test('resize preserves isReferenceImage', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref');
    stack.resize(2, 2);
    assert.equal(stack.getLayers()[1].isReferenceImage, true);
  });

  test('rotate90 preserves isReferenceImage', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref');
    stack.rotate90('cw');
    assert.equal(stack.getLayers()[1].isReferenceImage, true);
  });

  test('regular layers are unaffected: isReferenceImage defaults false', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B');
    assert.equal(stack.getLayers()[0].isReferenceImage, false);
    assert.equal(stack.getLayers()[1].isReferenceImage, false);
  });
});

describe('reference image original-resolution mode (reference-image-original-resolution)', () => {
  test('addReferenceImageLayer defaults to pixelated mode with no source blob', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const added = stack.addReferenceImageLayer(pixels, 'Ref');
    assert.equal(added.referenceMode, 'pixelated');
    assert.equal(added.originalSourceBlob, null);
  });

  test('addReferenceImageLayer accepts an initial mode and source blob', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const blob = new Blob(['fake image bytes']);
    const added = stack.addReferenceImageLayer(pixels, 'Ref', { referenceMode: 'original', originalSourceBlob: blob });
    assert.equal(added.referenceMode, 'original');
    assert.equal(added.originalSourceBlob, blob);
    // Pixel data is still seeded from the pixelated fit regardless of mode.
    assert.deepEqual(added.engine.data.length, pixels.length);
  });

  test('setReferenceMode switches an existing reference layer in place', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const added = stack.addReferenceImageLayer(pixels, 'Ref');
    const result = stack.setReferenceMode('original');
    assert.equal(result, true);
    assert.equal(added.referenceMode, 'original');
    // Position/name/id untouched.
    assert.equal(stack.getLayers()[1], added);
    assert.equal(added.name, 'Ref');
  });

  test('setReferenceMode refuses an invalid mode', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const added = stack.addReferenceImageLayer(pixels, 'Ref');
    assert.equal(stack.setReferenceMode('smoothed'), false);
    assert.equal(added.referenceMode, 'pixelated');
  });

  test('setReferenceMode refuses when there is no reference image layer', () => {
    const stack = new LayerStack(4, 4, 'white');
    assert.equal(stack.setReferenceMode('original'), false);
  });

  test('snapshot/restore preserves referenceMode and originalSourceBlob', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const blob = new Blob(['fake']);
    stack.addReferenceImageLayer(pixels, 'Ref', { referenceMode: 'original', originalSourceBlob: blob });
    const snap = stack.snapshot();
    stack.restore(snap);
    const layer = stack.getLayers()[1];
    assert.equal(layer.referenceMode, 'original');
    assert.equal(layer.originalSourceBlob, blob);
  });

  test('undo (restore) after a mode toggle brings back the prior mode', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const blob = new Blob(['fake']);
    stack.addReferenceImageLayer(pixels, 'Ref', { referenceMode: 'original', originalSourceBlob: blob });
    const beforeToggle = stack.snapshot();
    stack.setReferenceMode('pixelated');
    assert.equal(stack.getLayers()[1].referenceMode, 'pixelated');
    stack.restore(beforeToggle);
    assert.equal(stack.getLayers()[1].referenceMode, 'original');
    assert.equal(stack.getLayers()[1].originalSourceBlob, blob);
  });

  test('toProjectRecord/fromProjectRecord round-trips referenceMode and originalSourceBlob', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const blob = new Blob(['fake']);
    stack.addReferenceImageLayer(pixels, 'Ref', { referenceMode: 'original', originalSourceBlob: blob });
    const record = stack.toProjectRecord();
    const restored = LayerStack.fromProjectRecord(record);
    const layer = restored.getLayers()[1];
    assert.equal(layer.referenceMode, 'original');
    assert.equal(layer.originalSourceBlob, blob);
  });

  test('a Pixelated-mode reference layer round-trips with no source blob stored', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref');
    const record = stack.toProjectRecord();
    assert.equal(record.layers[1].originalSourceBlob, null);
    const restored = LayerStack.fromProjectRecord(record);
    assert.equal(restored.getLayers()[1].referenceMode, 'pixelated');
    assert.equal(restored.getLayers()[1].originalSourceBlob, null);
  });

  test('a record with no referenceMode field defaults to pixelated', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref');
    const record = stack.toProjectRecord();
    delete record.layers[1].referenceMode; // simulate a pre-existing saved project
    const restored = LayerStack.fromProjectRecord(record);
    assert.equal(restored.getLayers()[1].referenceMode, 'pixelated');
  });

  test('resize preserves referenceMode and originalSourceBlob', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const blob = new Blob(['fake']);
    stack.addReferenceImageLayer(pixels, 'Ref', { referenceMode: 'original', originalSourceBlob: blob });
    stack.resize(2, 2);
    const layer = stack.getLayers()[1];
    assert.equal(layer.referenceMode, 'original');
    assert.equal(layer.originalSourceBlob, blob);
  });

  test('rotate90 preserves referenceMode and originalSourceBlob', () => {
    const stack = new LayerStack(4, 4, 'white');
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const blob = new Blob(['fake']);
    stack.addReferenceImageLayer(pixels, 'Ref', { referenceMode: 'original', originalSourceBlob: blob });
    stack.rotate90('cw');
    const layer = stack.getLayers()[1];
    assert.equal(layer.referenceMode, 'original');
    assert.equal(layer.originalSourceBlob, blob);
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
    // 'transparent', not 'white' - a white-background starting layer is
    // now the locked Background layer (see 2g-background-layer), which
    // this test isn't about; a regular layer at index 0 is what actually
    // exercises the generic swap being tested here.
    const stack = new LayerStack(4, 4, 'transparent');
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
    // 'transparent', not 'white' - see the matching comment on
    // 'moveLayerUp swaps with the layer above' above.
    const stack = new LayerStack(4, 4, 'transparent');
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

describe('loadImage (embeddable-integration-api 3.3)', () => {
  test('replaces the stack with a single layer sized to the given ImageData', () => {
    const stack = new LayerStack(4, 4, 'white');
    stack.addLayer('B'); // extra layer must be discarded, not resized/preserved like resize()
    const data = new Uint8ClampedArray(2 * 3 * 4);
    data.set([9, 8, 7, 255], 0); // pixel (0,0)
    stack.loadImage({ data, width: 2, height: 3 });

    assert.equal(stack.width, 2);
    assert.equal(stack.height, 3);
    assert.equal(stack.getLayers().length, 1);
    assert.equal(stack.getActiveIndex(), 0);
    assert.deepEqual(stack.getActiveLayer().engine.getPixel(0, 0), [9, 8, 7, 255]);
  });

  test('the loaded layer is a regular, unlocked layer, not the Background layer', () => {
    const stack = new LayerStack(4, 4, 'white'); // starts with a Background layer
    const data = new Uint8ClampedArray(4 * 4 * 4);
    stack.loadImage({ data, width: 4, height: 4 });
    assert.equal(stack.getActiveLayer().isBackground, false);
  });

  test('rejects data whose length does not match width*height*4, leaving the stack unchanged', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    const tooShort = new Uint8ClampedArray(2 * 2 * 4); // half the bytes a 4x4 image needs
    assert.throws(() => stack.loadImage({ data: tooShort, width: 4, height: 4 }), RangeError);
    assert.equal(stack.width, 4);
    assert.equal(stack.getLayers().length, 1);
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

// mergeLayers/mergeDown's success path composites via a <canvas> (see
// #compositeSubset, mirroring #compositeToCanvas), which this repo's
// Node test harness has no DOM for - same boundary that already leaves
// composite()/toPNGBlob() untested here (see this file's header comment
// on LayerStack). Only the validation/refusal paths, which return before
// touching the DOM, are unit-tested; the successful-merge pixel output is
// covered by manual browser verification (merge-layers change's tasks.md
// 4.2), not here.
describe('mergeLayers', () => {
  test('refuses fewer than 2 indices', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B');
    const before = stack.getLayers();
    assert.equal(stack.mergeLayers([]), false);
    assert.equal(stack.mergeLayers([0]), false);
    assert.deepEqual(stack.getLayers(), before);
  });

  test('refuses when any index is out of range', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B');
    const before = stack.getLayers();
    assert.equal(stack.mergeLayers([0, 5]), false);
    assert.equal(stack.mergeLayers([-1, 1]), false);
    assert.deepEqual(stack.getLayers(), before);
  });

  test('refuses when any index is the Background layer', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0 is Background
    stack.addLayer('B');
    stack.addLayer('C');
    const before = stack.getLayers();
    assert.equal(stack.mergeLayers([0, 1]), false);
    assert.deepEqual(stack.getLayers(), before);
  });

  test('refuses when any index is the reference image layer', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B'); // index 1
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref'); // index 2, topmost, locked
    const before = stack.getLayers();
    assert.equal(stack.mergeLayers([1, 2]), false);
    assert.deepEqual(stack.getLayers(), before);
  });
});

describe('mergeDown', () => {
  test('refuses when index is 0 (nothing below)', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B');
    const before = stack.getLayers();
    assert.equal(stack.mergeDown(0), false);
    assert.deepEqual(stack.getLayers(), before);
  });

  test('refuses when index is out of range', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B');
    assert.equal(stack.mergeDown(5), false);
    assert.equal(stack.mergeDown(-1), false);
  });

  test('refuses on a single-layer stack', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    assert.equal(stack.mergeDown(0), false);
    assert.equal(stack.getLayers().length, 1);
  });

  test('refuses when the layer directly below is the Background layer', () => {
    const stack = new LayerStack(4, 4, 'white'); // index 0 is Background
    stack.addLayer('B'); // index 1
    const before = stack.getLayers();
    assert.equal(stack.mergeDown(1), false);
    assert.deepEqual(stack.getLayers(), before);
  });

  test('refuses when index is the reference image layer', () => {
    const stack = new LayerStack(4, 4, 'transparent');
    stack.addLayer('B'); // index 1
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    stack.addReferenceImageLayer(pixels, 'Ref'); // index 2, topmost, locked
    const before = stack.getLayers();
    assert.equal(stack.mergeDown(2), false);
    assert.deepEqual(stack.getLayers(), before);
  });
});
