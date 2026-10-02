import 'fake-indexeddb/auto';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  _clearAllForTests,
  createColorPalette,
  listColorPalettes,
  renameColorPalette,
  addColorToPalette,
  removeColorFromPalette,
  insertColorIntoPalette,
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

describe('removeColorFromPalette', () => {
  const colorsOf = async (id) => (await listColorPalettes()).find((p) => p.id === id).colors;

  test('removes exactly the color at the given index', async () => {
    const created = await createColorPalette('Trim', ['#111111', '#222222', '#333333']);
    await removeColorFromPalette(created.id, 1);
    assert.deepEqual(await colorsOf(created.id), ['#111111', '#333333']);
  });

  test('removes one occurrence of a duplicate, not all of them', async () => {
    const created = await createColorPalette('Dupes', ['#aaaaaa', '#bbbbbb', '#aaaaaa']);
    await removeColorFromPalette(created.id, 2);
    assert.deepEqual(await colorsOf(created.id), ['#aaaaaa', '#bbbbbb']);
  });

  test('can empty a palette', async () => {
    const created = await createColorPalette('Single', ['#123456']);
    await removeColorFromPalette(created.id, 0);
    assert.deepEqual(await colorsOf(created.id), []);
  });

  test('bumps updatedAt', async () => {
    const created = await createColorPalette('Stamp', ['#111111', '#222222']);
    await new Promise((r) => setTimeout(r, 5));
    await removeColorFromPalette(created.id, 0);
    const record = (await listColorPalettes()).find((p) => p.id === created.id);
    assert.ok(record.updatedAt > created.updatedAt);
  });

  test('an out-of-range index is a no-op', async () => {
    const created = await createColorPalette('Range', ['#111111']);
    await removeColorFromPalette(created.id, 5);
    await removeColorFromPalette(created.id, -1);
    assert.deepEqual(await colorsOf(created.id), ['#111111']);
  });

  test('a nonexistent palette id is a no-op, not a crash', async () => {
    await assert.doesNotReject(() => removeColorFromPalette('nope', 0));
  });
});

describe('insertColorIntoPalette', () => {
  const colorsOf = async (id) => (await listColorPalettes()).find((p) => p.id === id).colors;

  test('puts a color back at its original index (undo of removeColorFromPalette)', async () => {
    const created = await createColorPalette('Undo', ['#111111', '#222222', '#333333']);
    await removeColorFromPalette(created.id, 1);
    await insertColorIntoPalette(created.id, 1, '#222222');
    assert.deepEqual(await colorsOf(created.id), ['#111111', '#222222', '#333333']);
  });

  test('clamps an index past the end to an append', async () => {
    const created = await createColorPalette('Clamp', ['#111111']);
    await insertColorIntoPalette(created.id, 9, '#999999');
    assert.deepEqual(await colorsOf(created.id), ['#111111', '#999999']);
  });

  test('a nonexistent palette id is a no-op, not a crash', async () => {
    await assert.doesNotReject(() => insertColorIntoPalette('nope', 0, '#000000'));
  });
});
