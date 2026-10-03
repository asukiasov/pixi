// Panel mini-rail (5e-cards-mini-rail): the pure helpers behind the
// floating layout's rail. The DOM wiring is checked by hand in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { panelRailState, applyPanelRailState, optionsReach } from '../js/panel-rail.js';

// A stand-in for an element's DOMTokenList (contains, not Set#has).
const classes = (...names) => ({ contains: (name) => names.includes(name) });

describe('panelRailState', () => {
  test('an open card is expanded and available', () => {
    assert.deepEqual(panelRailState(classes('brushes-panel')), { expanded: true, unavailable: false });
  });

  test('a collapsed card is closed', () => {
    assert.deepEqual(panelRailState(classes('layers-panel', 'collapsed')), { expanded: false, unavailable: false });
  });

  test('a card hidden by the tool is unavailable and not expanded', () => {
    assert.deepEqual(panelRailState(classes('brushes-panel', 'hidden')), { expanded: false, unavailable: true });
  });

  test('hidden and collapsed together', () => {
    assert.deepEqual(panelRailState(classes('hidden', 'collapsed')), { expanded: false, unavailable: true });
  });
});

// A stand-in for a <button>, enough for applyPanelRailState.
function fakeButton(attrs = {}) {
  const map = new Map(Object.entries(attrs));
  return {
    map,
    getAttribute: (name) => (map.has(name) ? map.get(name) : null),
    setAttribute: (name, value) => map.set(name, String(value)),
    removeAttribute: (name) => map.delete(name),
    hasAttribute: (name) => map.has(name),
  };
}

const labels = { label: 'Brushes', unavailableLabel: 'Brushes (Brush tool)' };

describe('applyPanelRailState', () => {
  test('expanded', () => {
    const button = fakeButton();
    applyPanelRailState(button, { expanded: true, unavailable: false }, labels);
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(button.hasAttribute('aria-disabled'), false);
    assert.equal(button.getAttribute('aria-label'), 'Brushes');
    assert.equal(button.getAttribute('data-tooltip'), 'Brushes');
  });

  test('closed', () => {
    const button = fakeButton();
    applyPanelRailState(button, { expanded: false, unavailable: false }, labels);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(button.hasAttribute('aria-disabled'), false);
  });

  test('unavailable', () => {
    const button = fakeButton();
    applyPanelRailState(button, { expanded: false, unavailable: true }, labels);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.getAttribute('aria-label'), 'Brushes (Brush tool)');
    assert.equal(button.getAttribute('data-tooltip'), 'Brushes (Brush tool)');
  });

  test('unavailable then available again restores the label', () => {
    const button = fakeButton();
    applyPanelRailState(button, { expanded: false, unavailable: true }, labels);
    applyPanelRailState(button, { expanded: true, unavailable: false }, labels);
    assert.equal(button.hasAttribute('aria-disabled'), false);
    assert.equal(button.getAttribute('aria-label'), 'Brushes');
    assert.equal(button.getAttribute('data-tooltip'), 'Brushes');
  });

  test('without an unavailable label the normal label is kept', () => {
    const button = fakeButton();
    applyPanelRailState(button, { expanded: false, unavailable: true }, { label: 'Layers' });
    assert.equal(button.getAttribute('aria-label'), 'Layers');
  });
});

describe('optionsReach', () => {
  const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
  const screen = rect(0, 0, 1180, 820);
  const column = rect(858, 74, 1098, 773);

  test('bottom cards reaching under the column: distance from their top to the screen bottom', () => {
    assert.equal(optionsReach(rect(297, 700, 897, 808), column, screen), 120);
  });

  test('no horizontal overlap: no reach', () => {
    assert.equal(optionsReach(rect(297, 700, 850, 808), column, screen), 0);
  });

  test('hidden bottom cards (zero size): no reach', () => {
    assert.equal(optionsReach(rect(0, 0, 0, 0), column, screen), 0);
  });

  test('works with a screen not at the page origin', () => {
    assert.equal(optionsReach(rect(397, 750, 997, 858), rect(958, 124, 1198, 700), rect(100, 50, 1280, 870)), 120);
  });
});
