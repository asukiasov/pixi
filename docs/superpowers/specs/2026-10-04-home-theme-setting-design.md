# Home screen theme setting — design

Date: 2026-10-04. Requested by the user as "add a setting for dark mode vs
light mode on the home screen".

## Problem

Pixi already has a light/dark/system theme (`js/theme.js`, persisted in
`localStorage` under `pixi-theme-preference`, resolved to `data-theme` on
`<html>`). It can only be changed inside the Workspace: the top-bar
`#theme-toggle` (docked) or the More menu's Theme group (floating). On the
Gallery, the app's entry point, there is no way to change it.

## Decision

A small frosted-glass segmented control, `#home-theme`, fixed to the
Gallery's top-right corner, with three choices: **Light**, **Dark**,
**Auto** (the existing `system` preference — follows the OS, live).

- Markup: a `<fieldset>` with a visually hidden `<legend>Theme</legend>` and
  three native `<input type="radio" name="home-theme">` inside `<label>`s,
  each showing a Material Symbol (`light_mode`, `dark_mode`,
  `brightness_auto`) plus a short visible text label. Native radios give
  arrow-key navigation, one tab stop and correct screen-reader semantics
  for free.
- Behaviour: choosing a radio calls the existing `theme.setPreference()`.
  The theme applies immediately and is saved — the same preference the
  Workspace controls edit, so all three stay in agreement.
- Sync: `initThemeToggle()` gains a `subscribe(fn)` on its returned
  object, called after every preference change, so the home control (and
  anything else) re-checks the right radio whatever changed it.
- Layout: the version badge moves from the top-right to the top-left to
  make room. At 390px the control (icons + labels) fits beside it with no
  horizontal scroll.
- Styling: reuses `.glass`; the checked segment uses the same
  `--glass-hover`-style pressed disk as the floating chrome; focus ring
  via `:focus-visible` on the radio, drawn on its label. Both themes are
  covered by existing tokens.

## Alternatives considered

- **A single cycling icon button** (like `#theme-toggle`): smaller, but a
  three-state cycle hides the options, which is worse for a setting on
  the home screen.
- **A row in the Prefs sheet**: the Prefs sheet only opens from the
  Workspace's More menu, so it doesn't solve "on the home screen".

## Out of scope

No new theme values, no change to theme resolution or storage, no
control on the New Canvas screen.

## Testing

- Unit (`test/theme.test.js`): `subscribe` listeners fire with the new
  preference after `setPreference` and after a toggle click; `bindThemeRadios`
  checks the radio matching the current preference, calls `setPreference`
  on change, and follows external changes.
- Markup/CSS (`test/home-screen.test.js`): `#home-theme` exists in
  `#screen-gallery` with three radios for light/dark/system.
- Manual/Playwright: 1180×820 and 390×844, both themes, Chromium + WebKit.
