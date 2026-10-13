# Share and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Export popover into a Share popover with a live preview and file size, and Copy / Download / Share actions in place of the single Export button.

**Architecture:** `js/export.js` keeps owning the popover. It pre-renders the output Blob whenever the popover opens or an option changes (Safari only allows `navigator.share()` and `clipboard.write()` directly inside the click, so encoding can't wait for the click). That same Blob drives the preview, the size readout and all three actions. `js/workspace.js` supplies `render(options) → Promise<Blob>` (wrapping `LayerStack.toPNGBlob`) and `onDownloaded()` (the confetti). Pure helpers (`formatFileSize`, `copyLabel`, `shareCapabilities`, `createLatestOnly`, `exportFilename`) are unit-tested in Node; markup and CSS are checked by static tests that read the files, following the existing pattern in `test/floating-layout-css.test.js`.

**Tech Stack:** Vanilla HTML/CSS/JS ES modules, `node --test` (no DOM, no jsdom), Playwright WebKit for the browser check.

Spec: `docs/superpowers/specs/2026-10-13-share-export-design.md`

## Global Constraints

- No build step, no new dependencies.
- Material Symbols is a subset font: any new glyph name must be added to the `icon_names=` list in `index.html`'s `<link>`, in alphabetical order (`ios_share` goes between `ink_eraser` and `layers`).
- `lib/pixi.js` holds a hand-kept copy of the workspace markup (`WORKSPACE_MARKUP`). Every markup change to `#export-panel` or `#export-button` in `index.html` must be mirrored there.
- Keep element IDs `#export-button`, `#export-panel`, `#export-download`. The More menu forwards to `#export-button` by ID.
- `.export-download-button` is also used by `#timelapse-save`. Don't change or remove that rule; the new action buttons use a new class, `.export-action-button`.
- Hit targets are at least 44px tall.
- Options still reset to 1x / PNG / transparency off every time the popover opens. Nothing is persisted.
- User-facing copy: heading "Share"; More-menu item "Share / Export"; buttons "Copy" (or "Copy PNG" when the format isn't PNG), "Download", "Share"; toasts "Copied", "Couldn't copy the image.", "Couldn't share. Try Download instead.", "Couldn't prepare the image."
- Run the whole suite with `npm test`; it must end with `# fail 0`. (`test/floating-layout-css.test.js` has uncommitted local edits from before this branch. Leave them alone and don't stage them.)
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

### Task 1: Pure helpers in `js/export.js`

**Files:**
- Modify: `js/export.js` (add exports after `sanitizeFilename`, ~line 53)
- Create: `test/export.test.js`

**Interfaces:**
- Produces (all exported from `js/export.js`):
  - `formatFileSize(bytes: number) → string`: `"512 B"`, `"~3 KB"`, `"1.2 MB"`
  - `copyLabel(format: 'png'|'webp'|'jpg') → 'Copy' | 'Copy PNG'`
  - `shareCapabilities(nav = globalThis.navigator, env = globalThis) → { canShare: boolean, canCopy: boolean }`. `env` supplies `File` and `ClipboardItem`.
  - `createLatestOnly() → { run(task: () => Promise<T>): Promise<{ current: true, result: T } | { current: false }>, cancel(): void }`
  - `exportFilename(name: string, scale: number, format: string) → string`: `<sanitized>@<scale>x.<format>`

- [ ] **Step 1: Write the failing tests**

Create `test/export.test.js`:

```js
// Share/Export popover (2026-10-13 share-export): the pure half of
// js/export.js. The popover's DOM wiring is checked in the browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFileSize,
  copyLabel,
  shareCapabilities,
  createLatestOnly,
  exportFilename,
} from '../js/export.js';

describe('formatFileSize', () => {
  test('bytes under 1 KB are exact', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(512), '512 B');
  });

  test('kilobytes are rounded and marked approximate', () => {
    assert.equal(formatFileSize(1024), '~1 KB');
    assert.equal(formatFileSize(3200), '~3 KB');
    assert.equal(formatFileSize(1024 * 1024 - 1), '~1024 KB');
  });

  test('megabytes get one decimal', () => {
    assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
    assert.equal(formatFileSize(1.25 * 1024 * 1024), '1.3 MB');
  });
});

describe('copyLabel', () => {
  test('says Copy for PNG, Copy PNG otherwise', () => {
    assert.equal(copyLabel('png'), 'Copy');
    assert.equal(copyLabel('webp'), 'Copy PNG');
    assert.equal(copyLabel('jpg'), 'Copy PNG');
  });
});

describe('shareCapabilities', () => {
  class FakeFile {
    constructor(parts, name, options) {
      this.name = name;
      this.type = options?.type;
    }
  }
  class FakeClipboardItem {}
  const env = { File: FakeFile, ClipboardItem: FakeClipboardItem };

  test('can share when share() exists and canShare accepts files', () => {
    const nav = { share() {}, canShare: ({ files }) => files[0] instanceof FakeFile };
    assert.equal(shareCapabilities(nav, env).canShare, true);
  });

  test('cannot share when canShare rejects files', () => {
    const nav = { share() {}, canShare: () => false };
    assert.equal(shareCapabilities(nav, env).canShare, false);
  });

  test('cannot share without share() or canShare()', () => {
    assert.equal(shareCapabilities({}, env).canShare, false);
    assert.equal(shareCapabilities({ share() {} }, env).canShare, false);
  });

  test('cannot share when canShare throws', () => {
    const nav = { share() {}, canShare: () => { throw new TypeError('nope'); } };
    assert.equal(shareCapabilities(nav, env).canShare, false);
  });

  test('can copy with clipboard.write and ClipboardItem', () => {
    const nav = { clipboard: { write() {} } };
    assert.equal(shareCapabilities(nav, env).canCopy, true);
  });

  test('cannot copy without ClipboardItem or clipboard.write', () => {
    assert.equal(shareCapabilities({ clipboard: { write() {} } }, { File: FakeFile }).canCopy, false);
    assert.equal(shareCapabilities({ clipboard: {} }, env).canCopy, false);
    assert.equal(shareCapabilities(undefined, env).canCopy, false);
  });
});

describe('createLatestOnly', () => {
  function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  test('the only run is current', async () => {
    const latest = createLatestOnly();
    assert.deepEqual(await latest.run(async () => 'a'), { current: true, result: 'a' });
  });

  test('an older run that finishes last is not current', async () => {
    const latest = createLatestOnly();
    const slow = deferred();
    const first = latest.run(() => slow.promise);
    const second = latest.run(async () => 'new');
    slow.resolve('old');
    assert.deepEqual(await second, { current: true, result: 'new' });
    assert.deepEqual(await first, { current: false });
  });

  test('cancel() makes a pending run stale', async () => {
    const latest = createLatestOnly();
    const slow = deferred();
    const run = latest.run(() => slow.promise);
    latest.cancel();
    slow.resolve('x');
    assert.deepEqual(await run, { current: false });
  });

  test('a current run rethrows; a stale one swallows its error', async () => {
    const latest = createLatestOnly();
    await assert.rejects(latest.run(async () => { throw new Error('boom'); }), /boom/);
    const slow = deferred();
    const stale = latest.run(() => slow.promise);
    latest.run(async () => 'new');
    slow.reject(new Error('late'));
    assert.deepEqual(await stale, { current: false });
  });
});

describe('exportFilename', () => {
  test('follows <name>@<scale>x.<ext>, sanitized', () => {
    assert.equal(exportFilename('My Sprite', 4, 'webp'), 'My Sprite@4x.webp');
    assert.equal(exportFilename('Sword/Shield: v2', 1, 'png'), 'Sword-Shield- v2@1x.png');
    assert.equal(exportFilename('  ', 2, 'jpg'), 'untitled@2x.jpg');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/export.test.js`
Expected: FAIL, `SyntaxError: The requested module '../js/export.js' does not provide an export named 'formatFileSize'`

- [ ] **Step 3: Implement the helpers**

In `js/export.js`, directly after the `sanitizeFilename` function, add:

```js
/** `<sanitized-project-name>@<scale>x.<ext>` - the export spec's Export filename requirement. */
export function exportFilename(name, scale, format) {
  return `${sanitizeFilename(name)}@${scale}x.${format}`;
}

/** Human-readable encoded size for the preview row: exact bytes, then ~KB, then MB. */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The clipboard only takes image/png reliably across browsers, so Copy
 * always copies a PNG - and says so when another format is selected.
 */
export function copyLabel(format) {
  return format === 'png' ? 'Copy' : 'Copy PNG';
}

/**
 * Which of Share/Copy this browser supports. Share needs Web Share with
 * files (Safari on iOS/iPadOS/macOS, Android, Chrome on Windows/ChromeOS);
 * Copy needs async clipboard image writes. Takes navigator-like and
 * global-like objects so tests can pass fakes.
 */
export function shareCapabilities(nav = globalThis.navigator, env = globalThis) {
  let canShare = false;
  try {
    canShare = typeof nav?.share === 'function'
      && typeof nav?.canShare === 'function'
      && typeof env.File === 'function'
      && Boolean(nav.canShare({ files: [new env.File([''], 'probe.png', { type: 'image/png' })] }));
  } catch {
    canShare = false;
  }
  const canCopy = typeof nav?.clipboard?.write === 'function' && typeof env.ClipboardItem === 'function';
  return { canShare, canCopy };
}

/**
 * Lets only the newest of several overlapping async renders win, so a
 * slow 8x render finishing late can't overwrite a newer 1x one. A stale
 * run's rejection is swallowed too - nobody is waiting on it any more.
 */
export function createLatestOnly() {
  let latest = 0;
  return {
    async run(task) {
      const id = ++latest;
      try {
        const result = await task();
        return id === latest ? { current: true, result } : { current: false };
      } catch (err) {
        if (id !== latest) return { current: false };
        throw err;
      }
    },
    cancel() {
      latest++;
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/export.test.js`
Expected: PASS, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/export.js test/export.test.js
git commit -m "Export: pure helpers for size, copy label, share support, latest-only renders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Share popover markup and CSS

**Files:**
- Modify: `index.html`: icon font `<link>` (~line 37), `#export-button` (~line 177), More-menu item (~line 256), `#export-panel` (~lines 912-948)
- Modify: `lib/pixi.js`: `#export-button` (~line 55) and `#export-panel` (~lines 175-204) in `WORKSPACE_MARKUP`
- Modify: `style.css`: the Export popover block (~lines 1241-1272)
- Create: `test/export-markup.test.js`

**Interfaces:**
- Produces (element IDs Task 3 queries): `#export-preview-image` (`<img>`), `#export-preview-name`, `#export-preview-dimensions`, `#export-preview-size`, `#export-copy`, `#export-copy-label`, `#export-download`, `#export-share`. Action buttons carry `.export-action-button`; Task 3 adds `.primary` to one of them.

- [ ] **Step 1: Write the failing static test**

Create `test/export-markup.test.js`:

```js
// Share popover markup and CSS (2026-10-13 share-export). Static, like
// test/floating-layout-css.test.js: reads the files, renders nothing.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const embed = read('../lib/pixi.js');
const css = read('../style.css').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Share popover markup', () => {
  for (const [label, source] of [['index.html', html], ['lib/pixi.js', embed]]) {
    test(`${label}: top-bar button is Share with ios_share`, () => {
      assert.match(source, /id="export-button"[^>]*aria-label="Share"[^>]*data-tooltip="Share"/);
      assert.match(source, /id="export-button"[^>]*>\s*<span class="material-symbols-outlined"[^>]*>ios_share<\/span>/);
    });

    test(`${label}: popover has the preview and three actions`, () => {
      for (const id of [
        'export-preview-image',
        'export-preview-name',
        'export-preview-dimensions',
        'export-preview-size',
        'export-copy',
        'export-copy-label',
        'export-download',
        'export-share',
      ]) {
        assert.match(source, new RegExp(`id="${id}"`), `missing #${id}`);
      }
      assert.match(source, /<h2>Share<\/h2>/);
      assert.doesNotMatch(source, /<\/span> Export\s*<\/button>/);
    });
  }

  test('ios_share is in the icon font subset', () => {
    assert.match(html, /icon_names=[^"]*\bink_eraser,ios_share,layers\b/);
  });

  test('More menu item reads Share / Export', () => {
    assert.match(html, /data-forward="export-button">\s*<span[^>]*>ios_share<\/span>Share \/ Export/);
  });
});

