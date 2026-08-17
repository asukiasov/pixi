import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, nextThemePreference, normalizeThemePreference } from '../js/theme.js';

describe('resolveTheme', () => {
  test('"light" preference always resolves to light, regardless of OS', () => {
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('light', false), 'light');
  });

  test('"dark" preference always resolves to dark, regardless of OS', () => {
    assert.equal(resolveTheme('dark', true), 'dark');
    assert.equal(resolveTheme('dark', false), 'dark');
  });

  test('"system" preference follows the OS prefers-color-scheme state', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
  });
});

describe('nextThemePreference', () => {
  test('cycles light -> dark -> system -> light', () => {
    assert.equal(nextThemePreference('light'), 'dark');
    assert.equal(nextThemePreference('dark'), 'system');
    assert.equal(nextThemePreference('system'), 'light');
  });

  test('unrecognized input falls back to the start of the cycle', () => {
    assert.equal(nextThemePreference('bogus'), 'light');
  });

  test('cycling three times from any starting point returns to the start', () => {
    for (const start of ['light', 'dark', 'system']) {
      let value = start;
      for (let i = 0; i < 3; i++) value = nextThemePreference(value);
      assert.equal(value, start);
    }
  });
});

describe('normalizeThemePreference', () => {
  test('passes through valid preferences unchanged', () => {
    assert.equal(normalizeThemePreference('light'), 'light');
    assert.equal(normalizeThemePreference('dark'), 'dark');
    assert.equal(normalizeThemePreference('system'), 'system');
  });

  test('falls back to "system" for unset/invalid/corrupted values', () => {
    assert.equal(normalizeThemePreference(undefined), 'system');
    assert.equal(normalizeThemePreference(null), 'system');
    assert.equal(normalizeThemePreference(''), 'system');
    assert.equal(normalizeThemePreference('purple'), 'system');
    assert.equal(normalizeThemePreference(42), 'system');
  });
});
