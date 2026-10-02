## 1. Pure helpers (TDD)

- [x] 1.1 Write failing tests in `test/layer-rename.test.js` for `isDoubleTap` (same layer within window → true; different layer, too slow, too far, no previous → false)
- [x] 1.2 Write failing tests for `resolveLayerRename` (trims; empty/whitespace → null; unchanged → null)
- [x] 1.3 Implement and export both helpers from `js/layers-ui.js` until the tests pass

## 2. Layers panel UI

- [x] 2.1 Replace the always-live name `<input>` in `buildLayerRow` with a focusable `.layer-name` span (title hint, Enter/F2 to rename)
- [x] 2.2 Track the last plain click on a name in the row click handler, and on a detected double swap the span for a focused, fully selected input without re-rendering
- [x] 2.3 Wire Enter/blur commit (via `resolveLayerRename` + `renameLayer` + `commit()`), Escape cancel, and a guard against double commit
- [x] 2.4 Update `style.css`: style the `.layer-name` label (truncation, active-row color), keep `.layer-name-input` for edit mode

## 3. Verification

- [x] 3.1 `npm test` passes
- [x] 3.2 Browser check (Playwright): single click selects with no input; double-click renames; touch double-tap renames (touch emulation); Enter/Escape/blur; empty name; undo restores the old name
- [x] 3.3 web-design-guidelines review of the changed UI code, then code review
