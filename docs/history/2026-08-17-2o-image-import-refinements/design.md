## Context

See `proposal.md` for motivation. Root causes for all three issues were
confirmed by direct testing before this change was written (not assumed):

- `createImageBitmap()` throws `InvalidStateError: The source image could
  not be decoded` on SVG blobs in Chromium, regardless of whether the SVG
  has explicit `width`/`height` attributes - confirmed via a direct
  `createImageBitmap(new Blob([svgText], {type: 'image/svg+xml'}))` test
  in-browser. `js/image-import.js`'s `decodeImageFile` already catches
  this and returns `null`, so today's failure is silent by design, not a
  crash - but it means SVG (which the `accept="image/*"` file picker
  happily offers) never actually imports.
- Decoding the same SVG via an off-DOM `<img>` element (`new Image()`,
  `img.src = URL.createObjectURL(blob)`, wait for `onload`) works
  correctly - confirmed for both an SVG with explicit `width`/`height`
  (decodes at its stated size) and one with only a `viewBox` (falls back
  to the CSS "default object size" of 150×150, per spec, but still
  decodes and produces real pixel data once drawn to a canvas).
- `#import-preview-row` (`index.html`) sits inside `#color-library-body`
  in normal document flow, below `#color-library-select`. Its swatch grid
  (`.import-preview-grid`, `grid-template-columns: repeat(auto-fill,
  minmax(19px, 1fr))`) wraps to more rows as the color count rises, which
  grows the row's height and pushes `.import-preview-controls` (including
  the color-count input) further down - confirmed by reading the CSS,
  matching the reported symptom exactly.

## Goals / Non-Goals

**Goals:**
- Fix SVG import with one general fallback (decode-path failure → retry
  via `<img>`), not SVG-specific special-casing, so any other format a
  browser's `createImageBitmap` doesn't support but its `<img>` path does
  is covered too.
- Eliminate the color-count layout shift by moving the import preview out
  of normal document flow entirely (a popover), rather than just
  reordering rows within the existing in-flow layout - a popover is more
  robust to *any* future control being added to that preview, not just
  today's specific jump.
- Reuse the established popover pattern (`positionPanel`-style
  anchor/clamp/open/close, as `js/canvas-settings.js` and `js/export.js`
  already do) rather than inventing a new one.
- Bring the brush editor's Import control in line with every other
  icon-only control in the Workspace's toolbars.

**Non-Goals:**
- No change to the brush editor's own docked-panel presentation - only
  the Import *button* moves/changes appearance, confirmed with the user
  as out of scope for this change (a separate "convert the whole editor
  to a popover" question was asked and declined).
- No quality-of-life additions to SVG handling beyond making it work (no
  SVG-specific options, no viewBox-aware "default object size" override -
  the 150×150 CSS fallback for a dimensionless SVG is accepted as-is,
  since the result still gets downsampled to whatever grid size the
  editor wants regardless of that intermediate size).
- No change to `js/color-extraction.js` or `js/brush-import.js` - this
  change touches decoding and presentation only.

## Decisions

**SVG fallback lives in `decodeImageFile` itself, not in each caller.**
Both `2m` and `2n` call `decodeImageFile` and treat a `null` return as
"unsupported/corrupt file, fail gracefully" - keeping the fallback inside
that one function means neither caller needs to change, and any future
caller gets the same broadened format support for free:

```js
export async function decodeImageFile(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return decodeViaImgElement(file); // new fallback, still returns null on failure
  }
}
```

`decodeViaImgElement` creates an object URL, loads it into a `new
Image()`, resolves with the loaded `<img>` element on `onload`, resolves
`null` on `onerror` (revoking the object URL either way to avoid leaking
it), and never throws - `decodeImageFile`'s contract ("returns null,
never throws" per its existing doc comment and both callers' null-checks)
stays exactly as it is today. Downstream code
(`hasTransparency`/`downsampleToImageData` in the same file) already uses
`ctx.drawImage(image, ...)` and `image.width`/`image.height`, both of
which work identically whether `image` is an `ImageBitmap` or an
`HTMLImageElement` - no changes needed there.

**Color Library's import popover reuses `.canvas-settings-panel`'s base
styling, matching `.export-panel`'s precedent** - not a new visual
pattern, the third popover built on the same base class. `js/workspace.js`
gains a `positionPanel`-equivalent function scoped to this popover,
duplicated per this codebase's established per-popover convention (see
`js/canvas-settings.js` and `js/export.js`, each with their own copy)
rather than extracted into a shared helper.

**Brush editor's Import control moves into the header row as an icon
button, reusing the `image` icon** Color Library's Import control already
uses (added to `index.html`'s Material Symbols `icon_names` subset while
fixing that button's own broken-glyph bug, tracked separately). Same
icon for the same action ("import from an image") in both places, matching
this codebase's existing convention of reusing one icon per action across
contexts (e.g. `delete` for every delete button).

## Risks / Trade-offs

- [The 150×150 CSS default-object-size fallback for a dimensionless SVG
  means such an SVG's *aspect ratio* is forced square regardless of its
  actual `viewBox`] → Accepted per Non-Goals: uncommon (most real-world
  SVG icons declare `width`/`height`), and the result is downsampled to
  the editor's chosen grid size afterward regardless, so a squashed
  intermediate aspect ratio only matters for genuinely dimensionless,
  non-square SVGs - a narrow edge case not worth solving here.
- [Popover conversion changes `2n`'s already-shipped, spec-synced UI
  shape] → Intentional and confirmed with the user; the underlying
  behavior (live preview, adjustable count, clustering) is unchanged,
  only presentation.
