// Storage adapter interface for project records, plus two implementations:
// an IndexedDB/Dexie-backed one (the standalone app's default) and an
// in-memory one (for tests, and as a starting point for a host application
// that wants to supply its own backend when embedding — see
// pluggable-storage-adapter's spec and design.md's Decisions).
//
// A storage adapter is any object shaped like:
//   {
//     load(id)   -> Promise<record | undefined>
//     save(record) -> Promise<void>   // upsert: creates or overwrites by record.id
//     list()     -> Promise<record[]>  // every record, order not guaranteed
//     delete(id) -> Promise<void>      // no-op (does not throw) if id is missing
//   }
// `record` is whatever shape the caller stores — js/persistence.js uses
// this for project records (id, name, width, height, layers, thumbnail,
// createdAt, updatedAt). This module doesn't interpret record contents at
// all; it only keys on `record.id`.

/**
 * An in-memory adapter: no persistence beyond the current process. Useful
 * for tests, and as the simplest possible example of a host-supplied
 * adapter that doesn't touch IndexedDB at all.
 */
export function createInMemoryAdapter() {
  const records = new Map();
  return {
    async load(id) {
      return records.get(id);
    },
    async save(record) {
      records.set(record.id, record);
    },
    async list() {
      return [...records.values()];
    },
    async delete(id) {
      records.delete(id);
    },
  };
}

/**
 * The default adapter: backed by a Dexie table named 'projects' on the
 * given `db`. `db` is passed in (rather than imported directly) so this
 * module has no dependency on js/persistence.js's specific Dexie instance
 * or schema version history — it only assumes a `projects` table exists
 * with `id` as its primary key, which js/persistence.js's `db` already
 * declares.
 */
export function createDexieProjectAdapter(db) {
  return {
    async load(id) {
      return db.projects.get(id);
    },
    async save(record) {
      await db.projects.put(record);
    },
    async list() {
      return db.projects.toArray();
    },
    async delete(id) {
      await db.projects.delete(id);
    },
  };
}
