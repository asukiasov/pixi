import 'fake-indexeddb/auto';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { createInMemoryAdapter, createDexieProjectAdapter } from './storage-adapter.js';

/**
 * The same behavior contract, run against every adapter implementation —
 * proves the pluggable-storage-adapter spec's "Two adapters satisfy the
 * same call sites" scenario: callers get identical results regardless of
 * which adapter is active.
 */
function adapterContractTests(name, createAdapter) {
  describe(`${name} (storage adapter contract)`, () => {
    test('load() on an empty store returns undefined', async () => {
      const adapter = createAdapter();
      assert.equal(await adapter.load('missing'), undefined);
    });

    test('save() then load() round-trips the record', async () => {
      const adapter = createAdapter();
      const record = { id: 'a', name: 'Untitled', width: 4, height: 4, updatedAt: 1 };
      await adapter.save(record);
      assert.deepEqual(await adapter.load('a'), record);
    });

    test('save() upserts: a second save with the same id overwrites it', async () => {
      const adapter = createAdapter();
      await adapter.save({ id: 'a', name: 'First', updatedAt: 1 });
      await adapter.save({ id: 'a', name: 'Second', updatedAt: 2 });
      const loaded = await adapter.load('a');
      assert.equal(loaded.name, 'Second');
    });

    test('list() returns every saved record', async () => {
      const adapter = createAdapter();
      await adapter.save({ id: 'a', name: 'A', updatedAt: 1 });
      await adapter.save({ id: 'b', name: 'B', updatedAt: 2 });
      const all = await adapter.list();
      assert.equal(all.length, 2);
      assert.ok(all.some((r) => r.id === 'a'));
      assert.ok(all.some((r) => r.id === 'b'));
    });

    test('delete() removes the record so load() and list() no longer see it', async () => {
      const adapter = createAdapter();
      await adapter.save({ id: 'a', name: 'Gone soon', updatedAt: 1 });
      await adapter.delete('a');
      assert.equal(await adapter.load('a'), undefined);
      const all = await adapter.list();
      assert.ok(!all.some((r) => r.id === 'a'));
    });

    test('delete() on a missing id does not throw', async () => {
      const adapter = createAdapter();
      await assert.doesNotReject(() => adapter.delete('never-existed'));
    });
  });
}

adapterContractTests('createInMemoryAdapter', () => createInMemoryAdapter());

adapterContractTests('createDexieProjectAdapter', () => {
  // A fresh, uniquely-named in-memory Dexie database per test, so the
  // contract tests don't share state with each other or with the app's
  // own 'pixi' database used elsewhere.
  const db = new Dexie(`storage-adapter-test-${Math.random()}`);
  db.version(1).stores({ projects: 'id, updatedAt' });
  return createDexieProjectAdapter(db);
});
