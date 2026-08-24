## Why

The Standard/Pro split (`openspec/changes/archive/2026-08-21-split-pixi-pro-repo/`)
extracted 8 features into a private `pixi-pro` repo behind a manual $5
PayPal → GitHub-collaborator gate. In practice this trades a large amount of
ongoing maintenance overhead (two repos, a submodule pin that must stay
ahead of `pixi`'s hooks, a separate Cloudflare deploy, manual per-sale
access grants) for a low-volume, unenforceable paywall on a bundler-less
vanilla-JS app with no real DRM story. The operator has decided a single
open repo with a voluntary donation ask is a better fit than maintaining a
two-repo tier split for this project.

## What Changes

- **BREAKING**: All 8 previously Pro-only features move back into the
  public `pixi` repo as free, always-present tools: Layers panel, Color
  Library, symmetry/mirror drawing, pixel-perfect drawing toggle, Canvas
  Settings, brush/image import, Rectangle fill/outline toggle, and
  Pencil/Eraser opacity slider. Restored from `../pixi-pro`'s `js/pro/*`
  (a sibling checkout on disk), wired inline the way they were before the
  split — not through the extension-hook layer.
- **BREAKING**: The ~20 extension hooks added purely so `pixi-pro` could
  call back into `pixi` are removed (`registerApplyPixelTransform`,
  `getLayerStack`, `registerColorSequenceProvider`,
  `registerDisableColorLibrarySequence`, `registerActiveSwatchSync`,
  `registerPathTransform`, `registerRectangleDrawOverride`,
  `registerBlendedPaint`/`registerBlendedErase`,
  `setBrushEditorGrid`/`getBrushEditorSize`,
  `resizeCanvas`/`rotateCanvas`/`renameCurrentProject`/`getCanvasSize`/
  `onWorkspaceReset`, `registerAfterCommit`/`registerAfterUndoRedo`/
  `registerMergeShortcut`, and related exports) from `js/workspace.js`,
  `js/engine.js`, `js/shape-tools.js`, and other shared files. Restored
  features call the app's internals directly instead.
- `index.html` and `style.css` regain the Pro-only markup/CSS that was
  stripped out during the split.
- README's Features table goes back to listing every tool as included; the
  Standard-vs-Pro demo links collapse to pixi's single existing GitHub
  Pages demo. A short donation line ("enjoying this? buy me a beer" +
  PayPal link) is added to README. No in-app UI change for this — the ask
  lives in README only.
- The private `pixi-pro` GitHub repo and its Cloudflare demo
  (`pixi-pro.asukiasov.workers.dev`) are deleted/torn down as an
  operational step (tracked in tasks, not a spec-level concern).
- `openspec/specs/pixi-pro-distribution` is retired — its requirements
  describe a two-repo tier model that no longer exists.
- `openspec/roadmap.md`'s "Standard/Pro tier split" entry is marked
  reversed, and its separate "Plugin/powerup system, with Pixi Pro as its
  first plugin" idea is closed out as no-longer-applicable: that idea's
  premise was `pixi-pro` as an external, less-trusted API consumer needing
  a stable public surface, and that consumer no longer exists.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `pixi-pro-distribution`: every requirement in this spec is removed — the
  two-repo tier structure, submodule pinning, Pro-only feature gating,
  manual access gating, and the public Pro demo it describes are all
  reversed by this change.

Layers, Color Library, symmetry-drawing, canvas-settings, shape-tools, and
brushes already have specs under `openspec/specs/` describing the restored
behavior unconditionally (the 2026-08-21 split changed code and docs like
README, but never touched these capability specs to add tier gating) — so
this change brings code back in line with specs that were already accurate,
rather than requiring new deltas for them.

## Impact

- **Code**: `js/` gains back ~13 files from `pixi-pro`'s `js/pro/*`
  (Layers, Color Library, symmetry, pixel-perfect, Canvas Settings, brush
  import, image import, Rectangle fill override, Pencil opacity), and
  `js/workspace.js`, `js/engine.js`, `js/shape-tools.js` lose their
  extension-hook exports in favor of direct wiring. `index.html` and
  `style.css` regain Pro markup/CSS.
- **Docs**: `README.md` (Features table, demo links, donation line),
  `openspec/roadmap.md` (tier-split entry, plugin idea).
- **Specs**: `openspec/specs/pixi-pro-distribution/spec.md` is removed at
  archive time (all requirements removed).
- **External**: the private `pixi-pro` GitHub repo and its Cloudflare
  Workers deploy are deleted. No change to `pixi`'s GitHub Pages deploy.
- **Tests**: `pixi`'s test suite needs to absorb whatever unit tests exist
  in `pixi-pro`'s `test/` for the 8 restored modules.
