// Gallery tile metadata (home-screen redesign): pure formatters, no DOM.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatCanvasSize, formatEdited } from '../js/gallery-format.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 4, 15, 0).getTime(); // Oct 4 2026, 15:00 local

describe('formatCanvasSize', () => {
  test('width×height', () => {
    assert.equal(formatCanvasSize({ width: 32, height: 16 }), '32×16');
  });

  test('empty when dimensions are missing', () => {
    assert.equal(formatCanvasSize({}), '');
  });
});

describe('formatEdited', () => {
  test('under a minute is "Just now"', () => {
    assert.equal(formatEdited(NOW - 30_000, NOW, 'en'), 'Just now');
  });

  test('future timestamps (clock skew) are "Just now"', () => {
    assert.equal(formatEdited(NOW + 5 * MIN, NOW, 'en'), 'Just now');
  });

  test('minutes', () => {
    assert.equal(formatEdited(NOW - 5 * MIN, NOW, 'en'), '5 minutes ago');
  });

  test('hours', () => {
    assert.equal(formatEdited(NOW - 3 * HOUR, NOW, 'en'), '3 hours ago');
  });

  test('one to two days is "Yesterday"', () => {
    assert.equal(formatEdited(NOW - 30 * HOUR, NOW, 'en'), 'Yesterday');
  });

  test('older, same year: short date', () => {
    assert.equal(formatEdited(NOW - 10 * DAY, NOW, 'en'), 'Sep 24');
  });

  test('older, other year: includes the year', () => {
    assert.equal(formatEdited(new Date(2025, 0, 2).getTime(), NOW, 'en'), 'Jan 2, 2025');
  });

  test('missing timestamp is empty', () => {
    assert.equal(formatEdited(undefined, NOW, 'en'), '');
  });
});
