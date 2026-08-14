import 'fake-indexeddb/auto';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  renameProject,
  _clearAllForTests,
} from '../js/persistence.js';
import { LayerStack } from '../js/layers.js';

beforeEach(async () => {
  await _clearAllForTests();
});

describe('createProject', () => {
  test('creates a record with id, name, and the layer stack data', async () => {
    const stack = new LayerStack(4, 4, 'white');
    const record = await createProject(stack, 'My Art');
    assert.ok(record.id);
    assert.equal(record.name, 'My Art');
    assert.equal(record.width, 4);
    assert.equal(record.height, 4);
    assert.equal(record.layers.length, 1);
    assert.ok(record.createdAt);
    assert.equal(record.createdAt, record.updatedAt);
  });

  test('defaults name when none given', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const record = await createProject(stack);
    assert.equal(typeof record.name, 'string');
    assert.ok(record.name.length > 0);
  });

  test('stores the provided thumbnail', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const thumbnail = new Blob(['fake-png-bytes'], { type: 'image/png' });
    const record = await createProject(stack, 'Thumbed', thumbnail);
    assert.equal(record.thumbnail, thumbnail);
  });

  test('appears in listProjects immediately, before any drawing', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const record = await createProject(stack, 'Fresh');
    const all = await listProjects();
    assert.ok(all.some((p) => p.id === record.id));
  });
});

describe('saveProject', () => {
  test('updates layer data and updatedAt, keeps id/name/createdAt', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const created = await createProject(stack, 'Evolving');

    stack.getActiveLayer().engine.setPixel(0, 0, [1, 2, 3, 255]);
    await new Promise((resolve) => setTimeout(resolve, 5)); // ensure updatedAt can differ
    await saveProject(created.id, stack);

    const loaded = await loadProject(created.id);
    assert.equal(loaded.id, created.id);
    assert.equal(loaded.name, 'Evolving');
    assert.equal(loaded.createdAt, created.createdAt);
    assert.ok(loaded.updatedAt >= created.updatedAt);
    const restored = LayerStack.fromProjectRecord(loaded);
    assert.deepEqual(restored.getActiveLayer().engine.getPixel(0, 0), [1, 2, 3, 255]);
  });

  test('updates the thumbnail when one is provided', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const created = await createProject(stack, 'Thumbed');
    const newThumbnail = new Blob(['updated'], { type: 'image/png' });
    await saveProject(created.id, stack, newThumbnail);
    const loaded = await loadProject(created.id);
    // IndexedDB structured-clones the Blob, so it won't be the same
    // reference on the way back out — compare content instead.
    assert.equal(loaded.thumbnail.size, newThumbnail.size);
    assert.equal(loaded.thumbnail.type, newThumbnail.type);
  });
});

describe('renameProject', () => {
  test('updates the name and updatedAt, leaves layer data untouched', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const created = await createProject(stack, 'Old Name');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await renameProject(created.id, 'New Name');
    const loaded = await loadProject(created.id);
    assert.equal(loaded.name, 'New Name');
    assert.ok(loaded.updatedAt >= created.updatedAt);
    assert.equal(loaded.width, 2);
  });
});

describe('loadProject', () => {
  test('returns a record LayerStack.fromProjectRecord can reconstruct', async () => {
    const stack = new LayerStack(3, 3, 'white');
    stack.addLayer('B');
    stack.setActiveLayer(1);
    stack.getActiveLayer().engine.setPixel(1, 1, [9, 9, 9, 255]);
    const created = await createProject(stack, 'Layered');

    const loaded = await loadProject(created.id);
    const restored = LayerStack.fromProjectRecord(loaded);
    assert.equal(restored.getLayers().length, 2);
    assert.equal(restored.getActiveIndex(), 1);
    assert.deepEqual(restored.getActiveLayer().engine.getPixel(1, 1), [9, 9, 9, 255]);
  });
});

describe('listProjects', () => {
  test('orders by updatedAt, most recent first', async () => {
    const stackA = new LayerStack(2, 2, 'transparent');
    const a = await createProject(stackA, 'A');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const stackB = new LayerStack(2, 2, 'transparent');
    const b = await createProject(stackB, 'B');
    await new Promise((resolve) => setTimeout(resolve, 5));
    // Touch A again so it becomes the most recently updated.
    await saveProject(a.id, stackA);

    const all = await listProjects();
    assert.equal(all[0].id, a.id);
    assert.equal(all[1].id, b.id);
  });
});

describe('deleteProject', () => {
  test('removes the project so it no longer appears in listProjects', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const created = await createProject(stack, 'Gone soon');
    await deleteProject(created.id);
    const all = await listProjects();
    assert.ok(!all.some((p) => p.id === created.id));
    assert.equal(await loadProject(created.id), undefined);
  });
});
