## Why

Pixi has no shared way to tell the user something went wrong. The one
failure that does reach the user (the timelapse export) uses a blocking
`alert()`. Other user-initiated failures do nothing at all: picking an
unreadable image for a brush, palette, or reference layer just silently
does nothing. An autosave that fails (storage full, private browsing)
leaves the user believing their work is saved. Separately, 4c's
single-color removal shipped without undo, because there was nowhere to
offer one.

## What Changes

- A new toast/status-message component (`js/toast.js`): small
  non-blocking messages at the bottom-centre of the screen, in info and
  error variants. Each toast can carry one action button. All are
  dismissible, auto-hide after a delay that pauses on hover/focus, and
  stack up to 3. They are announced to screen readers, follow the
  light/dark theme, and stay visible while the interface is hidden (4d).
- A convention for when to surface vs. stay silent, recorded in the
  `status-messages` spec and `docs/code-standards.md`.
- Call sites migrated:
  - The timelapse export failure moves from `alert()` to an error
    toast.
  - Unreadable images in brush import, palette import, and the
    reference image layer each get an error toast that names the
    supported formats.
  - Autosave failure gets one error toast per failure streak (standalone
    app only).
  - Removing a palette color (4c) gets an info toast with an "Undo"
    action that puts the color back in place.

## Capabilities

### New Capabilities

- `status-messages`: the toast component's behavior, plus the
  surface-vs-silent convention.

### Modified Capabilities

- `color-library`: adds a requirement that a single-color removal can be
  undone from its toast.

## Impact

- New `js/toast.js` and `test/toast.test.js`.
- `js/workspace.js` (timelapse catch, autosave), `js/brush-import-ui.js`,
  `js/color-library-ui.js`, `js/layers-ui.js`, and `js/persistence.js`
  (insert a color at an index, for undo).
- `style.css`: toast styles.
- `docs/code-standards.md`: the error-surfacing convention.
