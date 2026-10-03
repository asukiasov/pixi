## 1. Pure helpers (TDD)

- [x] 1.1 New `js/tool-options-bar.js` with `toolsShowing(attr)`, which parses a `data-tools` value into a Set of tool names. Write the tests first in `test/tool-options-bar.test.js`: one tool, several tools, extra whitespace, empty
- [x] 1.2 `forwardValue(proxy, source, eventType)`: copies the proxy's value to the source and dispatches `eventType` on the source. Tests with fake elements: value copied, the right event type dispatched once, and the source's (fake) clamping listener result read back into the proxy
- [x] 1.3 `mirrorToggle(source, proxy)`: copies `.active` as `aria-pressed`, `aria-label` and `data-tooltip`, and `data-symmetry-mode` if present. Tests: on, off, a symmetry source in each mode, and a source with no mode attribute

## 2. Markup

- [x] 2.1 `index.html`: inside `.slot-options`, before `#palette-row`, add `#tool-options-bar` (`.floating-only`, `role="group"`, `aria-label="Tool options"`) with seven `.tool-options-group[data-tools]` groups in the order of design decision 5. Each control carries `data-forward="<source id>"` and a comment naming its source, for 5h
- [x] 2.2 Wrap `#palette-row` and `#selection-controls` in `<div class="options-card">`. Leave `.bottom-bar` outside it
- [x] 2.3 Add class `brush-stroke-settings` to the two Spacing/Rotation `.brushes-panel-row`s
- [x] 2.4 Confirm `lib/pixi.js` needs no change (embed is always docked) and `lib/pixi.test.js` still passes

## 3. CSS

- [x] 3.1 Docked: `.options-card { display: contents; }` and nothing else, so the docked layout is unchanged
- [x] 3.2 Floating `.slot-options` becomes a transparent, centred flex column with `gap: var(--float-gap)`, `align-items: center` and `pointer-events: none` (children `auto`). Same bottom inset and max width as today. Swap `.slot-options` for `.options-card` in the glass selector lists. Give `#tool-options-bar` the same card look
- [x] 3.3 Show/hide: groups hidden by default. One rule per tool with options (`pencil`, `eraser`, `brush`, `rectangle`, `selection`) shows `[data-tools~=<tool>]` groups under `[data-current-tool=<tool>]`. Bar `display: none` when `data-current-tool` is any other tool
- [x] 3.4 Bar styling: a flex row that may wrap. Slider groups have a label, a ~7rem horizontal range with a 44px-tall hit box and a thin track, and a fixed-width readout. Buttons are `--rail-button-size` square. Filled swaps its two SVGs on `[aria-pressed]`
- [x] 3.5 Widen the `#symmetry-toggle[data-symmetry-mode]::after` rules to `:is(#symmetry-toggle, .tool-options-symmetry)`
- [x] 3.6 Floating-only `display: none` on `#pencil-options`, `#rectangle-options`, `#square-constraint-options`, `#library-sequence-options`, `#pixel-perfect-toggle`, `#symmetry-toggle` and `.brush-stroke-settings`. Remove `.pencil-options` from the floating glass list, 5c's now-dead toggle `order` rule, and the `--slot-tools-flyout-*` variables and rule
- [x] 3.7 Extend `test/floating-layout-css.test.js`:
  - every new bar, column and hide rule is scoped to `[data-layout="floating"]`
  - outside it, the only `.options-card` rule is `display: contents`
  - the tools in the bar-hiding rule plus those named in `index.html`'s `data-tools` attributes cover all ten `data-tool` values, with no overlap

## 4. Wiring

