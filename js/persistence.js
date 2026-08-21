// Dexie-backed project storage by default. DOM-free (thumbnail generation
// is the caller's job, via LayerStack.toPNGBlob() which needs a canvas —
// see design.md) so this module is directly unit-testable with Node's test
// runner using fake-indexeddb, unlike engine.js/layers.js's canvas-only
// methods.
//
// Loaded as a bare specifier ("dexie"): the browser resolves it via the
// import map in index.html (pointing at an ESM CDN build, no npm/bundler
// for the shipped app); Node resolves it from node_modules, installed here
// purely so `node --test` can run this module at all.
//
// Project CRUD (createProject/saveProject/loadProject/listProjects/
// deleteProject/renameProject) goes through `activeAdapter`, a pluggable
// storage adapter (see lib/storage-adapter.js) — defaulting to
// createDexieProjectAdapter(db) below, unchanged standalone behavior. A
// host embedding Pixi (see the embeddable-editor-api capability) can
// substitute its own adapter via _setStorageAdapter. customBrushes/
// colorPalettes CRUD stays direct Dexie, unaffected — out of scope per
// this change's design.md ("only project records are in scope for
// embedding today").

import Dexie from 'dexie';
import { createDexieProjectAdapter } from '../lib/storage-adapter.js';

// Exported (split-pixi-pro-repo): Color Library's palette CRUD moved to
// pixi-pro (js/pro/color-library-persistence.js), since Color Library
// itself is Pro-only - but the colorPalettes table's schema declaration
// below stays here, since Dexie's versioned-schema model has a single
// declaration point per database, not one that can cleanly split across
// files. Exporting `db` lets pixi-pro build its own table operations on
// the same shared local database instead of duplicating one.
export const db = new Dexie('pixi');
db.version(1).stores({
  projects: 'id, updatedAt',
});
// Dexie requires restating every store (not just the diff) in a new
// version block. customBrushes: user-created Brush-tool patterns,
// available across every project - see design.md on the userId field.
db.version(2).stores({
  projects: 'id, updatedAt',
  customBrushes: 'id, createdAt',
});
// colorPalettes: named, persisted collections of user-added colors (see
// 2f-color-library-panel's design.md) - one record per palette, its
// whole color list read/written together, same userId:null-reserved
// pattern as customBrushes.
db.version(3).stores({
  projects: 'id, updatedAt',
  customBrushes: 'id, createdAt',
  colorPalettes: 'id, name',
});

function generateId() {
  return crypto.randomUUID();
}

let activeAdapter = createDexieProjectAdapter(db);

// Per-id write queue. saveProject/renameProject do a load-modify-save
// round trip through the adapter interface (unlike the old direct
// db.projects.update(id, {...}), which was one atomic IndexedDB
// transaction) - so two concurrent, unawaited writers to the same project
// (exactly how workspace.js calls these: commit()'s autosave and
// renameCurrentProject() are both fire-and-forget) could otherwise race,
// with whichever save() lands second silently overwriting the other's
// field from a stale pre-write snapshot. Chaining each write behind the
// previous one for the same id guarantees every writer's load() sees the
// prior writer's completed result, restoring the same effective atomicity
// the old single-transaction update() had - regardless of which adapter
// is active, so this holds for a host-supplied adapter too.
const writeQueues = new Map();

function enqueueWrite(id, task) {
  const previous = writeQueues.get(id) ?? Promise.resolve();
  const settled = previous.then(task, task);
  // Track the queue by its settled state, not its resolved value, so a
  // rejected write doesn't permanently wedge later writes to the same id -
  // but don't let that suppression turn into a silently swallowed
  // rejection for the caller: `settled` (returned below) still carries it.
  writeQueues.set(id, settled.catch(() => {}));
  return settled;
}

