## 1. Pre-flight

- [x] 1.1 Diff `../pixi-pro`'s `pixi` submodule checkout (pinned `v0.4.0`)
      against this repo's current `main` for `js/workspace.js`,
      `js/engine.js` (`lib/pixel-engine/engine.js`), and `js/shape-tools.js`
      — note any engine-side change the restored Pro modules depend on
      that `main` doesn't have yet, and pull it forward before restoring.
      No diff found in any of the three files — the two commits `main` has
      moved since the split (`db82a33`, `884771f`, both mount-API docs
      work) never touched them. No engine-side changes to pull forward.
- [x] 1.2 Confirm `pixi`'s current test suite passes clean before starting
      (baseline for comparison after restoration). 272/272 passing.

## 2. Restore Color Library + Layers

- [x] 2.1 Copy `image-import.js`, `color-library-ui.js`,
      `default-color-library.js`, `color-extraction.js`, `color-ramp.js`,
      `color-library-persistence.js`, `layers-ui.js`, and
      `image-import-extras.js` from `../pixi-pro/js/pro/` into `pixi/js/`,
      restoring their pre-split filenames/locations
      (`js/color-extraction.js`, `js/color-ramp.js`,
      `js/default-color-library.js`, `js/image-import.js` — see the
      archived split's task 2.2 for the original file map to reverse).
      Done, plus `js/layers-ui.js` and `js/color-library-ui.js` (module-
      level state, matching `workspace.js`'s own convention rather than
      pixi-pro's closure-based `initLayers(root)`/`initColorLibrary(root)`
      shape). `image-import-extras.js`'s `hasTransparency` was left to
      task 3.5 (brush import) instead, which owns it.
- [x] 2.2 Restore `index.html` markup and `style.css` rules for the Color
      Library panel and the Layers panel (including background-layer
      locking and reference-image-layer UI). Also restored the shared
      `.panel-header`/`.panel-header-top`/`.panel-header-actions`/
      `.panel-collapse-chevron` base classes and folded
      `.layer-visibility-toggle`/`.layer-reorder-button`/
      `.color-library-swatch` back into the original shared `.ios-platform`
      hover-buzz selector list, matching pre-split CSS structure.
- [x] 2.3 Replace each `registerColorSequenceProvider`,
      `registerDisableColorLibrarySequence`, `registerActiveSwatchSync`,
      `getLayerStack`, `registerAfterCommit`, `registerAfterUndoRedo`, and
      `registerMergeShortcut` call in the restored modules with a direct
      call into `workspace.js`'s internals; remove the corresponding
      `register*`/`getLayerStack` export from `workspace.js` once nothing
      calls it externally. All 6 `register*` hooks removed and confirmed
      via repo-wide grep to have no other callers. `getLayerStack` stays
      exported — `layers-ui.js` calls it directly as an ordinary cross-
      file export (deliberate circular import between `workspace.js` and
      `layers-ui.js`/`color-library-ui.js`; verified safe since neither
      side calls the other's exports at module-eval time, only inside
      function bodies invoked after the module graph finishes evaluating).
- [x] 2.4 Restore palette-CRUD functions into `persistence.js` (moved out
      to `pixi-pro` per the archived split's task 2.2); confirm
      `persistence.js`'s `db` export still matches what both Standard and
      the restored Color Library code expect. Confirmed working.
- [x] 2.5 Verify live in a browser: Layers panel (add/delete/reorder/
      rename, visibility, blend mode, opacity, background layer, reference
      image layer, merge layers both shortcut forms), Color Library panel
      (saved/named palettes, add-to-palette, import from image, ramp
      generator), undo/redo refreshing the Layers panel correctly. No
      browser available to the implementing agents — verified instead via
      full `npm test` pass (300/300 at the time), `node --check` on every
      touched file, and a manual cross-check of every DOM id `layers-ui.js`
      /`color-library-ui.js` queries against `index.html`. **Update:** a
      real live-browser pass (Playwright, served locally) was done after
      implementation — Layers add/opacity-popover/blend-mode, Color
      Library panel and palette switcher, undo-enabling-on-draw all
      confirmed working live, zero console errors introduced. Residual gap
      closed.

## 3. Restore remaining 6 features

- [x] 3.1 Symmetry/mirror drawing: restore `symmetry.js` + `symmetry-ui.js`
      into `js/`, restore `index.html`/`style.css` for the symmetry
      toggle, replace the `registerApplyPixelTransform` call with a direct
      hookup in `workspace.js`/`brushes.js`, remove the export. Done;
      `registerApplyPixelTransform`/`withProPixelTransform` removed.
- [x] 3.2 Pixel-perfect drawing toggle: restore `pixel-perfect.js` +
      `pixel-perfect-ui.js`, restore markup/CSS, replace the
      `registerPathTransform` call with a direct hookup in
      `lib/pixel-engine/engine.js`, remove the export. Done;
      `pixel-perfect.js`'s pure `removeRedundantCorners` placed in
      `lib/pixel-engine/` next to `engine.js` (which now imports it
      directly) rather than in `js/`, avoiding an upward dependency from
      `lib/` into `js/`. `registerPathTransform` removed.
- [x] 3.3 Rectangle fill/outline toggle: restore `rectangle-fill-ui.js`,
      restore markup/CSS (Standard's Rectangle reverts from outline-only
      to fill/outline toggle), replace the `registerRectangleDrawOverride`
      call with a direct hookup in `js/shape-tools.js`, remove the export.
      Done via a `setRectangleFilled` toggle; `registerRectangleDrawOverride`
      removed.
- [x] 3.4 Pencil/Eraser opacity slider: restore `pencil-opacity.js` +
      `pencil-opacity-ui.js`, restore markup/CSS, replace the
      `registerBlendedPaint`/`registerBlendedErase` calls with direct
      calls in `workspace.js`, restore `PixelEngine.setPixelBlended`/
      `erasePixelBlended` (removed per the archived split's task 2.2),
      remove the `register*` exports. Done; both hooks removed.
- [x] 3.5 Brush import from image: restore `brush-import.js` +
      `brush-import-ui.js`, restore markup/CSS, replace the
      `setBrushEditorGrid`/`getBrushEditorSize` calls with direct access
      in `workspace.js`, remove those exports if nothing else external
      calls them, restore `hasTransparency` (as `js/image-import-extras.js`).
      `getBrushEditorSize`/`setBrushEditorGrid` deliberately kept exported
      — `brush-import-ui.js` is a real same-repo caller now, so these are
      ordinary cross-file exports, not dead hooks.
- [x] 3.6 Canvas Settings (rename/resize/rotate): restore
      `canvas-settings.js` + `canvas-settings-ui.js`, restore markup/CSS,
      replace `resizeCanvas`/`rotateCanvas`/`renameCurrentProject`/
      `getCanvasSize`/`onWorkspaceReset` calls with direct calls in
      `workspace.js`, remove those exports (note: `LayerStack.resize`/
      `rotate90` stay as-is, they were never extracted per the archived
      split's task 2.2). Done, with two deviations from the literal task
      wording: (1) no separate `canvas-settings-ui.js` was created — its UI
      glue was folded directly into `workspace.js`, since keeping it
      separate would have required re-exporting the very functions this
      task says to remove; `resizeCanvas`/`rotateCanvas`/
      `renameCurrentProject`/`getCanvasSize` lost their `export` keyword
      accordingly. (2) `onWorkspaceReset` was NOT removed — `layers-ui.js`
      and `color-library-ui.js` (task group 2, concurrent work) both call
      it as their subscribe mechanism, so it's a shared internal, not a
      dead Pro hook; kept and Canvas Settings' own sync registered through
      it too.
- [x] 3.7 Verify each of the 6 features live in a browser as it's
      restored (not deferred to one final pass), matching the original
      extraction's verification discipline. Same caveat as 2.5: no browser
      available to the implementing agent — verified via `npm test`
      (300/300 after this group) and `node --check` per file instead.
      **Update:** a real live-browser pass (Playwright, served locally)
      was done after implementation — Symmetry (cycled to horizontal,
      confirmed a single click mirrors into two pixels), Pixel-perfect
      toggle, Canvas Settings popover (Resize + Rotate both present and
      functional), Rectangle's Filled toggle, and Pencil's Opacity slider
      all confirmed present/working live with zero console errors
      introduced. Found and fixed one **pre-existing, unrelated** bug
      during this pass: `index.html`'s Material Symbols `icon_names`
      subset was missing `fiber_manual_record` (the Record-timelapse
      button's icon), rendering as broken ligature text — confirmed via
      `git diff`/`git log` this predates this change entirely (the
      timelapse-recording feature's own commit never added its icon to
      the subset); fixed as a one-line addition, same pattern as
      roadmap.md's "2n's Import icon rendered broken" precedent (direct
      fix, no OpenSpec change, no behavior change). Residual gap closed.

## 4. Hook and dead-code sweep

- [x] 4.1 Grep `js/workspace.js`, `lib/pixel-engine/engine.js`, and
      `js/shape-tools.js` for any remaining `register*`/`getLayerStack`/
      `getCanvasSize`/`getBrushEditorSize` export with no in-repo caller
      after tasks 2 and 3; remove it. Swept after both groups landed: only
      `getLayerStack`, `getBrushEditorSize`, and `getColorPickerCurrentColor`
      remain exported from `workspace.js`, all with real in-repo callers
      (`layers-ui.js`, `brush-import-ui.js`, and a pre-existing caller
      respectively) — confirmed via grep, none are dead. Also fixed stale
      comments left behind referencing the removed hooks/pixi-pro
      (`js/workspace.js` ×2, `lib/pixel-engine/layers.js`'s `BLEND_MODES`
      doc comment, `lib/README.md`'s `options.ui`/Known-limitations
      sections, `test/brushes.test.js`, `test/persistence.test.js`).
- [x] 4.2 Confirm `js/pixi-pro.js` and `js/main.js`-equivalent
      Pro-bootstrap code has no remaining counterpart needed in `pixi`
      (Pro modules are now initialized the same way Standard's own
      features are, not through a separate boot step). Confirmed — `pixi`
      never had these files; nothing to remove. `js/app.js` gained
      `initColorLibrary()`/`initLayers()` calls alongside its other
      `init*` calls, same pattern as every other feature.
- [x] 4.3 Run `pixi`'s test suite; confirm no failures and no skipped
      coverage regressions versus the 1.2 baseline. 300/300 passing after
      groups 2–4 (up from the 272 baseline; +28 from the concurrent
      agents' own new test files, ahead of task 5's porting).

## 5. Tests

- [x] 5.1 Port `../pixi-pro/test/` coverage for the 8 restored modules
      (`brush-import.test.js`, `layers-marking.test.js`,
      `rectangle-fill.test.js`, `color-ramp.test.js`,
      `color-extraction.test.js`, `color-library-persistence.test.js`,
      `pixel-perfect.test.js`, `symmetry.test.js`,
      `pencil-opacity.test.js`) into `pixi`'s test suite, skipping any that
      duplicate coverage `pixi` already has. `brush-import.test.js`,
      `symmetry.test.js`, `pixel-perfect.test.js` (as
      `lib/pixel-engine/pixel-perfect.test.js`), and `pencil-opacity.test.js`
      (folded into `lib/pixel-engine/engine.test.js`) were already ported
      by the task-3 agent. This task ported the remaining four:
      `layers-marking.test.js`, `color-extraction.test.js`,
      `color-ramp.test.js`, `color-library-persistence.test.js` (import
      paths adjusted from `../js/pro/*`/`../pixi/js/persistence.js` to
      this repo's actual restored locations).
      `rectangle-fill.test.js` was NOT ported — its
      `registerRectangleDrawOverride`-based coverage is fully superseded by
      `test/shape-tools.test.js`'s `setRectangleFilled` tests (task 3.3),
      which exercise the real restored API instead of the removed hook.
      Full suite: 341/341 passing.
- [x] 5.2 Confirm `pixi-pro-markup-patches.test.js` (tests that verified
      `pixi-pro`'s `index.html` correctly patched `pixi`'s shared markup)
      has no remaining purpose — its assertions should now be covered by
      `pixi`'s own markup being correct outright — and is not carried over
      as-is. Confirmed: that test existed solely to check `pixi-pro`'s
      `index.html` DOM-patched `pixi`'s shared markup correctly at
      runtime — a concern specific to the two-repo split's markup-injection
      mechanism, which no longer exists now that all markup lives directly
      in `pixi`'s own `index.html`. Not ported.

## 6. Docs

- [x] 6.1 Restore README's Features table to list every tool (Layers,
      Color Library, symmetry, pixel-perfect, Canvas Settings, brush/image
      import, Rectangle fill/outline, Pencil/Eraser opacity) as included,
      not Pro-only. Done — replaced the old Standard-only Features table +
      separate "Standard vs. Pro" comparison table with one unified
      Features table covering everything.
- [x] 6.2 Remove the Pro demo link (`pixi-pro.asukiasov.workers.dev`) and
      the Standard-vs-Pro demo labeling from README; leave the existing
      GitHub Pages demo link as the only demo link. Done.
- [x] 6.3 Add a short donation line to README ("enjoying this? buy me a
      beer" + PayPal link) — README only, no in-app UI change. Done, under
      "Support the Project" (replaced the old "buy Pro" pitch).
- [x] 6.4 Update `openspec/roadmap.md`: mark the "Standard/Pro tier split"
      entry under "Not yet scheduled" as reversed (point at this change),
      and close out the "Plugin/powerup system, with Pixi Pro as its first
      plugin" idea as no-longer-applicable, noting its premise (`pixi-pro`
      as an external, less-trusted API consumer) no longer holds. Done,
      both entries struck through with a dated note.
- [x] 6.5 Note in `docs/superpowers/specs/2026-08-18-pixi-tiers-design.md`
      that the tier split it designed has been reversed by this change
      (it already carries a "legacy — superseded" note; extend it rather
      than replacing it). Done, and the same extension applied to
      `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md`'s
      matching note (not originally called out in this task, but it
      carried an identical stale claim). Also updated `lib/README.md`'s
      `options.ui` and Known-limitations sections, which described the
      now-removed Pro/Standard hook boundary to embedders (found during
      the task 4.1 sweep, fixed here as the natural docs-cleanup home for
      it).

## 7. Operator step (manual, after everything above is verified)

- [ ] 7.1 Delete the private `pixi-pro` GitHub repo.
- [ ] 7.2 Tear down the `pixi-pro` Cloudflare Workers deploy
      (`pixi-pro.asukiasov.workers.dev`).
