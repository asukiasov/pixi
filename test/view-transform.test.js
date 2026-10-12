import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { localToContainer, containerToLocal, transformAround, snapAngle, rotatedSize, centredPan, angleDelta } from '../js/view-transform.js';

const close = (a, b, msg) => {
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `${msg ?? ''} ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
};

describe('localToContainer / containerToLocal', () => {
  test('no rotation is translate + scale', () => {
    const view = { panX: 10, panY: 20, scale: 2, rotation: 0 };
    close(localToContainer({ x: 3, y: 4 }, view), { x: 16, y: 28 });
  });

  test('90 degrees turns +x into +y (clockwise on screen)', () => {
    const view = { panX: 0, panY: 0, scale: 1, rotation: 90 };
    close(localToContainer({ x: 1, y: 0 }, view), { x: 0, y: 1 });
  });

  for (const rotation of [0, 37, 90, 180, 270, -45]) {
    test(`round trip at ${rotation} degrees`, () => {
      const view = { panX: 13, panY: -7, scale: 1.7, rotation };
      const p = { x: 42.5, y: -3 };
      close(localToContainer(containerToLocal(p, view), view), p);
    });
  }
});

describe('transformAround', () => {
  test('zooming keeps the anchor under the same point', () => {
    const view = { panX: 5, panY: 9, scale: 1.5, rotation: 30 };
    const p = { x: 100, y: 60 };
    const local = containerToLocal(p, view);
    const next = transformAround(view, p, p, 2.5, 0);
    assert.equal(next.scale, 2.5);
    close(localToContainer(local, next), p);
  });

  test('rotating keeps the anchor under the same point', () => {
    const view = { panX: 5, panY: 9, scale: 1.5, rotation: 30 };
    const p = { x: 100, y: 60 };
    const local = containerToLocal(p, view);
    const next = transformAround(view, p, p, view.scale, 45);
    assert.equal(next.rotation, 75);
    close(localToContainer(local, next), p);
  });

  test('a moving anchor pans: the old point lands on the new one', () => {
    const view = { panX: 0, panY: 0, scale: 1, rotation: 10 };
    const local = containerToLocal({ x: 50, y: 50 }, view);
    const next = transformAround(view, { x: 50, y: 50 }, { x: 70, y: 40 }, 1.2, -5);
    close(localToContainer(local, next), { x: 70, y: 40 });
  });
});

describe('snapAngle', () => {
  test('within 6 degrees of a right angle snaps to it', () => {
    assert.equal(snapAngle(4), 0);
    assert.equal(snapAngle(-5), 0);
    assert.equal(snapAngle(95.5), 90);
    assert.equal(snapAngle(176), 180);
    assert.equal(snapAngle(359), 0);
    assert.equal(snapAngle(-88), 270);
  });

  test('otherwise just normalised to [0, 360)', () => {
    assert.equal(snapAngle(37), 37);
    assert.equal(snapAngle(-30), 330);
    assert.equal(snapAngle(400), 40);
  });
});

describe('angleDelta', () => {
  test('shortest signed turn between two angles', () => {
    assert.equal(angleDelta(10, 30), 20);
    assert.equal(angleDelta(170, -170), 20);
    assert.equal(angleDelta(-170, 170), -20);
  });
});

describe('rotatedSize', () => {
  test('bounding box of a turned rectangle', () => {
    assert.deepEqual(rotatedSize(40, 20, 0), { width: 40, height: 20 });
    const quarter = rotatedSize(40, 20, 90);
    assert.ok(Math.abs(quarter.width - 20) < 1e-9 && Math.abs(quarter.height - 40) < 1e-9);
    const eighth = rotatedSize(10, 10, 45);
    assert.ok(Math.abs(eighth.width - 10 * Math.SQRT2) < 1e-9);
  });
});

describe('centredPan', () => {
  for (const rotation of [0, 90, 33]) {
    test(`puts the content centre on the area centre at ${rotation} degrees`, () => {
      const area = { x: 10, y: 20, width: 300, height: 200 };
      const view = { ...centredPan(area, 64, 32, 2, rotation), scale: 2, rotation };
      close(localToContainer({ x: 32, y: 16 }, view), { x: 160, y: 120 });
    });
  }
});
