## Context

`js/app.js` currently has no concept of a URL at all: it always calls
`showScreen('gallery')` on load, and every screen transition
(`openWorkspace`, the Gallery's `onNewCanvas`/`onOpenProject` callbacks,
`initNewCanvasScreen`'s `onCanvasCreated`, and the Workspace's
`onRequestGallery`) only ever toggles `.hidden` on the three screen
`<div>`s. Every project already has a stable `crypto.randomUUID()` id
(`createProject` in `js/persistence.js`), but nothing surfaces it
anywhere outside memory.

## Goals / Non-Goals

**Goals:**
- Reloading the page while a project is open re-opens that exact
  project, not the Gallery.
- A `#/project/<id>` URL is a stable pointer to one project, on the
  same browser/profile that created it.
- Back/Forward move between Gallery / New Canvas / a given project the
  way they would for a normal multi-page site.

**Non-Goals:**
- **Not sharing.** This does not make a drawing accessible to anyone
  who doesn't already have it stored locally. The app is fully
  local/offline (IndexedDB, no backend yet — see `CLAUDE.md`'s
  non-goals and Phase 3 in `openspec/roadmap.md`). Pasting a
  `#/project/<id>` URL to someone else, or opening it on a different
  device/browser profile, will not show that drawing until Phase 3
  (Supabase sync) exists — it'll just fall back to the Gallery. This
  change establishes the route shape Phase 3's real sharing can reuse
  later without a routing redesign, but does not implement sharing
  itself.
- No deep-linking into New Canvas's chosen size/preset — `#/new` is
  the New Canvas screen itself, nothing about its in-progress form
  state.
- No change to `js/persistence.js` — project ids already exist and are
  already stable; this only surfaces the existing id in the URL.

## Decisions

**Hash-based routing (`#/`, `#/new`, `#/project/<id>`), not the
History API with real paths.** Pixi is a static site with no
server-side routing config, deployed to GitHub Pages
(`CLAUDE.md`: "no custom backend server"). Real paths via
`history.pushState` (e.g. `/project/<id>`) need the host to serve
`index.html` for any path under it — GitHub Pages can do this only via
a `404.html`-redirects-to-`index.html` trick, which is itself an extra
moving part (an extra HTML file, a redirect script, a flash of a 404
on first load) to buy exactly nothing this project needs yet: no SEO
requirement, no server-rendered content, no path-based cache
behavior. Hash routing needs zero server configuration — the fragment
never leaves the browser — and is trivially reversible if a future
phase's needs change (e.g., once Phase 3 adds a real backend and
sharing becomes a goal, that's the point to reconsider real paths, not
before).

**A small, dependency-free `js/router.js` module, not a routing
library.** Three routes, one always-current URL, no nested routes, no
route guards/middleware beyond "does this project id exist locally."
A library (or hand-rolling more than needed) would add surface area
this doesn't need. `parseRoute()`/`formatRoute()` are pure functions
(hash string in, route object out, and back) with no `window`/`location`
access, so they're unit-testable without a browser or DOM shim;
`parseRoute()`, `navigate()`, and `onRouteChange()` are the only
functions that touch `location`/`history`/`window`.

**`navigate(route, { replace })` combines a hash update with
`history.replaceState` for the `replace` case, rather than assigning
`location.hash` in both cases.** Assigning `location.hash` always
pushes a new history entry, even when the hash is only being
"corrected" (e.g., an unknown/deleted project id falling back to the
Gallery on boot). Left as a plain hash assignment, that correction
would leave a broken `#/project/<stale-id>` entry sitting in history —
pressing Back from the Gallery would immediately bounce back to the
same dead link. `history.replaceState(null, '', url)` swaps the
current entry in place instead of adding one, so the stale hash is
gone rather than one Back-press away.

**`hashchange`, not `popstate`, drives `onRouteChange`.** Both fire on
Back/Forward, but a plain hash-only URL change (no full navigation)
does not reliably fire `popstate` in every browser, whereas
`hashchange` is specified to fire on any URL change where the
fragment differs — the more direct match for a router whose only state
lives in the hash. Verified manually (see Verification in the change's
`proposal.md`/tasks) that Back/Forward through Gallery → project →
Gallery all fire `hashchange` as expected in Chromium.

**The `hashchange` handler never calls `navigate()` itself.** It only
updates which screen is visible (and, for a workspace route, reopens
that project's data via `loadProject`/`LayerStack.fromProjectRecord`).
If it also called `navigate()`, a user pressing Back would trigger our
own handler pushing/replacing the URL again, fighting the browser's
own history stack. The one exception is the boot-time and
route-change-time "unknown project id" fallback, which uses
`{ replace: true }` specifically so it corrects the URL in place
without adding a new entry (see above) rather than treating that
fallback as a fresh user-initiated navigation.

## Risks / Trade-offs

- Hash routing means the visible URL always has a leading `#` segment
  (`https://.../index.html#/project/<id>`) rather than a "clean" path.
  Accepted per the server-config trade-off above; revisit only if/when
  a real backend and server-side routing exist.
- `loadProject`'s current not-found behavior is `db.projects.get(id)`
  returning `undefined` for a missing row (Dexie's normal behavior,
  not a thrown error) — the router's fallback logic depends on that
  `undefined`, not a caught exception. If `loadProject`'s contract ever
  changes to throw instead, the fallback path needs updating.
