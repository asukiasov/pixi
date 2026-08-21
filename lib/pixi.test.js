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
// isImageDataLike (instance.loadImage(), task 3.3) is the same kind of pure
// dispatch check: no DOM needed to decide whether a value already looks
// like ImageData versus needing the Blob decode path (createImageBitmap +
// canvas, DOM-only - exercised by the Playwright smoke test, task 3.11).
let validateHostElement;
let isImageDataLike;

before(async () => {
  globalThis.document = {};
  ({ validateHostElement, isImageDataLike } = await import('./pixi.js'));
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

describe('isImageDataLike', () => {
  test('accepts an ImageData-shaped object', () => {
    const imageData = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    assert.equal(isImageDataLike(imageData), true);
  });

  test('rejects a Blob-shaped object (has arrayBuffer(), no width/height)', () => {
    const blobLike = { type: 'image/png', arrayBuffer: () => Promise.resolve() };
    assert.equal(isImageDataLike(blobLike), false);
  });

  test('rejects undefined', () => {
    assert.equal(isImageDataLike(undefined), false);
  });

  test('rejects an object whose data is a plain array, not Uint8ClampedArray', () => {
    assert.equal(isImageDataLike({ data: [0, 0, 0, 255], width: 1, height: 1 }), false);
  });
});
