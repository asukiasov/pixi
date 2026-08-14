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

/** Test-only: empties the projects table between test cases. */
export async function _clearAllForTests() {
  await db.projects.clear();
}
