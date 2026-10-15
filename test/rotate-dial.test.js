import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { wrapAngle, snapAngle, pointerAngle, angleDelta } from '../js/rotate-dial.js';

describe('wrapAngle', () => {
  test('wraps into (-180, 180]', () => {
    assert.equal(wrapAngle(0), 0);
    assert.equal(wrapAngle(190), -170);
    assert.equal(wrapAngle(-190), 170);
    assert.equal(wrapAngle(-180), 180);
    assert.equal(wrapAngle(540), 180);
    assert.equal(wrapAngle(270), -90);
    assert.equal(wrapAngle(-360), 0);
  });
});

describe('snapAngle', () => {
  test('snaps within 3 degrees of a 15 degree mark', () => {
    assert.equal(snapAngle(44), 45);
    assert.equal(snapAngle(42), 45);
    assert.equal(snapAngle(-88), -90);
    assert.equal(snapAngle(178), 180);
    assert.equal(snapAngle(-178), 180);
    assert.equal(snapAngle(2), 0);
  });

  test('leaves other angles alone', () => {
    assert.equal(snapAngle(41), 41);
    assert.equal(snapAngle(7), 7);
    assert.equal(snapAngle(-23), -23);
  });
});

describe('pointerAngle', () => {
  test('0 is right, 90 is down (screen y grows down)', () => {
    assert.equal(pointerAngle(0, 0, 1, 0), 0);
    assert.equal(pointerAngle(0, 0, 0, 1), 90);
    assert.equal(pointerAngle(0, 0, -1, 0), 180);
    assert.equal(pointerAngle(0, 0, 0, -1), -90);
  });
});

describe('angleDelta', () => {
  test('takes the short way across the seam', () => {
    assert.equal(angleDelta(170, -170), 20);
    assert.equal(angleDelta(-170, 170), -20);
    assert.equal(angleDelta(10, 40), 30);
  });
});
