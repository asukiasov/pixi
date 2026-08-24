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
// is active, so this holds for a host-supplied adapter too. Doesn't cover
// the `thumbnail` argument's *ordering*, though: it's captured by the
// caller (via LayerStack.toPNGBlob()) before saveProject is even called,
// so two rapid commits can still enqueue their thumbnails out of
// chronological order if the later commit's toPNGBlob() happens to
// resolve first - pre-existing nondeterminism (see workspace.js's own
// autoSave() comment), not something this queue fixes.
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

/**
 * Restores the default Dexie-backed adapter. Used by tests to reset
 * `activeAdapter` between cases, and by `lib/pixi.js`'s `destroy()` - a
 * real production consumer, same as `_setStorageAdapter` above - so a
 * mounted instance's `options.storage` adapter can't outlive the instance
 * and leak into a later `mount()` call or the standalone app sharing the
 * same page.
 */
export function _resetStorageAdapter() {
  activeAdapter = createDexieProjectAdapter(db);
}

/**
 * Returns whichever adapter is active right now. Exists so a caller that's
 * about to do its own async work *before* calling saveProject() (e.g.
 * workspace.js's autoSave(), which awaits LayerStack.toPNGBlob() first) can
 * pin down "the adapter in effect when this write was requested" up front
 * and pass it into saveProject()'s `adapter` param - the same
 * capture-before-the-gap shape as the `const adapter = activeAdapter;`
 * lines already in this file, just moved to before an async gap that lives
 * outside this module instead of before `enqueueWrite`.
 *
 * Without this, a `destroy()` (or any other `_setStorageAdapter`/
 * `_resetStorageAdapter` call) landing while that caller's own async step
 * is still in flight would have saveProject() read the *post-swap*
 * `activeAdapter` when it's finally invoked - silently rerouting a write
 * the caller began under one adapter to a different one.
 */
