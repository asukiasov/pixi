import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStandardLibraries, standardLibraryRows, loadStandardLibraries } from '../js/standard-libraries.js';
import { STANDARD_PALETTES, PREDEFINED_PALETTES } from '../js/default-color-library.js';

describe('parseStandardLibraries', () => {
  test('keeps well-formed entries, lower-cases colours', () => {
    const parsed = parseStandardLibraries([{ name: 'A', colors: ['#AABBCC', '#000000'] }]);
    assert.deepEqual(parsed, [{ name: 'A', colors: ['#aabbcc', '#000000'] }]);
  });

  test('drops entries with no name, no colours or a bad colour; null for a non-list', () => {
    const parsed = parseStandardLibraries([
      { name: '', colors: ['#000000'] },
      { name: 'B', colors: [] },
      { name: 'C', colors: ['red'] },
      { name: 'D', colors: ['#123456'] },
      'nope',
    ]);
    assert.deepEqual(parsed.map((p) => p.name), ['D']);
    assert.equal(parseStandardLibraries({ name: 'x' }), null);
  });
});

describe('standardLibraryRows', () => {
  test('marks the ones already in the library by name, case-insensitively', () => {
    const rows = standardLibraryRows([{ name: 'Kit Kat', colors: ['#d0021b'] }, { name: 'PICO-8', colors: ['#000000'] }], ['kit kat', 'Mine']);
    assert.deepEqual(rows.map((r) => [r.name, r.added]), [['Kit Kat', true], ['PICO-8', false]]);
  });
});

describe('loadStandardLibraries', () => {
  test('uses the downloaded list when it parses', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => [{ name: 'Remote', colors: ['#010203'] }] });
    assert.deepEqual(await loadStandardLibraries(fetchFn), [{ name: 'Remote', colors: ['#010203'] }]);
  });

  test('falls back to the built-in list when offline, on a bad status, or bad JSON', async () => {
    for (const fetchFn of [
      async () => { throw new TypeError('offline'); },
      async () => ({ ok: false, json: async () => [] }),
      async () => ({ ok: true, json: async () => 'garbage' }),
    ]) {
      assert.deepEqual(await loadStandardLibraries(fetchFn), STANDARD_PALETTES);
    }
  });
});

describe('the shipped list', () => {
  test('assets/palettes/standard.json matches the built-in fallback', () => {
    const shipped = JSON.parse(readFileSync(new URL('../assets/palettes/standard.json', import.meta.url), 'utf8'));
    assert.deepEqual(parseStandardLibraries(shipped), STANDARD_PALETTES);
  });

  test('includes Pixi Basics, every starter palette, PICO-8 and Game Boy', () => {
    const names = STANDARD_PALETTES.map((p) => p.name);
    for (const name of ['Pixi Basics', ...Object.keys(PREDEFINED_PALETTES), 'PICO-8', 'Game Boy']) assert.ok(names.includes(name), name);
  });
});
