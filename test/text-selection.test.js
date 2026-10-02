// Guards the iPad fix for accidental text selection (roadmap Phase 4a):
// fast taps / double-taps on app chrome (toolbar buttons, panel labels)
// used to select text like a browser page, and a long press opened
// Safari's callout. The fix is pure CSS in style.css, so this reads the
// stylesheet and checks the declarations rather than rendering anything.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Top-level rules only (good enough for style.css's flat structure) -
// returns the merged declarations of every rule whose selector list
// contains `selector` exactly.
function declarationsFor(selector) {
  const decls = {};
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    for (const decl of match[2].split(';')) {
      const [prop, ...rest] = decl.split(':');
      if (prop.trim()) decls[prop.trim()] = rest.join(':').trim();
    }
  }
  return decls;
}

describe('app chrome text selection (iPad 4a)', () => {
  test('body disables text selection and the long-press callout', () => {
    const body = declarationsFor('body');
    assert.equal(body['user-select'], 'none');
    assert.equal(body['-webkit-user-select'], 'none');
    assert.equal(body['-webkit-touch-callout'], 'none');
  });

  for (const selector of ['input', 'textarea', '[contenteditable]']) {
    test(`${selector} re-enables selection so text fields stay editable`, () => {
      const decls = declarationsFor(selector);
      assert.equal(decls['user-select'], 'text');
      assert.equal(decls['-webkit-user-select'], 'text');
      assert.equal(decls['-webkit-touch-callout'], 'default');
    });
  }
});
