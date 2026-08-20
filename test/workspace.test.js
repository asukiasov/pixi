import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayerMarkState } from '../js/workspace.js';

// librarySequenceToggleVisibleForTool (Color Library sequence toggle's
// show/hide predicate) moved to pixi-pro (split-pixi-pro-repo) - see that
// repo's test suite for its coverage.

// The rest of js/workspace.js is DOM-bound (bindDomOnce wires up dozens of
// elements at once, and this repo has no jsdom/browser test harness - see
// test/router.test.js and friends, all DOM-free). Layers panel marking
// (multi-select) is DOM-bound in buildLayerRow's click handler too, so
// only the pure state-transition function below is unit-tested; the
// actual click wiring is covered by manual verification (merge-layers
// change's tasks.md 4.2).
describe('computeLayerMarkState', () => {
  const layers = [
    { id: 'bg', isBackground: true },
    { id: 'a', isBackground: false },
    { id: 'b', isBackground: false },
    { id: 'c', isBackground: false },
    { id: 'd', isBackground: false },
  ];

  test('Cmd/Ctrl+click marks an unmarked layer, preserving other marks', () => {
    const result = computeLayerMarkState({
      marked: new Set(['b']),
      lastClickedId: 'b',
      clickedId: 'a',
      layers,
      metaOrCtrl: true,
      shift: false,
    });
    assert.deepEqual([...result.marked].sort(), ['a', 'b']);
    assert.equal(result.lastClickedId, 'a');
  });

  test('Cmd/Ctrl+click on an already-marked layer unmarks it', () => {
    const result = computeLayerMarkState({
      marked: new Set(['a', 'b']),
      lastClickedId: 'b',
      clickedId: 'a',
      layers,
      metaOrCtrl: true,
      shift: false,
    });
    assert.deepEqual([...result.marked], ['b']);
  });

  test('Shift+click marks the contiguous range from the last click', () => {
    const result = computeLayerMarkState({
      marked: new Set(),
      lastClickedId: 'a',
      clickedId: 'd',
      layers,
      metaOrCtrl: false,
      shift: true,
    });
    assert.deepEqual([...result.marked].sort(), ['a', 'b', 'c', 'd']);
    assert.equal(result.lastClickedId, 'd');
  });

  test('Shift+click range works in either direction', () => {
    const result = computeLayerMarkState({
      marked: new Set(),
      lastClickedId: 'd',
      clickedId: 'b',
      layers,
      metaOrCtrl: false,
      shift: true,
    });
    assert.deepEqual([...result.marked].sort(), ['b', 'c', 'd']);
  });

  test('Shift+click replaces any prior marks with the new range', () => {
    const result = computeLayerMarkState({
      marked: new Set(['a']),
      lastClickedId: 'b',
      clickedId: 'c',
      layers,
      metaOrCtrl: false,
      shift: true,
    });
    assert.deepEqual([...result.marked].sort(), ['b', 'c']);
  });

  test('Shift+click with no prior click behaves like a plain click', () => {
    const result = computeLayerMarkState({
      marked: new Set(['a']),
      lastClickedId: null,
      clickedId: 'c',
      layers,
      metaOrCtrl: false,
      shift: true,
    });
    assert.deepEqual([...result.marked], []);
    assert.equal(result.lastClickedId, 'c');
  });

  test('Plain click clears all marks', () => {
    const result = computeLayerMarkState({
      marked: new Set(['a', 'b']),
      lastClickedId: 'b',
      clickedId: 'c',
      layers,
      metaOrCtrl: false,
      shift: false,
    });
    assert.deepEqual([...result.marked], []);
    assert.equal(result.lastClickedId, 'c');
  });

  test('the Background layer is never marked, Cmd/Ctrl+click', () => {
    const result = computeLayerMarkState({
      marked: new Set(),
      lastClickedId: 'a',
      clickedId: 'bg',
      layers,
      metaOrCtrl: true,
      shift: false,
    });
    assert.deepEqual([...result.marked], []);
  });

  test('Cmd/Ctrl+click on the Background layer leaves existing marks untouched', () => {
    const result = computeLayerMarkState({
      marked: new Set(['a']),
      lastClickedId: 'a',
      clickedId: 'bg',
      layers,
      metaOrCtrl: true,
      shift: false,
    });
    assert.deepEqual([...result.marked], ['a']);
  });

  test('a plain click on the Background layer still clears marks, same as any other row', () => {
    const result = computeLayerMarkState({
      marked: new Set(['a', 'b']),
      lastClickedId: 'b',
      clickedId: 'bg',
      layers,
      metaOrCtrl: false,
      shift: false,
    });
    assert.deepEqual([...result.marked], []);
    assert.equal(result.lastClickedId, 'bg');
  });

  test('a Shift+click range excludes the Background layer even when it falls inside the span', () => {
    const spanningLayers = [
      { id: 'a', isBackground: false },
      { id: 'bg', isBackground: true },
      { id: 'b', isBackground: false },
    ];
    const result = computeLayerMarkState({
      marked: new Set(),
      lastClickedId: 'a',
      clickedId: 'b',
      layers: spanningLayers,
      metaOrCtrl: false,
      shift: true,
    });
    assert.deepEqual([...result.marked].sort(), ['a', 'b']);
  });

  const layersWithReference = [
    { id: 'a', isBackground: false, isReferenceImage: false },
    { id: 'b', isBackground: false, isReferenceImage: false },
    { id: 'ref', isBackground: false, isReferenceImage: true },
  ];

  test('the reference image layer is never marked, Cmd/Ctrl+click', () => {
    const result = computeLayerMarkState({
      marked: new Set(),
      lastClickedId: 'a',
      clickedId: 'ref',
      layers: layersWithReference,
      metaOrCtrl: true,
      shift: false,
    });
    assert.deepEqual([...result.marked], []);
  });

  test('Cmd/Ctrl+click on the reference image layer leaves existing marks untouched', () => {
    const result = computeLayerMarkState({
      marked: new Set(['a']),
      lastClickedId: 'a',
      clickedId: 'ref',
      layers: layersWithReference,
      metaOrCtrl: true,
      shift: false,
    });
    assert.deepEqual([...result.marked], ['a']);
  });

  test('a Shift+click range excludes the reference image layer even when it falls inside the span', () => {
    const spanningLayers = [
      { id: 'a', isBackground: false, isReferenceImage: false },
      { id: 'ref', isBackground: false, isReferenceImage: true },
      { id: 'b', isBackground: false, isReferenceImage: false },
    ];
    const result = computeLayerMarkState({
      marked: new Set(),
      lastClickedId: 'a',
      clickedId: 'b',
      layers: spanningLayers,
      metaOrCtrl: false,
      shift: true,
    });
    assert.deepEqual([...result.marked].sort(), ['a', 'b']);
  });
});
