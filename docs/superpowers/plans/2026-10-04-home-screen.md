# Home Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Gallery and New Canvas screens after Pixelmator Pro for iPad's file picker (artwork backdrop, glass hero, glass Recents sheet).

**Architecture:** Markup changes in `index.html`, styles in `style.css` (reusing `.glass`), a pure formatter module `js/gallery-format.js` consumed by `js/gallery.js`. No new behavior beyond richer tile metadata and keyboard-reachable tiles.

**Tech Stack:** Vanilla HTML/CSS/ES modules, `node --test`, Playwright for screenshots, `cwebp` for the asset.

Design: `docs/superpowers/specs/2026-10-04-home-screen-design.md`.

## Global Constraints

- No build step, no new runtime dependencies.
- Glass surfaces use the existing `.glass` class (5a); no second blur implementation.
- Both themes (`:root` dark, `:root[data-theme="light"]`) must define any new colour tokens.
- Backdrop asset: `assets/home-bg.webp`, from `docs/bg.png` (which is removed from `docs/`).
- Targets: 1180×820, 768×1024, 390×844; Chromium + WebKit.

---

### Task 1: Tile metadata formatters (TDD)

**Files:**
- Create: `js/gallery-format.js`
- Test: `test/gallery-format.test.js`

**Interfaces:**
- Produces: `formatCanvasSize({ width, height }) → string`, `formatEdited(timestamp: number, now: number, locale?: string) → string`.

- [ ] Step 1: write `test/gallery-format.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatCanvasSize, formatEdited } from '../js/gallery-format.js';

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 4, 15, 0).getTime(); // Oct 4 2026, 15:00 local

describe('formatCanvasSize', () => {
  test('width×height', () => assert.equal(formatCanvasSize({ width: 32, height: 16 }), '32×16'));
  test('empty when dimensions are missing', () => assert.equal(formatCanvasSize({}), ''));
});

describe('formatEdited', () => {
  test('under a minute is "Just now"', () => assert.equal(formatEdited(NOW - 30_000, NOW, 'en'), 'Just now'));
  test('future timestamps (clock skew) are "Just now"', () => assert.equal(formatEdited(NOW + 5 * MIN, NOW, 'en'), 'Just now'));
  test('minutes', () => assert.equal(formatEdited(NOW - 5 * MIN, NOW, 'en'), '5 minutes ago'));
  test('hours', () => assert.equal(formatEdited(NOW - 3 * HOUR, NOW, 'en'), '3 hours ago'));
  test('one to two days is "Yesterday"', () => assert.equal(formatEdited(NOW - 30 * HOUR, NOW, 'en'), 'Yesterday'));
  test('older, same year: short date', () => assert.equal(formatEdited(NOW - 10 * DAY, NOW, 'en'), 'Sep 24'));
  test('older, other year: includes year', () =>
    assert.equal(formatEdited(new Date(2025, 0, 2).getTime(), NOW, 'en'), 'Jan 2, 2025'));
  test('missing timestamp is empty', () => assert.equal(formatEdited(undefined, NOW, 'en'), ''));
});
```

- [ ] Step 2: `npm test` → fails with module not found.
- [ ] Step 3: implement `js/gallery-format.js`:

```js
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatCanvasSize({ width, height } = {}) {
  return width && height ? `${width}×${height}` : '';
}

export function formatEdited(timestamp, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(timestamp)) return '';
  const age = now - timestamp;
  if (age < MINUTE) return 'Just now';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (age < HOUR) return rtf.format(-Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return rtf.format(-Math.floor(age / HOUR), 'hour');
  if (age < 2 * DAY) return capitalize(rtf.format(-1, 'day'));
  const date = new Date(timestamp);
  const options = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== new Date(now).getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString(locale, options);
}

function capitalize(s) {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
```

- [ ] Step 4: `npm test` → all pass.
- [ ] Step 5: commit "Add gallery tile metadata formatters".

### Task 2: Home screen markup, asset, styles, gallery tiles

**Files:**
- Create: `assets/home-bg.webp` (`cwebp -q 82 docs/bg.png -o assets/home-bg.webp`, then `git rm`/delete `docs/bg.png`)
- Modify: `index.html` (gallery + new-canvas `<main>`s), `style.css` (gallery/new-canvas sections, tokens), `js/gallery.js` (tile builder, easter-egg selector)
- Test: `test/home-screen.test.js`

**Interfaces:**
- Consumes: `formatCanvasSize`, `formatEdited` from Task 1.
- Keeps ids `gallery-grid`, `gallery-empty-state`, `gallery-new-canvas-button`, `version-badge`, `create-canvas-button`, and all New Canvas form ids unchanged (`js/app.js`, `js/new-canvas.js` rely on them).

