## 1. Router module

- [x] 1.1 New `js/router.js`: `parseRouteHash(hash)` — pure function,
      no DOM/`location` access, parses a hash string into
      `{ screen: 'gallery' | 'newCanvas' | 'workspace', projectId? }`,
      defaulting to `{ screen: 'gallery' }` for empty/unrecognized input
- [x] 1.2 `formatRoute(route)` — inverse of `parseRouteHash`, also pure
- [x] 1.3 `parseRoute()` — reads `location.hash` and delegates to
      `parseRouteHash`
- [x] 1.4 `navigate(route, { replace = false })` — sets `location.hash`
      normally (pushes a history entry); with `replace: true`, uses
      `history.replaceState(null, '', url)` instead so a stale/corrected
      URL doesn't leave a broken Back-button entry
- [x] 1.5 `onRouteChange(handler)` — subscribes `handler(parseRoute())`
      to `hashchange` (verified manually that it fires reliably for
      Back/Forward through hash-only changes; `popstate` alone is not
      dependable for this), returns an unsubscribe function
- [x] 1.6 `test/router.test.js`: unit tests for `parseRouteHash` and
      `formatRoute` covering all three route shapes, empty/unrecognized
      hashes, encoding/decoding of project ids with special characters,
      and a roundtrip check

## 2. Wire into app.js

- [x] 2.1 Boot sequence reads `parseRoute()` before deciding what to
      show, replacing the old unconditional `showScreen('gallery')`:
      `workspace` route with a project that still loads opens directly
      to the Workspace; a `workspace` route whose project id doesn't
      resolve (via `loadProject` returning `undefined`) falls back to
      the Gallery and clears the stale hash with
      `navigate({screen:'gallery'}, {replace:true})`; `newCanvas`
      shows the New Canvas screen; anything else shows the Gallery
      (unchanged default)
- [x] 2.2 Gallery's `onNewCanvas` callback also calls
      `navigate({screen:'newCanvas'})`
- [x] 2.3 Gallery's `onOpenProject` callback also calls
      `navigate({screen:'workspace', projectId: id})` after the project
      loads successfully
- [x] 2.4 `initNewCanvasScreen`'s `onCanvasCreated` callback also calls
      `navigate({screen:'workspace', projectId})`
- [x] 2.5 `openWorkspace`'s `onRequestGallery` callback (Workspace's
      "back to gallery" button) also calls
      `navigate({screen:'gallery'})`
- [x] 2.6 `onRouteChange` handler registered once at startup: re-derives
      the visible screen from the new route on Back/Forward; for a
      `workspace` route, actually reopens that project via `loadProject`
      + `openWorkspace` (not just a visibility toggle) unless it's
      already the one on screen; for an unresolved project id, falls
      back to the Gallery and replaces the stale hash; never calls
      `navigate()` for a route it's merely reacting to, to avoid
      fighting the browser's own history entry

## 3. Verification

- [x] 3.1 `node --test` — full suite green (103 pre-existing +
      16 new router tests = 119/119)
- [x] 3.2 Playwright smoke pass (headless Chromium): create a new
      project → URL becomes `#/project/<uuid>`; reload → re-opens the
      same project (not the Gallery); back to Gallery → URL becomes
      `#/`; manually navigate to `#/project/not-a-real-id` and reload →
      falls back to the Gallery with zero console errors; Gallery →
      open a project → browser Back → Gallery shown again with the URL
      updated. Screenshots captured for the visually relevant states.
- [x] 3.3 `npx openspec validate 2i-url-routing --strict` passes with
      zero errors
