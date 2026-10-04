## 1. Shortcut predicate (TDD)

- [x] 1.1 Write failing tests in `test/hide-ui.test.js` for `isHideUiShortcut` (plain Tab with body/null/canvas-container focus → true; Shift/Meta/Ctrl/Alt+Tab, other keys, or focus on a button/input → false)
- [x] 1.2 Implement `js/hide-ui.js` until the tests pass

## 2. Workspace wiring

- [x] 2.1 `index.html`: add `#hide-ui-toggle` to the top bar, `#show-ui-button` to the workspace screen, and the `fullscreen`/`fullscreen_exit` icons to the font subset
- [x] 2.2 `js/canvas-view.js`: add public `panBy(dx, dy)`
- [x] 2.3 `js/workspace.js`: `setUiHidden(hidden)` (class toggle, pan compensation, focus handoff), button handlers, Tab/Escape keydown, and a reset on workspace open
- [x] 2.4 `style.css`: `.ui-hidden` region hiding plus the floating button (safe-area insets, light/dark)

## 3. Verification

- [x] 3.1 `npm test` passes
- [x] 3.2 Browser check (Playwright): every region hides, the canvas doesn't move, drawing works while hidden, the restore button works by click and touch, Tab toggles only with nothing focused, Escape restores, a project switch resets it, light/dark screenshots
- [x] 3.3 web-design-guidelines review, then code review