/**
 * Substitutes the storage adapter used by every project CRUD function
 * below (create/save/load/list/delete/renameProject). Used by the
 * embeddable editor API (lib/pixi.js) to route a mounted instance's
 * persistence through a host-supplied adapter instead of IndexedDB, and
 * by tests to verify a non-Dexie adapter works through these same call
 * sites (pluggable-storage-adapter spec's "Host provides a custom
 * backend" scenario).
 */
export function _setStorageAdapter(adapter) {
  activeAdapter = adapter;
}

/** Test-only: restores the default Dexie-backed adapter. */
export function _resetStorageAdapter() {
  activeAdapter = createDexieProjectAdapter(db);
}

/**
 * Creates a new project record from a LayerStack and writes it immediately
 * — the record exists before any drawing happens, per the local-persistence
 * spec's "Project created alongside a new canvas" scenario.
 */
export async function createProject(layerStack, name = 'Untitled', thumbnail = null) {
  const now = Date.now();
  const record = {
    id: generateId(),
    name,
    ...layerStack.toProjectRecord(),
    thumbnail,
    createdAt: now,
    updatedAt: now,
  };
  await activeAdapter.save(record);
  return record;
}

/**
 * Updates an existing project's layer data (and thumbnail, if provided)
 * and bumps updatedAt. This is the auto-save write path — called from
 * workspace.js's commit(), the same point that already pushes an undo
 * snapshot after every completed action. A no-op if `id` doesn't exist
 * (matches Dexie's own `.update()` semantics: silently does nothing
 * rather than creating a new record), since the adapter interface's
 * `save()` is a full-record upsert and would otherwise create a
 * partial record from `updates` alone.
 */
export async function saveProject(id, layerStack, thumbnail = null) {
  return enqueueWrite(id, async () => {
    const existing = await activeAdapter.load(id);
    if (!existing) return;
    const merged = {
      ...existing,
      ...layerStack.toProjectRecord(),
      id,
      updatedAt: Date.now(),
    };
    if (thumbnail) merged.thumbnail = thumbnail;
    await activeAdapter.save(merged);
  });
}

/** Renames an existing project. No-op if `id` doesn't exist. */
export async function renameProject(id, name) {
  return enqueueWrite(id, async () => {
    const existing = await activeAdapter.load(id);
    if (!existing) return;
    await activeAdapter.save({ ...existing, name, updatedAt: Date.now() });
  });
}

/** Returns the raw stored record (or undefined), ready for LayerStack.fromProjectRecord(). */
export async function loadProject(id) {
  return activeAdapter.load(id);
}

/** All projects, most-recently-updated first — for the Gallery. */
export async function listProjects() {
  const all = await activeAdapter.list();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id) {
  return enqueueWrite(id, () => activeAdapter.delete(id));
}

/**
 * Creates a custom brush (from the Brush editor's grid) and writes it
 * immediately. `userId` is always null today - no auth exists yet (Phase 3
 * adds Supabase Auth, per openspec/roadmap.md); reserving the field now
 * means "owned by the signed-in user" later is a matter of setting it, not
 * a schema change.
 */
export async function createCustomBrush(name, width, height, pixels) {
  const record = {
    id: generateId(),
    name,
    width,
    height,
    pixels,
    userId: null,
    createdAt: Date.now(),
  };
  await db.customBrushes.put(record);
  return record;
}

/** Every custom brush, for merging into the Brush tool's picker alongside the built-ins. */
export async function listCustomBrushes() {
  return db.customBrushes.toArray();
}

export async function deleteCustomBrush(id) {
  await db.customBrushes.delete(id);
}

// createColorPalette/listColorPalettes/renameColorPalette/
// addColorToPalette/deleteColorPalette (Color Library's palette CRUD)
// moved to pixi-pro's js/pro/color-library-persistence.js
// (split-pixi-pro-repo), built on the `db` exported above - the
// colorPalettes table schema itself stays declared here (see that
// export's comment).

/** Test-only: empties the projects, customBrushes, and colorPalettes tables between test cases. */
export async function _clearAllForTests() {
  await db.projects.clear();
  await db.customBrushes.clear();
  await db.colorPalettes.clear();
}
