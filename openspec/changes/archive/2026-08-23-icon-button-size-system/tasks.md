## 1. Size scale foundation

- [x] 1.1 Add `--icon-size-xs` (1.4rem), `--icon-size-s` (1.6rem),
      `--icon-size-m` (1.8rem), `--icon-size-l` (2.2rem), `--icon-size-xl`
      (2.6rem) custom properties to `:root` in `style.css`.
- [x] 1.2 Update base `.icon-button` to use `var(--icon-size-xl)` for its
      `width`/`height` (no visual change).
- [x] 1.3 Update `.tools-sidebar .tool-button` to use `var(--icon-size-xl)`.
- [x] 1.4 Update `.zoom-controls .icon-button` to use `var(--icon-size-l)`.
- [x] 1.5 Update `.bottom-bar-group .icon-button` to use
      `var(--icon-size-xl)`.
- [x] 1.6 Update `.color-picker-popover-header .icon-button` to use
      `var(--icon-size-s)`.
- [x] 1.7 Update `.layer-visibility-toggle`, `.layer-reference-smoothing-
      toggle`, `.layer-reorder-button`, `.layer-delete-button` to use
      `var(--icon-size-xs)`.

## 2. Fix: Color Library header overflow

- [x] 2.1 Change `.color-library-header-actions .icon-button` from
      1.8rem to `var(--icon-size-xs)`.
- [x] 2.2 Add `min-width: 0; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap;` to `.color-library-header h2` so the label
      truncates instead of forcing overflow.
- [x] 2.3 Verify in-browser at the sidebar's normal clamped width (~13rem)
      that all Color Library header icon buttons are visible with no
      horizontal scrollbar.

## 3. Fix: reference image layer row overflow

- [x] 3.1 Reduce `.layer-name-input`'s `min-width` from 3rem to a smaller
      floor (start at 2rem, adjust after visual check).
- [x] 3.2 Tighten `.layer-row-actions`'s gap if still needed after 3.1.
- [x] 3.3 If controls still don't fit on one line at the sidebar's normal
      clamped width, add `flex-wrap: wrap` to `.layer-row` (or a narrower
      scope if only the reference-image row needs it) so controls wrap
      instead of overflowing horizontally.
- [x] 3.4 Verify in-browser with a reference image layer present that
      visibility, thumbnail, name, lock icon, smoothing toggle, and
      up/down/delete are all visible/reachable with no horizontal
      scrollbar.

## 4. Verification

- [x] 4.1 Run `web-design-guidelines` skill against the CSS/DOM diff.
- [x] 4.2 Manually spot-check tool rail, top bar, bottom bar, zoom
      controls, and color picker popover for unintended visual size
      changes (should be none).
- [x] 4.3 Run `superpowers:requesting-code-review`.
- [x] 4.4 Screenshot both fixed containers (Color Library header, reference
      image layer row) at the sidebar's normal clamped width as evidence.