describe('Share popover CSS', () => {
  test('preview is pixelated over a checkerboard', () => {
    assert.match(css, /#export-preview-image \{[^}]*image-rendering: pixelated/);
    assert.match(css, /\.export-preview-frame \{[^}]*conic-gradient/);
  });

  test('action buttons are 44px tall; .primary is accent-filled', () => {
    assert.match(css, /\.export-action-button \{[^}]*min-height: 44px/);
    assert.match(css, /\.export-action-button\.primary \{[^}]*background: var\(--color-accent\)/);
  });

  test('timelapse Save keeps .export-download-button', () => {
    assert.match(css, /\.export-download-button \{/);
    assert.match(html, /id="timelapse-save" class="tool-button export-download-button"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/export-markup.test.js`
Expected: FAIL on the Share button, preview IDs, `ios_share`, and CSS assertions. The timelapse test passes.

- [ ] **Step 3: Update `index.html`**

(a) In the Material Symbols `<link>`'s `icon_names=` list, change `ink_eraser,layers` to `ink_eraser,ios_share,layers`.

(b) Replace the `#export-button` element:

```html
      <button type="button" id="export-button" class="tool-button icon-button" aria-label="Share" data-tooltip="Share">
        <span class="material-symbols-outlined">ios_share</span>
      </button>
```

(c) Replace the More-menu Export item:

```html
        <button type="button" class="topbar-menu-item" role="menuitem" data-forward="export-button">
          <span class="material-symbols-outlined" aria-hidden="true">ios_share</span>Share / Export
        </button>
```

(d) Replace the whole `#export-panel` block, including its leading comment, with:

```html
      <!-- Share popover (2026-10-13 share-export), anchored to the top bar's
           share icon (#export-button), same clamped-to-viewport pattern as
           #canvas-settings-panel (js/export.js). The output is pre-rendered
           on open and on every option change, so the preview, the size, and
           Copy/Share (which Safari only allows inside the click) all use the
           same ready Blob. Scale, format and the transparent-background
           toggle reset to their defaults every time it opens. -->
      <div id="export-panel" class="canvas-settings-panel export-panel hidden">
        <div class="canvas-settings-row canvas-settings-header-row">
          <h2>Share</h2>
          <button type="button" id="export-close" class="icon-button" aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="canvas-settings-row export-preview-row">
          <div class="export-preview-frame">
            <img id="export-preview-image" alt="" />
          </div>
          <div class="export-preview-meta">
            <span id="export-preview-name" class="export-preview-name"></span>
            <span id="export-preview-dimensions"></span>
            <span id="export-preview-size" aria-live="polite"></span>
          </div>
        </div>
        <div class="canvas-settings-row export-scale-row" role="radiogroup" aria-label="Scale">
          <button type="button" class="tool-button export-scale-option active" data-scale="1">1x</button>
          <button type="button" class="tool-button export-scale-option" data-scale="2">2x</button>
          <button type="button" class="tool-button export-scale-option" data-scale="4">4x</button>
          <button type="button" class="tool-button export-scale-option" data-scale="8">8x</button>
        </div>
        <div class="canvas-settings-row export-format-row" role="radiogroup" aria-label="Format">
          <button type="button" class="tool-button export-format-option active" data-format="png">PNG</button>
          <button type="button" class="tool-button export-format-option" data-format="webp">WebP</button>
          <button type="button" class="tool-button export-format-option" data-format="jpg">JPG</button>
        </div>
        <div class="canvas-settings-row">
          <label id="export-transparent-label">
            <input type="checkbox" id="export-transparent-background" />
            Transparent background
          </label>
        </div>
        <div class="canvas-settings-row export-actions-row">
          <button type="button" id="export-copy" class="tool-button export-action-button">
            <span class="material-symbols-outlined" aria-hidden="true">content_copy</span><span id="export-copy-label">Copy</span>
          </button>
          <button type="button" id="export-download" class="tool-button export-action-button">
            <span class="material-symbols-outlined" aria-hidden="true">download</span>Download
          </button>
          <button type="button" id="export-share" class="tool-button export-action-button">
            <span class="material-symbols-outlined" aria-hidden="true">ios_share</span>Share
          </button>
        </div>
      </div>
```

- [ ] **Step 4: Mirror the markup in `lib/pixi.js`**

In `WORKSPACE_MARKUP`, replace the `#export-button` element with the same markup as Step 3(b), and replace the `#export-panel` block's contents with the same markup as Step 3(d), indented to match the template's 2-space indentation. Leave out the HTML comment.

- [ ] **Step 5: Update `style.css`**

In the "Export popover" block (~line 1241), change the leading comment to `/* Share popover (export.js) - reuses .canvas-settings-panel's base popover styling (position/size/background/border), just its own content rows below. */`. Keep every existing rule, including `.export-download-button`, which `#timelapse-save` still uses. Append after `.export-download-button { … }`:

```css
.export-preview-row {
  gap: 0.75rem;
  align-items: center;
}

/* Fixed box, checkerboard so transparency reads; the image is scaled up
   to fit with hard pixel edges. */
.export-preview-frame {
  width: 72px;
  height: 72px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  overflow: hidden;
  background: repeating-conic-gradient(#d9d9d9 0% 25%, #ffffff 0% 50%) 50% / 12px 12px;
}

#export-preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.export-preview-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted, inherit);
  font-variant-numeric: tabular-nums;
}

.export-preview-name {
  color: var(--color-text, inherit);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-actions-row {
  gap: 0.4rem;
}

.export-action-button {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.export-action-button.primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.export-action-button:disabled {
  opacity: 0.5;
}
```

Check that `--color-text-muted` and `--color-text` exist (`grep -n "\-\-color-text" forma-ui/tokens.css style.css`). If they have other names, use those and drop the `inherit` fallback.

- [ ] **Step 6: Run the tests**

Run: `npm test 2>&1 | tail -5`
Expected: `# fail 0`

- [ ] **Step 7: Commit**

```bash
git add index.html lib/pixi.js style.css test/export-markup.test.js
git commit -m "Share popover markup: preview row, Copy/Download/Share, ios_share icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wire pre-rendering, preview and the three actions

**Files:**
- Modify: `js/export.js`: replace `initExport` (from its doc comment ~line 55 to the end of the file); add `import { showToast } from './toast.js';` under the existing import
- Modify: `js/workspace.js:1907-1918` (the `initExport({...})` call)

**Interfaces:**
- Consumes: `exportFilename`, `formatFileSize`, `copyLabel`, `shareCapabilities`, `createLatestOnly` (Task 1); the element IDs from Task 2; `showToast(message, { type })` from `js/toast.js`; `LayerStack.toPNGBlob({ scale, format, skipBackground }) → Promise<Blob|null>` and `LayerStack.width`/`.height`.
- Produces: `initExport({ render, onDownloaded, getProjectName, getCanvasSize, root }) → { close() }`, where `render(options) → Promise<Blob>`, `onDownloaded() → void` and `getCanvasSize() → { width, height }`.

There is no DOM in Node tests, so this task is verified in the browser (Step 4).

- [ ] **Step 1: Replace `initExport` in `js/export.js`**

Add `import { showToast } from './toast.js';` after the `layout.js` import. Then replace everything from the `/** Wires the Export popover …` doc comment to the end of the file with:

```js
/**
 * Wires the Share popover (preview, scale, format, transparent-background
 * override, and Copy/Download/Share) in the Workspace screen. Doesn't own
 * a LayerStack: `render(options)` (from workspace.js) encodes the output
 * Blob, and `onDownloaded()` runs workspace.js's celebration.
 *
 * The Blob is rendered ahead of time - on open and on every option
 * change - because Safari rejects navigator.share() and
 * clipboard.write() once an await has spent the click's user activation.
 * The same Blob drives the preview and the size readout. When the format
 * isn't PNG, a second PNG Blob is rendered for Copy (the clipboard only
 * takes PNG reliably).
 *
 * Scale, format and the toggle reset to their defaults (1x, PNG, off)
 * every time the popover opens - transient UI state, not saved with the
 * project. `getProjectName()` is read at action time, so a rename right
 * before sharing is still reflected in the filename.
 */
export function initExport({ render, onDownloaded = () => {}, getProjectName, getCanvasSize, root = document }) {
  const toggleButton = root.querySelector('#export-button');
  const panel = root.querySelector('#export-panel');
  const closeButton = root.querySelector('#export-close');
  const scaleOptions = [...panel.querySelectorAll('.export-scale-option')];
  const formatOptions = [...panel.querySelectorAll('.export-format-option')];
  const transparentCheckbox = root.querySelector('#export-transparent-background');
  const transparentLabel = root.querySelector('#export-transparent-label');
  const downloadButton = root.querySelector('#export-download');
  const copyButton = root.querySelector('#export-copy');
  const copyLabelText = root.querySelector('#export-copy-label');
  const shareButton = root.querySelector('#export-share');
  const previewImage = root.querySelector('#export-preview-image');
  const previewName = root.querySelector('#export-preview-name');
  const previewDimensions = root.querySelector('#export-preview-dimensions');
  const previewSize = root.querySelector('#export-preview-size');
  const actionButtons = [copyButton, downloadButton, shareButton].filter(Boolean);

  // Hide what this browser can't do. Share is the primary (accent) action
  // where there's a share sheet; elsewhere Download is.
  const { canShare, canCopy } = shareCapabilities();
  copyButton?.classList.toggle('hidden', !canCopy);
  shareButton?.classList.toggle('hidden', !canShare);
  shareButton?.classList.toggle('primary', canShare);
  downloadButton.classList.toggle('primary', !canShare);

  const latest = createLatestOnly();
  // { blob, pngBlob, options } for the current options, or null while
  // rendering / closed.
  let rendered = null;
  let previewUrl = null;

  function currentFormat() {
    const activeFormatButton = formatOptions.find((btn) => btn.classList.contains('active'));
    return FORMATS.includes(activeFormatButton?.dataset.format) ? activeFormatButton.dataset.format : 'png';
  }

  function currentScale() {
    const activeScaleButton = scaleOptions.find((btn) => btn.classList.contains('active'));
    return SCALES.includes(Number(activeScaleButton?.dataset.scale)) ? Number(activeScaleButton.dataset.scale) : 1;
  }

  function currentOptions() {
    return { scale: currentScale(), format: currentFormat(), skipBackground: transparentCheckbox.checked };
  }

  // JPG has no alpha channel (see the export spec's Transparent-background
  // override requirement) - disable and force off the toggle while JPG is
  // selected, rather than let the user pick a combination that can't mean
  // what it says.
  function syncTransparentToggleAvailability() {
    const disabled = currentFormat() === 'jpg';
    transparentCheckbox.disabled = disabled;
    transparentLabel.classList.toggle('disabled', disabled);
    if (disabled) transparentCheckbox.checked = false;
  }

  function resetToDefaults() {
    scaleOptions.forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.scale) === 1));
    formatOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.format === 'png'));
    transparentCheckbox.checked = false;
    syncTransparentToggleAvailability();
  }

  function setBusy(busy) {
    actionButtons.forEach((btn) => { btn.disabled = busy; });
  }

  function showPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = rendered ? URL.createObjectURL(rendered.blob) : null;
    if (previewImage) {
      if (previewUrl) previewImage.src = previewUrl;
      else previewImage.removeAttribute('src');
    }
    if (!rendered) return;
    const { scale, format } = rendered.options;
    const { width, height } = getCanvasSize();
    if (previewName) previewName.textContent = getProjectName() || 'Untitled';
    if (previewDimensions) previewDimensions.textContent = `${width * scale}×${height * scale} · ${format.toUpperCase()}`;
    if (previewSize) previewSize.textContent = formatFileSize(rendered.blob.size);
  }

  async function refresh() {
    const options = currentOptions();
    if (copyLabelText) copyLabelText.textContent = copyLabel(options.format);
    rendered = null;
    setBusy(true);
    let outcome;
    try {
      outcome = await latest.run(async () => {
        const blob = await render(options);
        const pngBlob = options.format === 'png' ? blob : await render({ ...options, format: 'png' });
        if (!blob || !pngBlob) throw new Error('Image encoding returned no data');
        return { blob, pngBlob };
      });
    } catch (err) {
      console.error(err);
      showToast("Couldn't prepare the image.", { type: 'error' });
      return;
    }
    if (!outcome.current) return;
    rendered = { ...outcome.result, options };
    showPreview();
    setBusy(false);
  }

  function filenameFor(options) {
    return exportFilename(getProjectName(), options.scale, options.format);
  }

  function close() {
    panel.classList.add('hidden');
    latest.cancel();
    rendered = null;
    showPreview();
  }

  toggleButton.addEventListener('click', () => {
    const wasHidden = panel.classList.contains('hidden');
    if (wasHidden) resetToDefaults();
    // Unhide before measuring - .hidden is display:none, which has no box
    // to read a size from.
    panel.classList.remove('hidden');
    if (wasHidden) {
      // Floating layout: the toggle is hidden and this opens from the More
      // menu, so anchor to More instead (5b-top-bar-more).
      positionPanel(panel, visibleAnchor(toggleButton, root.querySelector('#more-button')));
      refresh();
    } else {
      close();
    }
  });

  closeButton.addEventListener('click', close);

  // Close on outside click/Escape too, not just the explicit close button
  // or re-clicking the toggle - standard popover behavior, same as
  // Canvas Settings and the color-picker popover.
  if (outsideClickHandler) document.removeEventListener('pointerdown', outsideClickHandler);
  outsideClickHandler = (e) => {
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(e.target)) return;
    if (e.target === toggleButton || toggleButton.contains(e.target)) return;
    close();
  };
  document.addEventListener('pointerdown', outsideClickHandler);

  if (escapeHandler) document.removeEventListener('keydown', escapeHandler);
  escapeHandler = (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) close();
  };
  document.addEventListener('keydown', escapeHandler);

  scaleOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      scaleOptions.forEach((other) => other.classList.toggle('active', other === btn));
      refresh();
    });
  });

  formatOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      formatOptions.forEach((other) => other.classList.toggle('active', other === btn));
      syncTransparentToggleAvailability();
      refresh();
    });
  });

  transparentCheckbox.addEventListener('change', refresh);

  downloadButton.addEventListener('click', () => {
    if (!rendered) return;
    const url = URL.createObjectURL(rendered.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFor(rendered.options);
    a.click();
    URL.revokeObjectURL(url);
    onDownloaded();
    close();
  });

  // Copy and Share call the browser API synchronously in the click, with
  // the pre-rendered Blob - no await before it (see the doc comment).
  copyButton?.addEventListener('click', () => {
    if (!rendered) return;
    navigator.clipboard.write([new ClipboardItem({ 'image/png': rendered.pngBlob })])
      .then(() => showToast('Copied'))
      .catch((err) => {
        console.error(err);
        showToast("Couldn't copy the image.", { type: 'error' });
      });
  });

  shareButton?.addEventListener('click', () => {
    if (!rendered) return;
    const file = new File([rendered.blob], filenameFor(rendered.options), { type: rendered.blob.type });
    navigator.share({ files: [file], title: getProjectName() || 'Untitled' })
      .then(close)
      .catch((err) => {
        // AbortError: the user dismissed the share sheet - not a failure.
        if (err?.name === 'AbortError') return;
        console.error(err);
        showToast("Couldn't share. Try Download instead.", { type: 'error' });
      });
  });

  return {
    /** Called by workspace.js's per-project reset - a freshly opened project starts with the popover closed and defaults reset. */
    close() {
      resetToDefaults();
      close();
    },
  };
}
```

Make sure `.hidden` beats `.export-action-button`'s `display: flex`: `grep -n "^\.hidden" style.css`. If `.hidden` isn't `!important` or isn't more specific, add `.export-action-button.hidden { display: none; }` to the Task 2 CSS block.

- [ ] **Step 2: Update the `initExport` call in `js/workspace.js`**

Replace the `exportControls = initExport({ … });` block (~lines 1907-1918) with:

```js
  exportControls = initExport({
    root,
    getProjectName: () => state.projectName,
    getCanvasSize: () => ({ width: state.layerStack.width, height: state.layerStack.height }),
    render: (options) => state.layerStack.toPNGBlob(options),
    onDownloaded: () => celebrateExport(state.exportButton),
  });
