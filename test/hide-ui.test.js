import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isHideUiShortcut } from '../js/hide-ui.js';

// Plain objects stand in for KeyboardEvent / Element - the predicate only
// reads key, modifier flags, and the focused element's identity/tag.
const body = { tagName: 'BODY' };
const canvasContainer = { tagName: 'DIV', id: 'workspace-canvas-container' };
const tab = { key: 'Tab', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };
// Default context: interface visible, last pointer interaction on the
// canvas (the user was drawing).
const drawing = { uiHidden: false, canvasEngaged: true };

describe('isHideUiShortcut', () => {
  test('plain Tab with nothing focused (body) toggles', () => {
    assert.equal(isHideUiShortcut(tab, body, drawing), true);
  });

  test('plain Tab with no active element toggles', () => {
    assert.equal(isHideUiShortcut(tab, null, drawing), true);
  });

  test('plain Tab with the canvas container focused toggles', () => {
    assert.equal(isHideUiShortcut(tab, canvasContainer, drawing), true);
  });

  for (const mod of ['shiftKey', 'metaKey', 'ctrlKey', 'altKey']) {
    test(`Tab with ${mod} does not toggle`, () => {
      assert.equal(isHideUiShortcut({ ...tab, [mod]: true }, body, drawing), false);
    });
  }

  test('other keys do not toggle', () => {
    assert.equal(isHideUiShortcut({ ...tab, key: 'h' }, body, drawing), false);
  });

  for (const tagName of ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']) {
    test(`Tab with a focused ${tagName} keeps normal focus navigation`, () => {
      assert.equal(isHideUiShortcut(tab, { tagName }, drawing), false);
    });
  }

  test('Tab with a focusable non-control element (e.g. layer name) keeps focus navigation', () => {
    assert.equal(isHideUiShortcut(tab, { tagName: 'SPAN', className: 'layer-name' }, drawing), false);
  });

  test('Tab on body before the canvas was used keeps focus navigation (keyboard user arriving from the Gallery)', () => {
    assert.equal(isHideUiShortcut(tab, body, { uiHidden: false, canvasEngaged: false }), false);
  });

  test('while hidden, Tab on body always restores, canvas used or not', () => {
    assert.equal(isHideUiShortcut(tab, body, { uiHidden: true, canvasEngaged: false }), true);
  });

  test('while hidden, a focused control still keeps Tab navigation', () => {
    assert.equal(isHideUiShortcut(tab, { tagName: 'BUTTON' }, { uiHidden: true, canvasEngaged: true }), false);
  });
});
