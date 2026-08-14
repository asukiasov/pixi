## Context

`2c2-color-panel` (still open, implemented but not yet archived) added
`customSwatches` — a flat, module-level, unpersisted array of hex
strings, rendered into the bottom `palette-row` alongside the 16 presets.
Its own design doc explicitly scoped out persistence and multi-palette
naming as "a possible future increment." This change is that increment.

The existing `customBrushes` persistence pattern (`js/persistence.js`,
from `2c1`) is the direct template: a Dexie table, `userId: null`
reserved for future Supabase Auth ownership, a module-level in-memory
list refreshed from IndexedDB and merged into whatever UI renders it,
`renderX()`-style functions re-invoked after every mutation.

## Goals / Non-Goals

**Goals:**
- Named, persisted palettes, replacing `customSwatches`.
- Right-sidebar panel matching the reference screenshot's shape (named
  collection selector, scrollable swatch grid), without copying its full
  scope (search, multiple *libraries* of palettes, etc.).

**Non-Goals:**
- Individually-named colors (resolved explicitly with the user: the
  *palette*, not each color, gets a name).
- Search/filter across palettes, "All libraries" grouping, or any other
  part of the reference screenshot beyond name + sort + scroll + add.
- Editing/reordering colors within a palette beyond adding them; deleting
  a color from a palette. (Deleting a whole *palette* is in scope - see
  Decisions.)
- Per-user ownership/sync — `userId: null` reserved exactly like
  `customBrushes`, actual ownership is Phase 3 (Supabase Auth).
- Any change to the 16 built-in preset swatches or Rainbow.

## Decisions

**One new Dexie table, `colorPalettes`, storing the whole palette
(`{id, name, colors: [hex, ...], userId, createdAt, updatedAt}`) as one
record — not a separate table of individual color rows.** A palette's
colors are always read/written together (open the panel, see the whole
list; add one color, save the whole updated array) - no requirement
needs querying "which palettes contain color X" or similar
color-level relationships, so one-record-per-palette is simpler than
normalizing colors into their own table with a foreign key.

**Auto-create one "Default" palette on first load if none exist.**
Mirrors "a fresh canvas has exactly one layer" (`2a`'s starting-state
pattern) — the panel should never show an empty "no palettes" state with
nothing to select; there's always at least one active palette to add to.
Checked once, lazily, the first time the panel is rendered (not on every
`initWorkspace` call) — like `loadCustomBrushes()`, this is a one-time
IndexedDB read + conditional write, not per-project.

**New palette creation reuses the existing inline-name-input pattern
(brush editor's name field, canvas settings' name field), not
`window.prompt()`.** The codebase has exactly one native dialog
(`window.confirm` for project deletion in `gallery.js`) and otherwise
always uses an inline text `<input>` for naming something — consistent
with that established convention rather than introducing the app's first
`prompt()`.

**Palette dropdown only appears once more than one palette exists.**
With just the auto-created "Default" palette, a dropdown offering one
option is pure clutter; it becomes useful (and appears) the moment a
second palette exists. Avoids designing a "disabled dropdown" state for
the common single-palette case.

**Deleting a palette is in scope, deleting one color from within a
palette is not.** A palette can be deleted wholesale (mirrors
`customBrushes`' per-item delete), but removing a single swatch from an
existing palette isn't - matches the Non-Goals decision to keep "editing
a palette's contents" out of this slice; if a color turns out to be a
mistake, deleting and recreating the palette (or starting a new one) is
the escape hatch until a finer-grained edit UI is worth building.
Deleting the *last remaining* palette isn't allowed (same "can't delete
the only X" pattern as the last layer) — one always exists, per the
auto-create decision above.

## Risks / Trade-offs

- **No per-color removal is a real limitation for a "mistake" swatch** →
  accepted for this slice (see Decisions); revisit if it comes up again.
- **Storing colors as a JSON array inside one Dexie record means adding
  one color rewrites the whole record** → fine at the expected scale (tens
  of colors per palette, not thousands); `customBrushes` already handles
  its own "whole document per add" pattern the same way and hasn't been a
  problem.
- **Auto-created "Default" palette could conflict with a future
  multi-library import/sync feature's own defaults** → out of scope to
  design against speculatively; Phase 3 (Supabase sync) can migrate or
  rename it if that ever becomes relevant.
