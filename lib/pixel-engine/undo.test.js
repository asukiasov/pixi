import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UndoStack } from './undo.js';

describe('UndoStack', () => {
  test('starts with nothing to undo or redo', () => {
    const stack = new UndoStack();
    assert.equal(stack.canUndo(), false);
    assert.equal(stack.canRedo(), false);
  });

  test('undo returns the previously pushed snapshot', () => {
    const stack = new UndoStack();
    stack.push('state-0');
    stack.push('state-1');
    assert.equal(stack.canUndo(), true);
    assert.equal(stack.undo(), 'state-0');
  });

  test('redo returns to the state before the undo', () => {
    const stack = new UndoStack();
    stack.push('state-0');
    stack.push('state-1');
    stack.undo();
    assert.equal(stack.canRedo(), true);
    assert.equal(stack.redo(), 'state-1');
  });

  test('undo with nothing pushed yet is a no-op returning undefined', () => {
    const stack = new UndoStack();
    assert.equal(stack.undo(), undefined);
  });

  test('redo with nothing to redo is a no-op returning undefined', () => {
    const stack = new UndoStack();
    stack.push('state-0');
    assert.equal(stack.redo(), undefined);
  });

  test('committing a new action after undo discards the redo history', () => {
    const stack = new UndoStack();
    stack.push('state-0');
    stack.push('state-1');
    stack.undo(); // pointer now behind state-1, state-1 is redoable
    stack.push('state-2'); // new commit while not at the top
    assert.equal(stack.canRedo(), false);
    assert.equal(stack.undo(), 'state-0');
  });

  test('stack is capped at 20 snapshots', () => {
    const stack = new UndoStack();
    for (let i = 0; i < 30; i++) stack.push(`state-${i}`);
    assert.equal(stack.size(), 20);
    // The oldest 10 should have been dropped; undoing all the way should
    // bottom out at state-10, not state-0.
    let last;
    while (stack.canUndo()) last = stack.undo();
    assert.equal(last, 'state-10');
  });
});
