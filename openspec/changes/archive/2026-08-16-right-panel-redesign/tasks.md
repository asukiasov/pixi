## 1. Panel reorder and sizing

- [x] 1.1 Move `#color-library-panel`'s markup block above `#layers-panel`
      in `index.html` (Brushes stays between them, per design.md)
- [x] 1.2 `.color-library-panel`: `flex: 1` → `max-height: clamp(200px,
      30vh, 250px)` with its own `overflow-y: auto` in `style.css`
- [x] 1.3 `.layers-panel`: `max-height: 35%` → `flex: 1; min-height: 0`
      in `style.css`
- [x] 1.4 `.color-library-grid`: `minmax(1.6rem, 1fr)` → `minmax(19px,
      1fr)`, trim `gap` to `0.25rem`
- [x] 1.5 Manual check: with a tall window and a short palette, confirm
      Color Library stays bounded and Layers absorbs the extra space

## 2. Whole-sidebar visibility toggle

- [x] 2.1 Add `state.rightSidebarVisible` (default `true`) to the state
      object in `js/workspace.js`
- [x] 2.2 Add a new icon button to `.workspace-topbar` in `index.html`
      (e.g. `panel_right` Material icon, `data-tooltip="Right panel"`)
- [x] 2.3 Wire the button: toggle `state.rightSidebarVisible`, toggle a
      `hidden` class on `#right-sidebar`, toggle the button's `active`
      class - mirroring `#layers-panel-toggle`'s existing pattern
- [x] 2.4 Manual check: hiding the sidebar lets the canvas area expand;
      showing it again restores the prior width with each panel's
      collapsed/expanded state unchanged

## 3. Per-panel collapse (accordion)

- [x] 3.1 Add a chevron icon to `.color-library-header` and
      `.layers-panel-header` in `index.html`
- [x] 3.2 Add `.color-library-panel.collapsed` / `.layers-panel.collapsed`
      CSS: hide the body content, cap the panel's height to the header's
      own height, rotate the chevron
- [x] 3.3 Repurpose `state.layersPanelVisible` semantics to mean
      "expanded" (add a clarifying comment at its declaration); wire
      `#layers-panel-toggle` and the new Layers header click to the same
      state, both toggling the `collapsed` class instead of `hidden`
- [x] 3.4 Add `state.colorLibraryCollapsed` (default `false`); wire the
      Color Library header click to toggle it and the `collapsed` class
      (no bottom-bar entry point for this one)
- [x] 3.5 Manual check: collapsing one panel lets the other grow into
      the freed space; both toggle entry points for Layers stay in sync

## 4. Layers toolbar one-line Blend mode + Opacity

- [x] 4.1 `.layers-panel-toolbar`: `flex-direction: column` → `row;
      align-items: center` in `style.css`
- [x] 4.2 `.layers-panel-blend-select`: `width: 100%` → `width: auto`
      (with a sensible `max-width`)
- [x] 4.3 In `index.html`, turn `#layers-panel-opacity-readout` into a
      `<button>` and move the existing `#layers-panel-opacity-slider`
      out of the always-visible row into a new
      `#layers-panel-opacity-popover` (hidden by default), which also
      contains a small `<input type="number">` for direct entry
      alongside the slider
- [x] 4.4 In `js/workspace.js`, wire the readout button's click to open/
      position the popover, reusing `openColorPicker`'s viewport-clamp
      math (anchored below the toolbar row); wire outside-click/Escape
      to close it, same listener pattern as the color-picker popover
- [x] 4.5 Wire the popover's number input and slider to both update the
      active layer's opacity live and stay in sync with each other
- [x] 4.6 Manual check: Blend mode + Opacity fit on one row at the
      sidebar's normal width; typing a number and dragging the slider
      both work and stay in sync; popover clamps on-screen near the
      viewport edge

## 5. Right-sidebar tooltip fix

- [x] 5.1 In `bindTooltips()`'s `show()` (`js/workspace.js`), add a
      `target.closest('.right-sidebar')` branch alongside the existing
      `isTopbar` check
- [x] 5.2 For that branch, measure `tooltipEl`'s width after setting its
      content, then position `left = rect.left - tooltipWidth - 12`,
      keep vertical centering
- [x] 5.3 Add a `.tool-tooltip.left-side` CSS modifier mirroring the
      `::after` arrow to the opposite edge; toggle that class in the new
      branch
- [x] 5.4 Manual check: hover every right-sidebar icon button (e.g.
      Color Library's "Add current color") and confirm its tooltip
      renders fully on-screen, arrow pointing at the button

## 6. Verification

- [x] 6.1 Run the existing test suite (`npm test`) - no regressions
      expected since this change is presentation-only
- [x] 6.2 Manual pass through every scenario in
      `specs/layers/spec.md`, `specs/color-library/spec.md`, and
      `specs/canvas-navigation/spec.md`
