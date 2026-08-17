import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { librarySequenceToggleVisibleForTool } from '../js/workspace.js';

// The rest of js/workspace.js is DOM-bound (bindDomOnce wires up dozens of
// elements at once, and this repo has no jsdom/browser test harness - see
// test/router.test.js and friends, all DOM-free), so this covers only the
// pure show/hide predicate the shared Color Library sequence toggle
// (#library-sequence-toggle) uses. The actual DOM wiring - the toggle
// showing/hiding as tools switch, and its state.colorLibrarySequence value
// staying in sync across Pencil/Brush - was verified manually via
// Playwright (see AUD-12).
describe('librarySequenceToggleVisibleForTool', () => {
  test('visible for Pencil', () => {
    assert.equal(librarySequenceToggleVisibleForTool('pencil'), true);
  });

  test('visible for Brush', () => {
    assert.equal(librarySequenceToggleVisibleForTool('brush'), true);
  });

  test('hidden for Eraser - nothing to cycle through with no paint color', () => {
    assert.equal(librarySequenceToggleVisibleForTool('eraser'), false);
  });

  test('hidden for every other tool', () => {
    for (const tool of ['move', 'bucket', 'line', 'rectangle', 'selection', 'hand', 'eyedropper']) {
      assert.equal(librarySequenceToggleVisibleForTool(tool), false, `expected ${tool} to be hidden`);
    }
  });
});
