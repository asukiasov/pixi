## Context

See `proposal.md` for motivation. The Color Library panel already exists:
`index.html`'s palette dropdown (`#color-library-select`), swatch grid
(`#color-library-grid`), "+ New Palette" flow (`#add-palette-button` →
`#new-palette-row` with a name input and Save/Cancel), wired in
`js/workspace.js`. Saving calls `createColorPalette(name, colors)`
(`js/persistence.js`), which is format-agnostic about where `colors`
came from - a hand-typed hex, an Eyedropper sample, or (after this
change) extracted swatches. This change only adds a new way to arrive at
a `colors` array before that same call.

No file-import code exists anywhere yet - this is the second change to
add one (alongside `2m-brush-image-import`, built in parallel via git
worktrees), sharing a small decode/downsample utility
(`js/image-import.js`, see that change's design.md for the exact shared
surface and the merge-coordination note).

## Goals / Non-Goals

**Goals:**
- Reuse the existing palette-creation/save path entirely (`+ New Palette`'s
  naming UI, `createColorPalette`) - import only changes how the initial
  `colors` array is produced.
- Keep color extraction good enough that a real image (photo, sprite,
  concept art) produces a genuinely useful, visually distinct palette,
  not a handful of near-identical shades.
- Live-adjustable color count without re-picking the file each time.

**Non-Goals:**
- No manual color-region selection (e.g. "extract only from this crop") -
  the whole image is sampled.
- No editing individual extracted swatches before saving (e.g. nudging
  one cluster's color) - if a result isn't quite right, the user adjusts
  the count and re-extracts, or edits the palette normally after saving
  (Color Library already supports adding/removing colors from any
  palette).
- No persisting the source image or extraction parameters - once saved,
  an imported palette is just a palette; re-importing means re-picking
  the file.

## Decisions

**Downsample to a small fixed internal grid before clustering, not
cluster the full-resolution image.** A modest fixed size (e.g. 64×64 =
4096 sample pixels) is plenty to represent an image's color distribution
while keeping the clustering step's input size small and bounded
regardless of the source image's actual resolution - a 4000×3000 photo
and a 64×64 icon get the same clustering cost. This grid is purely
internal (per the proposal, "not shown to the user") - reusing
`js/image-import.js`'s `downsampleToImageData(image, width, height)` from
`2m` with fixed values instead of user-facing W/H.

**Median-cut clustering over the downsampled pixels.** Standard, simple-
to-implement palette-reduction algorithm: recursively split the sampled
pixels' bounding box along its longest color-channel axis until there are
as many boxes as the requested color count, then average each box's
pixels for its representative color. Chosen over k-means because it's
deterministic (no random initialization/convergence concerns), simpler to
implement without a library, and standard for exactly this "reduce an
image to N representative colors" use case (it's literally the classic
GIF-palette-reduction algorithm). Runs entirely synchronously over the
small fixed sample grid, so re-extracting on every color-count change
stays fast enough for a live preview with no debouncing needed.

**Live preview re-runs clustering on the same cached downsampled
`ImageData`, not on the original image, when the color count changes.**
The image is decoded and downsampled once per import; changing the count
slider only re-runs median-cut over the already-downsampled pixels -
cheap, since the expensive part (decode + downsample) doesn't repeat.

**Color-count control range: a reasonable bounded slider/number input**
(e.g. 2-32), consistent with this project's existing bounded-input
pattern (canvas size 1-256, brush editor size 3-canvas) rather than
unbounded. Exact bounds are a minor implementation detail, not a design
question worth blocking on - default to a starting value like 8 or 16,
matching the existing fixed-palette-row convention from Phase 1.

## Risks / Trade-offs

- [Median-cut is a simpler algorithm than k-means/other perceptual
  clustering methods] → Accepted: it's the standard choice for this
  exact problem (palette reduction), fast, dependency-free, and
  "genuinely distinct colors, not near-duplicates" (the actual
  requirement) doesn't need anything fancier.
- [Fixed internal downsample size, not tied to color count] → A very
  high requested color count (e.g. 32) against a coarse internal grid
  (64×64) could plateau in distinctiveness for very simple/flat images
  with few real colors - acceptable, since median-cut naturally produces
  duplicate/near-duplicate boxes only when there aren't enough genuinely
  different source colors to split further, which is the expected
  behavior for a flat image regardless of algorithm.
- [Shared `js/image-import.js` with `2m-brush-image-import`, built in a
  parallel worktree] → Same merge-coordination note as `2m`'s design.md -
  small conflict risk on that one shared file when the second change
  lands, not on either change's own extraction/thresholding logic.
