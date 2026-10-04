# Forma UI: shared design system, extracted from Pixi

Date: 2026-10-04 · Branch: `forma-ui`

## Goal

Forma (see `docs/brand.md`) makes two apps, Pixi and Lines (a vector editor),
and both will share one visual language: the Pixelmator-style frosted-glass
look Pixi has today, in the home screen *and* the editor. This change
extracts that look from Pixi's `style.css` (4,185 lines, mixed shared and
Pixi-only rules) into a self-contained `forma-ui/` folder inside this repo.
Pixi then consumes it like any other app would.

Once the owner calls Forma UI finished, the folder moves to its own repo
(`asukiasov/forma-ui`, via `git subtree split` to keep history) and is
vendored into each app as `vendor/forma-ui/`, pinned to a tag. That move,
Lines adopting it, and new components Lines needs are separate projects (see
"Later projects").

**Success criterion: Pixi looks pixel-identical before and after.** Nothing
new is built; no behavior changes.

## Decisions

- **Same style everywhere.** Lines takes the whole look, editor included,
  not just the home screen. Its spec moves from "Figma-style" to Forma UI in
  project 2.
- **Distribution is by copy, not CDN.** Lines vendors all third-party code
  as files and must work offline as a PWA; jsDelivr links would break both.
  For now Pixi links `forma-ui/` in place; after the move, both apps keep a
  pinned copy.
- **Only identity differs between apps:** the accent colour, the wordmark
  text, and the home background artwork. Everything else is identical.
- **Icon font: Material Symbols Outlined, weight 300** (Pixi's current
  font). Lines' spec says Rounded; it switches in project 2 (it has no UI
  built yet).
