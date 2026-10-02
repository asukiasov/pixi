import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createToastController, TOAST_DURATIONS, MAX_TOASTS } from '../js/toast.js';

// Fake clock + timer table, so lifetime rules are tested without waiting.
function fakeClock() {
  let t = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => t,
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

describe('createToastController', () => {
  let clock;
  let snapshots;
  let ctl;

  beforeEach(() => {
    clock = fakeClock();
    snapshots = [];
    ctl = createToastController({ ...clock, onChange: (list) => snapshots.push(list.map((x) => x.message)) });
  });

  test('add returns an id and reports the visible list', () => {
    const id = ctl.add('Hello');
    assert.ok(id);
    assert.deepEqual(snapshots.at(-1), ['Hello']);
    assert.equal(ctl.list()[0].type, 'info');
  });

  test('info auto-dismisses after its duration, error after its longer one', () => {
    ctl.add('info msg');
    ctl.add('error msg', { type: 'error' });
    clock.advance(TOAST_DURATIONS.info);
    assert.deepEqual(snapshots.at(-1), ['error msg']);
    clock.advance(TOAST_DURATIONS.error - TOAST_DURATIONS.info);
    assert.deepEqual(snapshots.at(-1), []);
    assert.ok(TOAST_DURATIONS.error > TOAST_DURATIONS.info);
  });

  test(`at most ${MAX_TOASTS} visible - the oldest goes first`, () => {
    for (const m of ['a', 'b', 'c', 'd']) ctl.add(m);
    assert.deepEqual(snapshots.at(-1), ['b', 'c', 'd']);
  });

  test('manual dismiss removes immediately and cancels its timer', () => {
    const id = ctl.add('bye');
    ctl.dismiss(id);
    assert.deepEqual(snapshots.at(-1), []);
    const count = snapshots.length;
    clock.advance(TOAST_DURATIONS.info * 2);
    assert.equal(snapshots.length, count, 'no further change once dismissed');
  });

  test('dismissing an unknown id is a no-op', () => {
    ctl.add('stay');
    ctl.dismiss(999);
    assert.deepEqual(snapshots.at(-1), ['stay']);
  });

  test('runAction calls the action once and dismisses', () => {
    let calls = 0;
    const id = ctl.add('Removed', { action: { label: 'Undo', onClick: () => calls++ } });
    ctl.runAction(id);
    ctl.runAction(id);
    assert.equal(calls, 1);
    assert.deepEqual(snapshots.at(-1), []);
  });

  test('pause holds the toast; resume continues with the remaining time', () => {
    const id = ctl.add('read me');
    clock.advance(1000);
    ctl.pause(id);
    clock.advance(TOAST_DURATIONS.info * 3);
    assert.deepEqual(snapshots.at(-1), ['read me'], 'paused toast never times out');
    ctl.resume(id);
    clock.advance(TOAST_DURATIONS.info - 1000 - 1);
    assert.deepEqual(snapshots.at(-1), ['read me'], 'not yet - only the remainder is left');
    clock.advance(1);
    assert.deepEqual(snapshots.at(-1), []);
  });

  test('pause/resume are idempotent', () => {
    const id = ctl.add('x');
    ctl.pause(id);
    ctl.pause(id);
    ctl.resume(id);
    ctl.resume(id);
    clock.advance(TOAST_DURATIONS.info);
    assert.deepEqual(snapshots.at(-1), []);
  });
});