- [ ] Step 1: write `test/home-screen.test.js` (static checks):

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const html = read('index.html').toString('utf8');
const css = read('style.css').toString('utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function screen(id) {
  const start = html.indexOf(`<main id="${id}"`);
  return html.slice(start, html.indexOf('</main>', start));
}

describe('home screen backdrop', () => {
  test('artwork ships as WebP under assets/', () => {
    assert.ok(existsSync(new URL('../assets/home-bg.webp', import.meta.url)));
    const bytes = read('assets/home-bg.webp');
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP');
  });

  for (const id of ['screen-gallery', 'screen-new-canvas']) {
    test(`${id} carries a decorative backdrop image`, () => {
      assert.match(screen(id), /<div class="home-backdrop" aria-hidden="true">\s*<img src="assets\/home-bg\.webp" alt=""/);
    });
  }

  test('the backdrop image covers the screen', () => {
    assert.match(css, /\.home-backdrop img\s*{[^}]*object-fit:\s*cover/);
  });

  test('scrim tokens exist in both themes', () => {
    const dark = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    const lightStart = css.indexOf(':root[data-theme="light"] {');
    const light = css.slice(lightStart, css.indexOf('}', lightStart));
    for (const block of [dark, light]) {
      assert.match(block, /--home-scrim-inner:/);
      assert.match(block, /--home-scrim-outer:/);
    }
  });
});

describe('home screen glass surfaces', () => {
  test('hero card and recents sheet use .glass', () => {
    const gallery = screen('screen-gallery');
    assert.match(gallery, /class="home-hero glass"/);
    assert.match(gallery, /class="home-recents glass"/);
  });

  test('New Canvas form sits in a glass card', () => {
    assert.match(screen('screen-new-canvas'), /class="new-canvas-card glass"/);
  });

  test('project grid is a list', () => {
    assert.match(screen('screen-gallery'), /<ul id="gallery-grid" class="gallery-grid"/);
  });
});
```

- [ ] Step 2: `npm test` → new tests fail.
- [ ] Step 3: convert the asset; rewrite the two `<main>`s in `index.html`:

```html
<main id="screen-gallery" class="screen home-screen">
  <div class="home-backdrop" aria-hidden="true">
    <img src="assets/home-bg.webp" alt="" decoding="async" />
  </div>
  <div class="home-hero-wrap">
    <div class="home-hero glass">
      <h1 class="home-wordmark">Pixi</h1>
      <button type="button" id="gallery-new-canvas-button" class="primary-button">New Canvas</button>
    </div>
  </div>
  <section class="home-recents glass" aria-labelledby="home-recents-title">
    <h2 id="home-recents-title" class="home-recents-title">Recents</h2>
    <ul id="gallery-grid" class="gallery-grid"></ul>
    <p id="gallery-empty-state" class="gallery-empty-state hidden">
      No projects yet — tap New Canvas to start one.
    </p>
  </section>
  <p id="version-badge" class="version-badge"></p>
</main>

<main id="screen-new-canvas" class="screen home-screen hidden">
  <div class="home-backdrop" aria-hidden="true">
    <img src="assets/home-bg.webp" alt="" decoding="async" />
  </div>
  <div class="new-canvas-card glass">
    …existing h1, two .field-group sections, Create button, unchanged…
  </div>
