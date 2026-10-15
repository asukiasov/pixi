import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PixelEngine } from './engine.js';
import { flipRegion, rotateRegion, rotateRegionFree, contentBounds, alignOffset, moveRegion } from './transform.js';

// Rows of characters: '.' transparent, any other letter its own colour.
function fromRows(rows) {
  const engine = new PixelEngine(rows[0].length, rows.length, 'transparent');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') engine.setPixel(x, y, [ch.charCodeAt(0), 0, 0, 255]);
  }));
  return engine;
}
function toRows(engine) {
  return Array.from({ length: engine.height }, (_, y) => Array.from({ length: engine.width }, (_, x) => {
    const [r, , , a] = engine.getPixel(x, y);
    return a ? String.fromCharCode(r) : '.';
  }).join(''));
}
const all = (e) => ({ x: 0, y: 0, width: e.width, height: e.height });

describe('flipRegion', () => {
  test('horizontal and vertical, whole layer', () => {
    const e = fromRows(['ab.', 'c..']);
    flipRegion(e, all(e), 'horizontal');
    assert.deepEqual(toRows(e), ['.ba', '..c']);
    flipRegion(e, all(e), 'vertical');
    assert.deepEqual(toRows(e), ['..c', '.ba']);
  });

  test('only inside the rect', () => {
    const e = fromRows(['abcd', 'efgh']);
    flipRegion(e, { x: 1, y: 0, width: 2, height: 2 }, 'horizontal');
    assert.deepEqual(toRows(e), ['acbd', 'egfh']);
  });
});

describe('rotateRegion', () => {
  test('180 in place', () => {
    const e = fromRows(['ab.', 'c..']);
    assert.deepEqual(rotateRegion(e, all(e), '180'), all(e));
    assert.deepEqual(toRows(e), ['..c', '.ba']);
  });

  test('90 cw and ccw on a square region keep the rect', () => {
    const e = fromRows(['ab', 'c.']);
    assert.deepEqual(rotateRegion(e, all(e), 'cw'), all(e));
    assert.deepEqual(toRows(e), ['ca', '.b']);
    rotateRegion(e, all(e), 'ccw');
    assert.deepEqual(toRows(e), ['ab', 'c.']);
  });

  test('four cw turns are the identity', () => {
    const rows = ['abc', 'd.e', 'fg.'];
    const e = fromRows(rows);
    for (let i = 0; i < 4; i++) rotateRegion(e, all(e), 'cw');
    assert.deepEqual(toRows(e), rows);
  });

  test('a non-square region turns about its centre, w and h swap, vacated area clears', () => {
    const e = fromRows(['.....', '.abc.', '.def.', '.....', '.....']);
    const rect = rotateRegion(e, { x: 1, y: 1, width: 3, height: 2 }, 'cw');
    // centre (2.5, 2) -> 2 wide, 3 tall at x = floor(2.5 - 1) = 1, y = floor(2 - 1.5) = 0
    assert.deepEqual(rect, { x: 1, y: 0, width: 2, height: 3 });
    assert.deepEqual(toRows(e), ['.da..', '.eb..', '.fc..', '.....', '.....']);
  });

  test('pixels landing off the canvas are lost and the rect is clamped', () => {
    const e = fromRows(['abc', 'def']);
    const rect = rotateRegion(e, all(e), 'cw');
    assert.deepEqual(rect, { x: 0, y: 0, width: 2, height: 2 });
    assert.deepEqual(toRows(e), ['eb.', 'fc.']);
  });
});

describe('contentBounds', () => {
  test('box of the non-transparent pixels inside the rect', () => {
    const e = fromRows(['.....', '..a..', '.b...', '.....']);
    assert.deepEqual(contentBounds(e, all(e)), { x: 1, y: 1, width: 2, height: 2 });
    assert.deepEqual(contentBounds(e, { x: 2, y: 0, width: 3, height: 4 }), { x: 2, y: 1, width: 1, height: 1 });
  });

  test('null when empty', () => {
    assert.equal(contentBounds(fromRows(['..', '..']), { x: 0, y: 0, width: 2, height: 2 }), null);
  });
});

describe('alignOffset', () => {
  // A 3x2 box at (3, 2) on an 8x7 canvas.
  const b = { x: 3, y: 2, width: 3, height: 2 };
  const cases = {
    left: { dx: -3, dy: 0 },
    center: { dx: -1, dy: 0 }, // to x = floor((8 - 3) / 2) = 2
    right: { dx: 2, dy: 0 },
    top: { dx: 0, dy: -2 },
    middle: { dx: 0, dy: 0 }, // y = floor((7 - 2) / 2) = 2, already there
    bottom: { dx: 0, dy: 3 },
  };
  for (const [edge, expected] of Object.entries(cases)) {
    test(edge, () => assert.deepEqual(alignOffset(b, 8, 7, edge), expected));
  }
});

describe('moveRegion', () => {
  test('moves the rect content, clears where it was, returns the moved rect', () => {
    const e = fromRows(['ab..', 'c...', '....']);
    const rect = moveRegion(e, { x: 0, y: 0, width: 2, height: 2 }, 2, 1);
    assert.deepEqual(rect, { x: 2, y: 1, width: 2, height: 2 });
    assert.deepEqual(toRows(e), ['....', '..ab', '..c.']);
  });
});

test('moveRegion clamps the returned rect to the canvas', () => {
  const e = fromRows(['a...', '....']);
  assert.deepEqual(moveRegion(e, { x: 0, y: 0, width: 3, height: 2 }, 2, 0), { x: 2, y: 0, width: 2, height: 2 });
  assert.deepEqual(toRows(e), ['..a.', '....']);
});

describe('rotateRegionFree', () => {
  test('0 degrees changes nothing', () => {
    const e = fromRows(['ab', 'c.']);
    assert.deepEqual(rotateRegionFree(e, all(e), 0), all(e));
    assert.deepEqual(toRows(e), ['ab', 'c.']);
  });

  test('quarter turns are rotateRegion', () => {
    for (const [deg, turn] of [[90, 'cw'], [-90, 'ccw'], [270, 'ccw'], [180, '180']]) {
      const a = fromRows(['abc', 'd..']);
      const b = fromRows(['abc', 'd..']);
      assert.deepEqual(rotateRegionFree(a, all(a), deg), rotateRegion(b, all(b), turn));
      assert.deepEqual(toRows(a), toRows(b));
    }
  });

  test('turns about the centre into the rotated box', () => {
    const e = fromRows(['.......', '.......', '.......', '...a...', '.......', '.......', '.......']);
    const next = rotateRegionFree(e, { x: 2, y: 2, width: 3, height: 3 }, 45, 'fast');
    assert.deepEqual(next, { x: 1, y: 1, width: 5, height: 5 });
    assert.equal(toRows(e)[3][3], 'a');
    assert.equal(toRows(e).join('').replaceAll('.', ''), 'a');
  });

  test("the rotated box's transparent corners don't erase what's under them", () => {
    const e = fromRows(['zzzzzzz', 'zzzzzzz', 'zz...zz', 'zz.a.zz', 'zz...zz', 'zzzzzzz', 'zzzzzzz']);
    rotateRegionFree(e, { x: 2, y: 2, width: 3, height: 3 }, 45, 'fast');
    const rows = toRows(e);
    assert.equal(rows[1][1], 'z');
    assert.equal(rows[3][3], 'a');
    assert.equal(rows[2][2], '.');
  });

  test('the returned rect is clamped to the canvas', () => {
    const e = fromRows(['abc', 'def', 'ghi']);
    assert.deepEqual(rotateRegionFree(e, all(e), 45), all(e));
  });
});