- [x] 4.1 `js/workspace.js`: in `applyToolScopedUI()`, set `dataset.currentTool` on the workspace screen element
- [x] 4.2 `initToolOptionsBar(root)` in `js/tool-options-bar.js`:
  - wire each proxy button's click to the source, and each proxy slider's `input` to `forwardValue` (`input` for Size/Opacity, `change` for Spacing/Rotation)
  - copy each slider's `min`/`max`/`step` from its source at init
  - start one `MutationObserver` per source toggle (`class`, `aria-label`, `data-symmetry-mode`) calling `mirrorToggle`, and run it once at init
  - observe `data-current-tool` on the workspace screen and refresh all proxy values and readouts on every record
  - null-safe and a no-op if the bar is absent
- [x] 4.3 Readouts: Size/Opacity proxies copy the source readout's text. Spacing/Rotation format `${v}px` / `${v}°`. Set `aria-valuetext` on every proxy slider to its readout text
- [x] 4.4 Bind `bindSliderWheel` to the Size and Opacity proxies
- [x] 4.5 `js/app.js`: call `initToolOptionsBar()` next to `initFloatingTopbar()`, only when `layout === 'floating'`
- [x] 4.6 `bindTooltips`: targets inside `.tool-options-bar` place their tooltip above the target, using the existing viewport clamp. Docked branches untouched

## 5. Verification

- [x] 5.1 `npm test` passes
- [x] 5.2 Serve locally with `?layout=floating` at 1180×820 and 768×1024. Go through all ten tools (click and shortcut), and check the bar's contents and order against the spec table. The bar is hidden for Move/Bucket/Line/Hand/Eyedropper, and the artwork doesn't move on any switch
- [x] 5.3 Bar above the palette card, both centred, no overlap. With a selection active, Clear/Delete sit in the palette card and the bar stays above it. Fit at project open (Pencil) keeps the artwork clear of both cards. Pointer input in the gap between the cards reaches the canvas
- [x] 5.4 Each control has the same effect as its source:
  - Size 4 → 4px stroke
  - Opacity
  - Spacing 5 → sparser trail, applied while dragging
  - Rotation
  - Pixel-perfect
  - Symmetry cycles through all four modes, with the marker shown
  - Filled
  - 1:1
  - library sequence
  - Rainbow swatch turns the sequence button off
- [x] 5.5 State carries over: Pixel-perfect on with Pencil → Rectangle → Pencil, still on. Open another project with Size at 6: Size shows 1px, which confirms the microtask refresh ordering (design decision 2). If not, add the fallback refresh call and note it in design.md
- [x] 5.6 Accessibility: the bar is a labelled group. Sliders announce value with unit and respond to arrow keys. Toggles report pressed. Symmetry's name includes the mode. Buttons are ≥44px and slider hit boxes ≥44px tall. Tab order follows the visual order. Tooltips open above the bar and stay on screen
- [x] 5.7 Hide interface (Tab): the bar hides and comes back with the rest
- [x] 5.8 Top bar shows Back, title, zoom pill, Layers, Undo, Redo, right sidebar, More. Rail shows only tools and swatches, and keeps its size across tool switches. The Brushes panel shows no Spacing/Rotation rows
- [ ] 5.9 Without the parameter: the docked layout looks and behaves exactly as before, including the Pencil/Eraser flyout, rail toggles, top bar Pixel-perfect/Symmetry, and the Brushes panel fields. A `Pixi.mount()` embed still works
  - Docked part verified: pixel-identical to `main` at 1180×820 for Pencil, Eraser, Brush, Rectangle, Select and Bucket, and with Pixel-perfect/Symmetry on.
  - Open: `lib/pixi-embed-example.html` throws on mount (`bindDomOnce()` binds `#record-toggle`, which `lib/pixi.js`'s markup lacks). This is the same on `main` (pre-existing since the timelapse change), not caused by 5d. Fixing it needs embed markup, which is outside 5d's scope.
- [x] 5.10 Run `web-design-guidelines` on the changed markup/CSS/JS before code review
- [x] 5.11 Update `docs/ui-reference.md` with a floating tool-options bar paragraph, and adjust the 5b/5c paragraphs that list Pixel-perfect/Symmetry in the top bar and the toggles in the rail
