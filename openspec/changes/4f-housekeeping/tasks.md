## 1. Spec sync (AUD-11, AUD-12)

- [x] 1.1 Delta for `canvas-navigation`'s right-sidebar toggle: slide, reduced motion, hidden content out of the focus order
- [x] 1.2 Delta for `brushes`' Color Library sequence mode: one shared control for Pencil/Brush
- [x] 1.3 Verify both deltas against the shipped behavior in the browser (sidebar animates and is `inert` when hidden; one `#library-sequence-toggle`, shown for Pencil/Brush only, state shared)

## 2. Docs

- [x] 2.1 Replace the "Pro extension point" / "moved to pixi-pro" sections in `docs/architecture-standards.md` and `docs/code-standards.md` with a historical note, and drop the matching "Known code issues" item
- [ ] 2.2 Close CFIX-7 (no longer applicable) and CFIX-5 (fixed) in `docs/audits/2026-08-21-code-standards-fixes.md`; update `code-standards.md`'s CFIX-5 citations

## 3. CFIX-5 (TDD)

- [ ] 3.1 Write failing tests: `REFERENCE_MODES` is exported and frozen with the two existing string values; `setReferenceMode` still rejects unknown modes
- [ ] 3.2 Add `REFERENCE_MODES` to `lib/pixel-engine/layers.js` and use it at every `referenceMode` assignment and comparison there and in `js/layers-ui.js`

## 4. Verification

- [ ] 4.1 `npm test` passes; a reference image still toggles Pixelated/Original in the browser
- [ ] 4.2 Code review
