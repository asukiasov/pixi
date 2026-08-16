#!/usr/bin/env bash
# Stamps js/version.js with the current HEAD commit hash and a UTC build
# timestamp, then commits that one file.
#
# Run this AFTER pushing whatever commit(s) you want reflected on the live
# site - the stamp commit can't know its own hash in advance, so it's
# always one commit behind the code it describes. That's fine for its
# actual purpose (telling a stale cached copy apart from the real latest
# deploy in js/version.js's own doc comment) - just run it again after your
# next push to catch up.
set -euo pipefail
cd "$(dirname "$0")/.."

hash=$(git rev-parse --short HEAD)
built_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > js/version.js <<EOF
// Stamped by scripts/stamp-version.sh, which overwrites this file with the
// current HEAD commit hash and a UTC build timestamp, then commits it as
// its own trailing commit. Necessarily "one commit behind" the code it
// describes (it can't know its own commit hash in advance) - run the
// script again after pushing to catch up. Shown in the Gallery screen's
// corner (see index.html's #version-badge, wired in app.js) purely as a
// cache sanity check: compare this against \`git log -1 --format=%h\` on
// whatever branch GitHub Pages is serving to tell a stale cached copy
// apart from the real latest deploy.
export const VERSION = {
  commit: '$hash',
  builtAt: '$built_at',
};
EOF

git add js/version.js
git commit -m "chore: stamp version to $hash"
echo "Stamped js/version.js -> $hash ($built_at)"
