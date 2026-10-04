# Home Theme Setting Implementation Plan

**Goal:** A Light/Dark/Auto segmented control on the Gallery.
Design: `docs/superpowers/specs/2026-10-04-home-theme-setting-design.md`.

### Task 1: `subscribe` + `bindThemeRadios` in `js/theme.js` (TDD)
- Tests first in `test/theme.test.js`, then implement.
- `initThemeToggle()` returns `{ getPreference, setPreference, subscribe }`.
- `bindThemeRadios(radios, theme)`: checks the radio whose `value` equals
  the preference, `change` → `theme.setPreference(radio.value)`,
  subscribes to keep `checked` in sync.

### Task 2: Markup + CSS
- `#home-theme` fieldset in `#screen-gallery` (index.html); icon names
  already in the font subset (used by the More menu).
- `.home-theme` styles in style.css; version badge to top-left.
- Test in `test/home-screen.test.js`.

### Task 3: Wire in `js/app.js`
- `bindThemeRadios([...document.querySelectorAll('#home-theme input')], theme)`.

### Task 4: Docs
- `docs/specs/gallery/spec.md` requirement, `docs/ui-reference.md` entry,
  `docs/roadmap.md` note.

### Task 5: Verify
- `npm test`, Playwright screenshots (both themes, 1180 and 390 widths),
  web-design-guidelines review, code review, merge, push.
