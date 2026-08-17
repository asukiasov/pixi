// Stamped by scripts/stamp-version.sh, which overwrites this file with the
// current HEAD commit hash and a UTC build timestamp, then commits it as
// its own trailing commit. Necessarily "one commit behind" the code it
// describes (it can't know its own commit hash in advance) - run the
// script again after pushing to catch up. Shown in the Gallery screen's
// corner (see index.html's #version-badge, wired in app.js) purely as a
// cache sanity check: compare this against `git log -1 --format=%h` on
// whatever branch GitHub Pages is serving to tell a stale cached copy
// apart from the real latest deploy.
export const VERSION = {
  commit: 'c69f85d',
  builtAt: '2026-08-17T11:15:33Z',
};
