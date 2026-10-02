## 1. Toast controller (TDD)

- [x] 1.1 Write failing tests in `test/toast.test.js`: add/ids/onChange, per-type durations, auto-dismiss on timer, max-3 trimming (oldest first), manual dismiss, action runs once and dismisses, pause/resume keeps remaining time
- [x] 1.2 Implement `createToastController` in `js/toast.js`

## 2. Toast DOM + styles

- [x] 2.1 Implement `showToast(message, { type, action })` in `js/toast.js`: lazy container with polite and assertive regions, rendering, dismiss/action buttons, hover/focus pause
- [x] 2.2 Add `info`/`error` icons to the `index.html` icon subset; add toast styles to `style.css` (theme tokens, safe area, danger border + icon, `pointer-events` pass-through, reduced-motion-gated entrance)

## 3. Call sites

- [x] 3.1 Timelapse export failure: `alert()` → error toast
- [x] 3.2 Unreadable image → error toast in brush import, palette import, and reference image layer
- [x] 3.3 Autosave failure → one error toast per failure streak (standalone only)
- [x] 3.4 Palette color removal → info toast with Undo (`insertColorIntoPalette` + persistence tests)
- [x] 3.5 Document the surface-vs-silent convention in `docs/code-standards.md`

## 4. Verification

- [x] 4.1 `npm test` passes
- [x] 4.2 Browser check (Playwright): each call site, stacking, hover pause, dismiss, Undo, light/dark, visible while UI hidden, touch
- [ ] 4.3 web-design-guidelines review, then code review