```

- [ ] **Step 3: Run the unit suite**

Run: `npm test 2>&1 | tail -5`
Expected: `# fail 0`

- [ ] **Step 4: Verify in the browser (WebKit and Chromium)**

Serve the repo (`npx http-server -p 8080 -c-1 .` or `python3 -m http.server 8080`). With Playwright, use a **persistent** context, because IndexedDB blobs fail in a non-persistent WebKit context. Then:

1. Create a 32×32 canvas, draw a few pixels, open More ⋯ → "Share / Export".
2. The preview shows the drawing with hard pixel edges; the meta reads `32×32 · PNG` and a size like `~1 KB`.
3. Click 8x: dimensions become `256×256 · PNG` and the size changes.
4. Click JPG: transparency disables, the Copy label reads "Copy PNG", and the dimensions read `256×256 · JPG`.
5. Click Download: a file named `<project>@8x.jpg` downloads (use `page.waitForEvent('download')`) and the popover closes.
6. Visibility in headless Chromium: `navigator.canShare` is usually missing, so Share is hidden and Download carries `.primary`. In WebKit, record whatever `shareCapabilities()` returns and check the buttons match.
7. Console: no errors.

Take screenshots of the popover in light and dark themes for the final review.

- [ ] **Step 5: Commit**

```bash
git add js/export.js js/workspace.js style.css
git commit -m "Share popover: pre-rendered preview and size, Copy, Download, Share

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Specs, UI reference and roadmap

**Files:**
- Modify: `docs/specs/export/spec.md`
- Modify: `docs/ui-reference.md` (~line 143 More menu, ~line 343 top-bar table row, ~lines 476-481 `#export-panel`)
- Modify: `docs/roadmap.md` (Phase 5 list, directly before the `- **5i — Palette merge**` bullet)

