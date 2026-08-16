## Why

Phase 1 shipped a single Export button that writes the composited canvas to a
PNG at native resolution, with whatever background the canvas already has.
Pixel art is drawn small (16–128px) and almost always needs to be used large
(sprites dropped into a game at 4x/8x, icons blown up for a mockup, avatars),
and often needs a transparent background regardless of what the canvas was
authored with (e.g. a white-background canvas whose Background layer should
be dropped for the exported asset). Today the user has to export at 1x and
upscale/key out the background in a separate tool. This closes out Phase 2's
last unimplemented sub-change (`2c3`, tracked in `openspec/roadmap.md`) by
turning the single Export button into a small Export screen/popover offering
a scale multiplier and a transparent-background override.

## What Changes

- Replace the single-click Export button's immediate-download behavior with
  an Export popover (same anchored-popover pattern as Canvas Settings —
  `openspec/specs/canvas-settings/`) offering:
  - **Scale multiplier**: 1x/2x/4x/8x, nearest-neighbor upscale so pixels
    stay crisp (no smoothing/interpolation) — applied after compositing at
    native resolution.
  - **Transparent background toggle**: when on, the Background layer (see
    `openspec/specs/layers/`) is composited as fully transparent instead of
    its `backgroundColor`/white fill, regardless of the canvas's own
    background type; when off (default), export behaves exactly as today.
    Disabled (greyed out, forced off) whenever JPG is the selected format,
    since JPG has no alpha channel.
  - **Format selector**: PNG (default), WebP, or JPG.
  - Export still produces one download per click, but the filename now
    reflects the project's own name and the chosen scale instead of the
    fixed `pixi-export.png` — see the `export` capability spec for the
    exact pattern.
- No changes to the composited pixel data used for on-canvas rendering,
  undo/redo, or persistence — this only changes what gets written to the
  exported file.

## Capabilities

### New Capabilities
- `export`: the Export screen/popover's scale multiplier and
  transparent-background override, and the resulting PNG output rules.

### Modified Capabilities
(none — no existing capability's requirements change; the old Export button
behavior described informally in `pixel-drawing-engine`/`layers` notes is
superseded by the new `export` capability, not altered in place)

## Impact

- `js/workspace.js`: replace the `exportButton` click handler with an
  Export popover (open/close, controls, trigger) following the Canvas
  Settings popover pattern (`js/canvas-settings.js`) already in the
  codebase.
- `js/layers.js`: `LayerStack.toPNGBlob()` / `#compositeToCanvas()` need a
  way to (a) skip the Background layer's opaque fill, (b) scale the
  output, and (c) encode to PNG, WebP, or JPG — likely new optional
  parameters rather than new public methods, to avoid duplicating the
  compositing loop.
- `index.html`: new popover markup, mirroring the Canvas Settings popover's
  DOM structure, plus a format selector.
- `js/persistence.js` / gallery: no changes — the project's existing name
  field is only read, not written, by export.
- No new dependencies, no persistence/schema changes (export options are
  transient UI state, not saved with the project).
