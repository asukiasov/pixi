## Context

See proposal.md for motivation. `js/confirm-dialog.js` already sets the
pattern for app-wide overlays: lazily built DOM appended to `<body>`,
usable from any screen, with no `index.html` changes. The only test
runner is `node --test` with no DOM.

## Goals / Non-Goals

**Goals:** one tiny API (`showToast`) that any module can call; testable
lifetime logic; accessible by default; a written rule so future call
sites choose consistently.

**Non-Goals:** progress or loading toasts, persistent notification
history, toasts inside the `Pixi.mount()` embed's own error surface (an
embed host gets adapter errors from its own adapter), success toasts for
routine actions (the existing confetti and celebration cover those).

## Decisions

**1. A pure controller plus a thin DOM layer.**
`createToastController({ onChange, setTimer, clearTimer, now })` owns
the visible list, ids, the max-3 trimming, per-type durations, and
pause/resume (with remaining time tracked across pauses). The DOM layer
renders the list on each `onChange` and wires hover, focus, and buttons
to `pause`, `resume`, and `dismiss`. Tests drive the controller with a
fake clock. *Alternative:* test only through Playwright. Rejected,
because the timing rules are the error-prone part and deserve fast unit
tests.

**2. Two live regions, created up front.** On first use, the container
is built with two child regions: `role="status"` (polite) for info and
`role="alert"` (assertive) for errors. The first message's text is
inserted on the next animation frame, so screen readers that only watch
pre-existing regions still announce it.

**3. Placement: bottom-centre, above everything except the confirm
modal.** `position: fixed; bottom: calc(env(safe-area-inset-bottom) +
4.5rem)` clears the bottom zoom bar. `z-index` is 90, below
`.confirm-overlay`'s 100, so a modal still covers toasts. Toasts live
outside `#screen-workspace`, so 4d's `.ui-hidden` never hides them. The
container itself is `pointer-events: none`; only toasts take pointer
events, so the empty strip never blocks drawing.

**4. Errors aren't color-only.** Error toasts get a `--color-danger` left
border *and* an `error` icon glyph. Info toasts use the `info` glyph.
Both glyphs are added to `index.html`'s `icon_names` subset, which must
stay alphabetical.

**5. Autosave failure is throttled by a flag.** `autoSave()` catches a
rejected save. It shows the error toast only when `saveFailureShown` is
false, then sets it; a later successful save clears it. This only
happens in the standalone app (`root === document`): an embed's host
supplies its own storage adapter and owns that error surface.

**6. Undo for color removal re-inserts by index.** A new
`insertColorIntoPalette(id, index, hex)` (clamped to the list length)
mirrors `removeColorFromPalette`. The toast captures the palette id,
index, and hex at removal time, so undo still targets the right palette
after a switch.

## Risks / Trade-offs

- [Toasts could cover canvas content at the bottom-centre] → They are
  small, short-lived, dismissible, and pass pointer events through
  outside the toast box.
- [Two quick removals produce two Undo toasts whose indices could
  interact] → Each undo re-inserts by its own captured index, clamped to
  the current length. Undoing in reverse order restores exactly; any
  other order restores every color, possibly with a shifted position.
  This is acceptable for a palette.
