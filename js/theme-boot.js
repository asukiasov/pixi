// Sets `data-theme` on <html> synchronously, before first paint - a plain
// classic script (not `type="module"`), loaded first thing in <head>. ES
// modules are always deferred (even inline ones), so js/theme.js's
// initThemeToggle() only runs after the DOM is built and would otherwise
// let the page flash the dark default palette before snapping to a
// stored light/system-light preference. This file duplicates the small
// slice of js/theme.js's resolution logic it needs (STORAGE_KEY, the
// preference validation, and the system fallback) rather than importing
// it, precisely because it must run un-deferred - keep the two in sync by
// hand if either changes; initThemeToggle() re-resolves and re-applies
// the same value once it runs, so any drift here is only ever visible as
// a one-frame flash, never a stuck-wrong theme.
(function () {
  try {
    var STORAGE_KEY = 'pixi-theme-preference';
    var stored = localStorage.getItem(STORAGE_KEY);
    var preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved;
    if (preference === 'light') {
      resolved = 'light';
    } else if (preference === 'dark') {
      resolved = 'dark';
    } else {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {
    // Storage/matchMedia unavailable - leave data-theme unset, which
    // style.css's :root (dark) defaults already cover.
  }
})();