export function _activeAdapter() {
  return activeAdapter;
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
 * Creates a project record under a caller-supplied `id` instead of one
 * generated internally (contrast `createProject`, whose `generateId()`
 * call the caller has no say over). Used by `lib/pixi.js`'s `mount()`
 * (embeddable-integration-api task 3.9): a mounted instance generates its
 * own id up front (`crypto.randomUUID()`, same generation
 * `lib/pixel-engine/layers.js`'s `Layer` already uses) so it can hand that
 * id to `js/workspace.js`'s `initWorkspace()` synchronously, then fire this
 * function in the background to actually create the record - without a
 * real record to write into, every subsequent `saveProject(id, ...)` call
 * from that instance's autoSave() would silently no-op forever (see that
 * function's doc comment), regardless of which adapter is active.
 *
 * Goes through the same per-id write queue (`enqueueWrite`) as
 * `saveProject`/`renameProject`/`deleteProject`, so a `saveProject()` call
 * for the same id enqueued right after this one - the earliest a mounted
 * instance's first autoSave can happen, since it requires a user draw
 * action strictly after `mount()` returns - is guaranteed to see this
 * record already exist by the time it actually runs, regardless of which
 * call's own Promise settles first (ordering follows *enqueue* order, not
 * *settlement* order).
 */
export async function createProjectWithId(id, layerStack, name = 'Untitled', thumbnail = null) {
  const adapter = activeAdapter; // see saveProject's comment on why this is captured here
  return enqueueWrite(id, async () => {
    const now = Date.now();
    const record = {
      id,
      name,
      ...layerStack.toProjectRecord(),
      thumbnail,
      createdAt: now,
      updatedAt: now,
    };
    await adapter.save(record);
    return record;
  });
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
 *
 * `adapter` defaults to whatever's active *when this function is called*
 * (same as every other CRUD function here), which is correct for callers
 * that invoke saveProject() synchronously after deciding to save. It's an
 * explicit param, not always read fresh from module state, because a
 * caller that does its own async work *before* calling saveProject() (e.g.
 * workspace.js's autoSave(), which awaits LayerStack.toPNGBlob() first)
 * needs to pin down the adapter *before* that gap via `_activeAdapter()`
 * and pass it in - otherwise a `destroy()`/`_setStorageAdapter()` call
 * landing during that caller's own await would have this default
 * parameter resolve to the *post-swap* adapter instead, silently
 * rerouting the write (see `_activeAdapter()`'s doc comment).
 */
export async function saveProject(id, layerStack, thumbnail = null, adapter = activeAdapter) {
  // A null/undefined id (a mounted instance with no project record yet —
  // see lib/pixi.js — auto-saves against one until a host explicitly
  // creates/saves one) is definitionally nonexistent, same as this
  // function's documented no-op case below, but must be caught before the
  // adapter: the Dexie adapter's load() forwards id straight to
  // Table.get(), which throws on null/undefined instead of resolving to
  // undefined the way a merely-unknown id does.
  if (id == null) return;
  // `adapter` above is already captured (either by the caller via
  // `_activeAdapter()`, or by this default parameter) before this queued
  // task runs - not read inside the task itself. Same reasoning as
  // createProjectWithId/renameProject/deleteProject: the task may sit
  // queued behind an earlier write for the same id and not actually run
  // until later, so reading module-level `activeAdapter` at *execution*
  // time would silently write to whichever adapter is active *then*.
  return enqueueWrite(id, async () => {
    const existing = await adapter.load(id);
    if (!existing) return;
    const merged = {
      ...existing,
      ...layerStack.toProjectRecord(),
      id,
      updatedAt: Date.now(),
    };
    if (thumbnail) merged.thumbnail = thumbnail;
    await adapter.save(merged);
  });
}

/** Renames an existing project. No-op if `id` doesn't exist. */
export async function renameProject(id, name) {
  const adapter = activeAdapter; // see saveProject's comment on why this is captured here
  return enqueueWrite(id, async () => {
    const existing = await adapter.load(id);
    if (!existing) return;
    await adapter.save({ ...existing, name, updatedAt: Date.now() });
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
  const adapter = activeAdapter; // see saveProject's comment on why this is captured here
  return enqueueWrite(id, () => adapter.delete(id));
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

/**
 * Creates a named palette (optionally seeded with colors) and writes it
 * immediately. `userId` is always null today, same reserved-for-Phase-3
 * pattern as createCustomBrush. `isDefault` marks the one auto-created,
 * built-in "Material" palette (see js/color-library-ui.js's
 * loadColorPalettes) - the UI refuses to delete it regardless of how
 * many other palettes exist, so there's always at least one populated
 * palette to fall back to. Every user-created palette leaves this false.
 */
export async function createColorPalette(name, colors = [], isDefault = false) {
  const now = Date.now();
  const record = {
    id: generateId(),
    name,
    colors,
    isDefault,
    userId: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.colorPalettes.put(record);
  return record;
}

/** Every palette, for the Color Library panel's dropdown + swatch grid. */
export async function listColorPalettes() {
  return db.colorPalettes.toArray();
}

export async function renameColorPalette(id, name) {
  await db.colorPalettes.update(id, { name, updatedAt: Date.now() });
}

/** Appends `hex` to the palette's color list (no de-duplication - the same color can be added twice if the user wants). */
export async function addColorToPalette(id, hex) {
  const record = await db.colorPalettes.get(id);
  if (!record) return;
  await db.colorPalettes.update(id, { colors: [...record.colors, hex], updatedAt: Date.now() });
}

export async function deleteColorPalette(id) {
  await db.colorPalettes.delete(id);
}

/**
 * Test-only: empties projects (via the active adapter, not a direct Dexie
 * call — CFIX-1, found by the code-standards red-team: calling
 * `db.projects.clear()` directly bypassed whichever adapter was active,
 * so a non-Dexie adapter's records survived a "clear everything" call
 * while an unrelated Dexie-backed project silently got wiped), plus
 * customBrushes and colorPalettes (still direct Dexie — out of adapter
 * scope, same as everywhere else in this file).
 */
export async function _clearAllForTests() {
  const records = await activeAdapter.list();
  await Promise.all(records.map((record) => activeAdapter.delete(record.id)));
  await db.customBrushes.clear();
  await db.colorPalettes.clear();
}
