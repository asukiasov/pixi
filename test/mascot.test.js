import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMascotController, MASCOT_DURATION, MASCOT_SPRITES, MASCOT_TOOLS } from '../js/mascot.js';

// Fake timer table, so the 3-second lifetime is tested without waiting.
function fakeTimers() {
  let t = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, at: t + ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      t += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= t) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

describe('createMascotController', () => {
  let clock;
  let events;
  let mascot;
  let enabled;

  beforeEach(() => {
    clock = fakeTimers();
    events = [];
    enabled = true;
    mascot = createMascotController({
      tools: ['pencil'],
      isEnabled: () => enabled,
      onShow: (tool) => events.push(['show', tool]),
      onHide: () => events.push(['hide']),
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
  });

  test('picking a tool with a mascot shows it, then hides it after MASCOT_DURATION', () => {
    mascot.toolPicked('pencil', 'eraser');
    assert.deepEqual(events, [['show', 'pencil']]);
    clock.advance(MASCOT_DURATION - 1);
    assert.deepEqual(events, [['show', 'pencil']]);
    clock.advance(1);
    assert.deepEqual(events, [['show', 'pencil'], ['hide']]);
  });

  test('the duration is 3 seconds', () => {
    assert.equal(MASCOT_DURATION, 3000);
  });

  test('picking a tool without a mascot shows nothing', () => {
    mascot.toolPicked('eraser', 'pencil');
    assert.deepEqual(events, []);
  });

  test('re-picking the already-active tool does not replay', () => {
    mascot.toolPicked('pencil', 'pencil');
    assert.deepEqual(events, []);
  });

  test('switching to another tool while showing hides it at once', () => {
    mascot.toolPicked('pencil', 'eraser');
    mascot.toolPicked('eraser', 'pencil');
    assert.deepEqual(events, [['show', 'pencil'], ['hide']]);
    clock.advance(MASCOT_DURATION);
    assert.deepEqual(events, [['show', 'pencil'], ['hide']], 'old timer was cleared');
  });

  test('picking it again after switching away restarts the full duration', () => {
    mascot.toolPicked('pencil', 'eraser');
    clock.advance(2000);
    mascot.toolPicked('eraser', 'pencil');
    mascot.toolPicked('pencil', 'eraser');
    clock.advance(2000);
    assert.deepEqual(events.at(-1), ['show', 'pencil']);
    clock.advance(1000);
    assert.deepEqual(events.at(-1), ['hide']);
  });

  test('hide() dismisses early and cancels the timer', () => {
    mascot.toolPicked('pencil', 'eraser');
    mascot.hide();
    clock.advance(MASCOT_DURATION);
    assert.deepEqual(events, [['show', 'pencil'], ['hide']]);
  });

  test('hide() while nothing is showing does nothing', () => {
    mascot.hide();
    assert.deepEqual(events, []);
  });

  test('turned off (Show Mascot pref), picking a tool shows nothing', () => {
    enabled = false;
    mascot.toolPicked('pencil', 'eraser');
    assert.deepEqual(events, []);
  });

  test('turned off while showing, the next pick still hides it and shows nothing', () => {
    mascot.toolPicked('pencil', 'eraser');
    enabled = false;
    mascot.toolPicked('eraser', 'pencil');
    mascot.toolPicked('pencil', 'eraser');
    assert.deepEqual(events, [['show', 'pencil'], ['hide']]);
  });

  test('turned back on, the next pick shows it again', () => {
    enabled = false;
    mascot.toolPicked('pencil', 'eraser');
    enabled = true;
    mascot.toolPicked('eraser', 'pencil');
    mascot.toolPicked('pencil', 'eraser');
    assert.deepEqual(events, [['show', 'pencil']]);
  });
});

describe('MASCOT_SPRITES', () => {
  test('every sprite has a whole frame count of at least 2', () => {
    for (const [tool, { frames }] of Object.entries(MASCOT_SPRITES)) {
      assert.ok(Number.isInteger(frames) && frames >= 2, tool);
    }
  });

  test('MASCOT_TOOLS lists exactly the tools with a sprite', () => {
    assert.deepEqual(MASCOT_TOOLS, Object.keys(MASCOT_SPRITES));
  });
});
