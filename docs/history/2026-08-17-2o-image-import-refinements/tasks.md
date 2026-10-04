## 1. SVG decode fallback

- [x] 1.1 `js/image-import.js`: add `decodeViaImgElement(file)` - creates
      an object URL from `file`, loads it into a `new Image()`, resolves
      the loaded element on `onload`, resolves `null` on `onerror`,
      revokes the object URL in both cases
- [x] 1.2 `js/image-import.js`: `decodeImageFile` catches a
      `createImageBitmap` failure and retries via `decodeViaImgElement`
      instead of returning `null` immediately; still returns `null` (never
      throws) if the fallback also fails - contract unchanged for both
      existing callers
- [x] 1.3 Confirmed `hasTransparency`/`downsampleToImageData` work
      unchanged when passed an `HTMLImageElement` instead of an
      `ImageBitmap` - no code changes needed, verified via the SVG import
      Playwright pass in 4.2 (both produce a real, non-solid pixel
      pattern)

## 2. Color Library import becomes a popover

- [x] 2.1 `index.html`: restructured `#import-preview-row` into a
      popover (`class="canvas-settings-panel import-preview-panel"`),
      moved out of `#color-library-body`'s flow to a sibling of
      `#color-library-panel`, anchored to `#import-palette-button`, with
      an explicit close button (`#import-preview-close`) in a header row
- [x] 2.2 `style.css`: added `.import-preview-panel` (width) and updated
      `.import-preview-grid` to a **fixed** (not max) height with
      internal scroll - first pass used `max-height`, which still let
      shorter previews grow and push the controls below as the count
      rose; fixed `height: 9rem` + `overflow-y: auto` actually holds the
      position steady regardless of row count, confirmed via Playwright
      (see 4.2). Retired the old `.import-preview-row`/
      `.import-preview-controls` in-flow rules - the new markup reuses
      `.canvas-settings-row`'s generic label/number-input styling.
- [x] 2.3 `js/workspace.js`: added `positionPanelBelow(panel, anchorEl)`
      (module-level, mirrors `js/canvas-settings.js`'s/`js/export.js`'s
      own `positionPanel`, duplicated per this codebase's convention);
      wired close-button/outside-click/Escape. Deliberately did NOT wire
      "re-click the Import button closes the popover" - unlike Canvas
      Settings/Export, the Import button's click always opens the native
      file picker (not a direct visibility toggle), so re-clicking it
      while the popover is open means "let me pick a different image,"
      not "close this" - keeping that behavior matches the trigger's
      actual semantics.
- [x] 2.4 Confirmed existing import logic (file selection → decode →
      downsample → extract → live preview → Save/Cancel) is unchanged -
      only the show/hide mechanism changed from an in-flow row toggle to
      a positioned popover open/close

## 3. Brush editor Import button: icon, repositioned

- [x] 3.1 `index.html`: moved the Import control into a new
      `.brush-editor-header-row` alongside "New Brush", as an icon-only
      button (`class="tool-button icon-button"`) using the `image` icon
- [x] 3.2 `style.css`: added `.brush-editor-header-row`
      (`justify-content: space-between`) and `.brush-editor-header-row
      h2` (margin reset); removed the old standalone Import row (no
      longer present in the markup, no orphaned styles left)
- [x] 3.3 Confirmed `#brush-editor-import`'s `id`/event handler in
      `js/workspace.js` is untouched - `document.getElementById` doesn't
      care where in the DOM the element moved to

## 4. Verification

- [x] 4.1 Re-ran full `node --test` suite: 150/150 pass
- [x] 4.2 Playwright smoke pass: imported an SVG with explicit
      width/height into the brush editor - grid pre-filled with a
      partial silhouette (112/256 cells on); imported a dimensionless
      (viewBox-only) SVG - also pre-filled correctly (144/256 on, via the
      150×150 default-object-size fallback); confirmed the brush editor's
      Import button renders as a small (~42×42px) icon button, not a
      full-width text button; opened the Color Library import popover,
      recorded the color-count input's screen position, raised the count
      from 8 to 32, and confirmed the position was byte-identical before
      and after (first attempt with `max-height` failed this exact check
      - caught by the test, not assumed - fixed per 2.2); confirmed
      Escape closes the popover without creating a palette
      (`#color-library-select`'s option count unchanged); confirmed a
      real import → name → Save still creates a working palette via the
      popover. Zero console errors throughout.