- [ ] **Step 1: Update `docs/specs/export/spec.md`**

(a) Replace the Purpose paragraph with:

```markdown
Lets a user get the current project out of Pixi as an image at a chosen
scale and format, optionally with a transparent background, by copying it
to the clipboard, downloading it, or handing it to the operating system's
share sheet - with a preview and file size of exactly what will go out.
```

(b) Rename `### Requirement: Export popover` to `### Requirement: Share popover`, and replace its body and scenarios with:

```markdown
Share SHALL open as a popover anchored to the Share control in the top
bar (icon `ios_share`, label "Share"; in the floating layout, the More
menu's "Share / Export" item), using the same anchored-popover behavior
as Canvas Settings (positioned below the control, flipping above if that
would overflow the viewport, clamped horizontally, closable via an
explicit close button, clicking outside, Escape, or re-clicking the
control) rather than downloading immediately on click.

#### Scenario: Opening the Share popover
- **WHEN** the user clicks the Share control
- **THEN** the popover opens showing the preview, the scale multiplier,
  format selector, transparent-background control, and the action row,
  with no file downloaded, copied, or shared yet

#### Scenario: Closing without exporting
- **WHEN** the Share popover is open and the user presses Escape, clicks
  outside it, or clicks its close button
- **THEN** the popover closes and nothing is downloaded, copied, or shared
```

