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

  test('defaults: tools left, panels right, every card pinned, no auto-hide, brush cursor on', () => {
    assert.deepEqual(DEFAULT_PREFS, {
      toolsSide: 'left',
      panelsSide: 'right',
      pinned: { colors: true, brushes: true, layers: true },
      autoHide: false,
      brushCursor: true,
      pencilOnly: true,
      showMascot: true,
      railTools: ['move', 'pencil', 'eraser', 'bucket', 'brush', 'line', 'rectangle', 'ellipse', 'selection', 'hand', 'eyedropper'],
      newCanvas: { width: 32, height: 32, background: 'transparent' },
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
    assert.equal(normalizePrefs({ brushCursor: 'no' }).brushCursor, true);
    assert.equal(normalizePrefs({ brushCursor: false }).brushCursor, false);
    assert.equal(normalizePrefs({ pencilOnly: 1 }).pencilOnly, true);
    assert.equal(normalizePrefs({ pencilOnly: false }).pencilOnly, false);
    assert.equal(normalizePrefs({ showMascot: 'no' }).showMascot, true);
    assert.equal(normalizePrefs({ showMascot: false }).showMascot, false);
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
    const prefs = { toolsSide: 'right', panelsSide: 'left', pinned: { colors: false, brushes: true, layers: false }, autoHide: true, brushCursor: false, pencilOnly: false, showMascot: false, railTools: ['pencil', 'move'], newCanvas: { width: 8, height: 8, background: 'white' } };
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
    applyPrefsToScreen(screen, { ...DEFAULT_PREFS, toolsSide: 'right', panelsSide: 'right', autoHide: true, brushCursor: false });
    assert.deepEqual(screen.dataset, { toolsSide: 'right', panelsSide: 'right', autoHide: 'on', brushCursor: 'off' });
    applyPrefsToScreen(screen, DEFAULT_PREFS);
    assert.deepEqual(screen.dataset, { toolsSide: 'left', panelsSide: 'right', autoHide: 'off', brushCursor: 'on' });
  });
});

describe('isAutoHideTool', () => {
  test('stroke tools hide the interface', () => {
    for (const tool of ['pencil', 'eraser', 'brush', 'line', 'rectangle', 'ellipse']) assert.equal(isAutoHideTool(tool), true, tool);
  });

  test('other tools never do', () => {
    for (const tool of ['selection', 'move', 'hand', 'bucket', 'eyedropper', undefined]) assert.equal(isAutoHideTool(tool), false, String(tool));
  });
});

describe('newCanvas (last New Canvas choice)', () => {
  test('keeps a valid size and background', () => {
    const raw = { newCanvas: { width: 24, height: 96, background: 'white' } };
    assert.deepEqual(normalizePrefs(raw).newCanvas, { width: 24, height: 96, background: 'white' });
  });

  test('clamps and rounds the size to 1-256', () => {
    const raw = { newCanvas: { width: 999, height: 0.4, background: 'white' } };
    assert.deepEqual(normalizePrefs(raw).newCanvas, { width: 256, height: 1, background: 'white' });
  });

  test('each bad field falls back on its own', () => {
    const raw = { newCanvas: { width: 'big', height: 64, background: 'pink' } };
    assert.deepEqual(normalizePrefs(raw).newCanvas, { width: 32, height: 64, background: 'transparent' });
    assert.deepEqual(normalizePrefs({ newCanvas: 7 }).newCanvas, DEFAULT_PREFS.newCanvas);
  });

  test('round-trips through storage', () => {
    const storage = fakeStorage();
    savePrefs(storage, { ...DEFAULT_PREFS, newCanvas: { width: 16, height: 128, background: 'white' } });
    assert.deepEqual(loadPrefs(storage).newCanvas, { width: 16, height: 128, background: 'white' });
  });
});
