// Tool rail (5c-floating-tool-rail): the selected-tool state each tool
// button exposes, and which buttons show (Customize Tools). The DOM wiring is checked by hand in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { syncToolButtons, applyRailTools } from '../js/tool-rail.js';

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

// A container whose children are tool buttons plus, optionally, a
// non-tool anchor (the ⋯ button) - enough of the DOM for insertBefore.
function fakeContainer(tools, { anchor = false } = {}) {
  const children = tools.map((t) => fakeButton(t));
  const anchorNode = anchor ? { dataset: {} } : null;
  if (anchorNode) children.push(anchorNode);
  return {
    children,
    anchor: anchorNode,
    querySelectorAll: () => children.filter((c) => c.dataset.tool),
    insertBefore(node, ref) {
      children.splice(children.indexOf(node), 1);
      children.splice(ref ? children.indexOf(ref) : children.length, 0, node);
    },
  };
}

const order = (c) => c.children.map((b) => b.dataset.tool ?? 'anchor');
const offRail = (c) => c.children.filter((b) => b.classList?.contains('off-rail')).map((b) => b.dataset.tool);

describe('applyRailTools', () => {
  test('the rail tools first, in order; the rest after, off-rail', () => {
    const c = fakeContainer(['move', 'pencil', 'eraser', 'hand']);
    applyRailTools(c, ['hand', 'move']);
    assert.deepEqual(order(c), ['hand', 'move', 'pencil', 'eraser']);
    assert.deepEqual(offRail(c), ['pencil', 'eraser']);
  });

  test('tools go before the anchor, which stays put', () => {
    const c = fakeContainer(['move', 'pencil'], { anchor: true });
    applyRailTools(c, ['pencil'], c.anchor);
    assert.deepEqual(order(c), ['pencil', 'move', 'anchor']);
  });

  test('applying again clears off-rail from tools that are back', () => {
    const c = fakeContainer(['move', 'pencil']);
    applyRailTools(c, []);
    assert.deepEqual(offRail(c), ['move', 'pencil']);
    applyRailTools(c, ['pencil', 'move']);
    assert.deepEqual(offRail(c), []);
    assert.deepEqual(order(c), ['pencil', 'move']);
  });

  test('restricted (disabled) buttons are left disabled', () => {
    const c = fakeContainer(['move', 'pencil']);
    c.children[1].disabled = true;
    applyRailTools(c, ['move', 'pencil']);
    assert.equal(c.children[1].disabled, true);
  });
});
