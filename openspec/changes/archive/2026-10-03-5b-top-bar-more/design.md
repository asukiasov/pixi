## Context

See proposal.md for motivation and specs/floating-workspace/spec.md for
the required behaviour.

Current state that shapes the approach:

- Each top bar control is wired directly to its button by id:
  - `initExport` and `initCanvasSettings` each attach a click listener to
    their toggle and position their popover below it (`positionPanel`,
    duplicated in each module).
  - The record toggle and its review popover are wired inside
    `workspace.js` (`bindDomOnce`), and the review popover is anchored
    to `#record-toggle`.
  - Tile preview keeps its on/off state in the button's `.active` class.
  - `initThemeToggle(button)` cycles the theme, saves it, and owns the
    button's icon and label.
  - Hide interface goes through `setUiHidden()`. When the interface comes
    back, focus returns to `#hide-ui-toggle` (`workspace.js`, ~line 479).
- The zoom readout and presets are wired to `.bottom-bar` buttons in
  `bindDomOnce`. The readout text is set from `CanvasView`'s zoom
  callback.
- 5a's `measureClearInsets` already skips cards that are
  `display: none`, because a hidden element has a zero-size box. So once
  the bottom bar is hidden, Fit stops counting it without any change.
- 5a puts the glass blur on a `::before` layer. That keeps
  `position: fixed` popovers inside a card positioned against the
  viewport rather than the card, so a menu placed inside the header is
  not clipped.
- 5h deletes the docked layout. Anything that exists only to keep both
  layouts running should be easy to delete then.

## Goals / Non-Goals

**Goals:**
- One accessible menu-button helper, shared by the zoom pill and More,
  and reusable for later Phase 5 menus.
- No duplicate copies of each feature's logic. A menu item triggers the
  existing feature code instead of re-implementing it.
- The docked layout stays byte-for-byte unchanged in behaviour.

**Non-Goals:**
- Editing the title inline. Rename stays in Canvas Settings.
- Moving Pixel-perfect, Symmetry, Layers and the right-sidebar toggle.
  5d and 5e move them.
- Prefs in More. That comes with 5g.
- Restyling the popovers that open from More.
- Phone widths. That is a post-5h follow-up.

## Decisions

### 1. Menu items forward to the existing buttons

Most More and zoom items call `.click()` on the existing, now-hidden
control: `#canvas-settings-toggle`, `#export-button`, `#record-toggle`,
`#tile-preview-toggle`, `#hide-ui-toggle`, `#zoom-in-button`,
`#zoom-out-button` and `#zoom-preset-*`. Theme is the exception (see
decision 4).

- **Why:** the existing click handlers already hold the logic: export
  defaults reset, the record start/stop branches, the
  unsupported-browser disable. Forwarding means one code path in both
  layouts, and 5h only has to move the listeners off the deleted buttons.
- **Alternative:** expose `open()` and `toggle()` functions from each
  module and call them from both places. This is cleaner in the long
  run, but it touches five modules' public shape now for a layout that
  is still dev-only. 5h can do that refactor when the old buttons go.
- **Item state is read when the menu opens, not stored:**
  - Record and Tile preview set `aria-checked` from the source button's
    `.active` class.
  - Record copies the source button's `disabled` state and label, which
    carries the "not supported in this browser" text.
  - So there is no second copy of the state to keep in sync.

### 2. Popovers anchor to whichever control is visible

Add a small helper, `visibleAnchor(el, fallback)`, to `js/layout.js`. It
returns `el` if `el` has a box. Otherwise it returns `fallback`, the More
button.

- `positionPanel` in `export.js` and `canvas-settings.js`, and
  `positionTimelapsePanel` in `workspace.js`, pass their toggle through
  this helper.
- The popovers' outside-click guards also treat a press on the More
  button or the More menu as "inside", so the menu press that opened a
  popover doesn't immediately close it.
- **Alternative:** pass an explicit anchor from the menu. Rejected,
  because popovers also reopen or reposition on their own (re-click,
  resize), and those paths would need the anchor threaded through too.
- Right-aligned anchors: `positionPanel` currently left-aligns to the
  anchor, and More sits at the inline end. The existing horizontal clamp
  already keeps the popover on screen, so no new alignment logic is
  needed. If it looks off during verification, align the popover's end
  edge to the anchor's end edge.

### 3. Menu-button helper: `js/topbar-menu.js`

- **Pure, unit-tested function:** `menuKeyTarget(key, index, count)`
  maps Up/Down/Home/End to the next item index, wrapping at the ends.
  Disabled items are filtered out before the index is used.
