// 5g Prefs: the stored preferences and how they reach the Workspace screen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  normalizePrefs,
  loadPrefs,
  savePrefs,
  applyPrefsToScreen,
  isAutoHideTool,
} from '../js/prefs.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
};

describe('normalizePrefs', () => {
  test('anything that is not an object gives the defaults', () => {
    for (const raw of [undefined, null, 'left', 42, []]) {
      assert.deepEqual(normalizePrefs(raw), DEFAULT_PREFS);
    }
  });

  test('defaults: tools left, panels right, every card pinned, no auto-hide', () => {
    assert.deepEqual(DEFAULT_PREFS, {
      toolsSide: 'left',
      panelsSide: 'right',
      pinned: { colors: true, brushes: true, layers: true },
      autoHide: false,
      railTools: ['move', 'pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'selection', 'hand', 'eyedropper'],
    });
  });

  test('railTools keeps known tools in order and falls back to every tool', () => {
    assert.deepEqual(normalizePrefs({ railTools: ['hand', 'nope', 'hand', 'move'] }).railTools, ['hand', 'move']);
    assert.deepEqual(normalizePrefs({ railTools: 'hand' }).railTools, [...DEFAULT_PREFS.railTools]);
    assert.deepEqual(normalizePrefs({ railTools: [] }).railTools, []);
  });

  test('each field falls back on its own', () => {
    const prefs = normalizePrefs({ toolsSide: 'right', panelsSide: 'up', autoHide: 'yes' });
    assert.equal(prefs.toolsSide, 'right');
    assert.equal(prefs.panelsSide, 'right');
    assert.equal(prefs.autoHide, false);
  });

  test('both sides may be the same', () => {
    const prefs = normalizePrefs({ toolsSide: 'left', panelsSide: 'left' });
    assert.equal(prefs.toolsSide, 'left');
    assert.equal(prefs.panelsSide, 'left');
  });

  test('pins merge per card, ignoring non-booleans', () => {
    const prefs = normalizePrefs({ pinned: { colors: false, brushes: 'no' } });
    assert.deepEqual(prefs.pinned, { colors: false, brushes: true, layers: true });
  });

  test('returns a fresh object, never the defaults themselves', () => {
    const prefs = normalizePrefs(undefined);
    prefs.pinned.colors = false;
    assert.equal(DEFAULT_PREFS.pinned.colors, true);
  });
});

describe('loadPrefs / savePrefs', () => {
  test('no storage, or nothing stored, gives the defaults', () => {
    assert.deepEqual(loadPrefs(null), DEFAULT_PREFS);
    assert.deepEqual(loadPrefs(fakeStorage()), DEFAULT_PREFS);
  });

  test('corrupt JSON gives the defaults', () => {
    assert.deepEqual(loadPrefs(fakeStorage({ [PREFS_STORAGE_KEY]: '{nope' })), DEFAULT_PREFS);
  });

  test('a throwing storage gives the defaults', () => {
    const storage = { getItem() { throw new Error('denied'); } };
    assert.deepEqual(loadPrefs(storage), DEFAULT_PREFS);
  });

  test('round trip', () => {
    const storage = fakeStorage();
    const prefs = { toolsSide: 'right', panelsSide: 'left', pinned: { colors: false, brushes: true, layers: false }, autoHide: true, railTools: ['pencil', 'move'] };
    savePrefs(storage, prefs);
    assert.equal(PREFS_STORAGE_KEY, 'pixi-prefs');
    assert.deepEqual(loadPrefs(storage), prefs);
  });

  test('a failing write does not throw', () => {
    const storage = { setItem() { throw new Error('quota'); } };
    assert.doesNotThrow(() => savePrefs(storage, DEFAULT_PREFS));
    assert.doesNotThrow(() => savePrefs(null, DEFAULT_PREFS));
  });
});

describe('applyPrefsToScreen', () => {
  test('writes the sides and auto-hide as data attributes', () => {
    const screen = { dataset: {} };
    applyPrefsToScreen(screen, { ...DEFAULT_PREFS, toolsSide: 'right', panelsSide: 'right', autoHide: true });
    assert.deepEqual(screen.dataset, { toolsSide: 'right', panelsSide: 'right', autoHide: 'on' });
    applyPrefsToScreen(screen, DEFAULT_PREFS);
    assert.deepEqual(screen.dataset, { toolsSide: 'left', panelsSide: 'right', autoHide: 'off' });
  });
});

describe('isAutoHideTool', () => {
  test('stroke tools hide the interface', () => {
    for (const tool of ['pencil', 'eraser', 'brush', 'line', 'rectangle']) assert.equal(isAutoHideTool(tool), true, tool);
  });

  test('other tools never do', () => {
    for (const tool of ['selection', 'move', 'hand', 'bucket', 'eyedropper', undefined]) assert.equal(isAutoHideTool(tool), false, String(tool));
  });
});
