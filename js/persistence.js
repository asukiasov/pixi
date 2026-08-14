// Dexie-backed project storage. DOM-free (thumbnail generation is the
// caller's job, via LayerStack.toPNGBlob() which needs a canvas — see
// design.md) so this module is directly unit-testable with Node's test
// runner using fake-indexeddb, unlike engine.js/layers.js's canvas-only
// methods.
//
// Loaded as a bare specifier ("dexie"): the browser resolves it via the
// import map in index.html (pointing at an ESM CDN build, no npm/bundler
// for the shipped app); Node resolves it from node_modules, installed here
// purely so `node --test` can run this module at all.

import Dexie from 'dexie';

const db = new Dexie('pixi');
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

function generateId() {
  return crypto.randomUUID();
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
  await db.projects.put(record);
  return record;
}

/**
 * Updates an existing project's layer data (and thumbnail, if provided)
 * and bumps updatedAt. This is the auto-save write path — called from
 * workspace.js's commit(), the same point that already pushes an undo
 * snapshot after every completed action.
 */
export async function saveProject(id, layerStack, thumbnail = null) {
  const updates = {
    ...layerStack.toProjectRecord(),
    updatedAt: Date.now(),
  };
  if (thumbnail) updates.thumbnail = thumbnail;
  await db.projects.update(id, updates);
}

/** Renames an existing project. */
export async function renameProject(id, name) {
  await db.projects.update(id, { name, updatedAt: Date.now() });
}

/** Returns the raw stored record (or undefined), ready for LayerStack.fromProjectRecord(). */
export async function loadProject(id) {
  return db.projects.get(id);
}

/** All projects, most-recently-updated first — for the Gallery. */
export async function listProjects() {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function deleteProject(id) {
  await db.projects.delete(id);
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

/** Test-only: empties the projects and customBrushes tables between test cases. */
export async function _clearAllForTests() {
  await db.projects.clear();
  await db.customBrushes.clear();
}
