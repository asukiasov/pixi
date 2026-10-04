## Context

See `proposal.md` - Why/What Changes for motivation. Today `#export-button`
in the top bar downloads immediately on click
(`js/workspace.js` around the `exportButton` listener), calling
`state.layerStack.toPNGBlob()`, which composites every visible layer via
`LayerStack.#compositeToCanvas()` (`js/layers.js`) at native resolution and
converts to a PNG blob with no options. Canvas Settings already established
the popover pattern this change reuses: a hidden panel positioned with
fixed + JS (`js/canvas-settings.js`'s `positionPanel`), anchored to a top-bar
icon, closable via close button/outside-click/Escape/re-click, clamped to
the viewport.

## Goals / Non-Goals

**Goals:**
- Reuse the existing popover mechanics (`positionPanel`-style
  anchor/clamp/open/close) rather than inventing a new UI pattern.
- Keep the compositing logic in one place (`LayerStack`) rather than
  duplicating the layer-loop in workspace code.
- Export options (scale, transparent-background) are transient UI state,
  not persisted with the project or saved across reloads - they reset to
  defaults (1x, off) each time the popover opens, matching Canvas Settings'
  own non-persistent input fields.

**Non-Goals:**
- No batch export or spritesheet/GIF output - one static image per click,
  in PNG, WebP, or JPG.
- No quality/compression control in the UI - JPG/WebP use a fixed default
  quality (0.92), matching pixel art's low tolerance for compression
  artifacts (a slider inviting visible banding isn't worth the surface
  area for this project).
- No change to what "visible layers, in stacking order, with blend
  mode/opacity" means for compositing - that rule is unchanged, only scale,
  format, and the Background layer's fill are new options.
- No change to the Background layer's actual stored color/data, or to
  on-screen rendering - the transparent-background toggle only affects the
  exported file (see `export` spec's Transparent-background override
  requirement).

## Decisions

**Reuse Canvas Settings' popover pattern, not a new component.** The
Export popover is structurally identical to `#canvas-settings-panel`: same
`.hidden` toggle, same anchor-and-clamp positioning, same close triggers.
Alternative considered: a modal dialog - rejected because it's heavier and
inconsistent with the one popover pattern already established for
Canvas Settings.

**Add optional parameters to the existing compositing path instead of a
parallel export-specific compositor.** `LayerStack.#compositeToCanvas()`
already does exactly the loop needed (iterate visible layers, respect
blend mode/opacity); the design threads two optional inputs through it:
- a `skipBackground` (or similar) flag that, when on, omits the layer with
  `isBackground: true` from compositing entirely (treated as if invisible),
  rather than trying to distinguish its fill color from anything the user
  painted on top pixel-by-pixel (no such provenance is tracked today).
  Confirmed with the user: dropping the whole Background layer, including
  any content explicitly painted on it, is the intended behavior - the
  Background layer is rarely painted on directly (its main interaction is
  Eraser revealing the fill color, per `2g-background-layer`), and adding
  per-pixel fill/user-drawn tracking is not worth the complexity for that
  edge case.
- a `scale` integer that upscales the final composited canvas via a second
  offscreen canvas with `imageSmoothingEnabled = false` and
  `drawImage(source, 0, 0, w*scale, h*scale)`, applied after compositing
  (not per-layer), keeping the scale concern separate from the
  transparency concern.

Both are added as an options object to a new `toPNGBlob(options)` signature
(default `{}` preserves today's exact behavior) rather than new public
methods, so the one existing caller and any future caller share the same
code path.

Alternative considered for scale: repeat each source pixel `scale` times
by writing into a larger `ImageData` directly (bypassing `drawImage`).
Rejected - `drawImage` with `imageSmoothingEnabled = false` is simpler,
already battle-tested by the browser, and equally crisp for integer
scale factors.

**Format support (PNG/WebP/JPG) reuses `toPNGBlob`'s existing options
object rather than a new method.** Add `format` (`'png' | 'webp' | 'jpg'`,
default `'png'`) alongside `skipBackground`/`scale`. Internally this maps
to `canvas.toBlob(resolve, mimeType, quality)` where `mimeType` is
`image/png`, `image/webp`, or `image/jpeg` and `quality` is a fixed `0.92`
(ignored by the PNG encoder, which is lossless). The method itself keeps
its `toPNGBlob` name for this change - renaming it project-wide is a
larger, unrelated refactor; a follow-up change can rename it to something
format-neutral (e.g. `toImageBlob`) if/when that naming friction is worth
addressing on its own.

**JPG flattens transparency onto white before encoding, at the compositing
step, not as a post-process.** `canvas.toBlob('image/jpeg', ...)` on a
canvas with transparent pixels renders them black by default (no alpha
channel to preserve) - worse than a defined choice. When `format ===
'jpg'`, draw an opaque white rect on the destination canvas before
compositing/scaling onto it, so JPG always exports on white regardless of
the (forced-off, per spec) transparent-background toggle or a naturally
transparent canvas.

**Filename built in the UI layer (`js/export.js`), not `LayerStack`.**
`LayerStack` stays format/filename-agnostic - it only knows how to
produce image bytes. `js/export.js` (or workspace.js's export handler)
composes `<sanitized-project-name>@<scale>x.<ext>` from the project name
already held in `workspace.js`'s `state.projectName`, the selected scale,
and the selected format's extension. Sanitization is a small inline regex
(`/[/\\:*?"<>|]/g` → `-`), not a new utility module - it's used in exactly
one place.

## Risks / Trade-offs

- [Skipping the whole Background layer for the transparent toggle also
  drops anything explicitly drawn on the Background layer, not just its
  fill] → Accepted trade-off, confirmed with the user (see Decisions) -
  the Background layer is rarely painted on directly, and per-pixel
  fill/user-drawn tracking isn't worth adding for this edge case.
- [Adding an options object to `toPNGBlob` changes its signature] →
  Backward compatible: default `{}` reproduces current behavior exactly,
  and it's an internal method with one caller today.
- [`toPNGBlob` now also encodes WebP/JPG - a slightly misleading name] →
  Accepted for this change (see Decisions); flagged as a follow-up rename
  rather than done here, to keep this change scoped to behavior, not an
  unrelated rename sweep.
- [A project renamed between opening the Export popover and clicking
  Export could theoretically use a stale name] → Not a real risk in
  practice: the filename is built at click time from `state.projectName`,
  which Canvas Settings' `onRename` already keeps current, not captured
  when the popover opens.
