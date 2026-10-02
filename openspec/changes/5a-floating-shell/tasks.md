## 1. Layout switch

- [x] 1.1 Write `test/layout.test.js` cases for `resolveLayout(search)`: no query → `'docked'`, `?layout=floating` → `'floating'`, other values and mixed params → correct result
- [x] 1.2 Create `js/layout.js` with `resolveLayout` and `applyLayout(root, layout)` (sets/removes `data-layout` on `#screen-workspace`)
- [x] 1.3 Call it from `js/app.js` at boot; confirm with a quick check that `lib/pixi.js` never calls it

## 2. Tokens and glass card

- [x] 2.1 Add `--float-radius`, `--float-gap`, `--float-edge`, `--glass-tint`, `--glass-blur`, `--float-shadow` to `:root`, with a light-theme `--glass-tint`
- [x] 2.2 Add `.glass`: opaque base, blur layered on under `@supports` (with `-webkit-` prefix) on a `::before` layer, removed again under a positive `(prefers-reduced-transparency: reduce)` query (see design.md decision 4)
- [x] 2.3 Add CSS-parsing tests (same approach as `test/text-selection.test.js`) asserting the opaque base exists outside the blur conditions and the reduce-transparency guard is present

## 3. Floating layout and slots

- [x] 3.1 Grep JS for measurements of `.workspace-body`/`.workspace-main`; resolve any before using `display: contents`
- [x] 3.2 Add `.slot-top`/`.slot-tools`/`.slot-panels`/`.slot-options` classes to the existing elements in `index.html` (wrap palette row + selection controls + bottom bar in one `.slot-options` group) and mirror the markup change in `lib/pixi.js`'s workspace markup
- [x] 3.3 Add `.workspace-screen[data-layout="floating"]` rules: full-screen `.canvas-container`, `display: contents` wrappers, slot positioning via logical insets and side variables, safe-area margins, `.glass` applied to each card
- [x] 3.4 Make the right-sidebar hide/show work as a card (no width animation pushing the canvas) in the floating layout
- [x] 3.5 Add a CSS test asserting slot rules use only logical insets (no `left:`/`right:` inside `[data-layout="floating"]` region rules)

## 4. Clear-area fit

- [x] 4.1 Write tests for a pure `clearInsets(containerRect, cards)` in `js/layout.js`: each slot side, hidden cards ignored, gap added, overlapping cards take the max
- [x] 4.2 Implement `clearInsets`, then add the optional `getClearInsets` option to `CanvasView` and use it in `resetView()` and the Fill/100% presets (zero insets = current behaviour)
- [x] 4.3 Pass a DOM-measuring `getClearInsets` from `js/app.js` only when the layout is floating

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 Serve locally and check the docked layout is pixel-identical (no `layout` param): Gallery → open project → draw, zoom presets, hide interface, right-sidebar toggle
- [x] 5.3 Check `?layout=floating` at iPad landscape (1180×820) in both themes: canvas fills the screen, cards float in their slots, Fit centres between them, panning slides under cards, Hide interface works, reduce-transparency gives opaque cards
- [x] 5.4 Run `web-design-guidelines` on the CSS/markup diff, then `requesting-code-review`
- [x] 5.5 Update `docs/ui-reference.md` with a short note on the dev-only floating layout and slots
