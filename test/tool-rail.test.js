// Tool rail (5c-floating-tool-rail): the selected-tool state each tool
// button exposes. The DOM wiring is checked by hand in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { syncToolButtons } from '../js/tool-rail.js';

function fakeButton(tool, { disabled = false } = {}) {
  const classes = new Set();
  const attrs = {};
  return {
    dataset: { tool },
    disabled,
    classList: {
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    setAttribute: (name, value) => { attrs[name] = String(value); },
    getAttribute: (name) => attrs[name] ?? null,
  };
}

const pressed = (buttons) => buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');

describe('syncToolButtons', () => {
  test('exactly the current tool is pressed and active', () => {
    const buttons = ['move', 'pencil', 'eraser'].map((t) => fakeButton(t));
    syncToolButtons(buttons, 'pencil');
    assert.deepEqual(pressed(buttons).map((b) => b.dataset.tool), ['pencil']);
    assert.deepEqual(buttons.map((b) => b.classList.contains('active')), [false, true, false]);
    assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  });

  test('switching tools moves the pressed state', () => {
    const buttons = ['move', 'pencil', 'eraser'].map((t) => fakeButton(t));
    syncToolButtons(buttons, 'pencil');
    syncToolButtons(buttons, 'eraser');
    assert.deepEqual(pressed(buttons).map((b) => b.dataset.tool), ['eraser']);
  });

  test('an unknown tool leaves every button unpressed', () => {
    const buttons = ['move', 'pencil'].map((t) => fakeButton(t));
    syncToolButtons(buttons, 'lasso');
    assert.equal(pressed(buttons).length, 0);
  });

  test('a disabled (restricted) button is never pressed', () => {
    const buttons = [fakeButton('move'), fakeButton('pencil', { disabled: true })];
    syncToolButtons(buttons, 'pencil');
    assert.equal(pressed(buttons).length, 0);
    assert.equal(buttons[1].classList.contains('active'), false);
  });
});
