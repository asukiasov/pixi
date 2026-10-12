import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pointerDownAction } from '../js/pointer-policy.js';

const down = (pointerType, extra = {}) => pointerDownAction({ pointerType, pencilOnly: true, penSeen: false, penDown: false, ...extra });

describe('pointerDownAction', () => {
  test('with Pencil-only off, every pointer behaves as before', () => {
    for (const pointerType of ['mouse', 'pen', 'touch']) {
      assert.equal(down(pointerType, { pencilOnly: false, penSeen: true, penDown: true }), 'normal', pointerType);
    }
  });

  test('a mouse is never affected', () => {
    assert.equal(down('mouse', { penSeen: true, penDown: true }), 'normal');
  });

  test('the Pencil is always the Pencil (the caller drops resting touches)', () => {
    assert.equal(down('pen'), 'pen');
    assert.equal(down('pen', { penSeen: true }), 'pen');
  });

  test('before any Pencil touch, fingers draw as before', () => {
    assert.equal(down('touch'), 'normal');
  });

  test('after a Pencil touch, a finger only takes part in gestures', () => {
    assert.equal(down('touch', { penSeen: true }), 'gesture');
  });

  test('while the Pencil is down, a touch is ignored outright', () => {
    assert.equal(down('touch', { penSeen: true, penDown: true }), 'ignore');
  });
});
