/**
 * Minimal hash-based router. No dependencies, no framework.
 *
 * Routes:
 *   #/                 -> { screen: 'gallery' }
 *   #/new              -> { screen: 'newCanvas' }
 *   #/project/<id>     -> { screen: 'workspace', projectId: '<id>' }
 *
 * Anything else (empty hash, unrecognized path) falls back to
 * { screen: 'gallery' } — same as the app's pre-routing default.
 */

/**
 * Parses a hash string (e.g. `location.hash`, which includes the
 * leading `#`) into a route object. Pure function — no DOM/location
 * access — so it's easy to unit test without a browser.
 */
export function parseRouteHash(hash) {
  // Strip a leading '#', then a leading '/', leaving just the path.
  const path = String(hash || '').replace(/^#/, '').replace(/^\//, '');

  if (path === '' || path === undefined) {
    return { screen: 'gallery' };
  }
  if (path === 'new') {
    return { screen: 'newCanvas' };
  }
  const projectMatch = path.match(/^project\/(.+)$/);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    if (projectId) {
      return { screen: 'workspace', projectId };
    }
  }
  return { screen: 'gallery' };
}

/** Reads and parses the current `location.hash`. */
export function parseRoute() {
  return parseRouteHash(location.hash);
}

/** Formats a route object into a hash string (including the leading '#'). */
export function formatRoute(route) {
  if (!route || route.screen === 'gallery') {
    return '#/';
  }
  if (route.screen === 'newCanvas') {
    return '#/new';
  }
  if (route.screen === 'workspace' && route.projectId) {
    return `#/project/${encodeURIComponent(route.projectId)}`;
  }
  return '#/';
}

/**
 * Updates `location.hash` to match `route`.
 *
 * By default this pushes a new history entry (so Back/Forward can
 * navigate through it), matching normal hash-assignment behavior.
 * Pass `{ replace: true }` to replace the current history entry
 * instead (used for boot-time fallback/cleanup, where a stale or
 * invalid hash should not leave a Back-button trap).
 */
export function navigate(route, { replace = false } = {}) {
  const hash = formatRoute(route);
  if (replace) {
    const url = location.pathname + location.search + hash;
    history.replaceState(null, '', url);
  } else {
    location.hash = hash;
  }
}

/**
 * Subscribes `handler(route)` to run whenever the URL's route changes
 * via browser navigation (Back/Forward, manual hash edit). Returns an
 * unsubscribe function.
 *
 * Uses `hashchange`, which fires reliably for hash-only URL changes
 * (including those from Back/Forward) in all supported browsers;
 * `popstate` alone does not fire for hash changes in every browser.
 */
export function onRouteChange(handler) {
  const listener = () => handler(parseRoute());
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
