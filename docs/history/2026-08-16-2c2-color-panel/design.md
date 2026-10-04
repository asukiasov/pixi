## Context

The palette row (`js/workspace.js`) is built once in `bindDomOnce()` from
a fixed `PALETTE` array of 16 hex strings, plus one hardcoded Rainbow
swatch appended after them. Clicking a swatch sets `state.currentColor`
(an `[r,g,b,a]` array, via `hexToRgba()`) and toggles `.active` across
all `.palette-swatch` elements. This mirrors the Brushes panel's existing
"module-level list that isn't reset per-project, but the *selection*
resets to a sane default per-project" pattern already established for
`allBrushes`.

## Goals / Non-Goals

**Goals:**
- Let the user pick any RGB/hex color, not just the 16 presets.
- Let a picked color become a reusable palette swatch for the rest of the
  session, with one explicit action (not automatic on every pick — that
  would flood the palette row with one-off colors).

**Non-Goals:**
- No persistence of custom swatches to IndexedDB across reloads/sessions
  (see proposal.md's Impact section) — that's "saved palettes," a
  separate, larger feature (naming/organizing palettes) not requested
  here.
- No symmetry/grid tools — a different roadmap line item entirely,
  unrelated in implementation.
- No change to how colors are drawn (`engine.js` untouched) — this is
  entirely about how `state.currentColor` gets set.
- No drag/live-preview sampling for the Eyedropper — a single tap
  samples once, matching Bucket's existing point-origin interaction
  model; continuous live-sampling while dragging is a possible future
  refinement, not required by what was asked.
- No wiring of Background color into any tool's drawing behavior
  (notably not Eraser) — see the dedicated Decision below.

## Decisions

**Native `<input type="color">` as the visual picker, backed by manual
RGB/hex text inputs kept in sync with it.** No custom HSV wheel/canvas —
every evergreen browser already ships a perfectly usable native color
picker (with its own hex/RGB entry built in, on most platforms), and this
project's stack is deliberately plain HTML/CSS/JS with no build step;
reimplementing a color picker widget would be a lot of code for something
the browser already provides for free. The explicit RGB number inputs and
hex text input are added *alongside* it (not replaced by it) because the
user specifically asked for "rgb and hex" fields, and because the native
picker's own hex/RGB affordances vary by browser/OS and aren't guaranteed
visible - the explicit fields give a consistent, always-visible way to
type an exact value. All three inputs (native color swatch, hex field,
RGB fields) write to the same `state.currentColor` and stay
cross-synced: changing one updates the other two.

**"Add to palette" is a separate, explicit button — picking a color does
not auto-add it.** Every other palette interaction in this app is
one-tap-and-done (click a swatch, done); auto-adding every picked color
would make the palette row grow unboundedly just from experimenting with
the picker. An explicit action matches how the Brushes panel's custom
brushes work too — draw/pick first, explicit Save/Add second.

**Custom swatches live in a module-level array (`customSwatches`), not
`state`.** Same reasoning as `allBrushes`: palette additions are a
session-wide resource, not scoped to one project, so they should still be
visible in the palette row after switching to a different project - only
the *current selection* (which swatch is active) resets per project, via
the same per-project reset block that already re-marks the first preset
swatch active. Rendering follows the same `renderBrushesPanel()`-style
pattern: a render function rebuilds the swatch list from
`[...PALETTE, ...customSwatches]` (plus Rainbow last) and gets re-invoked
both on add and in the per-project reset block.

**Picking a custom color deselects Rainbow, exactly like clicking a
preset swatch already does.** Reuses the existing mutual-exclusion logic
(`state.brushRainbow = false` on any regular color pick) rather than
introducing a second, parallel selection concept.

**Eyedropper reads from `layerStack.composite()`, the same ImageData
already used to render the canvas — not from the active layer alone.**
"What color is this" should mean what the user visually sees (all
visible layers, blend modes, and opacity already baked in), not one
layer's raw pixel, which could differ wildly under Multiply/Screen/
Overlay blending or reduced opacity. `composite()` already exists and is
already called every render, so this is a read of already-computed data,
not new compositing logic. The Eyedropper is a point-origin tool like
Bucket (no drag/live-sample support in this slice - see Non-Goals) so it
reuses the same `onDrawStart`-only dispatch pattern Bucket already has,
just reading instead of writing.

**Foreground/Background is a rename+extension of `state.currentColor`,
not a new parallel field kept in sync with it.** `state.currentColor`
becomes `state.foregroundColor` (every existing read site - Pencil,
Bucket, Brush's non-Rainbow path, Line, Rectangle - already just wants
"the current draw color," so this is a mechanical rename); a new
`state.backgroundColor` is added alongside it, initialized to white.
Swap exchanges the two array references; reset sets Foreground to black
and Background to white. No new abstraction over "which one is active for
drawing" - Foreground unconditionally is, so every call site keeps
reading the same field it always did (just renamed).

**Background does not plug into Eraser (or anything else) in this
slice.** Tempting to wire Background into Eraser the way Photoshop does
on a locked/non-transparent layer, but this app's Eraser has an existing,
explicit spec requirement that it *always* erases to full transparency
"regardless of the canvas's background setting" (referring to the New
Canvas white/transparent background choice, a different concept, but the
naming collision makes it worth being explicit): changing that now would
modify a requirement nobody asked to change, for a workflow (erase-to-
background-color on an opaque layer) this app's layer model does not
obviously need. Left as a clearly-flagged Non-Goal instead of guessing.

## Risks / Trade-offs

- **Native color picker UI is not stylable and looks different across
  browsers/OSes** → accepted; it's a small trigger swatch, not the
  primary input surface (the hex/RGB fields are consistent everywhere).
- **Palette row can grow long with many custom swatches added over a long
  session** → accepted for this slice (matches Non-Goals: no
  save/delete/organize UI for custom swatches yet); revisit if it becomes
  a real usability problem once "saved palettes" is scoped.
- **Renaming `state.currentColor` to `state.foregroundColor` touches
  every existing call site that reads it** (Pencil, Bucket, Brush, Line,
  Rectangle) → mechanical, low-risk rename, but every call site needs
  updating in the same commit to avoid a half-renamed state; covered by
  the existing full Playwright regression pass across all those tools.
- **A user might expect Background to do something (erase-to-background,
  new-layer-fill, etc.) since it's a Photoshop-familiar concept** →
  explicitly scoped out (see Decisions); if requested later, it's an
  additive follow-up, not a rework of this slice.
