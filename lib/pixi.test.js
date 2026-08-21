import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

// This repo has no jsdom/browser test harness (see test/theme.test.js's
// doc comment) - Pixi.mount() itself needs a real DOM (CanvasView, canvas
// 2d contexts, ~40 querySelector'd elements) and is verified via a
// Playwright smoke test instead (task 3.11), not here. validateHostElement
// is the one piece of mount()'s logic that's pure enough to unit test
// directly: no DOM needed to prove it rejects non-elements.
//
// lib/pixi.js imports js/workspace.js, which reads the bare `document`
// global at module-load time (`let root = document;`) - so even importing
// lib/pixi.js requires a `document` global to exist, regardless of what's
// under test. A dynamic import after stubbing one in is enough (nothing
// here calls Pixi.mount(), which is the part that would actually need
// `document` to behave like a real DOM).
let validateHostElement;

before(async () => {
  globalThis.document = {};
  ({ validateHostElement } = await import('./pixi.js'));
});

describe('validateHostElement', () => {
  test('rejects undefined', () => {
    assert.throws(() => validateHostElement(undefined), TypeError);
  });

  test('rejects a plain object', () => {
    assert.throws(() => validateHostElement({}), TypeError);
  });

  test('rejects a string', () => {
    assert.throws(() => validateHostElement('#host'), TypeError);
  });

  test('accepts an object with appendChild and querySelector', () => {
    const fakeElement = { appendChild: () => {}, querySelector: () => null };
    assert.doesNotThrow(() => validateHostElement(fakeElement));
  });
});