(c) Append these requirements at the end of the file:

```markdown
### Requirement: Preview and size
The Share popover SHALL show a preview of the exact file the current
options produce, drawn with hard pixel edges over a checkerboard, together
with the project name, the output dimensions and format
(`<width×scale>×<height×scale> · <FORMAT>`), and the encoded file size
(exact bytes under 1 KB, `~N KB` under 1 MB, `N.N MB` above). The preview
and size SHALL update whenever scale, format, or the transparent-background
toggle changes; while the new output is being prepared, the action buttons
SHALL be disabled. If several changes overlap, only the newest one's
output SHALL be shown and used.

#### Scenario: Changing scale updates the preview
- **WHEN** the popover is open on a 32×32 project at 1x PNG and the user
  selects 8x
- **THEN** the dimensions read `256×256 · PNG` and the size reflects the
  8x file

### Requirement: Action row
The Share popover SHALL offer Copy, Download, and Share actions in one row,
in that order. Share SHALL be shown only when the browser can share files
(`navigator.canShare({ files })`), and Copy only when it can write images
to the clipboard (`navigator.clipboard.write` and `ClipboardItem`). The
rightmost visible action SHALL be styled as the primary action: Share
where available, otherwise Download. Each action SHALL use the output
already prepared for the current options, without re-encoding at click
time.

#### Scenario: Browser without a share sheet
- **WHEN** the browser does not support sharing files
- **THEN** the Share action is hidden and Download is the primary action

### Requirement: Download
Download SHALL save the prepared file under the name defined by the
Export filename requirement, run the export celebration, and close the
popover.

#### Scenario: Downloading
- **WHEN** the user selects 4x and WebP on a project named "My Sprite" and
  clicks Download
- **THEN** a file named `My Sprite@4x.webp` is saved and the popover closes

### Requirement: Share
Share SHALL hand the prepared file (named per the Export filename
requirement, titled with the project name) to the operating system's share
sheet. If the user dismisses the sheet, nothing else SHALL happen and the
popover SHALL stay open. If sharing fails for any other reason, an error
toast "Couldn't share. Try Download instead." SHALL be shown. After a
completed share the popover SHALL close.

#### Scenario: Sharing to Photos on iPad
- **WHEN** the user taps Share on iPad Safari and picks Save Image
- **THEN** the image is saved to Photos and the popover closes

#### Scenario: Dismissing the share sheet
- **WHEN** the user opens the share sheet and dismisses it
- **THEN** no error is shown and the popover stays open

### Requirement: Copy
Copy SHALL write a PNG image at the chosen scale and transparency to the
clipboard, whatever format is selected, because the clipboard only
accepts PNG reliably; when WebP or JPG is selected the button SHALL read
"Copy PNG" instead of "Copy". JPG's flatten-to-white does not apply to the
copied PNG. On success, an info toast "Copied" SHALL be shown and the
popover SHALL stay open; on failure, an error toast "Couldn't copy the
image." SHALL be shown.

#### Scenario: Copying with JPG selected
- **WHEN** the user selects JPG and clicks "Copy PNG"
- **THEN** a PNG of the image is on the clipboard and "Copied" is shown
```

