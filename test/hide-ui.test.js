import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isHideUiShortcut } from '../js/hide-ui.js';

// Plain objects stand in for KeyboardEvent / Element - the predicate only
// reads key, modifier flags, and the focused element's identity/tag.
const body = { tagName: 'BODY' };
const canvasContainer = { tagName: 'DIV', id: 'workspace-canvas-container' };
const tab = { key: 'Tab', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

describe('isHideUiShortcut', () => {
  test('plain Tab with nothing focused (body) toggles', () => {
    assert.equal(isHideUiShortcut(tab, body), true);
  });

  test('plain Tab with no active element toggles', () => {
    assert.equal(isHideUiShortcut(tab, null), true);
  });

  test('plain Tab with the canvas container focused toggles', () => {
    assert.equal(isHideUiShortcut(tab, canvasContainer), true);
  });

  for (const mod of ['shiftKey', 'metaKey', 'ctrlKey', 'altKey']) {
    test(`Tab with ${mod} does not toggle`, () => {
      assert.equal(isHideUiShortcut({ ...tab, [mod]: true }, body), false);
    });
  }

  test('other keys do not toggle', () => {
    assert.equal(isHideUiShortcut({ ...tab, key: 'h' }, body), false);
  });

  for (const tagName of ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']) {
    test(`Tab with a focused ${tagName} keeps normal focus navigation`, () => {
      assert.equal(isHideUiShortcut(tab, { tagName }), false);
    });
  }

  test('Tab with a focusable non-control element (e.g. layer name) keeps focus navigation', () => {
    assert.equal(isHideUiShortcut(tab, { tagName: 'SPAN', className: 'layer-name' }), false);
  });
});
