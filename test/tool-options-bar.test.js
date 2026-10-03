// Tool-options bar (5d-tool-options-bar): the pure helpers behind the
// floating layout's bar. The DOM wiring is checked by hand in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toolsShowing, forwardValue, mirrorToggle } from '../js/tool-options-bar.js';

describe('toolsShowing', () => {
  test('one tool', () => {
    assert.deepEqual([...toolsShowing('rectangle')], ['rectangle']);
  });

  test('several tools', () => {
    assert.deepEqual([...toolsShowing('pencil eraser brush')], ['pencil', 'eraser', 'brush']);
  });

  test('extra whitespace is ignored', () => {
    assert.deepEqual([...toolsShowing('  pencil \n  eraser\t')], ['pencil', 'eraser']);
  });

  test('empty or missing gives an empty set', () => {
    assert.equal(toolsShowing('').size, 0);
    assert.equal(toolsShowing('   ').size, 0);
    assert.equal(toolsShowing(undefined).size, 0);
    assert.equal(toolsShowing(null).size, 0);
  });
});

// A stand-in for an <input> with listeners, enough for forwardValue.
function fakeInput(value, onEvent = {}) {
  const dispatched = [];
  const input = {
    value: String(value),
    dispatched,
    dispatchEvent(event) {
      dispatched.push(event.type);
      onEvent[event.type]?.(input);
      return true;
    },
  };
  return input;
}

describe('forwardValue', () => {
  test('copies the proxy value to the source', () => {
    const proxy = fakeInput(4);
    const source = fakeInput(1);
    forwardValue(proxy, source, 'input');
    assert.equal(source.value, '4');
  });

  test('dispatches the given event type on the source, once', () => {
    const proxy = fakeInput(5);
    const source = fakeInput(1);
    forwardValue(proxy, source, 'change');
    assert.deepEqual(source.dispatched, ['change']);
    assert.deepEqual(proxy.dispatched, []);
  });

  test("the source listener's clamped value is read back into the proxy", () => {
    const proxy = fakeInput(99);
    const source = fakeInput(1, {
      change: (el) => { el.value = String(Math.min(20, Number(el.value))); },
    });
    forwardValue(proxy, source, 'change');
    assert.equal(source.value, '20');
    assert.equal(proxy.value, '20');
  });
});

function fakeButton({ active = false, attrs = {} } = {}) {
  const classes = new Set(active ? ['active'] : []);
  const store = { ...attrs };
  return {
    classList: { contains: (name) => classes.has(name) },
    hasAttribute: (name) => name in store,
    getAttribute: (name) => store[name] ?? null,
    setAttribute: (name, value) => { store[name] = String(value); },
    removeAttribute: (name) => { delete store[name]; },
  };
}

describe('mirrorToggle', () => {
  test('an active source shows as pressed', () => {
    const source = fakeButton({ active: true, attrs: { 'aria-label': 'Filled', 'data-tooltip': 'Filled rectangle' } });
    const proxy = fakeButton();
    mirrorToggle(source, proxy);
    assert.equal(proxy.getAttribute('aria-pressed'), 'true');
    assert.equal(proxy.getAttribute('aria-label'), 'Filled');
    assert.equal(proxy.getAttribute('data-tooltip'), 'Filled rectangle');
  });

  test('an inactive source shows as not pressed', () => {
    const source = fakeButton({ attrs: { 'aria-label': 'Pixel-perfect', 'data-tooltip': 'Pixel-perfect' } });
    const proxy = fakeButton({ attrs: { 'aria-pressed': 'true' } });
    mirrorToggle(source, proxy);
    assert.equal(proxy.getAttribute('aria-pressed'), 'false');
  });

  for (const mode of ['off', 'horizontal', 'vertical', 'both']) {
    test(`a symmetry source in mode ${mode} copies its mode and label`, () => {
      const label = `Symmetry: ${mode}`;
      const source = fakeButton({
        active: mode !== 'off',
        attrs: { 'data-symmetry-mode': mode, 'aria-label': label, 'data-tooltip': label },
      });
      const proxy = fakeButton();
      mirrorToggle(source, proxy);
      assert.equal(proxy.getAttribute('data-symmetry-mode'), mode);
      assert.equal(proxy.getAttribute('aria-label'), label);
      assert.equal(proxy.getAttribute('data-tooltip'), label);
      assert.equal(proxy.getAttribute('aria-pressed'), String(mode !== 'off'));
    });
  }

  test('a source with no mode attribute leaves the proxy without one', () => {
    const source = fakeButton({ attrs: { 'aria-label': '1:1 proportion' } });
    const proxy = fakeButton();
    mirrorToggle(source, proxy);
    assert.equal(proxy.hasAttribute('data-symmetry-mode'), false);
    assert.equal(proxy.getAttribute('aria-label'), '1:1 proportion');
  });
});