(d) In the remaining requirement texts and scenarios, change "Export popover" to "Share popover" (Scale multiplier, Transparent-background override, Format selector). Leave "downloaded PNG" wording where it describes the downloaded file.

- [ ] **Step 2: Update `docs/ui-reference.md`**

- ~Line 143: in the `#more-button` description, change "Export" to "Share / Export".
- ~Line 343: replace the `#export-button` row with
  `| \`#export-button\` | ios_share | Open Share popover | anchored popover, see below |`
- ~Lines 476-481: replace the `#export-panel` bullet with:

```markdown
- `#export-panel` — Share popover anchored to `#export-button`: preview
  row (`#export-preview-image` over a checkerboard, `#export-preview-name`,
  `#export-preview-dimensions`, `#export-preview-size`), scale
  1x/2x/4x/8x (`.export-scale-option[data-scale]`), format PNG/WebP/JPG
  (`.export-format-option[data-format]`), `#export-transparent-background`
  checkbox, and an action row of `.export-action-button`s: `#export-copy`
  ("Copy" / "Copy PNG", label in `#export-copy-label`; hidden without
  clipboard image support), `#export-download` ("Download"),
  `#export-share` ("Share"; hidden without Web Share files support). The
  primary action gets `.primary`. Output is pre-rendered on open and on
  every option change. Transient state, resets to defaults each time it
  opens (not persisted with the project). Spec: `export`.
