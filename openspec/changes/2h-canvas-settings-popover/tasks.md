## 1. Popover conversion

- [x] 1.1 `index.html`: `#canvas-settings-panel`'s header row gains
      `#canvas-settings-close` (close icon button), matching
      `#color-picker-popover`'s header pattern
- [x] 1.2 `style.css`: `.canvas-settings-panel` switches from a docked,
      full-width, `border-top`-only block to `position: fixed` popover
      styling (background, border, radius, shadow, `z-index: 60`, fixed
      `15rem` width) matching `.color-picker-popover`; `.canvas-settings-row`
      loses its bottom-margin-per-row spacing in favor of the popover's own
      flex `gap`; new `.canvas-settings-header-row` for the title/close row
- [x] 1.3 `js/canvas-settings.js`: new `positionPanel(panel, anchorEl)` -
      unhide-then-clamp below the anchor, flipping above if it would
      overflow the viewport bottom, clamped horizontally too (same
      pattern as `js/workspace.js`'s `openColorPicker`, adapted for
      below- instead of beside-anchor)
- [x] 1.4 `initCanvasSettings`: toggle button click now unhides +
      repositions (if it was hidden) or closes (if it was open) instead
      of a plain `.hidden` toggle; new `close()` local function wired to
      the new close button, outside-`pointerdown`, and Escape - same
      three dismissal paths `closeColorPicker` already offers
- [x] 1.5 `initCanvasSettings`'s returned object gains a `close()`
      method; `js/workspace.js`'s per-project reset block calls
      `canvasSettingsControls.close()` so a freshly opened project always
      starts with it closed
- [x] 1.6 Playwright: opening Canvas Settings renders it below the gear
      icon, positioned via `position: fixed` (canvas/palette row/bottom
      bar bounding boxes unchanged before/after opening); close button
      hides it; re-run full `node --test` suite (103/103)
