## Context

See `proposal.md` for motivation. The custom brush editor already exists:
`index.html`'s `#brush-editor-panel` (name input, W/H number inputs,
`#brush-editor-grid`, Clear/Cancel/Save), wired in `js/workspace.js`
(`bindBrushEditorOnce`, `rebuildBrushEditorGrid`, module-level
`brushEditorGridState`/`brushEditorWidth`/`brushEditorHeight`). Today,
changing W/H always calls `rebuildBrushEditorGrid()`, which resets to a
blank grid ("Changing size re-grids from scratch"). Saving calls
`pixelsFromGrid(brushEditorGridState)` (`js/brushes.js`) and
`createCustomBrush(...)`. None of that changes here - this change only
adds a new way to *populate* `brushEditorGridState` before the user gets
to Clear/hand-edit/Save.

No file-import code exists anywhere in the codebase yet (`grep` for
`type="file"`, `FileReader`, `createImageBitmap` all found nothing) - this
is the first import path, shared in spirit (not code) with
`2n-color-library-image-import`, which needs the same "decode a File into
pixel data" starting point for a different end goal (color clustering
instead of thresholding).

## Goals / Non-Goals

**Goals:**
- Reuse the existing brush editor and its Save/Cancel/persistence path
  entirely - import only changes how the grid gets its initial content.
- Keep the thresholding logic (alpha vs. brightness) simple and
  synchronous-feeling (a single `<canvas>` draw + pixel read), no new
  dependencies.
- Support re-pixelating on resize without re-prompting for the file.

**Non-Goals:**
- No full-color/multi-color brushes - out of scope per the proposal
  (monochrome silhouette only, confirmed with the user during
  brainstorming).
- No image cropping/rotation/adjustment UI before pixelation - the
  browser decodes the image as-is; the user's only controls are which
  file, the editor's W/H, and hand-editing the result afterward.
- No support for multi-frame formats (animated GIF, etc.) - first frame
  or browser-default static decode only, same as any `<img>`/
  `createImageBitmap` use.

## Decisions

**Downsample via `<canvas>` `drawImage` scaling, then read pixels with
`getImageData`.** Draw the source image (via `createImageBitmap` or an
`<img>` element) onto an offscreen canvas sized to the editor's current
W/H (`ctx.drawImage(source, 0, 0, editorWidth, editorHeight)`, smoothing
left on so the shrink averages/blends rather than nearest-neighbor
sampling - unlike Export's upscale, here we *want* each output cell to
represent an averaged region of the source, not a single sampled pixel).
Read the resulting `editorWidth × editorHeight` `ImageData` directly -
one pixel per grid cell, no separate box-averaging pass needed since
`drawImage` scaling already does that averaging.

**Thresholding, per cell, from that downsampled `ImageData`:**
- Alpha-based: cell is "on" if `alpha > 127` (i.e., more opaque than not).
  Used when the source image has any pixel with `alpha < 255` at its
  original resolution (checked once, on the full decoded image, before
  downsampling - so a fully-opaque image never accidentally triggers
  alpha mode from an incidental downsample averaging artifact).
- Brightness-based fallback: cell is "on" if luminance
  (`0.299r + 0.587g + 0.114b`, standard perceptual weighting) is below a
  fixed midpoint threshold (127.5) - darker regions become the brush
  shape. No user-facing threshold control (see Non-Goals - keep this
  simple; a slider is a plausible future addition to the brush editor,
  not required now).

**Track the decoded source image (not the raw `File`) at module scope in
`workspace.js`**, alongside the existing `brushEditorGridState`/
width/height - e.g. `brushEditorSourceImage` (an `ImageBitmap` or
`HTMLImageElement`), cleared whenever the editor opens fresh, closes, or
Clear is pressed... actually Clear should NOT drop the source image:
Clear is for wiping hand-edits back to blank, and today's Clear doesn't
distinguish "was this size just set" from "was this imported" - keeping
Clear as pure "blank the grid" (dropping any imported result) is the
simplest, least-surprising behavior and avoids a second "clear vs.
discard-import" control. Re-importing (choosing Import again) simply
overwrites the stored source image and re-pixelates, same as changing
W/H.

**Shared utility module (`js/image-import.js`), built alongside
`2n-color-library-image-import` in a parallel worktree.** Scope: File →
decoded image (`createImageBitmap(file)`), plus a `drawToCanvas(image,
width, height)` helper returning `ImageData` at a target size - the one
piece of logic both changes need identically. Thresholding (this change)
and color clustering (`2n`) stay in their own modules/call sites, not
shared, since they're conceptually unrelated beyond "start from
downsampled ImageData." Because both changes touch this same new file,
whichever change lands second in `main` will need a quick rebase/merge
of `image-import.js` - acceptable, flagged here rather than treated as a
blocking dependency between the two (see Risks).

## Risks / Trade-offs

- [Both `2m` and `2n` create/touch the same new `js/image-import.js` in
  parallel worktrees] → Small merge conflict risk on that one file when
  the second change lands; each change's own thresholding/clustering
  logic lives in separate files, so the conflict surface is limited to
  the shared decode/downsample helper itself. Acceptable given the
  user's explicit choice to parallelize via worktrees.
- [`drawImage`-based averaging vs. a "proper" box filter] → The canvas
  2D context's built-in scaling is a reasonable approximation (browsers
  use area-averaging or similar for minification) and avoids hand-rolling
  a resampling algorithm; visual quality is validated in the Playwright
  smoke pass (task 3.x), not just assumed.
- [No threshold-tuning UI] → Accepted per Non-Goals; if imported brushes
  come out under/over-filled in practice, the user can already hand-edit
  the result before saving - a real escape hatch, not a dead end.
