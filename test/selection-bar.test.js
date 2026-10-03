// Floating selection action bar (5f-selection-action-bar): where the bar
// goes, as a pure function of client-pixel rectangles.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { placeSelectionBar } from '../js/selection-bar.js';

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

// A 1180×820 screen: 12px edges, a top bar down to 66, the tool rail to 82,
// the panel column from 900, the bottom cards from 720 (insets include the
// 8px gap).
const outer = rect(12, 12, 1156, 796);
const clear = rect(82, 74, 818, 638);
const bar = { width: 200, height: 52 };
const GAP = 8;

describe('placeSelectionBar', () => {
  test('a selection in the middle: centred above, one gap away', () => {
    const selection = rect(400, 300, 100, 100);
    assert.deepEqual(placeSelectionBar(selection, bar, clear, outer, GAP), {
      x: 350, y: 300 - GAP - 52, side: 'above',
    });
  });

  test('a selection just below the top of the clear area flips below', () => {
    const selection = rect(400, 90, 100, 100);
    assert.deepEqual(placeSelectionBar(selection, bar, clear, outer, GAP), {
      x: 350, y: 190 + GAP, side: 'below',
    });
  });

  test('against the start edge: x clamped inside, as close to centre as allowed', () => {
    const selection = rect(90, 300, 40, 40);
    const place = placeSelectionBar(selection, bar, clear, outer, GAP);
    assert.equal(place.side, 'above');
    assert.equal(place.x, clear.left);
  });

  test('against the end edge: x clamped inside', () => {
    const selection = rect(860, 300, 40, 40);
    const place = placeSelectionBar(selection, bar, clear, outer, GAP);
    assert.equal(place.side, 'above');
    assert.equal(place.x, clear.right - bar.width);
  });

  test('a selection larger than the clear area is held at its top', () => {
    const selection = rect(0, 0, 1180, 820);
    assert.deepEqual(placeSelectionBar(selection, bar, clear, outer, GAP), {
      x: 490, // centred on the selection (590), not on the clear area
      y: clear.top,
      side: 'held',
    });
  });

  describe('a selection entirely outside the clear area is held at the nearest edge', () => {
    const inside = ({ x, y }) => {
      assert.ok(x >= clear.left && x + bar.width <= clear.right, `x ${x}`);
      assert.ok(y >= clear.top && y + bar.height <= clear.bottom, `y ${y}`);
    };

    test('above', () => {
      const place = placeSelectionBar(rect(400, -300, 100, 100), bar, clear, outer, GAP);
      assert.equal(place.side, 'held');
      assert.equal(place.y, clear.top);
      inside(place);
    });

    test('above, but only just (below would otherwise fit)', () => {
      const place = placeSelectionBar(rect(400, 20, 100, 50), bar, clear, outer, GAP);
      assert.equal(place.side, 'held');
      assert.equal(place.y, clear.top);
    });

    test('below', () => {
      const place = placeSelectionBar(rect(400, 1000, 100, 100), bar, clear, outer, GAP);
      assert.equal(place.side, 'held');
      assert.equal(place.y, clear.bottom - bar.height);
      inside(place);
    });

    test('left', () => {
      const place = placeSelectionBar(rect(-300, 300, 100, 100), bar, clear, outer, GAP);
      assert.equal(place.side, 'held');
      assert.equal(place.x, clear.left);
      inside(place);
    });

    test('right', () => {
      const place = placeSelectionBar(rect(1300, 300, 100, 100), bar, clear, outer, GAP);
      assert.equal(place.side, 'held');
      assert.equal(place.x, clear.right - bar.width);
      inside(place);
    });
  });

  test('a clear area narrower than the bar falls back to the outer box', () => {
    const narrow = rect(500, 74, 150, 638);
    const place = placeSelectionBar(rect(560, 300, 20, 20), bar, narrow, outer, GAP);
    assert.equal(place.side, 'above');
    assert.equal(place.x, 470); // centred on 570; the clear area couldn't hold it
  });

  test('a clear area shorter than the bar falls back to the outer box', () => {
    const short = rect(82, 300, 818, 40);
    const place = placeSelectionBar(rect(400, 100, 100, 100), bar, short, outer, GAP);
    assert.equal(place.side, 'above');
    assert.equal(place.y, 100 - GAP - 52);
  });

  test('the outer box still holds the bar on screen', () => {
    const narrow = rect(500, 74, 150, 638);
    const place = placeSelectionBar(rect(0, -400, 10, 10), bar, narrow, outer, GAP);
    assert.equal(place.side, 'held');
    assert.equal(place.x, outer.left);
    assert.equal(place.y, outer.top);
  });

  test('a zero-size selection is centred on its point', () => {
    const place = placeSelectionBar(rect(450, 300, 0, 0), bar, clear, outer, GAP);
    assert.deepEqual(place, { x: 350, y: 300 - GAP - 52, side: 'above' });
  });

  test('a 1×1 selection at low zoom rounds to whole pixels', () => {
    const place = placeSelectionBar(rect(450.25, 300.5, 0.5, 0.5), bar, clear, outer, GAP);
    assert.equal(place.side, 'above');
    assert.ok(Number.isInteger(place.x) && Number.isInteger(place.y));
    assert.equal(place.x, 351);
    assert.equal(place.y, 241);
  });
});
