## 1. Persistence (TDD)

- [x] 1.1 Write failing tests for `removeColorFromPalette(id, index)`: removes exactly one occurrence by index, leaves duplicates elsewhere, ignores out-of-range indices and unknown ids, bumps `updatedAt`
- [x] 1.2 Implement `removeColorFromPalette` in `js/persistence.js`

## 2. Edit mode UI

- [x] 2.1 Add the `#edit-palette-colors-button` toggle to the Color Library header in `index.html` (`edit` icon, `aria-pressed`)
- [x] 2.2 In `js/color-library-ui.js`, add edit-mode state; swatch click removes in edit mode and picks otherwise; swatch `aria-label`s switch; the default palette's last swatch is disabled
- [x] 2.3 Exit edit mode on toggle, Escape, palette switch, palette create/delete, and workspace reset
- [x] 2.4 Add `style.css` edit-mode swatch styling (× overlay, dashed border) for light and dark themes

## 3. Verification

- [x] 3.1 `npm test` passes
- [x] 3.2 Browser check (Playwright): remove with mouse and touch, the Foreground color is unchanged, removal persists across reload, duplicates, Escape/switch exits, Material keeps its last color, user palette empties to the empty state
- [x] 3.3 web-design-guidelines review, then code review