</main>
```

  Styles (replace the old Gallery/New Canvas sections of `style.css`):
  - Tokens: dark `--home-scrim-inner: rgba(0,0,0,0.45); --home-scrim-outer: rgba(0,0,0,0.82)`; light `--home-scrim-inner: rgba(236,236,240,0.35); --home-scrim-outer: rgba(236,236,240,0.78)`.
  - `.home-screen`: `position: relative; isolation: isolate; overflow-y: auto; padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left)); background: #0b0b0d`.
  - `.home-backdrop`: `position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none`. `img`: `width/height: 100%; object-fit: cover; filter: blur(3px); transform: scale(1.06)`. `::after`: `content:''; position:absolute; inset:0; background: radial-gradient(ellipse at 50% 40%, var(--home-scrim-inner), var(--home-scrim-outer) 75%)`.
  - `.home-hero-wrap`: `flex: 1 0 auto; display: grid; place-items: center; padding: 1.5rem 0`.
  - `.home-hero`: `position: relative; --glass-blur: 28px; width: min(100%, 34rem); padding: clamp(1.75rem, 5vw, 3rem) clamp(1.25rem, 5vw, 3rem); border-radius: 28px; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; text-align: center`.
  - `.home-wordmark`: `margin: 0; font-size: clamp(3.25rem, 11vw, 6rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1; cursor: default`.
  - `.home-hero .primary-button`: `margin-top: 0; min-width: 14rem; padding: 0.85rem 1.75rem; border-radius: 999px; font-weight: 600`.
  - `.primary-button:hover` → `--color-accent-strong`; `.primary-button:focus-visible` → 2px accent outline offset 3px.
  - `.home-recents`: `position: relative; --glass-blur: 32px; flex: 0 1 auto; display: flex; flex-direction: column; max-height: 52dvh; margin: 0 calc(-1 * max(1rem, env(safe-area-inset-left)) + var(--float-edge)); padding: 1rem 1.25rem max(1rem, env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; border-bottom: none`.
  - `.home-recents-title`: centred, `font-size: 0.95rem; font-weight: 600; margin: 0 0 0.75rem`.
  - `.gallery-grid`: `list-style: none; margin: 0; padding: 0 0 0.5rem; overflow-y: auto; min-height: 0; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 1rem 0.75rem`.
  - `.gallery-tile`: `position: relative`; `.gallery-tile-open`: reset button, column, `width:100%`, `padding: 0.4rem`, `border-radius: 14px`, hover bg `var(--color-accent-soft)`, focus-visible accent outline.
  - `.gallery-thumbnail`: square, `object-fit: contain`, checkerboard background (repeating-conic-gradient #e2e2e2/#cfcfcf 0 25%, 12px), `border-radius: 10px`, pixelated, hairline border.
  - `.gallery-tile-name` 0.85rem/600 ellipsis; `.gallery-tile-meta` 0.72rem `--color-text-secondary`, tabular-nums, two lines (size, time).
  - `.gallery-tile-delete`: top-right of the thumbnail; `opacity: 0` until tile `:hover`/`:focus-within`, always visible under `(hover: none)`.
  - `.version-badge`: `top: max(0.4rem, env(safe-area-inset-top)); bottom: auto; color: rgba(255,255,255,0.35)`.
  - `@media (max-width: 480px)`: tiles `minmax(6.5rem, 1fr)`, hero padding tighter.
  - `@media (max-height: 560px)`: `.home-recents { max-height: none }`, `.gallery-grid { overflow: visible }`.
  - New Canvas: `#screen-new-canvas { align-items: center; justify-content: center; padding-bottom: max(1rem, env(safe-area-inset-bottom)) }`; `.new-canvas-card { position: relative; --glass-blur: 28px; width: min(100%, 30rem); padding: 1.5rem; border-radius: 24px; display: flex; flex-direction: column; gap: 0.5rem }`; `.new-canvas-card h1 { margin: 0 }`; Create button `margin-top: 1rem`.

  `js/gallery.js`: build tiles as

```js
function buildProjectTile(project, onOpenProject, refresh) {
  const tile = document.createElement('li');
  tile.className = 'gallery-tile';

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'gallery-tile-open';
  open.addEventListener('click', () => onOpenProject(project.id));

  const img = document.createElement('img');
  img.className = 'gallery-thumbnail';
  img.alt = '';
  if (project.thumbnail) img.src = URL.createObjectURL(project.thumbnail);

  const name = document.createElement('span');
  name.className = 'gallery-tile-name';
  name.textContent = project.name;

  const meta = document.createElement('span');
  meta.className = 'gallery-tile-meta';
  const size = document.createElement('span');
  size.textContent = formatCanvasSize(project);
  const edited = document.createElement('time');
  edited.dateTime = new Date(project.updatedAt).toISOString();
  edited.textContent = formatEdited(project.updatedAt);
  meta.append(size, edited);

  open.append(img, name, meta);
  // …delete button as before, aria-label `Delete "${project.name}"`…
  tile.append(open, deleteButton);
  return tile;
}
```

  and change the easter egg's selector to `.home-wordmark`.
- [ ] Step 4: `npm test` → all pass.
- [ ] Step 5: commit "Pixelmator-style home screen and New Canvas card".

### Task 3: Docs

**Files:** `docs/specs/gallery/spec.md`, `docs/specs/canvas-creation/spec.md`, `docs/ui-reference.md`, `docs/roadmap.md`.

- [ ] Gallery spec: Project grid requirement adds size + last-edited and keyboard operability; new "Home screen presentation" requirement (backdrop, hero, Recents sheet, reduced transparency); "+ New Canvas" → "New Canvas".
- [ ] canvas-creation spec: "New Canvas presentation" requirement (same backdrop, form in a glass card).
- [ ] ui-reference: update the Gallery and New Canvas sections.
- [ ] roadmap: a done entry.
- [ ] Commit "Docs: home screen redesign".

### Task 4: Verification

- [ ] `npm test`.
- [ ] Serve (`python3 -m http.server`), Playwright screenshots in Chromium + WebKit at 1180×820, 768×1024 and 390×844 (dark + light, empty + seeded projects, New Canvas). Check the console for errors. Check that a tile opens, delete works, and the paw parade triggers.
- [ ] web-design-guidelines review of the diff; fix findings.
- [ ] Code review; fix findings.
- [ ] Merge `--no-ff` into main, push, remove the worktree.
