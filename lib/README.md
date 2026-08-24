# Mount API

Pixi's embeddable editor — `Pixi.mount(hostElement, options)` drops a full
Workspace screen (drawing tools, undo/redo, export) into a container element
on a host page, without the standalone app's Gallery/routing shell around it.
This folder is self-contained the same way `lib/pixel-engine/` is: everything
you need to use it is on this page. Last verified against commit
[`706e975`](https://github.com/asukiasov/pixi/commit/706e97521be7784d6cfd73e29b76d14da4b5ff0c)
(31 commits after tag `v0.3.0`, not yet re-tagged).

## Embedding checklist

For a narrow embed inside another product (an avatar picker, a modal, any
use that isn't "reuse the whole Workspace as-is") — the decisions below
are the ones that actually differ from the standalone app's own defaults.
Each links to the section with the full explanation; nothing here
duplicates it.

1. **Serve it, don't bundle it.** No `npm install` — serve Pixi's file
   tree as static assets and import `lib/pixi.js` by URL. See
   [No bundler support](#no-bundler-support).
2. **One instance at a time, page-wide.** `destroy()` the previous
   instance before mounting a new one (reopening an editor, switching
   profiles). See [Single active instance](#single-active-instance).
3. **Always `destroy()` before the host element goes away.** Removing
   `hostElement` from the DOM yourself (a React/Vue component unmounting)
   without calling `instance.destroy()` first leaves stale document-level
   state behind. See [`instance.destroy()`](#instancedestroy).
4. **Pick a storage adapter deliberately.** The default autosaves into
   your host page's own IndexedDB, indistinguishable from a real saved
   project — pass `createInMemoryAdapter()` if the embed shouldn't leave
   projects behind. See [`options.storage`](#optionsstorage).
5. **Scope `style.css` yourself.** It's unprefixed global CSS; an iframe
   or your own scoping step is required to avoid collisions with your
   host site's styles. See [Style scoping](#style-scoping).
6. **Crop/mask is on you.** The canvas is always a square PNG — circular
   or masked presentation (e.g. avatars) is applied host-side after
   export. See the canvas-shape paragraph in
   [`Pixi.mount(hostElement, options)`](#piximounthostelement-options).
7. **Most chrome isn't configurable.** Only the Gallery button and the
   tool sidebar have an opt-out — everything else in the Workspace topbar
   is fixed. See [`options.ui`](#optionsui).
8. **Pin against drift.** There's no semver yet — pin your copy to the
   commit named in [Stability](#stability) (or the nearest tag at/before
   it) rather than tracking `main`.

**Full mount, or just the data model?** If you need the actual drawing
UI, `Pixi.mount()` (this file) is what you want. If your host already
owns its own canvas rendering and pointer handling and only needs pixel
data — layers, compositing, undo — see
[`lib/pixel-engine/`](pixel-engine/README.md) instead; it ships no UI at
all, so going that route means building your own tool state machine and
input handling on top of it. There's no documented sizing/performance
guidance for a lightweight embed (a mobile modal, many concurrent
instances on one page) either way — if that's a concern for your use
case, `lib/pixel-engine/` alone is the lighter-weight option, since it
never mounts the Workspace UI at all.

### Stability

There's no semver commitment on this API yet — no `CHANGELOG`, no published
version number distinct from the repo's own git tags. Treat the "last
verified against commit" line above as the actual contract: if you need
certainty a future commit won't change `mount()`'s behavior out from under
you, pin your copy of the repo to that commit (or the nearest tag at/before
it) rather than tracking `main`.

### License

MIT, matching the repo root [`LICENSE`](../LICENSE). See
[Known limitations](#known-limitations) below for exactly what that
permits, and how it differs from Pixi Pro.

### Get it

`lib/pixi.js` imports from `lib/pixel-engine/`, `js/canvas-view.js`,
`js/workspace.js`, and `js/persistence.js` — a mounted instance is the
standalone app's Workspace screen reused, not a rewrite, so it needs those
files in place with their existing relative paths. The simplest way to get a
working copy is what the worked example below does: clone or copy the whole
Pixi repo and serve it as static files (`python3 -m http.server 8000`, no
build step — see the repo root [`README.md`](../README.md#quick-start)) and
import `lib/pixi.js` from a page anywhere under that served root. If your
host is a monorepo and copying the whole Pixi repo isn't practical,
`lib/pixi.js`'s actual dependency set is smaller than that: `lib/pixel-engine/`,
`js/canvas-view.js`, `js/workspace.js`, `js/persistence.js`, `style.css`, and
whatever those files import in turn — copying just that subtree, with
relative paths preserved, works the same way.

### No bundler support

This is a deliberate project-wide stance (see the repo root `CLAUDE.md`'s
non-goals), not a gap waiting to be filled: `lib/pixi.js` and everything it
imports are plain ES modules loaded via relative paths and an import map,
not an npm package. If your host app is built with webpack/Vite/etc., the
practical path is serving Pixi's file tree as static assets alongside your
build output and importing `lib/pixi.js` by URL, the same way
`pixi-embed-example.html` does — not `npm install`-ing it into your bundle.

## Worked example

[`lib/pixi-embed-example.html`](pixi-embed-example.html) is a complete,
real host page exercising this API end to end: mount → `loadImage()` a
sample PNG → draw → `getImage()` → `destroy()`, with the `'change'`/`'error'`
events wired to a visible status line. Read it alongside this doc rather than
inventing your own from scratch — its own comments explain the choices (e.g.
why it uses the default Dexie-backed adapter instead of `options.storage`,
why it revokes the previous object URL on every "Get Image" click). Serve the
repo root and open `/lib/pixi-embed-example.html` — the ES module imports
need `http(s)`, not `file://`.

## `Pixi.mount(hostElement, options)`

Mounts a Workspace editor into `hostElement`, replacing its contents, and
returns an instance:

```js
import { Pixi } from './lib/pixi.js';

const instance = Pixi.mount(document.getElementById('pixi-host'), {
  width: 32,       // default 32 — matches New Canvas's own default preset
  height: 32,
  name: 'Untitled', // project name persisted alongside the record
});
```

The canvas is always a square pixel grid, `width` × `height` in whole
pixels, with `1`–`256` a hard ceiling on each (matches the `min`/`max` on
the standalone app's own custom-size inputs) — there's no forced aspect
ratio, but there's also no path to a canvas larger than 256×256 today. If
your use case (e.g. avatars) wants a circular/cropped presentation, that's
a host-side concern layered on top of the exported square PNG — `mount()`
has no crop/mask option of its own.

### Single active instance

**Exactly one instance (mounted or the standalone app) can be active on the
whole page at a time** — not one per host element. Mounting a second
instance into a different container while the first is still active isn't
supported; `destroy()` the first one first. This is inherited from
`js/workspace.js`'s own single-active-instance design, not a new limitation
`mount()` introduces. Re-mounting into the same or a different host element
after `destroy()` is fully supported.

The touch/pen/mouse input itself is unified — `mount()` reuses the same
`CanvasView` the standalone app uses, which binds Pointer Events (not
separate mouse/touch handlers), including two-finger pan/pinch for the Hand
tool. No separate mobile setup is needed.

`hostElement` gets no layout contract beyond "an element to replace the
contents of" — `mount()` doesn't read or enforce a size on it, and the
mounted editor doesn't listen for host-element resize events. Give it
whatever CSS sizing you want; the editor's own internal layout (toolbar,
canvas, side panels) is what actually determines its rendered footprint,
not `hostElement`'s box.

### Style scoping

Your host page must also load Pixi's stylesheet (`<link rel="stylesheet"
href=".../style.css">`) — `mount()` does not inject it, since you may want to
scope or bundle it differently — and the same Material Symbols icon font
`index.html` uses, for the tool/undo/redo icons to render (see the worked
example's `<head>` for both). **`style.css` is not scoped or prefixed** — it
uses ordinary global selectors (`:root`, `*`, `body`, etc.), the same as the
standalone app's own page. Loading it into a host page with other global
styles can collide either direction; wrapping `hostElement` in an iframe,
or scoping `style.css` yourself (a CSS layer, a build-time prefixer) before
you load it, is on you today — `mount()` doesn't do either for you.

**If the Material Symbols font fails to load** (blocked network, ad
blocker, forgotten `<link>`), the standalone app degrades gracefully: `js/app.js`
calls `js/icon-font-fallback.js`'s `initIconFontFallback()`, which detects the
failure and hides the raw ligature text (`style.css`'s `.icon-font-failed`
rule) so tool buttons stay usable via their `aria-label`/tooltip instead of
showing garbled text. **`mount()` doesn't call this** — it only imports
`canvas-view.js`/`workspace.js`/`persistence.js`, not `app.js` — so a mounted
instance without the font shows the raw, un-hidden ligature text instead. To
get the same graceful degradation, import and call `initIconFontFallback()`
from `js/icon-font-fallback.js` yourself.

### `instance.destroy()`

Unmounts the editor and empties `hostElement` back out. Calling it twice is
a harmless no-op. Every other instance method throws if called after
`destroy()`.

**Call this before removing `hostElement` from the DOM yourself** — e.g. a
React/Vue component unmounting its container. `mount()` reuses
`js/workspace.js`'s module-level `root` reference and several
`document`-level event listeners (keyboard shortcuts and similar); nothing
repoints or tears these down except `destroy()` itself running. Removing the
host element without calling it first leaves `root` pointing at a detached
node and those listeners still bound for the rest of the page's lifetime.

### `instance.loadImage(pngBlobOrImageData)`

Replaces the mounted canvas's content with a PNG `Blob` or an `ImageData`
(or `ImageData`-shaped `{ data: Uint8ClampedArray, width, height }`),
resizing the canvas to match the image's own dimensions. This is the
mounted equivalent of opening a New Canvas from an existing image, not an
in-place edit of whatever was already there — it resets the undo stack and
every tool/color/panel selection to a fresh baseline, the same as opening a
different project in the standalone app.

```js
const response = await fetch('/sprite.png');
await instance.loadImage(await response.blob());
```

Two overlapping `loadImage()` calls are not synchronized — await one before
starting the next (e.g. from a file picker's `change` handler), the same
assumption the standalone app's own image-import flow already makes.

### `instance.getImage({ format })`

Reads the mounted canvas's current composited content back out, independent
of the in-canvas Export panel. `format` (default `'png'`) selects the return
shape:

| `format` | Returns |
|---|---|
| `'png'` (default) | `Promise<Blob>` — native-resolution PNG |
| `'base64'` | `Promise<string>` — the same PNG as a `data:image/png;base64,...` URL |
| `'imagedata'` | `Promise<ImageData>` — the same PNG decoded back to pixels |

All three round-trip through the same PNG encode, so they're guaranteed to
reflect identical pixels — this isn't three independently-behaving export
paths. Anything outside those three values throws a `TypeError`. Only PNG is
available here; WebP/JPG export stays the in-canvas Export panel's own
surface (scale and multi-format encoding aren't re-exposed through
`getImage()`).

```js
const blob = await instance.getImage();               // PNG Blob
const dataUrl = await instance.getImage({ format: 'base64' });
const pixels = await instance.getImage({ format: 'imagedata' });
```

### `instance.on(event, handler)`

Registers `handler` on `event`. Multiple handlers on the same event are all
called, in registration order; there's no `off()` — a torn-down instance
simply stops invoking registered handlers, since `destroy()` tears down the
whole thing.

- **`'change'`** — fired on every committed drawing action (a completed
  stroke, a fill, an undo/redo — anything that already triggers auto-save).
  Use this to know when the mounted canvas's persisted state has moved.
- **`'error'`** — fired if the instance's own initial project-record creation
  fails (e.g. a host-supplied `options.storage.save()` throws). This is your
  only signal for that failure, since without it every subsequent edit would
  silently fail to persist for the rest of the instance's lifetime. The
  instance itself stays otherwise fully usable after this — `loadImage()`,
  `getImage()`, `save()`, `cancel()`, and `destroy()` all keep working
  normally, so `save()`/`getImage()` are still a reliable way to get pixels
  out even though autosave is permanently dead for this instance. There's no
  retry method; the only recovery path is `destroy()` followed by a fresh
  `mount()`.

```js
instance.on('change', () => console.log('edited + autosaved'));
instance.on('error', (err) => console.error('mount instance error:', err));
```

### `instance.save()` / `instance.cancel()`

Two pure instance methods with no in-canvas button of their own — build your
own host-page controls and call into them, the same way the worked example
calls `getImage()`/`destroy()` from its own buttons.

- **`save()`** — computes the current PNG (same encode as `getImage()`) and,
  if `options.ui.onSave` was supplied, invokes it with that `Blob`. Always
  returns the `Blob` either way.
- **`cancel()`** — reverts the mounted canvas to the state at `mount()` or
  the most recent `loadImage()`, whichever is later, and, if
  `options.ui.onCancel` was supplied, invokes it afterward. Nothing already
  autosaved to storage is at risk — this only discards in-memory canvas
  state since the last checkpoint, the same "start over from what I last
  loaded" meaning New Canvas already has in the standalone app.

## `options.ui`

All of `options.ui` is optional; omitting it keeps every pre-existing
`mount()` caller's behavior unchanged.

**`gallery` and `tools` (below) are the only configurable chrome.** The rest
of `WORKSPACE_MARKUP`'s topbar and panels — zoom controls, undo/redo, the
Export/download button, timelapse recording, the theme toggle, the Layers
panel, the Color Library panel, symmetry drawing, and every other tool —
are fixed and have no `options.ui` surface to hide or restyle them through
the API.

### `options.ui.gallery`

`false` hides the topbar's Gallery/navigation button — the only piece of
Gallery chrome this mounted markup renders (there's no standalone Gallery to
navigate to from a host page, so the button is already wired to a no-op).
Default is `true` (shown). Any value other than the literal `false` resolves
to shown, so a typo can't silently hide the button.

```js
Pixi.mount(host, { ui: { gallery: false } });
```

### `options.ui.tools`

Restricts the tool sidebar to only the named tools, in the order given.
Default is every tool. Recognized tool names:

```
move, pencil, eraser, bucket, brush, line, rectangle, selection, hand, eyedropper
```

Anything that isn't a genuinely restrictive array — not an array, an empty
array, or an array of names that don't match a real tool — falls back to
every tool rather than leaving the editor with an empty toolset. If the
restricted set excludes Pencil (the editor's normal default), the instance
starts on the first tool named in your array instead.

```js
Pixi.mount(host, { ui: { tools: ['pencil', 'eraser', 'bucket'] } });
```

### `options.ui.onSave` / `options.ui.onCancel`

Host-supplied notification callbacks for `instance.save()`/`instance.cancel()`
(see those methods above). Both optional; omitting either just leaves the
corresponding method fully usable without notifying anyone.

```js
Pixi.mount(host, {
  ui: {
    onSave: (blob) => uploadToMyBackend(blob),
    onCancel: () => closeMyModal(),
  },
});
```

## `options.storage`

Supplies a storage adapter that every project-persistence call this instance
makes goes through, instead of the default IndexedDB/Dexie adapter. An
adapter is any object shaped like:

```js
{
  load(id)     -> Promise<record | undefined>
  save(record) -> Promise<void>   // upsert: creates or overwrites by record.id
  list()       -> Promise<record[]>
  delete(id)   -> Promise<void>   // no-op if id is missing
}
```

`lib/storage-adapter.js` ships two implementations: `createInMemoryAdapter()`
(no persistence beyond the current process — the simplest possible starting
point for your own adapter) and `createDexieProjectAdapter(db)` (the default
Dexie-backed one `mount()` uses when you don't supply `options.storage`).
Malformed adapters throw immediately from `mount()` rather than failing
silently later — unlike `options.ui.*`, a broken storage adapter would
otherwise mean a host's users lose work without any signal.

**The default adapter autosaves into the host page's own IndexedDB, under
the host page's own origin** — every committed drawing action persists
there, same as the standalone app. That's the right default for embedding
the full standalone experience, but it's very likely the wrong default for
a narrower embed (e.g. an avatar picker inside someone else's product):
without passing `options.storage: createInMemoryAdapter()` explicitly,
you'll be silently writing every user's in-progress drawing into your
host's IndexedDB, indistinguishable from a real saved project. Decide this
deliberately rather than inheriting the default.

```js
import { createInMemoryAdapter } from './lib/storage-adapter.js';

Pixi.mount(host, { storage: createInMemoryAdapter() });
```

`destroy()` restores the default adapter, so a custom `options.storage`
never outlives the instance that set it.

## Do you need the Dexie CDN dependency?

**Only if you use the default storage adapter** (i.e. you don't pass
`options.storage`). `js/persistence.js` imports the bare specifier `"dexie"`,
resolved via an import map — see `index.html`'s or
`lib/pixi-embed-example.html`'s `<script type="importmap">` block for the
exact entry to copy:

```html
<script type="importmap">
  { "imports": { "dexie": "https://esm.sh/dexie@4" } }
</script>
```

If you supply your own `options.storage` adapter, `js/persistence.js`'s
Dexie-backed path is never reached for that instance, and your host page
does not need this import map or the Dexie CDN at all.

## Known limitations

**Accessibility**: the mounted editor is a canvas-based drawing surface with
no keyboard-only or screen-reader-driven path to any tool, color, or
drawing action today — every interaction goes through pointer events on the
canvas. If your host page has an accessibility requirement, treat the
mounted editor as a mouse/touch/pen-only surface until this changes.

**Confirmed (task 4.3):** the repo root [`LICENSE`](../LICENSE) is the
standard MIT license, with no additional restriction or field-of-use clause.
It permits using, copying, modifying, merging, publishing, distributing,
sublicensing, and selling copies of this software — which covers embedding
`lib/pixi.js` (this mount API) into another codebase, product, or site as-is,
including commercially, subject only to MIT's one condition: keep the
copyright notice and permission notice included with any copy or substantial
portion you redistribute.

**Pixi Pro is separate and does not carry these terms.** Pro's extra tools
(Layers, Color Library, symmetry drawing, and more — see the repo root
[`README.md`](../README.md#standard-vs-pro)) live in a private `pixi-pro`
repo under a paid, one-time-access model: $5 via PayPal, then a GitHub
username emailed to the maintainer for private-repo collaborator access, or
a release archive handed over instead for a buyer who doesn't want ongoing
GitHub access (see `openspec/changes/split-pixi-pro-repo/runbook.md`,
sections 4.1–4.2, for the exact process). That access grant is not a
redistribution license — it does not carry MIT's right to copy, sublicense,
or resell Pro's source the way this README's confirmation above does for
Standard. If your integration needs Pro's tools, use Pro's own access
process; don't assume this document's MIT confirmation extends to it.
