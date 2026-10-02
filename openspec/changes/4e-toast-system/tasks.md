## 1. Toast controller (TDD)

- [ ] 1.1 Write failing tests in `test/toast.test.js`: add/ids/onChange, per-type durations, auto-dismiss on timer, max-3 trimming (oldest first), manual dismiss, action runs once and dismisses, pause/resume keeps remaining time
- [ ] 1.2 Implement `createToastController` in `js/toast.js`

## 2. Toast DOM + styles

- [ ] 2.1 Implement `showToast(message, { type, action })` in `js/toast.js`: lazy container with polite and assertive regions, rendering, dismiss/action buttons, hover/focus pause
- [ ] 2.2 Add `info`/`error` icons to the `index.html` icon subset; add toast styles to `style.css` (theme tokens, safe area, danger border + icon, `pointer-events` pass-through, reduced-motion-gated entrance)

## 3. Call sites

- [ ] 3.1 Timelapse export failure: `alert()` → error toast
- [ ] 3.2 Unreadable image → error toast in brush import, palette import, and reference image layer
- [ ] 3.3 Autosave failure → one error toast per failure streak (standalone only)
- [ ] 3.4 Palette color removal → info toast with Undo (`insertColorIntoPalette` + persistence tests)
- [ ] 3.5 Document the surface-vs-silent convention in `docs/code-standards.md`

## 4. Verification

- [ ] 4.1 `npm test` passes
- [ ] 4.2 Browser check (Playwright): each call site, stacking, hover pause, dismiss, Undo, light/dark, visible while UI hidden, touch
- [ ] 4.3 web-design-guidelines review, then code review
