import { test, describe, before, after } from 'node:test';
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
// validateGetImageFormat (instance.getImage(), task 3.4) is the same kind
// of pure check again - no DOM needed to reject an unsupported `format`
// value before any encoding work starts. The encode/convert paths behind
// each accepted format (toPNGBlob's canvas work, the Blob->base64/
// ImageData conversions) all need a real DOM/canvas and are covered by
// the Playwright smoke test instead (task 3.11), same as loadImage's
// decodeToImageData.
// createEventEmitter (instance.on(), task 3.5) is the same kind of pure
// logic again - registering/dispatching handlers needs no DOM. What
// actually triggers a 'change' emit (autoSave(), inside js/workspace.js)
// does need a real DOM/CanvasView and is covered by the Playwright smoke
// test instead (task 3.11), same as everything else in this list.
// shouldShowGalleryChrome (mount()'s options.ui.gallery, task 3.6) is the
// same kind of pure resolution check as validateGetImageFormat - deciding
// whether to hide the mounted #back-to-gallery-button is a boolean
// resolved from `options` alone, no DOM needed. Actually hiding the button
// (the classList toggle in mount()/startWorkspace()) does need a real DOM
// and is covered by the Playwright smoke test instead (task 3.11), same as
// everything else in this list.
// resolveEnabledTools/resolveInitialTool (mount()'s options.ui.tools, task
// 3.7) are the same kind of pure resolution check again - deciding which
// tool names are enabled, and which one becomes the starting active tool,
// from `options` alone needs no DOM. Actually hiding/disabling the tool
// buttons and setting the initial active tool (the classList/disabled
// toggles in js/workspace.js's initWorkspace()) does need a real DOM and is
// covered by the Playwright smoke test instead (task 3.11), same as
// everything else in this list.
// resolveUiCallback (instance.save()/cancel(), options.ui.onSave/onCancel,
// task 3.8) is the same kind of pure resolution check again - deciding
// whether a host supplied a real callback function needs no DOM. What
// save()/cancel() actually do with it (encode/revert the canvas, invoke
// the callback) does need a real DOM/CanvasView/LayerStack and is covered
// by the Playwright smoke test instead (task 3.11), same as everything
// else in this list.
// validateStorageAdapter (mount()'s options.storage, task 3.9) is the same
// kind of pure structural check as validateHostElement - deciding whether
// a value duck-types as a storage adapter ({ load, save, list, delete }, all
// functions) needs no DOM. Unlike options.ui.*'s soft-degrade-to-default
// checks (shouldShowGalleryChrome/resolveEnabledTools/resolveUiCallback),
// this throws on a malformed value rather than silently falling back -
// see this function's own doc comment for why a broken storage adapter is
// structurally critical (silent data loss), not cosmetic, the same
// distinction validateHostElement already draws. Actually switching the
// active adapter (_setStorageAdapter, in js/persistence.js) and everything
// downstream of it (createProjectWithId, autoSave) needs a real DOM/
// IndexedDB-or-adapter round trip and is covered by the Playwright smoke
// test instead (task 3.11), same as everything else in this list.
let validateHostElement;
let isImageDataLike;
let validateGetImageFormat;
let createEventEmitter;
let shouldShowGalleryChrome;
let resolveEnabledTools;
let resolveInitialTool;
let resolveUiCallback;
let validateStorageAdapter;
let ALL_TOOL_NAMES;

before(async () => {
  globalThis.document = {};
  ({
    validateHostElement,
    isImageDataLike,
    validateGetImageFormat,
    createEventEmitter,
    shouldShowGalleryChrome,
    resolveEnabledTools,
    resolveInitialTool,
    resolveUiCallback,
    validateStorageAdapter,
    ALL_TOOL_NAMES,
  } = await import('./pixi.js'));
});

