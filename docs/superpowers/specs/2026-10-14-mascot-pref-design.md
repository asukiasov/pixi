# Show Mascot pref — design

## Goal

Let the user turn off the tool mascot bubble (`js/mascot.js`) from the
Prefs sheet.

## Behaviour

- New pref `showMascot: boolean`, default **on**. Missing or invalid
  stored values fall back to `true` (existing users keep the mascot).
- Prefs sheet, **Tools** section, below "Customize Tools…": a
  **Show Mascot** switch (`#prefs-show-mascot`) with the note
  "Pixi's axolotl pops up for a few seconds when you pick a tool."
- Off: picking a tool never shows the bubble.
- Turned off while the bubble is showing: it hides at once.
- Turned back on: the next tool pick shows it as usual (nothing is
  replayed for the current tool).

## Design

- `js/prefs.js`: add `showMascot` to the `Prefs` typedef,
  `DEFAULT_PREFS` and `normalizePrefs` (same pattern as `brushCursor`).
- `js/mascot.js`: `createMascotController` takes
  `isEnabled = () => true`. `toolPicked` hides any showing bubble as
  today, then returns early when `isEnabled()` is false.
  `initMascot(screen, { isEnabled })` passes it through and returns the
  controller.
- `js/app.js`: `initMascot(screens.workspace, { isEnabled: () => prefs.showMascot })`;
  `setPrefs` calls the controller's `hide()` when `showMascot` is off.
- `js/prefs-sheet.js`: sync/read the new switch.

Rejected: a CSS-only `data-mascot` toggle (sprite still loads, timers
still run, not unit-testable); a three-way setting (reduced motion
already shows a still frame).

## Testing

- `test/prefs.test.js`: default `true`; normalize keeps booleans,
  replaces invalid values with `true`.
- `test/mascot.test.js`: disabled controller never calls `onShow`;
  disabled pick still hides a showing bubble; `hide()` works when
  disabled after showing.
- Manual: toggle in the local app, pick tools.

## Docs

`docs/specs/tool-mascot/spec.md` (new requirement "Can be turned off"),
`docs/ui-reference.md` (Prefs row and mascot entry),
`docs/mascot/README.md` (one line), `docs/roadmap.md` (Tool mascot
section).
