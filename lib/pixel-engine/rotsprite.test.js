import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scale2x, rotatedSize, rotateNearest, rotSprite } from './rotsprite.js';

// Rows of characters: '.' transparent, any other letter its own colour.
function fromRows(rows) {
  const w = rows[0].length;
  const data = new Uint8ClampedArray(w * rows.length * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') data.set([ch.charCodeAt(0), 0, 0, 255], (y * w + x) * 4);
  }));
  return { data, width: w, height: rows.length };
}
function toRows({ data, width, height }) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const i = (y * width + x) * 4;
    return data[i + 3] ? String.fromCharCode(data[i]) : '.';
  }).join(''));
}
const run = (fn, rows, ...args) => {
  const { data, width, height } = fromRows(rows);
  return toRows(fn(data, width, height, ...args));
};

describe('scale2x', () => {
  test('a flat colour just doubles', () => {
    assert.deepEqual(run(scale2x, ['a']), ['aa', 'aa']);
  });

  test('a lone pixel becomes a 2x2 block', () => {
    assert.deepEqual(run(scale2x, ['...', '.a.', '...']), [
      '......', '......', '..aa..', '..aa..', '......', '......',
    ]);
  });

  test('a diagonal gets its corners filled', () => {
    assert.deepEqual(run(scale2x, ['.a', 'a.']), ['..aa', '.a.a', 'a.a.', 'aa..']);
  });
});

describe('rotatedSize', () => {
  test('quarter turns are exact', () => {
    assert.deepEqual(rotatedSize(3, 2, 0), { width: 3, height: 2 });
    assert.deepEqual(rotatedSize(3, 2, 90), { width: 2, height: 3 });
    assert.deepEqual(rotatedSize(3, 2, -90), { width: 2, height: 3 });
    assert.deepEqual(rotatedSize(3, 2, 180), { width: 3, height: 2 });
  });

  test('other angles take the rotated box, parity matched to the source', () => {
    assert.deepEqual(rotatedSize(1, 1, 45), { width: 3, height: 3 });
    assert.deepEqual(rotatedSize(4, 4, 45), { width: 6, height: 6 });
    assert.deepEqual(rotatedSize(4, 4, -45), { width: 6, height: 6 });
    assert.deepEqual(rotatedSize(5, 5, 30), { width: 7, height: 7 });
  });
});

describe('rotateNearest', () => {
  test('0 degrees is a copy', () => {
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], 0), ['ab', 'c.']);
  });

  test('quarter turns match rotateRegion', () => {
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], 90), ['ca', '.b']);
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], -90), ['b.', 'ac']);
    assert.deepEqual(run(rotateNearest, ['ab', 'c.'], 180), ['.c', 'ba']);
    assert.deepEqual(run(rotateNearest, ['abc'], 90), ['a', 'b', 'c']);
  });

  test('a lone pixel survives 45 degrees, centred', () => {
    assert.deepEqual(run(rotateNearest, ['a'], 45), ['...', '.a.', '...']);
  });
});

describe('rotSprite', () => {
  const shape = ['......', '.aab..', '.abbc.', '..bcc.', '...c..', '......'];

  test('adds no new colours', () => {
    for (const deg of [15, 30, 45, -60, 135]) {
      const out = run(rotSprite, shape, deg).join('');
      for (const ch of out) assert.ok('.abc'.includes(ch), `${deg}°: unexpected ${ch}`);
    }
  });

  test('output size is rotatedSize', () => {
    const { data, width, height } = fromRows(shape);
    const out = rotSprite(data, width, height, 30);
    assert.deepEqual({ width: out.width, height: out.height }, rotatedSize(6, 6, 30));
  });

  test('quarter turns are exact', () => {
    assert.deepEqual(run(rotSprite, shape, 90), run(rotateNearest, shape, 90));
    assert.deepEqual(run(rotSprite, shape, 0), shape);
  });

  test('a solid square keeps its middle at 45 degrees', () => {
    const out = run(rotSprite, ['aaaa', 'aaaa', 'aaaa', 'aaaa'], 45);
    assert.equal(out[3][3], 'a');
  });
});
