import 'fake-indexeddb/auto';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  _clearAllForTests,
  createColorPalette,
  listColorPalettes,
  renameColorPalette,
  addColorToPalette,
  deleteColorPalette,
} from '../js/persistence.js';

beforeEach(async () => {
  await _clearAllForTests();
});

describe('createColorPalette', () => {
  test('creates a palette with the given name and colors, and an id', async () => {
    const record = await createColorPalette('Skin Tones', ['#ffcc99', '#e0ac69']);
    assert.equal(record.name, 'Skin Tones');
    assert.deepEqual(record.colors, ['#ffcc99', '#e0ac69']);
    assert.ok(record.id);
    assert.equal(record.userId, null);
  });

  test('defaults to an empty color list', async () => {
    const record = await createColorPalette('Empty');
    assert.deepEqual(record.colors, []);
  });
});

describe('listColorPalettes', () => {
  test('returns every created palette', async () => {
    await createColorPalette('A');
    await createColorPalette('B');
    const all = await listColorPalettes();
    assert.equal(all.length, 2);
    assert.ok(all.some((p) => p.name === 'A'));
    assert.ok(all.some((p) => p.name === 'B'));
  });
});

describe('renameColorPalette', () => {
  test('updates the palette name', async () => {
    const created = await createColorPalette('Old Name');
    await renameColorPalette(created.id, 'New Name');
    const all = await listColorPalettes();
    assert.equal(all.find((p) => p.id === created.id).name, 'New Name');
  });
});

describe('addColorToPalette', () => {
  test('appends a color without losing existing ones', async () => {
    const created = await createColorPalette('Growing', ['#111111']);
    await addColorToPalette(created.id, '#222222');
    const all = await listColorPalettes();
    assert.deepEqual(all.find((p) => p.id === created.id).colors, ['#111111', '#222222']);
  });

  test('a nonexistent palette id is a no-op, not a crash', async () => {
    await assert.doesNotReject(() => addColorToPalette('nope', '#000000'));
  });
});

describe('deleteColorPalette', () => {
  test('removes it so it no longer appears in listColorPalettes', async () => {
    const created = await createColorPalette('Gone soon');
    await deleteColorPalette(created.id);
    const all = await listColorPalettes();
    assert.ok(!all.some((p) => p.id === created.id));
  });
});
