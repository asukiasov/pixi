## Why

Requested directly: every project already gets a unique internal ID
(`crypto.randomUUID()`) at creation, but nothing surfaces it in the
browser's URL. The app always boots to the Gallery screen regardless of
what was open, so reloading the page while a drawing is open loses your
place, and there's no URL that points at one specific project to
bookmark or share.

## What Changes

- Hash-based routes: `#/` (Gallery), `#/new` (New Canvas), `#/project/<id>`
  (Workspace, open to that project). A new `js/router.js` owns parsing
  the current hash and navigating (`pushState`-equivalent via
  `location.hash =`, plus a `popstate`/`hashchange` listener).
- Opening a project (from the Gallery, or right after creating one)
  updates the URL to `#/project/<id>`; going back to the Gallery clears
  it to `#/`; opening New Canvas sets `#/new`.
- On page load, the URL is read first: `#/project/<id>` opens that
  project directly (skipping the Gallery) if it still exists locally;
  if it doesn't (deleted, or a different browser/profile with no local
  copy), falls back to the Gallery and clears the stale hash. Anything
  else (`#/new`, `#/`, or no hash) shows the matching screen, same as
  today's default.
- The browser Back/Forward buttons now work between Gallery ↔ New Canvas
  ↔ a given project, via the `popstate`/`hashchange` listener re-deriving
  the current screen from the URL.

## Not addressed (know the limits)

- **This does not make a drawing accessible to anyone who doesn't
  already have it stored locally.** The app is fully local/offline
  (IndexedDB, no backend yet — see `CLAUDE.md`'s non-goals and Phase 3
  in `openspec/roadmap.md`). Pasting a `#/project/<id>` URL to someone
  else, or opening it on a different device, will not show that
  drawing until Phase 3 (Supabase sync) exists — it'll just show the
  Gallery. What this change delivers now: the URL round-trips correctly
  on the *same* browser (bookmark it, refresh it, use Back/Forward), and
  establishes the route shape Phase 3's real sharing can reuse later
  without a routing redesign.

## Capabilities

### New Capabilities
- `url-routing`: hash-based navigation between Gallery/New Canvas/
  Workspace, keyed by project ID; reload/bookmark/Back-Forward all stay
  in sync with what's open.

## Impact

- New `js/router.js`: `parseRoute()`, `navigate(route, { replace })`,
  `onRouteChange(handler)`.
- `js/app.js`: replaces its unconditional `showScreen('gallery')` boot
  with a route-driven boot; every screen transition (`openWorkspace`,
  `onNewCanvas`, `onRequestGallery`) now also calls `navigate(...)`.
- No change to `js/persistence.js` — project IDs already exist and are
  already stable; this only surfaces the existing ID in the URL.