// Restores the stub installed above, matching test/theme.test.js's
// restore-globals precedent - low blast radius (node --test isolates each
// file in its own process, so nothing outside this file could observe the
// stub either way), but consistent cleanup over leaving it dangling.
after(() => {
  delete globalThis.document;
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

describe('validateGetImageFormat', () => {
  test('accepts "png"', () => {
    assert.doesNotThrow(() => validateGetImageFormat('png'));
  });

  test('accepts "base64"', () => {
    assert.doesNotThrow(() => validateGetImageFormat('base64'));
  });

  test('accepts "imagedata"', () => {
    assert.doesNotThrow(() => validateGetImageFormat('imagedata'));
  });

  test('rejects an unsupported format string', () => {
    assert.throws(() => validateGetImageFormat('webp'), TypeError);
  });

  test('rejects undefined', () => {
    assert.throws(() => validateGetImageFormat(undefined), TypeError);
  });
});

describe('createEventEmitter', () => {
  test('invokes a registered handler when its event is emitted', () => {
    const emitter = createEventEmitter();
    let calls = 0;
    emitter.on('change', () => calls++);
    emitter.emit('change');
    assert.equal(calls, 1);
  });

  test('invokes every handler registered on the same event', () => {
    const emitter = createEventEmitter();
    const calls = [];
    emitter.on('change', () => calls.push('a'));
    emitter.on('change', () => calls.push('b'));
    emitter.emit('change');
    assert.deepEqual(calls, ['a', 'b']);
  });

  test('does not invoke a handler registered on a different event', () => {
    const emitter = createEventEmitter();
    let calls = 0;
    emitter.on('other', () => calls++);
    emitter.emit('change');
    assert.equal(calls, 0);
  });

  test('emitting an event with no registered handlers does not throw', () => {
    const emitter = createEventEmitter();
    assert.doesNotThrow(() => emitter.emit('change'));
  });

  test('passes emit() arguments through to the handler', () => {
    const emitter = createEventEmitter();
    let received;
    emitter.on('change', (...args) => (received = args));
    emitter.emit('change', 1, 'two');
    assert.deepEqual(received, [1, 'two']);
  });

  test('a throwing handler does not stop other handlers on the same event from running', () => {
    const emitter = createEventEmitter();
    let secondRan = false;
    emitter.on('change', () => {
      throw new Error('boom');
    });
    emitter.on('change', () => {
      secondRan = true;
    });
    assert.doesNotThrow(() => emitter.emit('change'));
    assert.equal(secondRan, true);
  });

  test('rejects a non-function handler', () => {
    const emitter = createEventEmitter();
    assert.throws(() => emitter.on('change', 'not a function'), TypeError);
  });

  test('a throwing handler re-emits through the "error" event instead of logging to console', () => {
    const emitter = createEventEmitter();
    const boom = new Error('boom');
    let receivedErr;
    emitter.on('error', (err) => (receivedErr = err));
    emitter.on('change', () => {
      throw boom;
    });
    assert.doesNotThrow(() => emitter.emit('change'));
    assert.equal(receivedErr, boom);
  });

  test('a throwing "error" handler does not recurse or throw back out of emit()', () => {
    const emitter = createEventEmitter();
    let errorHandlerCalls = 0;
    emitter.on('error', () => {
      errorHandlerCalls++;
      throw new Error('error handler itself is broken');
    });
    assert.doesNotThrow(() => emitter.emit('error', new Error('original')));
    assert.equal(errorHandlerCalls, 1);
  });
});

describe('shouldShowGalleryChrome', () => {
  test('defaults to shown when no options are passed', () => {
    assert.equal(shouldShowGalleryChrome(undefined), true);
  });

  test('defaults to shown when options.ui is absent', () => {
    assert.equal(shouldShowGalleryChrome({}), true);
  });

  test('defaults to shown when options.ui.gallery is absent', () => {
    assert.equal(shouldShowGalleryChrome({ ui: {} }), true);
  });

  test('hides on an explicit options.ui.gallery: false', () => {
    assert.equal(shouldShowGalleryChrome({ ui: { gallery: false } }), false);
  });

  test('shows on an explicit options.ui.gallery: true', () => {
    assert.equal(shouldShowGalleryChrome({ ui: { gallery: true } }), true);
  });

  test('treats a falsy-but-not-false gallery value as shown, not hidden', () => {
    // Only a literal `false` opts out - a typo like `gallery: 0` or
    // `gallery: undefined` should not silently hide the chrome.
    assert.equal(shouldShowGalleryChrome({ ui: { gallery: 0 } }), true);
    assert.equal(shouldShowGalleryChrome({ ui: { gallery: undefined } }), true);
  });
});

describe('resolveEnabledTools', () => {
  test('defaults to every known tool when no options are passed', () => {
    assert.deepEqual(resolveEnabledTools(undefined), ALL_TOOL_NAMES);
  });

  test('defaults to every known tool when options.ui is absent', () => {
    assert.deepEqual(resolveEnabledTools({}), ALL_TOOL_NAMES);
  });

  test('defaults to every known tool when options.ui.tools is absent', () => {
    assert.deepEqual(resolveEnabledTools({ ui: {} }), ALL_TOOL_NAMES);
  });

  test('restricts to exactly the tools named in options.ui.tools', () => {
    assert.deepEqual(resolveEnabledTools({ ui: { tools: ['pencil', 'eraser'] } }), ['pencil', 'eraser']);
  });

  test('preserves the host-given order rather than ALL_TOOL_NAMES order', () => {
    assert.deepEqual(resolveEnabledTools({ ui: { tools: ['eraser', 'pencil'] } }), ['eraser', 'pencil']);
  });

  test('drops unknown tool names but keeps known ones from the same array', () => {
    assert.deepEqual(resolveEnabledTools({ ui: { tools: ['pencil', 'not-a-real-tool'] } }), ['pencil']);
  });

  test('falls back to every known tool when options.ui.tools is not an array', () => {
    assert.deepEqual(resolveEnabledTools({ ui: { tools: 'pencil' } }), ALL_TOOL_NAMES);
  });

  test('falls back to every known tool when options.ui.tools is an empty array', () => {
    // An empty list would leave the editor with no usable tool at all -
    // treated as a misconfiguration, not a valid "zero tools" request, the
    // same typo-safety precedent as shouldShowGalleryChrome's falsy check.
    assert.deepEqual(resolveEnabledTools({ ui: { tools: [] } }), ALL_TOOL_NAMES);
  });

  test('falls back to every known tool when options.ui.tools contains only unknown names', () => {
    assert.deepEqual(resolveEnabledTools({ ui: { tools: ['not-a-real-tool'] } }), ALL_TOOL_NAMES);
  });
});

describe('resolveInitialTool', () => {
  test('keeps the preferred tool when it is in the enabled list', () => {
    assert.equal(resolveInitialTool(['pencil', 'eraser'], 'pencil'), 'pencil');
  });

  test('falls back to the first enabled tool when the preferred tool is excluded', () => {
    assert.equal(resolveInitialTool(['eraser', 'bucket'], 'pencil'), 'eraser');
  });

  test('defaults the preferred tool to "pencil" when not given', () => {
    assert.equal(resolveInitialTool(['eraser', 'pencil']), 'pencil');
    assert.equal(resolveInitialTool(['eraser', 'bucket']), 'eraser');
  });
});

describe('resolveUiCallback', () => {
  test('returns the function when options.ui.<name> is one', () => {
    const onSave = () => {};
    assert.equal(resolveUiCallback({ ui: { onSave } }, 'onSave'), onSave);
  });

  test('returns null when no options are passed', () => {
    assert.equal(resolveUiCallback(undefined, 'onSave'), null);
  });

  test('returns null when options.ui is absent', () => {
    assert.equal(resolveUiCallback({}, 'onSave'), null);
  });

  test('returns null when options.ui.<name> is absent', () => {
    assert.equal(resolveUiCallback({ ui: {} }, 'onCancel'), null);
  });

  test('returns null when options.ui.<name> is not a function', () => {
    assert.equal(resolveUiCallback({ ui: { onCancel: 'not a function' } }, 'onCancel'), null);
  });

  test('resolves onSave and onCancel independently', () => {
    const onSave = () => {};
    const onCancel = () => {};
    const options = { ui: { onSave, onCancel } };
    assert.equal(resolveUiCallback(options, 'onSave'), onSave);
    assert.equal(resolveUiCallback(options, 'onCancel'), onCancel);
  });
});

describe('validateStorageAdapter', () => {
  const noop = () => {};
  const fullAdapter = { load: noop, save: noop, list: noop, delete: noop };

  test('accepts an object with load/save/list/delete functions', () => {
    assert.doesNotThrow(() => validateStorageAdapter(fullAdapter));
  });

  test('rejects an object missing delete', () => {
    const { delete: _delete, ...partial } = fullAdapter;
    assert.throws(() => validateStorageAdapter(partial), TypeError);
  });

  test('rejects an object whose save is not a function', () => {
    assert.throws(() => validateStorageAdapter({ ...fullAdapter, save: 'nope' }), TypeError);
  });

  test('rejects undefined', () => {
    assert.throws(() => validateStorageAdapter(undefined), TypeError);
  });

  test('rejects a plain object', () => {
    assert.throws(() => validateStorageAdapter({}), TypeError);
  });
});
