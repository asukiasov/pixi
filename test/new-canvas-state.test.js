// New Canvas redesign: preset / Custom tile syncing and the last-used choice.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_SIZES,
  clampSize,
  initialState,
  selectTile,
  setSize,
  swapSize,
  setBackground,
  tileLabel,
} from '../js/new-canvas-state.js';

const last = { width: 24, height: 96, background: 'white' };

describe('new canvas state', () => {
  test('presets are 16, 32, 64, 128', () => {
    assert.deepEqual(PRESET_SIZES, [16, 32, 64, 128]);
  });

  test('clampSize rounds and keeps 1-256', () => {
    assert.equal(clampSize(0), 1);
    assert.equal(clampSize(300), 256);
    assert.equal(clampSize(12.6), 13);
  });

  test('opens on Last used with the last size and background', () => {
    assert.deepEqual(initialState(last), { width: 24, height: 96, background: 'white', last, selected: 'last' });
  });

  test('picking a preset sets a square size; picking Last used restores it', () => {
    let state = selectTile(initialState(last), 64);
    assert.equal(state.selected, 64);
    assert.equal(state.width, 64);
    assert.equal(state.height, 64);
    state = selectTile(state, 'last');
    assert.equal(state.selected, 'last');
    assert.deepEqual([state.width, state.height], [24, 96]);
  });

  test('picking a tile keeps the background', () => {
    assert.equal(selectTile(initialState(last), 16).background, 'white');
  });

  test('typing a preset square selects that preset', () => {
    assert.equal(setSize(initialState(last), 128, 128).selected, 128);
  });

  test('typing any other size selects Custom', () => {
    const state = setSize(initialState(last), 40, 20);
    assert.equal(state.selected, 'custom');
    assert.deepEqual([state.width, state.height], [40, 20]);
  });

  test('typing the last-used size selects Last used', () => {
    assert.equal(setSize(selectTile(initialState(last), 16), 24, 96).selected, 'last');
  });

  test('a preset beats Last used when they are the same size', () => {
    const square = { width: 32, height: 32, background: 'transparent' };
    assert.equal(initialState(square).selected, 'last');
    assert.equal(setSize(initialState(square), 32, 32).selected, 32);
  });

  test('typed sizes are clamped', () => {
    const state = setSize(initialState(last), 0, 999);
    assert.deepEqual([state.width, state.height], [1, 256]);
  });

  test('swap exchanges width and height and re-syncs the tile', () => {
    const state = swapSize(initialState(last));
    assert.deepEqual([state.width, state.height], [96, 24]);
    assert.equal(state.selected, 'custom');
    assert.equal(swapSize(state).selected, 'last');
  });

  test('setBackground keeps the size and selection', () => {
    const state = setBackground(initialState(last), 'transparent');
    assert.equal(state.background, 'transparent');
    assert.equal(state.selected, 'last');
  });

  test('tileLabel names the selection', () => {
    assert.equal(tileLabel(initialState(last)), 'Last used');
    assert.equal(tileLabel(selectTile(initialState(last), 32)), '32 × 32');
    assert.equal(tileLabel(setSize(initialState(last), 5, 7)), 'Custom');
  });
});