- **Floating-layout classes are applied by JS** (see "Applying Forma UI
  classes in the editor"), so Forma UI's CSS targets plain classes only and
  embeds stay docked and flat.

## Structure

```
forma-ui/
  tokens.css       colours, glass, floating layout, ghost, icon sizes, home scrim;
                   dark + light themes
  components.css   .glass / .glass-pill / .glass-circle, .ghost-button,
                   .primary-button, .slider, .swatch-pair
  home.css         home screen pattern: .home-screen, .home-backdrop + scrim,
                   .home-hero, .home-wordmark, .home-recents, .home-grid,
                   .home-tile*, empty state
  index.html       "Forma UI" style guide
  README.md        contents, how an app uses it, the allowed overrides
```

Rules:

- **`forma-ui/` never references Pixi**: no Pixi IDs, no `.workspace-screen`
  or other Pixi classes, no paths outside the folder (`../`). Enforced by a
  static test, so the folder can be lifted out as-is.
- **Load order:** `index.html` links `forma-ui/tokens.css`,
  `forma-ui/components.css`, `forma-ui/home.css`, then `style.css`.
- **`style.css` keeps only Pixi-specific styles**: canvas, layers, brushes,
  colour library, popovers, workspace positioning, Pixi-only tokens
  (`--workspace-backdrop`, `--title-shadow`, `--rail-button-size` and the
  like). Among Forma tokens it may override only the allowed ones.
- **Themes:** dark is the default; `data-theme="light"` / `"dark"` on
  `<html>` picks a theme. Forma UI has **no** `prefers-color-scheme`
  query: the app resolves the user's preference (including "system") and
  sets `data-theme`, as Pixi's `js/theme-boot.js` already does. Following
  the system inside Forma UI would silently turn docked embeds (which have
  no theme script) light on a light-mode OS, a behavior change. Lines adds
  a small boot script of its own in project 2.

## Tokens

Forma UI defines, with Pixi's current values unchanged:

| Group | Tokens |
|---|---|
| Colour | `--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-track`, `--color-border`, `--color-text`, `--color-text-secondary`, `--color-text-tertiary`, `--color-text-muted`, `--color-text-subtle`, `--color-text-subtle-2`, `--color-accent`, `--color-accent-strong`, `--color-accent-soft`, `--color-danger`, `--color-success`, `--color-overlay`, `--color-overlay-soft` |
| Glass | `--glass-tint`, `--glass-tint-hover`, `--glass-border`, `--glass-highlight`, `--glass-blur` |
| Floating | `--float-radius`, `--float-gap`, `--float-edge`, `--float-shadow` |
| Ghost button | `--ghost-hover`, `--ghost-on-bg`, `--ghost-on-fg` |
| Icon size | `--icon-size-xs`, `--icon-size-s`, `--icon-size-m`, `--icon-size-l`, `--icon-size-xl` |
| Home | `--home-scrim-inner`, `--home-scrim-outer` |

**Allowed per-app overrides** (listed in the README, checked by test):
`--color-accent`, `--color-accent-strong`, `--color-accent-soft`. The
wordmark text and the backdrop `<img src>` are markup the app supplies, not
tokens. Pixi keeps its current blue, so it overrides nothing today.

The plan's first task confirms which tokens components and the home
pattern actually use; any token used only by Pixi code stays in
`style.css` instead of the table above.

## Components moved

Taken from `style.css`'s "Components (Pixelmator visual pass)" section, the
`.glass` rules in the floating section, `.primary-button`, and the home
screen section:

- `.glass`, `.glass-pill`, `.glass-circle`: the opaque fallback, the
  `@supports` backdrop-filter on `::before`, hover and `aria-expanded`
  states, and the `prefers-reduced-transparency: reduce` opt-out (a
  positive query, because Safari doesn't know it).
- `.ghost-button` (+ `.ghost-text`): rest, hover, pressed/active/open,
  disabled. Its size reads `var(--rail-button-size, 2.75rem)`: the app may
  set `--rail-button-size` as a sizing hook; Forma UI doesn't define it.
- `.primary-button`: base look, hover, focus ring. The home hero's pill
  size moves with it as `.home-hero .primary-button`.
- `.slider`: track, thumb, end icons, value bubble, `--f` /
  `.is-adjusting` contract (scripts stay in the app).
- `.swatch-pair`: the foreground/background stack and corner buttons.
- Home pattern: all of `.home-*` plus tiles, the thumbnail checkerboard,
  short-viewport and phone rules.

**Renames** (Pixi-flavoured class names in shared code become generic):
`.gallery-grid` → `.home-grid`, `.gallery-tile` → `.home-tile`,
`.gallery-tile-open` / `-delete` / `-name` / `-meta` → `.home-tile-*`,
`.gallery-thumbnail` → `.home-thumbnail`. IDs (`#gallery-grid`,
`#gallery-empty-state`, …) are Pixi's and stay. `js/gallery.js` and the
tests follow the renames. Rules for New Canvas (`.new-canvas-card`) stay in
`style.css`; that screen is Pixi's form.

`.version-badge` stays in `style.css` (a Pixi diagnostic).

## Applying Forma UI classes in the editor

Today the floating workspace gets glass and ghost looks through 119
selectors such as
`.workspace-screen[data-layout="floating"] :is(.slot-tools, .panel-rail, #zoom-pill, …)`,
so the docked layout used by `Pixi.mount()` embeds stays flat.

New approach:

- `js/layout.js` gets a mapping table from Pixi selectors to Forma classes,
  for example:

  ```js
  const FORMA_CLASSES = [
    ['.slot-tools, .panel-rail, .options-card, #selection-bar, #zoom-pill, .topbar-group', 'glass glass-pill'],
    ['.tool-options-bar', 'glass'],
    ['#back-to-gallery-button, #more-button', 'glass glass-circle'],
    ['.right-sidebar > .color-library-panel, .right-sidebar > .brushes-panel, .right-sidebar > .layers-panel', 'glass'],
    [':is(.tool-rail-tools, .panel-rail, .tool-options-bar, #selection-bar, .topbar-group) .tool-button', 'ghost-button'],
  ];
  ```

  The exact list is derived from the current selectors in the plan.
- `applyLayout(screenEl, 'floating')` adds those classes within
  `screenEl`; `applyLayout(screenEl, 'docked')` (or any non-floating value)
  removes them. Embeds never call it, so they stay flat as today.
- **Elements created after boot:** none today. Every mapped element is
  static markup in `index.html` (checked: no JS creates or clones
  `.tool-button`s, the swatch stack, or the cards). No helper is built
  (YAGNI); code that later creates an element inside a mapped container
  must add its Forma classes itself, and the table's comment says so.
- `.tool-options-slider` already carries `.slider` in the markup, so it is
  not in the table (removing it on docked would strip the static class).
- `style.css` keeps the floating selectors only for *positioning and
  Pixi-specific sizing* (where each card sits, `.tool-options-bar`'s 26px
  radius, `--rail-button-size`); the *look* comes from Forma classes.
- Specificity: where a floating rule today outranks a docked rule because
  of the `[data-layout]` selector, the plan checks each override still
  wins once the look comes from a plain class. The screenshot comparison
  catches misses.

## Style guide (`forma-ui/index.html`)

- Today's `components.html`, moved and retitled "Forma UI". It loads only
  `forma-ui/*.css` and Material Symbols, never `style.css`, which proves the
  folder stands alone.
- Keeps its sections (glass, ghost button, slider, swatch pair) and its
  generated pixel backdrop and theme switch.
- Adds: tokens (colour swatches, radii, shadows, in both themes), primary
  button, and the home pattern (backdrop + scrim, hero with wordmark,
  Recents sheet with a tile with and without a thumbnail, empty state).
  Demo artwork is a generated or inline image inside the folder.
- `components.html` is deleted, no redirect.

## Embeds (`Pixi.mount()`)

Docked embeds use the tokens and `.primary-button` too, so embedders must
now link `forma-ui/tokens.css` and `forma-ui/components.css` before
`style.css`. `lib/pixi-embed-example.html` and `lib/README.md` are updated;
the README calls this out as a breaking setup change (same look, new
links).

## Testing

- `test/forma-ui.test.js` (new, static, in the style of
  `test/floating-layout-css.test.js`):
  - no file in `forma-ui/` mentions a Pixi ID, `.workspace-screen`, or
    `../`;
  - every token in the README's list is defined for dark and light;
  - `style.css` defines no Forma token except the allowed overrides;
  - `index.html` and `lib/pixi-embed-example.html` link the Forma files
    before `style.css`.
- `test/layout.test.js`: `applyLayout` adds the mapped classes for
  floating and removes them for docked, using a minimal hand-written DOM
  stub (the file has no DOM tests today; no new dependency).
- `test/floating-layout-css.test.js` and `test/home-screen.test.js` move
  to the new structure and class names.
- Visual check: computed-style snapshots (every element plus
  `::before`/`::after`, via a zero-dependency headless-Chrome script,
  `scripts/style-snapshot.mjs`) and screenshots, before (on `main`) and
  after, diffed exactly: Gallery empty and populated, New Canvas,
  Workspace with a popover open, the embed example; dark and light;
  1180×820 and 390×844. Any difference is a bug unless explained in the
  review.
- `web-design-guidelines` review, then `requesting-code-review`.

## Docs updated in this branch

- `docs/ui-reference.md`: class renames; `forma-ui/index.html` replaces
  `components.html`.
- `CLAUDE.md`: what `forma-ui/` is and the rule that it never references
  Pixi.
- `docs/roadmap.md`: this work recorded.
- `lib/README.md`: new stylesheet links for embeds.
- No `docs/specs/*` change; behavior is unchanged.

## Later projects (out of scope)

1. **Move to its own repo:** `git subtree split` `forma-ui/` into
   `asukiasov/forma-ui`, tag `v1.0.0`; Pixi switches to
   `vendor/forma-ui/` with a `VERSIONS.md` line.
2. **Lines adopts Forma UI:** update Lines' spec (Figma-style → Forma UI,
   Rounded → Outlined icons), vendor the files, build its home screen with
   its own wordmark, artwork, and accent.
3. **Grow Forma UI for Lines:** menu bar with dropdowns, layers tree,
   labelled number fields, tabs, tool flyouts. Each is built in Forma UI and
   shown on the style guide before Lines uses it.