```

- [ ] **Step 3: Add the roadmap entry**

In `docs/roadmap.md`, directly before the `- **5i — Palette merge**` bullet, add:

```markdown
- **Share and export** — done 2026-10-13 (design in
  `docs/superpowers/specs/2026-10-13-share-export-design.md`). The Export
  popover becomes a Share popover, after Procreate's Share menu and
  Pixelmator Pro's export preview: a live preview with dimensions and file
  size, then Copy (PNG to clipboard), Download, and Share (the system
  share sheet via Web Share, shown only where the browser supports
  sharing files). The output is pre-rendered so Safari's user-activation
  rule doesn't block Share/Copy. Options still reset on open. Not in
  scope: a `.pixi` project file, layers as separate PNGs, sharing the
  timelapse.
```

- [ ] **Step 4: Commit**

```bash
git add docs/specs/export/spec.md docs/ui-reference.md docs/roadmap.md
git commit -m "Docs: Share popover in the export spec, UI reference and roadmap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: UI review and device check

**Files:** whatever the review flags (`index.html`, `style.css`, `js/export.js`, and `lib/pixi.js` for mirrored markup).

- [ ] **Step 1: Run the `web-design-guidelines` skill** on the diff for `index.html`, `style.css` and `js/export.js`. Fix every finding that applies: focus-visible on the action buttons, `aria-live` on the size, the decorative image `alt=""`, contrast of the muted meta text in both themes, and the disabled state. Mirror any markup fix in `lib/pixi.js`. Run `npm test` and confirm `# fail 0`.

- [ ] **Step 2: Commit the fixes**

```bash
git add index.html lib/pixi.js style.css js/export.js
git commit -m "Share popover: web interface guideline fixes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Ask the user to test on iPad.** Headless browsers can't open the real share sheet. Ask the user to open the served app on the iPad (same Wi-Fi, `http://<mac-ip>:8080`; note that Web Share requires a secure context, so use the GitHub Pages preview or an HTTPS tunnel if plain HTTP hides the button), tap Share → Save Image, check Photos, then try Copy and paste into Notes. Record the result in the PR description.
