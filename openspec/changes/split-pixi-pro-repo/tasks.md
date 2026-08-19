## 1. Repo scaffolding

- [x] 1.1 Create the private `pixi-pro` GitHub repo (empty, no fork).
- [x] 1.2 Confirm `pixi` has a released tag to pin to; if not, cut one.
      (`v0.2.0` already existed.)
- [x] 1.3 Add `pixi` as a git submodule in `pixi-pro`, pinned to that tag
      (not tracking `main`).
- [ ] 1.4 Set up `pixi-pro`'s top-level structure (Pro module directories,
      entry point that loads the `pixi` submodule plus Pro-only files) —
      no build step, matching `pixi`'s plain HTML/CSS/JS/ES-modules stack.

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
- [ ] 2.2 Per feature, in `pixi`: remove its JS module(s), `index.html`
      markup, CSS, and call sites in shared files (`app.js`,
      `workspace.js`, `engine.js`, `persistence.js`), verifying Standard's
      remaining tools have no leftover dependency on the removed code path
      after each removal. Port each removed feature's code into `pixi-pro`
      as an additive module (starting point, not a rewrite), wired into
      `pixi`'s existing extension points from outside the submodule, per
      design.md's "Extraction before addition" and "no engine forking"
      decisions.
- [ ] 2.3 Verify `pixi-pro`, built and run, has the full Standard + Pro
      toolset working end to end (manual smoke test against the tier
      matrix in `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md`).
- [ ] 2.4 Verify `pixi` (Standard), unchanged, still has no Pro-only
      features present.

## 3. Demo deployment

- [ ] 3.1 Create a Cloudflare Pages project connected to the private
      `pixi-pro` repo (GitHub App install with repo access).
- [ ] 3.2 Configure auto-deploy on push/tag, no build command (static
      files served as-is).
- [ ] 3.3 Deploy and verify the live demo URL serves the full,
      unrestricted Pro app — no watermark, export/save fully functional.
- [ ] 3.4 Confirm `pixi`'s existing GitHub Pages deploy is unaffected.
- [ ] 3.5 Update public-facing demo links in `pixi`'s README (and any other
      doc referencing "demo") to add the `pixi-pro` Cloudflare Pages demo
      URL alongside the existing Standard GitHub Pages link, clearly
      labeled so visitors know which is which (free Standard vs. paid Pro
      demo).

## 4. Access and distribution runbook

- [ ] 4.1 Document the manual PayPal → GitHub-collaborator flow (where the
      PayPal link lives, what the buyer sees after paying, expected
      turnaround time) as an operator runbook.
- [ ] 4.2 Document the manual release-zip alternative for buyers who
      don't want/need ongoing GitHub access.
- [ ] 4.3 Document the submodule-pin-bump process for when `pixi-pro`
      should pick up a newer `pixi` release.

## 5. Docs cleanup

- [ ] 5.1 Update `openspec/roadmap.md`'s "Standard/Pro tier split" entry
      under "Not yet scheduled" to point at this change instead of
      "not yet proposed."
- [ ] 5.2 Note in `docs/superpowers/specs/2026-08-18-pixi-tiers-design.md`
      and `docs/superpowers/specs/2026-08-17-tier-matrix-worksheet.md`
      that they're superseded by `openspec/specs/pixi-pro-distribution/`
      once this change is archived.
