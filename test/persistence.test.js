import 'fake-indexeddb/auto';
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  renameProject,
  createCustomBrush,
  listCustomBrushes,
  deleteCustomBrush,
  _clearAllForTests,
  _setStorageAdapter,
  _resetStorageAdapter,
} from '../js/persistence.js';
import { LayerStack } from '../lib/pixel-engine/layers.js';
import { createInMemoryAdapter } from '../lib/storage-adapter.js';

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

  // Regression test: a mounted instance (lib/pixi.js, embeddable-
  // integration-api Phase 3) opens with no project record yet
  // (state.projectId is null until a host explicitly saves), so every
  // committed drawing action's auto-save calls saveProject(null, ...).
  // The doc comment above already promises "no-op if id doesn't exist";
  // a null/undefined id is definitionally nonexistent, but the Dexie
  // adapter's load() forwards it straight to Table.get(), which throws
  // ("Invalid argument to Table.get()") instead of resolving to
  // undefined — so this must be a no-op before it ever reaches the
  // adapter.
  test('is a no-op (does not throw) when id is null', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    await assert.doesNotReject(saveProject(null, stack));
  });

  test('is a no-op (does not throw) for an id that was never created', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    await assert.doesNotReject(saveProject('nonexistent-id', stack));
    assert.equal(await loadProject('nonexistent-id'), undefined);
  });

  // Regression test (found by code review): saveProject/renameProject do a
  // load-modify-save round trip through the adapter interface, unlike the
  // old direct db.projects.update(id, {...}) call, which was a single
  // atomic IndexedDB transaction. Two concurrent, unawaited writers to the
  // same project (exactly how js/workspace.js calls these - see commit()
  // and renameCurrentProject(), both fire-and-forget) could previously
  // race: whichever writer's save() landed second would overwrite the
  // other's field with its own stale pre-write snapshot. Writes to the
  // same id must be serialized so each writer always reads the other's
  // completed result first.
  test('a concurrent saveProject and renameProject on the same id do not clobber each other', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const created = await createProject(stack, 'Original');
    stack.getActiveLayer().engine.setPixel(0, 0, [1, 2, 3, 255]);

    // Fired together, unawaited relative to each other - exactly the
    // shape of workspace.js's fire-and-forget autoSave()/rename calls.
    await Promise.all([
      saveProject(created.id, stack),
      renameProject(created.id, 'Renamed'),
    ]);

    const loaded = await loadProject(created.id);
    assert.equal(loaded.name, 'Renamed');
    const restored = LayerStack.fromProjectRecord(loaded);
    assert.deepEqual(restored.getActiveLayer().engine.getPixel(0, 0), [1, 2, 3, 255]);
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

describe('createCustomBrush', () => {
  test('creates a record with id, name, dimensions, pixels, and a null userId', async () => {
    const pixels = [[0, 0], [1, 1]];
    const record = await createCustomBrush('My Brush', 2, 2, pixels);
    assert.ok(record.id);
    assert.equal(record.name, 'My Brush');
    assert.equal(record.width, 2);
    assert.equal(record.height, 2);
    assert.deepEqual(record.pixels, pixels);
    // Reserved for Phase 3 (Supabase Auth) ownership - unused today.
    assert.equal(record.userId, null);
    assert.ok(record.createdAt);
  });
});

describe('listCustomBrushes', () => {
  test('returns every created custom brush', async () => {
    await createCustomBrush('A', 2, 2, [[0, 0]]);
    await createCustomBrush('B', 3, 3, [[1, 1]]);
    const all = await listCustomBrushes();
    assert.equal(all.length, 2);
    assert.ok(all.some((b) => b.name === 'A'));
    assert.ok(all.some((b) => b.name === 'B'));
  });
});

describe('deleteCustomBrush', () => {
  test('removes it so it no longer appears in listCustomBrushes', async () => {
    const created = await createCustomBrush('Gone soon', 2, 2, [[0, 0]]);
    await deleteCustomBrush(created.id);
    const all = await listCustomBrushes();
    assert.ok(!all.some((b) => b.id === created.id));
  });
});

// createColorPalette/listColorPalettes/renameColorPalette/
// addColorToPalette/deleteColorPalette (Color Library's palette CRUD)
// moved to pixi-pro (split-pixi-pro-repo) - see that repo's
// test/color-library-persistence.test.js for their coverage.

describe('storage adapter substitution', () => {
  // Proves pluggable-storage-adapter's "Host provides a custom backend"
  // scenario: the same public call sites (createProject/saveProject/
  // loadProject/listProjects/deleteProject/renameProject) work identically
  // against a non-Dexie adapter, with no IndexedDB writes occurring.
  afterEach(() => {
    _resetStorageAdapter();
  });

  test('project CRUD works through an in-memory adapter, and IndexedDB stays empty', async () => {
    _setStorageAdapter(createInMemoryAdapter());

    const stack = new LayerStack(2, 2, 'transparent');
    const created = await createProject(stack, 'In-memory project');
    assert.ok(created.id);

    stack.getActiveLayer().engine.setPixel(0, 0, [9, 8, 7, 255]);
    await saveProject(created.id, stack);

    const loaded = await loadProject(created.id);
    assert.equal(loaded.name, 'In-memory project');
    const restored = LayerStack.fromProjectRecord(loaded);
    assert.deepEqual(restored.getActiveLayer().engine.getPixel(0, 0), [9, 8, 7, 255]);

    await renameProject(created.id, 'Renamed in-memory project');
    assert.equal((await loadProject(created.id)).name, 'Renamed in-memory project');

    const all = await listProjects();
    assert.equal(all.length, 1);

    await deleteProject(created.id);
    assert.equal(await loadProject(created.id), undefined);

    // The Dexie-backed 'pixi' database (still the active adapter's target
    // in every other test in this file) never saw this project.
    _resetStorageAdapter();
    assert.equal(await loadProject(created.id), undefined);
    assert.equal((await listProjects()).length, 0);
  });

  // Regression test (found by code review while starting Phase 3):
  // enqueueWrite's queued task used to read the module-level
  // activeAdapter binding at execution time, not at the time the write
  // was requested - so a mid-flight _setStorageAdapter swap (the
  // documented mechanism for a host to supply its own backend) could
  // redirect an already-queued write to the wrong adapter.
  test('a write enqueued before an adapter swap still lands on the adapter that was active when it was requested', async () => {
    const stack = new LayerStack(2, 2, 'transparent');
    const created = await createProject(stack, 'Original'); // via the default (Dexie) adapter

    stack.getActiveLayer().engine.setPixel(0, 0, [1, 2, 3, 255]);
    // saveProject's task is enqueued but hasn't run yet (enqueueWrite only
    // chains a microtask) - swap adapters before it gets a chance to.
    const savePromise = saveProject(created.id, stack);
    _setStorageAdapter(createInMemoryAdapter());
    await savePromise;

    _resetStorageAdapter();
    const loaded = await loadProject(created.id);
    const restored = LayerStack.fromProjectRecord(loaded);
    assert.deepEqual(
      restored.getActiveLayer().engine.getPixel(0, 0),
      [1, 2, 3, 255],
      'the write should have landed on the Dexie adapter active when saveProject was called, not the adapter swapped in afterward'
    );
  });

  // Regression test (CFIX-1, found by the code-standards red-team):
  // _clearAllForTests() used to call db.projects.clear() directly,
  // bypassing whichever adapter was active. With a non-Dexie adapter
  // active, that would silently clear the wrong store, leaving a
  // Dexie-backed project untouched when the caller expected everything
  // cleared - or, as tested here, wiping a Dexie project that a
  // *different* adapter's caller had no way to know still existed.
  test('_clearAllForTests only clears the active adapter\'s projects, not a Dexie project stored while a different adapter was active', async () => {
    // A project created while the default (Dexie) adapter is active.
    const dexieStack = new LayerStack(2, 2, 'transparent');
    const dexieProject = await createProject(dexieStack, 'Dexie project');

    // Switch to an in-memory adapter and create a second project there.
    _setStorageAdapter(createInMemoryAdapter());
    const memoryStack = new LayerStack(2, 2, 'transparent');
    const memoryProject = await createProject(memoryStack, 'In-memory project');

    // Clearing while the in-memory adapter is active must only clear the
    // in-memory store.
    await _clearAllForTests();
    assert.equal(await loadProject(memoryProject.id), undefined);

    // The Dexie project, unrelated to the currently-active adapter, must
    // still be there.
    _resetStorageAdapter();
    const stillThere = await loadProject(dexieProject.id);
    assert.ok(stillThere, 'Dexie project should not have been cleared by a call made while a different adapter was active');
  });
});