- **DOM function:**
  `initMenuButton(button, menu, { onOpen, keepOpen })` handles:
  - the `aria-haspopup="menu"` and `aria-expanded` attributes
  - opening the menu with `position: fixed` below the button, with the
    same flip and clamp rules as the existing popovers
  - moving focus to the first enabled item when the menu opens
  - closing the menu and returning focus to the button on Escape
  - closing the menu on a pointerdown outside it
  - closing the menu after an item is activated, unless `keepOpen(item)`
    returns true (Zoom in and Zoom out, and the Theme radios)
  - closing any other open top bar menu, through a module-level
    "currently open" reference, so only one menu is open at a time
- `onOpen` refreshes the item states described in decision 1.
- Markup:
  - `role="menu"` holds `role="menuitem"` items, plus
    `role="menuitemcheckbox"` for Record and Tile preview.
  - Theme is a `role="group"` labelled "Theme", holding three
    `role="menuitemradio"` items.
- Menu items use the existing icon-plus-label row styles and the 44px
  minimum touch size (`icon-button-sizing`).

### 4. Theme: expose get and set

`initThemeToggle(button)` now returns `{ getPreference, setPreference }`.
The click cycle on the docked button is unchanged. `setPreference` saves
the choice, applies it, and refreshes the docked button's icon and
label, so both controls always agree. The Theme radios call
`setPreference` directly. Forwarding a click would only cycle, which
can't select a specific value.

### 5. Recording dot and accessible name

- **The dot is CSS:**
  `[data-layout="floating"] .workspace-topbar:has(#record-toggle.recording) #more-button::after`.
  Its pulse follows the reduced-motion rule of the existing
  `.recording` dot.
- **Why CSS:** it can't drift from the real recording state. `:has()` is
  supported by every engine Pixi targets (Safari 15.4+, Chromium 105+).
- **The label is JS:** the More button's accessible name changes from
  "More" to "More (recording)". That one attribute is updated in the two
  places that already add or remove `.recording`: the record click
  handler and the reset on project open.

### 6. Title and zoom pill text

- **Title:** `#topbar-title` is set wherever `state.projectName` changes
  (project open and `onRename`). Its `title` attribute holds the full
  name, and CSS truncates it (`min-width: 0`, `text-overflow: ellipsis`,
  `flex: 1 1 auto`). Being the flexible item, it absorbs the spare
  space, so the other controls keep their size.
- **Zoom pill:** its text is updated next to the existing `zoomReadout`
  update in the zoom callback.

### 7. Show and hide by CSS only

- **New markup** (title, pill, More, both menus) carries a
  `.floating-only` class. The docked layout hides it with
  `display: none`.
- **Floating layout hides** with `display: none` the top bar buttons
  that moved into More, and `.bottom-bar`.
- Nothing is created or removed by JS based on the layout.
- `Pixi.mount()` gets no new markup. Its top bar template is already a
  cut-down subset (no Canvas Settings, Record or Hide interface buttons)
  and it is always docked. The `workspace.js` hooks for the title, the
  zoom pill and the anchors look up their elements null-safely, so the
  embed is unaffected.
- The menus are wired once from `js/app.js` by a new
  `js/floating-topbar.js`, and only in the floating layout. That module
  needs no workspace state, because every item forwards to a DOM button
  or calls the theme controller `app.js` already holds.

### 8. Focus after un-hiding the interface

`setUiHidden(false)` currently moves focus to `#hide-ui-toggle`. In the
floating layout that button is hidden, so focus would be lost. Use
`visibleAnchor(hideUiToggle, moreButton)` as the focus target.

## Risks / Trade-offs

- **[Forwarded clicks hide coupling]** A future change to an old
  button's handler silently changes the menu item too. → This is the
  intent until 5h. Leave a comment on each forwarding line naming the
  source button, so 5h can find and replace them.
- **[Popover outside-click races]** The menu item's pointerdown happens
  before the popover opens, so the popover's outside-click handler
  doesn't see it. But a later pointerdown on More, to open the menu
  again, would close the popover. → This is accepted. It matches how
  pressing another top bar button closes a popover today. Decision 2's
  guard covers only the press that opens the popover.
- **[Escape with nested layers]** Escape could close both an open menu
  and a popover. → The menu never stays open while a popover it opened
  is showing, because activating an item closes the menu first.
- **[Tooltip/magnetic-hover on new buttons]** → Give them the existing
  `magnetic-hover` class and `data-tooltip`, so `topbar-magnetic-hover`
  keeps holding for every top bar button.
- **[Embed (`lib/pixi.js`) lacks the new elements]** → Intended (see
  decision 7). Every new lookup in `workspace.js` is null-safe, and
  the existing embed tests must keep passing.

## Migration Plan

- Dev-only behind `?layout=floating`. Nothing changes for users.
- Rollback is reverting the change.
- 5h removes the hidden old buttons and replaces the forwarding with
  direct calls.
