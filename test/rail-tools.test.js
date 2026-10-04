// Customize Tools: which tools sit on the tool rail, and in what order.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_IDS,
  TOOL_LABELS,
  DEFAULT_RAIL_TOOLS,
  normalizeRailTools,
  overflowTools,
  insertTool,
  removeTool,
  isDefaultRail,
  dropIndex,
} from '../js/rail-tools.js';

describe('tool ids', () => {
  test('ten tools in rail order, each labelled', () => {
    assert.deepEqual([...TOOL_IDS], ['move', 'pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'selection', 'hand', 'eyedropper']);
    for (const id of TOOL_IDS) assert.equal(typeof TOOL_LABELS[id], 'string', id);
    assert.equal(TOOL_LABELS.selection, 'Select');
  });

  test('the default rail is every tool', () => {
    assert.deepEqual([...DEFAULT_RAIL_TOOLS], [...TOOL_IDS]);
  });
});

describe('normalizeRailTools', () => {
  test('non-arrays give a fresh default', () => {
    for (const raw of [undefined, null, 'pencil', {}, 3]) assert.deepEqual(normalizeRailTools(raw), [...TOOL_IDS]);
    assert.notEqual(normalizeRailTools(undefined), DEFAULT_RAIL_TOOLS);
  });

  test('keeps order, drops unknowns and duplicates', () => {
    assert.deepEqual(normalizeRailTools(['hand', 'lasso', 'pencil', 'hand', 7]), ['hand', 'pencil']);
  });

  test('an empty rail stays empty', () => {
    assert.deepEqual(normalizeRailTools([]), []);
  });
});

describe('list operations', () => {
  test('overflowTools is the rest, in default order', () => {
    assert.deepEqual(overflowTools(['hand', 'move']), ['pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'selection', 'eyedropper']);
    assert.deepEqual(overflowTools([...TOOL_IDS]), []);
  });

  test('insertTool adds at an index, clamped', () => {
    assert.deepEqual(insertTool(['move', 'pencil'], 'hand', 1), ['move', 'hand', 'pencil']);
    assert.deepEqual(insertTool(['move'], 'hand', 99), ['move', 'hand']);
    assert.deepEqual(insertTool(['move'], 'hand', -3), ['hand', 'move']);
  });

  test('insertTool moves a tool already there; the index counts the list without it', () => {
    assert.deepEqual(insertTool(['move', 'pencil', 'eraser'], 'move', 1), ['pencil', 'move', 'eraser']);
    assert.deepEqual(insertTool(['move', 'pencil', 'eraser'], 'eraser', 0), ['eraser', 'move', 'pencil']);
  });

  test('insertTool and removeTool never change their input', () => {
    const rail = ['move', 'pencil'];
    insertTool(rail, 'hand', 0);
    removeTool(rail, 'move');
    assert.deepEqual(rail, ['move', 'pencil']);
  });

  test('removeTool', () => {
    assert.deepEqual(removeTool(['move', 'pencil'], 'move'), ['pencil']);
    assert.deepEqual(removeTool(['move'], 'hand'), ['move']);
  });

  test('isDefaultRail', () => {
    assert.equal(isDefaultRail([...TOOL_IDS]), true);
    assert.equal(isDefaultRail(insertTool([...TOOL_IDS], 'move', 1)), false);
    assert.equal(isDefaultRail(TOOL_IDS.slice(1)), false);
    assert.equal(isDefaultRail([]), false);
  });
});

describe('dropIndex', () => {
  // Two rows of three tiles, 60px wide and 80px tall, 10px apart.
  const rects = [0, 1, 2, 3, 4, 5].map((i) => ({ left: (i % 3) * 70, top: Math.floor(i / 3) * 90, width: 60, height: 80 }));

  test('before the tile whose centre is right of the pointer, in its row', () => {
    assert.equal(dropIndex(rects, { x: 10, y: 40 }), 0);
    assert.equal(dropIndex(rects, { x: 40, y: 40 }), 1);
    assert.equal(dropIndex(rects, { x: 75, y: 130 }), 4);
  });

  test('past the end of a row goes before the next row', () => {
    assert.equal(dropIndex(rects, { x: 200, y: 40 }), 3);
  });

  test('past the last tile, and an empty row', () => {
    assert.equal(dropIndex(rects, { x: 500, y: 130 }), 6);
    assert.equal(dropIndex([], { x: 0, y: 0 }), 0);
  });
});
