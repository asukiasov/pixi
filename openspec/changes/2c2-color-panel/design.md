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

## Risks / Trade-offs

- **Native color picker UI is not stylable and looks different across
  browsers/OSes** → accepted; it's a small trigger swatch, not the
  primary input surface (the hex/RGB fields are consistent everywhere).
- **Palette row can grow long with many custom swatches added over a long
  session** → accepted for this slice (matches Non-Goals: no
  save/delete/organize UI for custom swatches yet); revisit if it becomes
  a real usability problem once "saved palettes" is scoped.
