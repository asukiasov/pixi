// Floating workspace layout (5a-floating-shell): the clear-area insets the
// canvas fits into, and the anchor/side helpers.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clearInsets, clearArea, visibleAnchor, canvasSide } from '../js/layout.js';

describe('clearInsets', () => {
  const container = { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

  test('no cards means no insets', () => {
    assert.deepEqual(clearInsets(container, [], 0), { top: 0, right: 0, bottom: 0, left: 0 });
  });

  test('each slot pushes in from its own edge, plus the gap', () => {
    const insets = clearInsets(container, [
      { slot: 'top', rect: rect(10, 10, 980, 50) },
      { slot: 'tools', rect: rect(10, 70, 60, 500) },
      { slot: 'panels', rect: rect(780, 70, 210, 600) },
      { slot: 'options', rect: rect(300, 740, 400, 50) },
    ], 8);
    assert.deepEqual(insets, { top: 68, left: 78, right: 228, bottom: 68 });
  });

  test('a mirrored layout is read from where cards actually are', () => {
    const insets = clearInsets(container, [
      { slot: 'tools', rect: rect(930, 70, 60, 500) },
      { slot: 'panels', rect: rect(10, 70, 210, 600) },
    ], 0);
    assert.equal(insets.right, 70);
    assert.equal(insets.left, 220);
  });

  test('hidden (zero-size) cards are ignored', () => {
    const insets = clearInsets(container, [{ slot: 'panels', rect: rect(1000, 70, 0, 0) }], 8);
    assert.equal(insets.right, 0);
  });

  test('two cards against one edge take the larger reach', () => {
    const insets = clearInsets(container, [
      { slot: 'options', rect: rect(300, 740, 400, 50) },
      { slot: 'options', rect: rect(300, 680, 400, 50) },
    ], 0);
    assert.equal(insets.bottom, 120);
  });

  // 5e-cards-mini-rail: the panels slot is a rail against the edge plus a
  // column of cards beside it; the column's left edge decides the inset.
  test('mini-rail and card column: the column reaches furthest', () => {
    const insets = clearInsets(container, [
      { slot: 'panels', rect: rect(928, 70, 62, 160) },
      { slot: 'panels', rect: rect(680, 70, 240, 500) },
    ], 8);
    assert.equal(insets.right, 328);
  });

  test('mini-rail with every card closed: the rail decides the inset', () => {
    const insets = clearInsets(container, [
      { slot: 'panels', rect: rect(928, 70, 62, 160) },
      { slot: 'panels', rect: rect(680, 70, 240, 0) },
    ], 8);
    assert.equal(insets.right, 80);
  });

  test('works with a container not at the page origin', () => {
    const offset = { left: 100, top: 50, right: 1100, bottom: 850, width: 1000, height: 800 };
    const insets = clearInsets(offset, [{ slot: 'top', rect: rect(110, 60, 980, 50) }], 0);
    assert.equal(insets.top, 60);
  });
});

describe('clearArea', () => {
  test('zero insets is the whole container', () => {
    assert.deepEqual(clearArea({ width: 1000, height: 800 }, { top: 0, right: 0, bottom: 0, left: 0 }),
      { x: 0, y: 0, width: 1000, height: 800 });
  });

  test('insets shrink and offset the area', () => {
    assert.deepEqual(clearArea({ width: 1000, height: 800 }, { top: 68, right: 228, bottom: 68, left: 78 }),
      { x: 78, y: 68, width: 694, height: 664 });
  });

  test('never collapses below 1px, even if cards cover everything', () => {
    const area = clearArea({ width: 300, height: 200 }, { top: 150, right: 200, bottom: 150, left: 200 });
    assert.equal(area.width, 1);
    assert.equal(area.height, 1);
  });
});

describe('visibleAnchor', () => {
  const el = (boxes) => ({ getClientRects: () => ({ length: boxes }) });

  test('an element that is rendered is its own anchor', () => {
    const toggle = el(1);
    assert.equal(visibleAnchor(toggle, el(1)), toggle);
  });

  test('an element with no box falls back', () => {
    const fallback = el(1);
    assert.equal(visibleAnchor(el(0), fallback), fallback);
  });

  test('a missing fallback still returns the element', () => {
    const toggle = el(0);
    assert.equal(visibleAnchor(toggle, null), toggle);
  });
});

describe('canvasSide', () => {
  const rect = (left, width) => ({ left, width });

  test('a rail on the left opens toward the end (right)', () => {
    assert.equal(canvasSide(rect(12, 60), 1180), 'end');
  });

  test('a rail on the right opens toward the start (left)', () => {
    assert.equal(canvasSide(rect(1108, 60), 1180), 'start');
  });

  test('an anchor exactly centred opens toward the start', () => {
    assert.equal(canvasSide(rect(560, 60), 1180), 'start');
  });

  test('uses the anchor centre, not its left edge, in a narrow viewport', () => {
    // Left edge is in the left half, centre is not.
    assert.equal(canvasSide(rect(140, 60), 320), 'start');
    assert.equal(canvasSide(rect(20, 60), 320), 'end');
  });
});
