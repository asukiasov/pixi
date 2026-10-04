// Top bar menus (5b-top-bar-more): the pure keyboard-navigation half of
// js/topbar-menu.js. The DOM wiring is checked by hand in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { menuKeyTarget, sideMenuPosition } from '../js/topbar-menu.js';

describe('menuKeyTarget', () => {
  test('ArrowDown steps forward and wraps to the first item', () => {
    assert.equal(menuKeyTarget('ArrowDown', 0, 4), 1);
    assert.equal(menuKeyTarget('ArrowDown', 3, 4), 0);
  });

  test('ArrowUp steps back and wraps to the last item', () => {
    assert.equal(menuKeyTarget('ArrowUp', 2, 4), 1);
    assert.equal(menuKeyTarget('ArrowUp', 0, 4), 3);
  });

  test('Home and End jump to the ends', () => {
    assert.equal(menuKeyTarget('Home', 2, 4), 0);
    assert.equal(menuKeyTarget('End', 1, 4), 3);
  });

  test('an index of -1 (nothing focused) still steps sensibly', () => {
    assert.equal(menuKeyTarget('ArrowDown', -1, 4), 0);
    assert.equal(menuKeyTarget('ArrowUp', -1, 4), 3);
  });

  test('other keys leave the index alone', () => {
    assert.equal(menuKeyTarget('a', 2, 4), 2);
    assert.equal(menuKeyTarget('Tab', 1, 4), 1);
  });

  test('an empty menu stays at -1', () => {
    assert.equal(menuKeyTarget('ArrowDown', -1, 0), -1);
    assert.equal(menuKeyTarget('End', -1, 0), -1);
  });
});

// Customize Tools: the tool rail's ⋯ menu opens beside the rail.
describe('sideMenuPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 200, height: 300 };

  test('past the end edge when there is room, top-aligned with the button', () => {
    assert.deepEqual(sideMenuPosition({ left: 10, right: 54, top: 100, bottom: 144 }, size, viewport), { left: 62, top: 100 });
  });

  test('toward the start from a rail on the end side', () => {
    assert.deepEqual(sideMenuPosition({ left: 946, right: 990, top: 100, bottom: 144 }, size, viewport), { left: 738, top: 100 });
  });

  test('kept above the bottom edge and inside a narrow viewport', () => {
    assert.equal(sideMenuPosition({ left: 10, right: 54, top: 700, bottom: 744 }, size, viewport).top, 492);
    assert.equal(sideMenuPosition({ left: 10, right: 54, top: 100, bottom: 144 }, size, { width: 150, height: 800 }).left, 8);
  });
});
