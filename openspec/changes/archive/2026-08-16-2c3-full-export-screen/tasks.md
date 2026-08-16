## 1. Compositing changes

- [x] 1.1 `js/layers.js`: extend `LayerStack.#compositeToCanvas()` to
      accept an options object (`{ skipBackground, scale }`, default `{}`)
      - when `skipBackground` is true, skip any layer with
        `isBackground: true` entirely from the compositing loop
- [x] 1.2 `js/layers.js`: after compositing, when `scale > 1` draw the
      composited canvas onto a second offscreen canvas sized
      `width*scale` x `height*scale` with `imageSmoothingEnabled = false`,
      and return that canvas instead
- [x] 1.3 `js/layers.js`: update `toPNGBlob(options = {})` to accept the
      same options object and pass it through to `#compositeToCanvas()`;
      confirm `toPNGBlob()` with no arguments still produces byte-identical
      output to today (native resolution, Background layer included)
- [x] 1.4 Confirm `composite()` (used for on-screen rendering) is
      unaffected - it should keep calling `#compositeToCanvas()` with no
      options
- [x] 1.5 `js/layers.js`: add `format` (`'png' | 'webp' | 'jpg'`, default
      `'png'`) to `toPNGBlob`'s options object; map to
      `canvas.toBlob(resolve, mimeType, quality)` with `image/png` /
      `image/webp` / `image/jpeg` and a fixed `quality = 0.92` (harmless
      no-op for PNG's lossless encoder)
- [x] 1.6 `js/layers.js`: when `format === 'jpg'`, fill the destination
      canvas with opaque white before drawing the composited (and
      possibly scaled) image onto it, so JPG never encodes transparent
      pixels as black

## 2. Export popover UI

- [x] 2.1 `index.html`: add an `#export-panel` popover, mirroring
      `#canvas-settings-panel`'s structure (header row with title + close
      button; content rows), anchored to `#export-button`:
      - scale control: four options (1x/2x/4x/8x), 1x selected by default
      - "Transparent background" toggle (checkbox or similar), off by
        default
      - an explicit "Export" action button that triggers the download
- [x] 2.2 `index.html`/CSS: style `.export-panel` reusing
      `.canvas-settings-panel`'s popover styling (or a shared class) so it
      looks consistent, not a one-off
- [x] 2.3 `js/workspace.js` (or a new `js/export.js` following
      `js/canvas-settings.js`'s module shape): implement open/close for
      the popover - anchor to `#export-button`, position below it
      (flip above on viewport overflow), clamp horizontally, close via
      close button / outside click / Escape / re-click on
      `#export-button` - reusing `canvas-settings.js`'s `positionPanel`
      logic (extract to a shared helper if duplicating verbatim, or
      import it directly)
- [x] 2.4 Wire the popover's scale/toggle controls to local state (reset
      to 1x/off each time the popover opens, not persisted)
- [x] 2.5 Wire the "Export" button inside the popover: call
      `state.layerStack.toPNGBlob({ skipBackground: transparentToggleOn,
      scale: selectedScale })`, download as `pixi-export.png` exactly as
      today, close the popover, and still trigger `celebrateExport`
- [x] 2.6 Remove the old immediate-download click handler on
      `#export-button` (replaced by popover open in 2.3)
- [x] 2.7 `index.html`: add a format selector (PNG/WebP/JPG) to
      `#export-panel`, PNG selected by default, mirroring the existing
      scale-option button-group markup/styling
- [x] 2.8 `js/export.js`: wire the format selector to local state (reset
      to PNG each time the popover opens, same as scale/toggle); when
      JPG is selected, disable the Transparent-background checkbox and
      force it unchecked; re-enable it (still unchecked) when switching
      back to PNG or WebP
- [x] 2.9 `js/export.js`: build the filename as
      `<sanitized-project-name>@<scale>x.<ext>` from the project's
      current name (passed in from `workspace.js`'s `state.projectName`
      at click time, not cached when the popover opens), the selected
      scale, and the selected format's extension (`png`/`webp`/`jpg`);
      sanitize with `/[/\\:*?"<>|]/g` → `-`, falling back to `untitled`
      if the sanitized name is empty
- [x] 2.10 `js/workspace.js`: pass `state.projectName` into `initExport`
      (e.g. a `getProjectName()` callback, matching the pattern other
      popovers use to read live workspace state) so the filename always
      reflects the current name, and update the `onExport` handler to
      pass `format` through to `toPNGBlob` and use the computed filename
      instead of the hardcoded `pixi-export.png`

## 3. Verification

- [x] 3.1 Re-run full `node --test` suite (136/136 pass)
- [x] 3.2 `LayerStack` compositing needs a `<canvas>`/DOM, which
      `node --test` doesn't provide (same reason `composite()`/
      `toPNGBlob()` were never unit-testable, per the existing code
      comment) - verified `scale`/`skipBackground` behavior via the
      Playwright pass in 3.3 below instead of adding Node unit tests.
- [x] 3.3 Playwright smoke pass (scale + transparent-background,
      pre-format-support): opened a white-background 32×32 project, drew
      a pixel, exported at default (1x, toggle off) - confirmed 32×32 PNG
      with opaque (alpha 255) corner, matching pre-change behavior;
      exported again at 4x + Transparent background on - confirmed
      128×128 PNG with fully transparent (alpha 0) corner where the
      Background layer was; confirmed Escape and an outside click both
      close the popover; zero console errors throughout
- [x] 3.4 Re-run full `node --test` suite after 1.5/1.6/2.7-2.10 (136/136 pass)
- [x] 3.5 Playwright smoke pass covering the new behavior: renamed a
      project to "My Sprite", exported at default settings - confirmed
      the downloaded filename is `My Sprite@1x.png`; exported at 4x -
      confirmed `My Sprite@4x.png`; switched format to WebP with
      Transparent background on and exported - confirmed
      `My Sprite@1x.webp`, a valid WebP file with alpha 0 (transparent)
      at the corner; switched format to JPG - confirmed the
      Transparent-background checkbox became disabled and unchecked,
      then exported - confirmed `My Sprite@1x.jpg`, a valid JPEG, with
      the corner rendered as opaque white (255,255,255), not black;
      renamed the project to `Sword/Shield: v2` and confirmed `/` and
      `:` were replaced with `-` in the downloaded filename
      (`Sword-Shield- v2@1x.png`); zero console errors throughout
