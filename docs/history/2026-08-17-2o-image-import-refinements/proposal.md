## Why

Real usage of `2m-brush-image-import` and `2n-color-library-image-import`
(shipped 2026-08-16) surfaced three issues worth fixing before more
polish work builds on top of them:

1. Both file pickers accept `image/*`, which includes SVG, but SVG
   silently fails to import - `createImageBitmap()`, the only decode path
   today, doesn't support SVG sources in Chromium (confirmed via direct
   testing). The user sees SVG as a valid choice, picks one, and nothing
   happens - no error, no feedback, just silence.
2. `2n`'s import preview (swatch grid + color-count control + name +
   Save/Cancel) is an inline row that expands in place inside the Color
   Library panel. Its color-count control visually shifts position every
   time the swatch grid above it gains or loses rows, because the
   variable-height grid sits above the fixed controls in DOM order.
3. `2m`'s brush-editor Import control is a full-width text button in its
   own row, inconsistent with every other icon-only control in the
   Workspace's toolbars.

## What Changes

- **SVG support (`2m`)**: when `createImageBitmap(file)` fails, fall back
  to decoding via an off-DOM `<img>` element (object URL → `Image.onload`)
  instead of failing silently. This covers SVG (and any other format a
  given browser's `createImageBitmap` doesn't support but its `<img>`
  decode path does) with one fallback, not SVG-specific branching.
- **Color Library import becomes a popover (`2n`)**: `#import-preview-row`
  moves out of the panel's normal document flow into an anchored popover
  triggered by the Import button, using the same positioning pattern as
  Export/Canvas Settings (`positionPanel`-style: anchored below the
  trigger, flips above on viewport overflow, clamped horizontally,
  closable via close button/outside-click/Escape). This is a presentation
  change, not a behavior change - live preview, adjustable color count,
  and Save/Cancel all work exactly as before; the color-count control no
  longer moves because the popover is a fixed-position surface, not
  in-flow content pushing its neighbors.
- **Brush editor Import button becomes icon-only, repositioned (`2m`)**:
  moves from its own full-width text-button row into the editor's header
  row (alongside the "New Brush" title), as an icon button using the same
  `image` icon Color Library's Import control already uses. The brush
  editor itself stays a docked panel - this is a control-level change,
  not the popover conversion `2n` gets.
- No changes to the underlying pixelation/thresholding/clustering logic,
  file-picker `accept` values, or what gets saved - only how the image is
  decoded (SVG fallback) and how the import controls are presented.

## Capabilities

### Modified Capabilities
- `brushes`: "Custom brush creation" - the Import control's presentation
  (icon, position) changes; the underlying import/threshold/resize
  behavior is unchanged. SVG decode support is additive to the same
  requirement (still "choosing an image decodes it").
- `color-library`: "Import palette from image" - becomes a popover
  instead of an inline preview row; every other aspect (live preview,
  adjustable count, clustering, Save/Cancel) is unchanged.

## Impact

- `js/image-import.js`: `decodeImageFile` gains an `<img>`-element
  fallback when `createImageBitmap` fails, instead of returning `null`
  immediately.
- `index.html`: brush editor header row gains the Import icon button
  (removing its old standalone row); `#import-preview-row` becomes a
  popover (`class="canvas-settings-panel"`-style base, matching Export's
  `.export-panel` pattern) instead of an in-flow row, gaining a close
  button.
- `style.css`: new popover positioning/sizing rules for the import
  preview (reusing `.canvas-settings-panel`'s base styling per this
  project's established convention); brush editor header row layout for
  the added icon button; the old `.import-preview-row`/
  `.import-preview-controls` in-flow styles adjust or get superseded as
  needed for the popover shape.
- `js/workspace.js`: the Color Library import wiring (`importPaletteButton`
  click handler, `closeImportPreview`, etc.) gains popover open/close/
  position logic (mirroring `js/export.js`'s `positionPanel` - duplicated
  per this codebase's established per-popover convention, not extracted
  into a shared helper); the brush editor's Import button wiring is
  otherwise unchanged (only its DOM location/appearance moves).
- No persistence/schema changes, no changes to `js/color-extraction.js`
  or `js/brush-import.js`'s thresholding/clustering logic.
