## 1. Repo scaffolding

- [x] 1.1 Create the private `pixi-pro` GitHub repo (empty, no fork).
- [x] 1.2 Confirm `pixi` has a released tag to pin to; if not, cut one.
      (`v0.2.0` already existed.)
- [x] 1.3 Add `pixi` as a git submodule in `pixi-pro`, pinned to that tag
      (not tracking `main`).
- [x] 1.4 Set up `pixi-pro`'s top-level structure: `js/main.js` (entry
      point, boots the `pixi` submodule then initializes Pro modules),
      `js/pro/` (Pro module directory), `index.html` (own copy of `pixi`'s
      shell, loading shared assets from `pixi/` and Pro-only assets from
      this repo), `style-pro.css` (Pro-only CSS, additive on top of the
      submodule's `style.css`). No build step, matching `pixi`'s stack.

## 2. Pro-only module split

- [x] 2.1 Confirmed: all 8 Pro-only features already live in the public
      `pixi` repo, tier-gating deferred (see `openspec/changes/
      reference-image-layer/` and `openspec/changes/merge-layers/`) —
      Layers panel (`js/layers.js` + `index.html` markup), Color Library
      (`js/default-color-library.js` + call sites in `workspace.js`/
      `persistence.js`/`image-import.js`), pixel-perfect toggle
      (`js/engine.js`, `js/workspace.js`), symmetry (`js/symmetry.js`),
      Canvas Settings (`js/canvas-settings.js`), brush/image import
      (`js/brush-import.js`, `js/image-import.js`), Rectangle fill/outline
      toggle (`js/shape-tools.js` + `index.html` markup), Pencil/Eraser
      opacity slider (`js/workspace.js` + `index.html` markup). None are
      dead code — all are live, wired-up features. Removal from `pixi` is
      in scope for task 2.2 below, not deferred further.
- [x] 2.2 Per feature, in `pixi`: remove its JS module(s), `index.html`
      markup, CSS, and call sites in shared files (`app.js`,
      `workspace.js`, `engine.js`, `persistence.js`), verifying Standard's
      remaining tools have no leftover dependency on the removed code path
      after each removal. Port each removed feature's code into `pixi-pro`
      as an additive module (starting point, not a rewrite), wired into
      `pixi`'s existing extension points from outside the submodule, per
      design.md's "Extraction before addition" and "no engine forking"
      decisions. Progress (8/8, all done):
      - [x] Symmetry/mirror drawing — extracted; added the generic
            `registerApplyPixelTransform` hook to `pixi`'s `workspace.js`/
            `brushes.js` for this and future features to register against.
      - [x] Pixel-perfect drawing toggle — extracted; added the generic
            `registerPathTransform` hook to `pixi`'s `engine.js`.
      - [x] Rectangle fill/outline toggle — extracted; Standard's
            Rectangle is now outline-only; added
            `registerRectangleDrawOverride` to `pixi`'s `shape-tools.js`.
      - [x] Pencil/Eraser opacity slider — extracted; removed
            `PixelEngine.setPixelBlended`/`erasePixelBlended`; added
            `registerBlendedPaint`/`registerBlendedErase` to
            `pixi`'s `workspace.js`.
      - [x] Brush import from image — extracted; removed
            `js/brush-import.js` and `hasTransparency`; added
            `setBrushEditorGrid`/`getBrushEditorSize` to
            `pixi`'s `workspace.js`. `js/image-import.js` itself stays in
            `pixi` for now (still used by Color Library import and the
            reference image layer, both not yet extracted).
      - [x] Canvas Settings (rename/resize/rotate) — extracted entirely
            (no Standard-only remainder); added
            `resizeCanvas`/`rotateCanvas`/`renameCurrentProject`/
            `getCanvasSize`/`onWorkspaceReset` to `pixi`'s `workspace.js`.
            `LayerStack.resize`/`rotate90` stay as class methods (private
            field reassignment, no way to extract to a free function).
      - [x] Color Library (saved/named palettes, add-to-palette, import
            from image, ramp generator) — extracted entirely; removed
            `js/color-extraction.js`/`js/color-ramp.js`/
            `js/default-color-library.js` and the palette-CRUD functions
            from `persistence.js` (which now exports `db`). Added
            `registerColorSequenceProvider`/
            `registerDisableColorLibrarySequence`/`disableRainbow`/
            `registerActiveSwatchSync`/`syncActiveSwatch` (exported) plus
            exported `hexToRgba`/`rgbaToHex`/`setForegroundColor`/
            `getColorPickerCurrentColor`/`bindPanelHeaderCollapse`/
            `matrixRain`/`confettiBurst` to `pixi`'s `workspace.js`.
            `js/image-import.js` still stays in `pixi` (now only the
            reference image layer, part of Layers below, still needs it).
      - [x] Layers panel and everything tied to it (add/delete/reorder/
            rename, visibility, blend mode, opacity, reference image
            layer, merge layers) — extracted entirely; `LayerStack`
            itself is untouched in `pixi` (its mutating methods were
            already public, so unlike `resize`/`rotate90` there was no
            technical wall — `pixi-pro` calls them directly via a new
            `getLayerStack()` accessor). Added `getLayerStack`/
            `renderCanvas`/`registerAfterCommit`/`registerAfterUndoRedo`/
            `registerMergeShortcut` to `pixi`'s `workspace.js`, and
            exported `BLEND_MODES` from `layers.js`. `js/image-import.js`
            (its last remaining caller) moved to `pixi-pro` wholesale.
            Verified extensively in a browser: background layer locking,
            every per-row/toolbar operation, reference image
            upload/mode/smoothing, undo refreshing the panel via the new
            hook, and merge-layers in both its shortcut forms.
- [x] 2.3 Verify `pixi-pro`, built and run, has the full Standard + Pro
      toolset working end to end — done per-feature throughout task 2.2
      (each of the 8 features was verified live in a browser as it was
      extracted, not deferred to one final pass); no consolidated
      single-session run against the tier matrix doc was done separately.
- [x] 2.4 Verify `pixi` (Standard), unchanged, still has no Pro-only
      features present — confirmed per-feature via grep sweeps for
      leftover references after each extraction (see each feature's
      commit); `pixi`'s own test suite (186 tests) passes throughout.

## 3. Demo deployment

- [x] 3.1 Create a Cloudflare Pages project connected to the private
      `pixi-pro` repo (GitHub App install with repo access). Done via
      Cloudflare's unified Workers-with-static-assets flow rather than
      classic Pages — same outcome (git-connected, private repo), needed
      a `wrangler.jsonc` (`assets.directory: "./"`) added to `pixi-pro`
      since that flow's deploy command is `npx wrangler deploy`.
- [x] 3.2 Configure auto-deploy on push/tag, no build command (static
      files served as-is). Build command left blank; deploy command is
      `npx wrangler deploy` (see 3.1).
- [x] 3.3 Deploy and verify the live demo URL
      (https://pixi-pro.asukiasov.workers.dev/) serves the full,
      unrestricted Pro app — no watermark, export/save fully functional.
      Hit one bug along the way: `pixi-pro`'s submodule pin (`v0.2.0`)
      predated the Pro extraction hooks, so Pro modules threw
      `SyntaxError`s importing hooks like `registerApplyPixelTransform`
      that didn't exist on that pin yet. Fixed by merging
      `split-pixi-pro-repo` into `pixi`'s `main`, cutting `v0.3.0`, and
      bumping the submodule pin — see `runbook.md` section 4.3 for the
      repeatable process.
- [x] 3.4 Confirm `pixi`'s existing GitHub Pages deploy is unaffected —
      https://asukiasov.github.io/pixi/ verified live (200, correct
      `<title>`) after the `main` merge/push.
- [x] 3.5 Update public-facing demo links in `pixi`'s README (and any other
      doc referencing "demo") to add the `pixi-pro` Cloudflare demo URL
      alongside the existing Standard GitHub Pages link, clearly labeled
      so visitors know which is which (free Standard vs. paid Pro demo).
      Also fixed the README's Features table while in there — it still
      listed Layers/Color Library/Canvas settings/pixel-perfect drawing
      as shipped in Standard, stale since the extraction.

## 4. Access and distribution runbook

- [x] 4.1 Document the manual PayPal → GitHub-collaborator flow (where the
      PayPal link lives, what the buyer sees after paying, expected
      turnaround time) as an operator runbook. See `runbook.md` section
      4.1 — flags one real gap found while documenting it: PayPal doesn't
      collect the buyer's GitHub username, so there's currently no stated
      channel for a buyer to send it.
- [x] 4.2 Document the manual release-zip alternative for buyers who
      don't want/need ongoing GitHub access. See `runbook.md` section 4.2.
- [x] 4.3 Document the submodule-pin-bump process for when `pixi-pro`
      should pick up a newer `pixi` release. See `runbook.md` section
      4.3 — this is the exact process used to fix task 3.3's bug, written
      up so it's repeatable.

## 5. Docs cleanup

- [x] 5.1 Update `openspec/roadmap.md`'s "Standard/Pro tier split" entry
      under "Not yet scheduled" to point at this change instead of
      "not yet proposed."
- [x] 5.2 Note in `docs/superpowers/specs/2026-08-18-pixi-tiers-design.md`
      and `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md`
      that they're superseded by `openspec/specs/pixi-pro-distribution/`
      once this change is archived.
