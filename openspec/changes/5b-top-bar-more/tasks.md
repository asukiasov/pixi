## 1. Menu-button helper

- [x] 1.1 Write `test/topbar-menu.test.js` cases for `menuKeyTarget(key, index, count)`: Down/Up step and wrap, Home/End jump, unknown keys return the same index
- [x] 1.2 Create `js/topbar-menu.js` with `menuKeyTarget` and `initMenuButton(button, menu, { onOpen, keepOpen })`: aria-haspopup/aria-expanded, fixed positioning below the button (flip/clamp like existing popovers), focus first enabled item, arrows/Home/End skipping disabled items, Enter/Space activate, Escape closes and refocuses the button, outside pointerdown closes, only one top bar menu open at a time (design.md decision 3)

## 2. Shared helpers

- [x] 2.1 Add `visibleAnchor(el, fallback)` to `js/layout.js` with tests in `test/layout.test.js` (element with a box → itself, zero-size box → fallback)
- [x] 2.2 Make `initThemeToggle` return `{ getPreference, setPreference }`; add tests in `test/theme.test.js` that `setPreference` saves, applies, and updates the docked button's label; confirm the click cycle is unchanged

## 3. Markup and CSS

- [x] 3.1 Add to `.workspace-topbar` in `index.html`, all with `.floating-only`: `#topbar-title`, the zoom pill button + `#zoom-menu` (100%, Fit, Fill, Zoom out, Zoom in), `#more-button` + `#more-menu` (Canvas settings, Export, Record timelapse checkbox, Tile preview checkbox, Theme radio group, Hide interface), with `magnetic-hover` and `data-tooltip` on the new buttons; place them so the floating order matches the spec (Back, title, pill, kept toggles, Undo, Redo, More)
- [x] 3.2 ~~Copy the same markup into `lib/pixi.js`'s workspace template~~ Not needed: the embed's top bar is a cut-down subset (no Canvas settings/Record/Hide/More targets) and is always docked, so it gets no floating-only markup; the new wiring is null-safe instead (see design.md decision 7)
- [x] 3.3 CSS: hide `.floating-only` in the docked layout; in `[data-layout="floating"]` hide `#canvas-settings-toggle`, `#export-button`, `#record-toggle`, `#tile-preview-toggle`, `#theme-toggle`, `#hide-ui-toggle` and `.bottom-bar`; style the title (ellipsis), pill, menus (44px rows, glass or popover surface, both themes) and the `:has(#record-toggle.recording)` dot on More with the reduced-motion rule
- [x] 3.4 Extend `test/floating-layout-css.test.js`: moved controls and `.bottom-bar` are hidden only under `[data-layout="floating"]`, `.floating-only` is hidden outside it, the recording-dot rule has a reduced-motion guard

## 4. Wiring

- [x] 4.1 Wire the zoom pill with `initMenuButton`: items forward clicks to `#zoom-preset-*` / `#zoom-in-button` / `#zoom-out-button`, Zoom in/out keep the menu open; update the pill text next to the existing `zoomReadout` update
- [x] 4.2 Wire More with `initMenuButton`: items forward clicks to their old buttons (comment each with the source id for 5h); `onOpen` copies `.active` → `aria-checked` and `disabled`/label for Record and Tile preview; Theme radios call `setPreference` and stay open
- [x] 4.3 Route `positionPanel` (`js/export.js`, `js/canvas-settings.js`) and `positionTimelapsePanel` (`js/workspace.js`) through `visibleAnchor(toggle, moreButton)`; ~~add More button/menu to each popover's outside-click "inside" check~~ not needed: the item's pointerdown lands while the popover is still closed
- [x] 4.4 Set `#topbar-title` text and `title` on project open and in `onRename`
- [x] 4.5 Update More's accessible name to "More (recording)" / "More" - done in `js/floating-topbar.js` by observing `#record-toggle`'s class, so it can't miss a path that adds/removes `.recording`
- [x] 4.6 In `setUiHidden`, focus `visibleAnchor(hideUiToggle, moreButton)` when the interface comes back

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 Serve locally, floating layout: top bar contents match the spec; each More item works (Canvas settings/Export/timelapse review open next to More and fully on screen; Tile preview and Record show checked state; Theme picks persist across reload; Hide interface and Tab, and focus on return); red dot while recording; zoom pill menu (Fit closes, Zoom in stays open, % tracks Ctrl/Cmd +/− and pinch); no bottom zoom bar and Fit uses the freed space; long project name truncates; keyboard-only pass through both menus
- [x] 5.3 Serve locally without the parameter: docked top bar and bottom zoom bar unchanged and every control works as before
- [x] 5.4 Run `web-design-guidelines` on the changed markup/CSS/JS before code review
- [x] 5.5 Update `docs/ui-reference.md`'s floating-layout paragraph to describe the slim top bar, zoom pill and More menu
