// Top bar menus (5b-top-bar-more): the pure keyboard-navigation half of
// js/topbar-menu.js. The DOM wiring is checked by hand in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { menuKeyTarget } from '../js/topbar-menu.js';

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
