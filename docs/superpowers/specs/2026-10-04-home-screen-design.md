# Home screen redesign (Pixelmator-style file picker)

Date: 2026-10-04 · Branch: `home-screen`

## Goal

Restyle the Gallery (`#screen-gallery`, route `#/`) after Pixelmator Pro for
iPad's file picker (`docs/Screenshots of other apps/other screens/pixelmator-pro-file-picker.avif`):
full-bleed artwork, a centred frosted-glass hero card with the wordmark and
the primary action, and saved projects in a frosted-glass "Recents" sheet
pinned to the bottom. The New Canvas screen (`#screen-new-canvas`) gets the
same backdrop with its form in a glass card.

No new features. Behavior is unchanged apart from the richer project tiles
(size + last-edited) and keyboard-reachable tiles.

## Decisions

- **No secondary hero action.** The app has no "open an image as a project"
  flow (image import only exists as a reference layer and a palette import),
  so "Import image" would be a new feature. The hero holds the wordmark and
  "New Canvas" only.
- **New Canvas is restyled too**, so leaving the home screen for the form
  doesn't jump to a flat grey page.
- **Backdrop is an `<img>`, not a CSS background**, so it can use
  `object-fit: cover` and a `filter: blur()` without a pseudo-element hack.
  One `.home-backdrop` wrapper per screen (`img` + scrim via `::after`),
  `position: fixed; inset: 0; z-index: -1` inside the screen's own stacking
  context (`isolation: isolate`). Same URL in both screens, so the second is
  a cache hit.
- **Artwork treatment:** `docs/bg.png` (1376×768) → `assets/home-bg.webp`.
  `filter: blur(3px)` plus `transform: scale(1.06)` hides the low resolution
  and the blurred edge. A radial scrim on top: dark theme darkens the centre
  less than the edges (vignette); light theme washes the artwork toward
  `--color-bg` so white glass reads. Scrim colours are theme tokens
  (`--home-scrim-inner`, `--home-scrim-outer`).
- **Glass reuse:** the hero card, the recents sheet and the New Canvas card
  use the existing `.glass` class from 5a, which already handles the
  opaque fallback, `@supports` blur on `::before`, and
  `prefers-reduced-transparency: reduce`. A stronger blur for the sheet and
  hero is set via `--glass-blur` on those elements, not a new rule.
- **Recents sheet:** pinned to the bottom, `--float-edge` side gutters, top
  corners rounded (24px), bottom flush with the screen edge plus safe-area
  padding. Heading "Recents". Its grid scrolls inside the sheet
  (`max-height: 52dvh`); on short viewports (`max-height: 560px`) the cap
  is lifted and the whole screen scrolls instead.
- **Tiles:** `<ul class="gallery-grid">` of `<li class="gallery-tile">`.
  Each tile has an "open" `<button>` (thumbnail, name, `W×H`, `<time>`
  last-edited) and a sibling delete button. Before this, the tile was a
  clickable `<div>`, which a keyboard couldn't reach. Thumbnails sit on
  the same checkerboard as transparency elsewhere, pixelated.
- **Meta formatting** lives in a pure module `js/gallery-format.js` so it can
  be unit-tested without a DOM:
  - `formatCanvasSize({ width, height })` → `"32×32"`, or `""` if missing.
  - `formatEdited(timestamp, now, locale)` → `"Just now"` (< 1 min),
    relative minutes/hours via `Intl.RelativeTimeFormat` (< 24 h),
    `"Yesterday"` (< 48 h), else a short date (`"Sep 12"`, with the year
    when it differs from `now`'s).
- **Empty state:** kept inside the sheet with the same copy, updated to
  match the button label ("tap New Canvas").
- **Version badge** moves to the top-right corner (the sheet now covers the
  bottom).
- **Paw Parade easter egg** now targets the hero wordmark (`.home-wordmark`).
- **Wordmark:** `h1.home-wordmark`, system-ui at weight 800,
  `clamp(3.25rem, 11vw, 6rem)`, tight tracking.
- **Primary button:** existing `.primary-button` look, but pill-shaped and
  sized to content inside the hero (`.home-hero .primary-button`). The label
  drops the "+" ("New Canvas", like Pixelmator's "Create a Document").

## Layout

`#screen-gallery` is a flex column with safe-area padding:

1. `.home-hero-wrap` (`flex: 1`, centres) → `.home-hero.glass`
   (`max-width: 34rem`, wordmark + button).
2. `.home-recents.glass` sheet (heading, grid / empty state).

Tile size is `minmax(8.5rem, 1fr)` at tablet width and `minmax(6.5rem, 1fr)`
under 480px. Targets: 1180×820 and 768×1024 iPad, 390×844 phone.

`#screen-new-canvas` centres `.new-canvas-card.glass` (`max-width: 30rem`)
over the same backdrop; the form markup inside is unchanged.

## Testing

- `test/gallery-format.test.js`: unit tests for the two formatters (TDD).
- `test/home-screen.test.js`: static checks in the style of
  `test/floating-layout-css.test.js`. The asset exists and is WebP. Both
  screens carry the backdrop. The hero, sheet and New Canvas card use
  `.glass`. The backdrop uses `object-fit: cover`. The scrim tokens are
  defined for both themes.
- Manual: Playwright screenshots in Chromium + WebKit at 1180×820,
  768×1024 and 390×844, light + dark, empty + populated. Then the
  web-design-guidelines review and a code review.
