## Context

See proposal.md for motivation. Building on 2a's `js/layers.js`
(`LayerStack`/`Layer`, each layer wrapping a `PixelEngine`), `js/undo.js`
(generic snapshot stack), and the existing screen-router pattern in
`js/app.js` (New Canvas ⇄ Workspace). No persisted data exists yet from any
earlier phase, so there's no migration to design for.

## Goals / Non-Goals

**Goals:**
- Projects survive closing the tab, with zero explicit save action.
- Gallery as a real home screen: see, resume, or start work at a glance.
- Keep the no-bundler, no-npm constraint — Dexie loads from a CDN like
  Supabase's SDK does (`docs/supabase-database.md`).

**Non-Goals:**
- Cross-device sync (that's Phase 3, Supabase).
- Undo/redo history surviving a reload — only the saved pixel/layer state
  persists; the in-memory undo stack resets like it already does today on
  any new `initWorkspace` call.
- A dedicated crop tool, project rename from the Gallery grid, multi-select/
  bulk actions, or Gallery sorting/search beyond recency.

## Decisions

**Dexie via CDN ES module**, matching `docs/supabase-database.md`'s
approach for `@supabase/supabase-js`:

```js
import Dexie from 'https://esm.sh/dexie@4';

const db = new Dexie('pixi');
db.version(1).stores({
  projects: 'id, updatedAt', // primary key id, indexed on updatedAt for Gallery ordering
});
```

**Project record shape** (one Dexie object per project):

```js
{
  id,                // uuid, generated client-side (same one LayerStack could adopt)
  name,              // string, defaults to e.g. "Untitled"
  width, height,
  layers: [
    { id, name, data /* ArrayBuffer, raw RGBA */, visible, opacity, blendMode },
    ...
  ],
  activeLayerIndex,
  thumbnail,         // Blob (PNG), from LayerStack.toPNGBlob() at full res —
                      // small enough at ≤256x256 that a separate downscale
                      // step isn't worth it; the Gallery grid scales it down
                      // via CSS
  createdAt, updatedAt, // epoch ms
}
```

Layer pixel data is stored as a raw `ArrayBuffer` (a copy of
`layer.engine.data.buffer`), not a PNG — IndexedDB/Dexie stores
ArrayBuffers natively via structured clone, so this avoids PNG encode/decode
on every single auto-save (only the thumbnail gets PNG-encoded, once per
save). Decode-free load, too: reading a project just wraps each stored
buffer back into a `Uint8ClampedArray` for a `PixelEngine`.

**`LayerStack` gains `toProjectRecord()` / `LayerStack.fromProjectRecord()`**
(static), living in `js/layers.js` since that's where the buffer layout is
already owned. `js/persistence.js` calls these; it doesn't know about
`Uint8ClampedArray`/`PixelEngine` internals itself.

**Revised during implementation**: `persistence.js`'s `createProject`/
`saveProject` take the thumbnail `Blob` as a parameter rather than calling
`layerStack.toPNGBlob()` themselves. `toPNGBlob()` needs a `<canvas>`, and
having `persistence.js` call it directly would make the whole module
DOM-dependent and untestable in Node — the caller (`workspace.js`, browser-
only) computes the thumbnail and passes it in, keeping `persistence.js`
exactly as DOM-free and unit-testable as `engine.js`/`layers.js`'s
non-canvas methods.

**Auto-save hooks into the existing `commit()` in `js/workspace.js`** — the
function that already pushes an undo snapshot after every completed stroke,
fill, layer change, or (new in this slice) canvas resize/rotate. Save is
literally "also write `layerStack.toProjectRecord()` to Dexie," same
trigger point, so no new granularity concept is introduced. This makes the
"save after every committed action, not per-pixel" requirement automatic
rather than something to separately get right.

**Screen flow becomes Gallery → New Canvas → Workspace → (back to)
Gallery**, replacing Phase 1/2a's New Canvas → Workspace → (back to) New
Canvas. `js/app.js`'s router grows a third screen. The Workspace's existing
"New" button is relabeled to go to Gallery instead, and per the modified
`canvas-creation` requirement, drops its confirm dialog (auto-save makes it
unnecessary) — the Gallery's own delete action keeps a confirm, since
deletion is the one truly destructive action left.

**Canvas settings (resize/rotate) operates on the `LayerStack` directly**:
new `LayerStack` methods `resize(width, height)` (top-left anchored,
crop-or-pad every layer's `PixelEngine` buffer into a freshly sized one) and
`rotate90(direction)` (same, swapping width/height when not square). Both
route through the same `commit()`/auto-save/undo path as any other layer
mutation — no special-casing needed in `workspace.js` beyond calling these
and then `commit()`.

**Testing IndexedDB in Node**: `node --test` has no IndexedDB. Using
`fake-indexeddb` (a well-established, dependency-free polyfill) as a
**test-only** dependency — the app itself still only loads Dexie via CDN, no
new runtime dependency. This is the project's first test-only npm package;
flagging it explicitly since every earlier slice managed with zero added
dependencies.

## Risks / Trade-offs

- [Auto-save with no manual "Save" affordance means a user can't
  distinguish "saved" from "saving" from "not yet saved"] → Out of scope to
  fully solve (a save-status indicator) in this slice; each auto-save is
  synchronous-enough at these data sizes that the window is negligible.
  Revisit if it's a real problem once used more.
- [Storing full per-layer ArrayBuffers uncompressed could add up across many
  projects] → Acceptable at ≤256×256×4 bytes × ≤8 layers per project; no
  compression in this slice. IndexedDB storage quotas are typically large
  (hundreds of MB+) relative to this.
- [`fake-indexeddb` is a new dependency, even if test-only] → Necessary:
  there's no way to unit-test real IndexedDB-backed logic in Node otherwise,
  and hand-rolling a fake would be more code and less trustworthy than an
  established polyfill.

## Testing

- `js/layers.js`'s `toProjectRecord()`/`fromProjectRecord()` round-trip
  stays DOM-free, tested with `node --test` like the rest of `layers.js`.
- `js/persistence.js` (Dexie-backed CRUD, auto-save write path) tested with
  `node --test` using `fake-indexeddb` to provide `indexedDB` in Node.
- `LayerStack.resize()`/`rotate90()` are DOM-free pixel-buffer operations,
  tested the same way as `engine.js`'s methods.
- Playwright smoke pass (as used for 2a): create a project, draw, reload the
  page, confirm it reappears via Gallery with the drawing intact; open a
  second project and confirm no cross-contamination; delete a project and
  confirm it's gone; resize and rotate a canvas and confirm layer content
  transforms correctly.
