# Pixi

A browser-based pixel art drawing tool. Fixed small canvas sizes
(16/32/64/128px, or custom up to 256px), layers, a full drawing toolset,
local persistence, and export — no animation/frame timeline in this phase.

![Pixi's Workspace screen: a pixel art scene open with the Layers panel and Color Library visible in the right sidebar](docs/screen.png)

**Live demo:** https://asukiasov.github.io/pixi/ — no install, try it now.

For the full feature set, current phase, and what's built vs. planned, see
[`openspec/roadmap.md`](openspec/roadmap.md). For exactly what each shipped
feature does, [`openspec/specs/`](openspec/specs/) is the source of truth —
this README stays high-level on purpose rather than duplicating that.

## Stack

Vanilla HTML/CSS/JS with ES modules — **no build step, no bundler, no
framework**. `js/*.js` files are loaded directly by the browser; CDN-hosted
packages (Dexie today, Supabase/Stripe later) are resolved via an
[import map](index.html) rather than npm.

- **Storage**: [Dexie.js](https://dexie.org/) over IndexedDB as the
  offline-first local cache — pixel art projects are saved locally and the
  app is fully usable signed out.
- **Later phases (not yet built)**: Supabase (Auth/Postgres/Storage/Edge
  Functions) and Stripe Checkout, both additive on top of the local-first
  core — see `openspec/roadmap.md` Phases 3–4 and
  [`docs/supabase-database.md`](docs/supabase-database.md).
- **`package.json`** exists only to declare test-only dependencies
  (`dexie`, `fake-indexeddb`) for running the test suite under Node — the
  shipped app itself has no npm dependencies.

## Running it locally

No build/dev server required — serve the repo root as static files and
open it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works equally well (`npx serve`, VS Code's Live
Server, etc.) — the app just needs to be served over HTTP rather than
opened as a `file://` URL, since ES module imports require it.

## Testing

```bash
npm install   # first time only - installs test-only dependencies
npm test      # runs node --test test/**/*.test.js
```

Tests cover DOM-free logic (e.g. engine, layers, undo, persistence,
routing, brushes, shape tools, symmetry, color library — see `test/` for
the full, current list) directly under Node. Anything requiring a real
`<canvas>`/DOM (compositing, rendering) is verified with a Playwright
smoke pass instead — see individual OpenSpec changes'
`tasks.md` under `openspec/changes/archive/` for what was checked.

## Deployment

Static site on GitHub Pages, served straight from this repo — no CI build
step, since there's nothing to build.

`js/version.js` is stamped with the current commit hash and build time by
[`scripts/stamp-version.sh`](scripts/stamp-version.sh), shown as a small
badge in the Gallery screen's corner. It's a cache sanity check only
(telling a stale cached copy apart from the latest deploy), not a real
version number — run the script and push after deploying to keep it
current.

Separately, [git tags and GitHub Releases](https://github.com/asukiasov/pixi/releases)
mark real version points (`v0.1.0`, `v0.2.0`, ...) — cut at the end of each
roadmap phase or a notable batch of shipped changes, not on every commit.

## Project structure

```
index.html   Single-page shell: Gallery / New Canvas / Workspace screens
style.css    All styles, no preprocessor
js/          ES modules, one per concern (engine, layers, workspace, ...)
test/        node --test unit tests, mirrors js/
openspec/    Requirements (specs/), in-flight change proposals (changes/),
             and the phase-by-phase roadmap.md - see CLAUDE.md for the process
docs/        Reference docs that don't belong in openspec/ (e.g. Supabase schema)
scripts/     One-off maintenance scripts (version stamping)
```

For a map of every screen and pixel art tool in the UI (what each control
does, where it lives in the DOM), see
[`docs/ui-reference.md`](docs/ui-reference.md).
