import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document ??= {}; // js/workspace.js reads `document` at import time; nothing here uses it
const { dropTarget } = await import('../js/layers-ui.js');

// Display order is top to bottom; stack ids bottom to top. The dragged
// layer is already left out of both, as the panel does.
describe('dropTarget', () => {
  const stack = ['a', 'b', 'c', 'd']; // a bottom ... d top
  const flat = [
    { kind: 'layer', id: 'd', groupId: null },
    { kind: 'layer', id: 'c', groupId: null },
    { kind: 'layer', id: 'b', groupId: null },
    { kind: 'layer', id: 'a', groupId: null },
  ];

  test('above the top row goes to the top', () => {
    assert.deepEqual(dropTarget(flat, 0, stack), { toIndex: 4, groupId: null });
  });

  test('between rows goes above the row below the gap', () => {
    assert.deepEqual(dropTarget(flat, 2, stack), { toIndex: 2, groupId: null });
  });

  test('after the last row goes to the bottom', () => {
    assert.deepEqual(dropTarget(flat, 4, stack), { toIndex: 0, groupId: null });
  });

  // d top, then group G (header) with members c and b, then a.
  const grouped = [
    { kind: 'layer', id: 'd', groupId: null },
    { kind: 'group', id: 'G', memberIds: ['b', 'c'] },
    { kind: 'layer', id: 'c', groupId: 'G' },
    { kind: 'layer', id: 'b', groupId: 'G' },
    { kind: 'layer', id: 'a', groupId: null },
  ];

  test('just under a group header joins the group at its top', () => {
    assert.deepEqual(dropTarget(grouped, 2, stack), { toIndex: 3, groupId: 'G' });
  });

  test('between two members joins the group', () => {
    assert.deepEqual(dropTarget(grouped, 3, stack), { toIndex: 2, groupId: 'G' });
  });

  test('above a group header goes above the whole group, outside it', () => {
    assert.deepEqual(dropTarget(grouped, 1, stack), { toIndex: 3, groupId: null });
  });

  test('under the last member goes below the group, outside it', () => {
    assert.deepEqual(dropTarget(grouped, 4, stack), { toIndex: 1, groupId: null });
  });

  test('a collapsed group: under its header means below the group', () => {
    const collapsed = [grouped[0], grouped[1], grouped[4]];
    assert.deepEqual(dropTarget(collapsed, 2, stack), { toIndex: 1, groupId: null });
  });
});
