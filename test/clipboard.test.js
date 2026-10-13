import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cropToContent, matchesRecord, placeOnCanvas, setRecord, getRecord } from '../js/clipboard.js';

// 3x3 RGBA source with one opaque red pixel at (1, 2) and one at (2, 1).
function source() {
  const data = new Uint8ClampedArray(3 * 3 * 4);
  data.set([255, 0, 0, 255], (2 * 3 + 1) * 4);
  data.set([255, 0, 0, 255], (1 * 3 + 2) * 4);
  return { data, width: 3, height: 3 };
}

describe('cropToContent', () => {
  test('crops tight to the content inside rect', () => {
    const r = cropToContent(source(), { x: 0, y: 0, width: 3, height: 3 });
    assert.deepEqual({ x: r.x, y: r.y, width: r.width, height: r.height }, { x: 1, y: 1, width: 2, height: 2 });
    assert.deepEqual([...r.data.slice(4, 8)], [255, 0, 0, 255]); // (2,1) is top-right of the crop
    assert.deepEqual([...r.data.slice(8, 12)], [255, 0, 0, 255]); // (1,2) is bottom-left
    assert.deepEqual([...r.data.slice(0, 4)], [0, 0, 0, 0]);
  });

  test('null for an empty area', () => {
    assert.equal(cropToContent(source(), { x: 0, y: 0, width: 1, height: 1 }), null);
  });

  test('clamps a rect hanging off the canvas', () => {
    const r = cropToContent(source(), { x: -2, y: -2, width: 10, height: 10 });
    assert.equal(r.width, 2);
    assert.equal(r.height, 2);
  });
});

describe('matchesRecord', () => {
  const record = { width: 1, height: 2, data: new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0]) };

  test('exact match', () => {
    assert.equal(matchesRecord(record, { width: 1, height: 2, data: record.data.slice() }), true);
  });

  test('within rounding, colour ignored where alpha is 0', () => {
    assert.equal(matchesRecord(record, { width: 1, height: 2, data: new Uint8ClampedArray([11, 19, 30, 254, 9, 9, 9, 0]) }), true);
  });

  test('low alpha tolerates more colour drift', () => {
    const faint = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 10]) };
    assert.equal(matchesRecord(faint, { width: 1, height: 1, data: new Uint8ClampedArray([120, 90, 100, 10]) }), true);
  });

  test('different size or pixels, or no record', () => {
    assert.equal(matchesRecord(record, { width: 2, height: 1, data: record.data.slice() }), false);
    assert.equal(matchesRecord(record, { width: 1, height: 2, data: new Uint8ClampedArray([90, 20, 30, 255, 0, 0, 0, 0]) }), false);
    assert.equal(matchesRecord(null, record), false);
  });
});

describe('placeOnCanvas', () => {
  test('stamps the region at x, y and clips what hangs off', () => {
    const region = { x: 1, y: -1, width: 2, height: 2, data: new Uint8ClampedArray([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]) };
    const out = placeOnCanvas(region, 2, 2);
    assert.equal(out.length, 16);
    assert.deepEqual([...out.slice(4, 8)], [3, 3, 3, 3]); // region (0,1) lands at canvas (1,0)
    assert.deepEqual([...out.slice(0, 4)], [0, 0, 0, 0]);
    assert.deepEqual([...out.slice(8)], [0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

test('record store keeps the last copy', () => {
  setRecord({ kind: 'layer' });
  assert.deepEqual(getRecord(), { kind: 'layer' });
});
