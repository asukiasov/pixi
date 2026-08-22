// Mount API (embeddable-integration-api, Phase 3). `Pixi.mount(hostElement,
// options)` programmatically does what `js/app.js` does for the standalone
// app's Workspace route (construct a Workspace against a container) except
// the container is host-supplied. See openspec/changes/
// embeddable-integration-api/design.md's "mount API reuses js/'s existing
// rendering/tool/UI code" decision.
//
// This file, not `js/`, owns a *copy* of the Workspace screen's markup
// (WORKSPACE_MARKUP below, sourced from index.html's `#screen-workspace`).
// Duplication was a deliberate choice over fetching a separate .html
// partial (adds a runtime fetch()+relative-path dependency a host would
// have to route around) or rebuilding the same DOM via createElement calls
// (a much larger rewrite of the same markup, no less prone to drifting
// from index.html) - an inline template string keeps `lib/` self-contained
// and copy/vendorable, consistent with `lib/pixel-engine/`'s "no build
// step, no registry" stance. The tradeoff is real: if index.html's
// `#screen-workspace` markup changes (a button/panel added or an id
// renamed), this template must be updated to match by hand, or a mounted
// instance will silently lack that control (its DOM lookup in
// `js/workspace.js`/`js/export.js` just won't find the element). No
// automated drift check exists yet - keep this comment as the reminder
// until one does.
//
// `js/workspace.js`'s `root` module-level variable (see its doc comment)
// only supports one active Workspace instance at a time - standalone app,
// or a single mounted instance, not both/multiple concurrently. `mount()`
// inherits that limitation as-is; calling it while another instance (or
// the standalone app) is active is unsupported. `js/persistence.js`'s
// `activeAdapter` (task 3.9, `options.storage`) is the same shape of
// module-level, single-slot state, so it inherits the identical
// limitation: only one storage adapter is active at a time, shared by
// whichever instance (standalone or mounted) is currently persisting.
// `destroy()` calls `_resetStorageAdapter()` so a torn-down instance's
// custom adapter can't outlive it and leak into whatever mounts or runs
// next on the same page - but two *concurrently* mounted instances with
// different adapters is unsupported, same as two concurrent Workspaces.
//
// A host page must also load Pixi's stylesheet (`style.css`) for this
// markup to render correctly - `mount()` does not inject a `<link>` for
// it, since a host may want to scope/bundle it differently. See the mount
// API docs (task 4.1) for the exact requirement once written.

import { LayerStack } from './pixel-engine/layers.js';
import { CanvasView } from '../js/canvas-view.js';
import { initWorkspace } from '../js/workspace.js';
import { _setStorageAdapter, _resetStorageAdapter, createProjectWithId } from '../js/persistence.js';

const DEFAULT_CANVAS_SIZE = 32; // matches js/new-canvas.js's own default preset

const WORKSPACE_MARKUP = `
<header class="workspace-topbar">
  <button type="button" id="back-to-gallery-button" class="tool-button icon-button magnetic-hover" aria-label="Gallery" data-tooltip="Gallery">
    <span class="material-symbols-outlined">home</span>
  </button>
  <button type="button" id="export-button" class="tool-button icon-button magnetic-hover" aria-label="Export PNG" data-tooltip="Export PNG">
    <span class="material-symbols-outlined">download</span>
  </button>

  <div class="workspace-topbar-spacer"></div>

  <button type="button" id="undo-button" class="tool-button icon-button magnetic-hover" disabled aria-label="Undo" data-tooltip="Undo">
    <span class="material-symbols-outlined">undo</span>
  </button>
  <button type="button" id="redo-button" class="tool-button icon-button magnetic-hover" disabled aria-label="Redo" data-tooltip="Redo">
    <span class="material-symbols-outlined">redo</span>
  </button>
  <button type="button" id="right-sidebar-toggle" class="tool-button icon-button active magnetic-hover" aria-label="Right panel" data-tooltip="Right panel">
    <span class="material-symbols-outlined">dock_to_right</span>
  </button>
  <button type="button" id="theme-toggle" class="tool-button icon-button magnetic-hover" aria-label="Theme: System" data-tooltip="Theme: System">
    <span class="material-symbols-outlined">brightness_auto</span>
  </button>
</header>

<div class="workspace-body">
<aside id="tools-sidebar" class="tools-sidebar">
  <button type="button" class="tool-button magnetic-hover" data-tool="move" aria-label="Move" data-tooltip="Move" data-shortcut="V">
    <span class="material-symbols-outlined">arrow_selector_tool</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="pencil" aria-label="Pencil" data-tooltip="Pencil" data-shortcut="P">
    <span class="material-symbols-outlined">edit</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="eraser" aria-label="Eraser" data-tooltip="Eraser" data-shortcut="E">
    <span class="material-symbols-outlined">ink_eraser</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="bucket" aria-label="Bucket" data-tooltip="Bucket" data-shortcut="G">
    <span class="material-symbols-outlined">format_color_fill</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="brush" aria-label="Brush" data-tooltip="Brush" data-shortcut="B">
    <span class="material-symbols-outlined">brush</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="line" aria-label="Line" data-tooltip="Line" data-shortcut="L">
    <span class="material-symbols-outlined">horizontal_rule</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="rectangle" aria-label="Rectangle" data-tooltip="Rectangle" data-shortcut="R">
    <span class="material-symbols-outlined">rectangle</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="selection" aria-label="Select" data-tooltip="Select (click outside or Esc to deselect)" data-shortcut="M">
    <span class="material-symbols-outlined">crop_free</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="hand" aria-label="Hand (pan)" data-tooltip="Hand" data-shortcut="H">
    <span class="material-symbols-outlined">back_hand</span>
  </button>
  <button type="button" class="tool-button magnetic-hover" data-tool="eyedropper" aria-label="Eyedropper" data-tooltip="Eyedropper" data-shortcut="I">
    <span class="material-symbols-outlined">colorize</span>
  </button>

  <div class="fg-bg-swatches">
    <div class="fg-bg-swatch-stack">
      <button type="button" id="background-swatch" class="fg-bg-swatch bg-swatch" aria-label="Background color" data-tooltip="Background color"></button>
      <button type="button" id="foreground-swatch" class="fg-bg-swatch fg-swatch" aria-label="Foreground color" data-tooltip="Foreground color"></button>
      <button type="button" id="fg-bg-swap" class="fg-bg-corner-button swap-corner" aria-label="Swap colors" data-tooltip="Swap colors">
        <span class="material-symbols-outlined">swap_horiz</span>
      </button>
      <button type="button" id="fg-bg-reset" class="fg-bg-corner-button reset-corner" aria-label="Reset colors" data-tooltip="Reset colors">
        <span class="material-symbols-outlined">restart_alt</span>
      </button>
    </div>
  </div>

  <div id="color-picker-popover" class="color-picker-popover hidden">
    <div class="color-picker-popover-header">
      <span id="color-picker-popover-title">Foreground Color</span>
      <button type="button" id="color-picker-close" class="icon-button" aria-label="Close">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <input type="color" id="color-picker-native" value="#000000" title="Custom color" />
    <div class="color-picker-hex-row">
      <input type="text" id="color-picker-hex" class="color-picker-hex" value="#000000" maxlength="7" placeholder="#000000" aria-label="Hex" title="Double-click to copy" />
      <span id="color-picker-copied" class="color-picker-copied hidden" role="status" aria-live="polite">Copied!</span>
    </div>
    <div class="color-picker-rgb-row">
      <input type="number" id="color-picker-r" class="color-picker-rgb" min="0" max="255" value="0" aria-label="Red" />
      <input type="number" id="color-picker-g" class="color-picker-rgb" min="0" max="255" value="0" aria-label="Green" />
      <input type="number" id="color-picker-b" class="color-picker-rgb" min="0" max="255" value="0" aria-label="Blue" />
    </div>
  </div>

  <div id="square-constraint-options" class="rectangle-options hidden">
    <button type="button" id="square-constraint-toggle" class="tool-button square-constraint-button" aria-label="1:1 proportion" data-tooltip="1:1 proportion (like holding Shift)">1:1</button>
  </div>
</aside>

<div class="workspace-main">
  <div id="workspace-canvas-container" class="canvas-container">
    <canvas id="workspace-canvas"></canvas>

    <div id="pencil-options" class="pencil-options hidden">
      <div class="pencil-options-row">
        <input type="range" id="pencil-size-slider" class="vertical-slider" min="1" max="20" value="1" aria-label="Size" />
        <span id="pencil-size-readout" class="pencil-options-readout">1px</span>
      </div>
    </div>
  </div>

  <div id="export-panel" class="canvas-settings-panel export-panel hidden">
    <div class="canvas-settings-row canvas-settings-header-row">
      <h2>Export</h2>
      <button type="button" id="export-close" class="icon-button" aria-label="Close">
        <span class="material-symbols-outlined">close</span>
      </button>
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
    <div class="canvas-settings-row">
      <button type="button" id="export-download" class="tool-button export-download-button">
        <span class="material-symbols-outlined">download</span> Export
      </button>
    </div>
  </div>

  <div id="palette-row" class="palette-row"></div>

  <div id="selection-controls" class="selection-controls hidden">
    <button type="button" id="selection-clear-button" class="tool-button no-buzz">Clear selection</button>
    <button type="button" id="selection-delete-button" class="tool-button no-buzz">Delete</button>
  </div>

  <nav class="bottom-bar">
    <div class="bottom-bar-group zoom-controls">
      <button type="button" id="zoom-out-button" class="tool-button icon-button no-buzz" title="Zoom out (Ctrl/Cmd -)">
        <span class="material-symbols-outlined">remove</span>
      </button>
      <span id="zoom-readout" class="zoom-readout">100%</span>
      <button type="button" id="zoom-in-button" class="tool-button icon-button no-buzz" title="Zoom in (Ctrl/Cmd +)">
        <span class="material-symbols-outlined">add</span>
      </button>
      <button type="button" id="zoom-preset-100" class="tool-button no-buzz" title="Actual size">100%</button>
      <button type="button" id="zoom-preset-fit" class="tool-button no-buzz" title="Fit the canvas to the screen">Fit</button>
      <button type="button" id="zoom-preset-fill" class="tool-button no-buzz" title="Fill the screen with the canvas">Fill</button>
    </div>
  </nav>
</div>

<aside id="right-sidebar" class="right-sidebar">
  <div id="brushes-panel" class="brushes-panel">
    <div class="brushes-panel-header">
      <h2>Brushes</h2>
    </div>
    <div class="brushes-panel-row">
      <label class="brushes-spacing-label">Spacing
        <input type="number" id="brush-spacing" min="1" max="20" value="1" /> px
      </label>
    </div>
    <div class="brushes-panel-row">
      <label class="brushes-spacing-label">Rotation
        <input type="number" id="brush-rotation" min="0" max="359" value="0" /> °
      </label>
    </div>
    <div id="brushes-panel-grid" class="brushes-panel-grid"></div>
    <div class="brushes-panel-toolbar">
      <button type="button" id="add-brush-button" class="tool-button icon-button" aria-label="Add brush" data-tooltip="Add brush">
        <span class="material-symbols-outlined">add</span>
      </button>
      <button type="button" id="delete-brush-button" class="tool-button icon-button no-buzz" disabled aria-label="Delete selected brush" data-tooltip="Delete selected brush">
        <span class="material-symbols-outlined">delete</span>
      </button>
    </div>

    <div id="brush-editor-panel" class="brush-editor-panel hidden">
      <div class="brush-editor-row brush-editor-header-row">
        <h2>New Brush</h2>
      </div>
      <div class="brush-editor-row">
        <input type="text" id="brush-editor-name" placeholder="Brush name" />
      </div>
      <div class="brush-editor-row">
        <label class="brush-editor-size-label">W
          <input type="number" id="brush-editor-width" min="3" value="9" />
        </label>
        <label class="brush-editor-size-label">H
          <input type="number" id="brush-editor-height" min="3" value="9" />
        </label>
      </div>
      <div id="brush-editor-grid" class="brush-editor-grid"></div>
      <div class="brush-editor-row">
        <button type="button" id="brush-editor-clear" class="tool-button">Clear</button>
        <button type="button" id="brush-editor-cancel" class="tool-button">Cancel</button>
        <button type="button" id="brush-editor-save" class="tool-button">Save</button>
      </div>
    </div>
  </div>
</aside>
</div>
`;

/**
 * Validates the `hostElement` argument shared by `Pixi.mount()`. Pulled out
 * so the check (and its error message) is exercised directly by
 * `lib/pixi.test.js` without needing a real DOM/CanvasView/LayerStack -
 * this repo has no jsdom harness (see `test/theme.test.js`'s doc comment),
 * so anything past this point can only be exercised by a real browser
 * smoke test (task 3.11), not `node --test`.
 */
export function validateHostElement(hostElement) {
  if (
    !hostElement ||
    typeof hostElement !== 'object' ||
    typeof hostElement.appendChild !== 'function' ||
    typeof hostElement.querySelector !== 'function'
  ) {
    throw new TypeError('Pixi.mount(hostElement, options): hostElement must be a DOM element');
  }
}

/**
 * Duck-types whether `value` is already ImageData (or shaped enough like
 * it - `{ data, width, height }` with `data` a Uint8ClampedArray) rather
 * than a PNG Blob needing the createImageBitmap() decode path below. Pulled
 * out for the same reason as validateHostElement: pure enough to unit-test
 * directly in `lib/pixi.test.js` without a real DOM (real `ImageData` is a
 * browser global this repo's `node --test` run has no polyfill for - see
 * that file's doc comment - so this checks shape, not `instanceof
 * ImageData`, matching validateHostElement's own duck-typing over
 * `instanceof HTMLElement`).
 */
export function isImageDataLike(value) {
  return (
    !!value &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    value.data instanceof Uint8ClampedArray
  );
}

const GET_IMAGE_FORMATS = ['png', 'base64', 'imagedata'];

/**
 * Validates `instance.getImage()`'s `format` option (task 3.4). Pulled out
 * for the same reason as `validateHostElement`/`isImageDataLike`: pure
 * enough to unit-test directly in `lib/pixi.test.js` without a real DOM.
 *
 * Three values, not four - the proposal's own phrasing
 * ("`getImage({ format })` returning PNG/Blob/Base64/ImageData") reads as
 * one axis (a Blob is what `'png'` *is*, not a second sibling value next
 * to it), not two independent axes. `getImage()` only ever encodes via
 * `LayerStack.toPNGBlob()` (see `getImage()`'s own doc comment for why
 * that's "one encoding path, not two", per design.md) - `toPNGBlob()`'s
 * own `format` option (`'png'`/`'webp'`/`'jpg'`) is an Export-panel-only
 * concern (multi-format downloads), not something `getImage()` re-exposes;
 * a host that wants WebP/JPG bytes has no route to them through this
 * method, only through the Export panel.
 */
export function validateGetImageFormat(format) {
  if (!GET_IMAGE_FORMATS.includes(format)) {
    throw new TypeError(
      `instance.getImage({ format }): format must be one of ${GET_IMAGE_FORMATS.join(', ')} (got ${JSON.stringify(format)})`
    );
  }
}

/**
 * Converts a Blob to a base64 data URL (`instance.getImage({ format:
 * 'base64' })`, task 3.4) via `FileReader.readAsDataURL` - the standard
 * DOM API for this, no manual byte-to-base64 encoding needed. Requires a
 * real DOM (`FileReader`); like `decodeToImageData` below, this has no
 * `node --test` coverage and is verified by the Playwright smoke test
 * (task 3.11) instead.
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Decodes `instance.loadImage()`'s argument (task 3.3) into a plain
 * `{ data, width, height }` ImageData-shaped object that
 * `LayerStack.loadImage()` accepts directly. ImageData input passes
 * through unchanged; a PNG Blob is decoded via `createImageBitmap()` (no
 * FileReader/base64 round trip needed) and drawn onto a same-size
 * offscreen canvas to read its pixels back out - the same
 * decode-via-canvas approach `LayerStack`'s own compositing already uses
 * elsewhere in this file's dependency, not a new technique. Requires a
 * real DOM (canvas 2d context, createImageBitmap) - untestable under
 * `node --test` (see this file's `isImageDataLike`/`validateHostElement`
 * doc comments), verified instead by the Playwright smoke test (task
 * 3.11).
 */
async function decodeToImageData(pngBlobOrImageData) {
  if (isImageDataLike(pngBlobOrImageData)) return pngBlobOrImageData;

  if (!pngBlobOrImageData || typeof pngBlobOrImageData.arrayBuffer !== 'function') {
    throw new TypeError('instance.loadImage(pngBlobOrImageData): expected a PNG Blob or ImageData');
  }

  const bitmap = await createImageBitmap(pngBlobOrImageData);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * Resolves whether mount()'s Gallery/navigation chrome (the topbar's
 * `#back-to-gallery-button`, task 3.6) should be shown. Defaults to shown
 * (`true`) so every existing `mount()` caller keeps today's rendered markup
 * unchanged - only a literal `options.ui.gallery === false` opts out; any
 * other value (no `options`, no `options.ui`, no `options.ui.gallery`,
 * `undefined`, or a falsy-but-not-`false` value like `0`) also resolves to
 * shown, so a typo can't silently hide the button the way a bare falsy
 * check (`!options?.ui?.gallery`) would.
 */
export function shouldShowGalleryChrome(options) {
  return options?.ui?.gallery !== false;
}

// The full set of tool names WORKSPACE_MARKUP's #tools-sidebar renders
// (each button's data-tool value, in sidebar order) - the universe
// resolveEnabledTools() restricts against and falls back to.
export const ALL_TOOL_NAMES = [
  'move',
  'pencil',
  'eraser',
  'bucket',
  'brush',
  'line',
  'rectangle',
  'selection',
  'hand',
  'eyedropper',
];

/**
 * Resolves which tool names mount()'s instance offers (task 3.7). Defaults
 * to every known tool (`ALL_TOOL_NAMES`) so every existing `mount()` caller
 * keeps today's full tool sidebar unchanged - only a real
 * `options.ui.tools` array opts into a restricted set, and the host's own
 * ordering is preserved (it may want its own preferred tool-button order,
 * not necessarily ALL_TOOL_NAMES's).
 *
 * Anything that isn't a genuinely restrictive array - not an array at all,
 * an empty array, or an array containing only names that don't match a
 * real tool - resolves back to every known tool instead of leaving the
 * editor with an unusable, empty (or accidentally-empty-after-filtering)
 * toolset. This mirrors `shouldShowGalleryChrome`'s typo-safety precedent:
 * a misconfigured option should degrade to today's default behavior, not
 * to a broken one.
 */
export function resolveEnabledTools(options) {
  const tools = options?.ui?.tools;
  if (!Array.isArray(tools)) return ALL_TOOL_NAMES;
  const known = tools.filter((name) => ALL_TOOL_NAMES.includes(name));
  return known.length > 0 ? known : ALL_TOOL_NAMES;
}

/**
 * Resolves which tool should be active when a mounted instance starts
 * (task 3.7). `js/workspace.js`'s own default is always Pencil - when
 * `options.ui.tools` restricts Pencil out, initWorkspace() needs a
 * different starting tool instead of highlighting/activating one that
 * isn't actually selectable. Falls back to the first tool in
 * `enabledTools`'s own order (not ALL_TOOL_NAMES's) - the host's ordering
 * is treated as its preference for which restricted tool is "primary".
 */
export function resolveInitialTool(enabledTools, preferredTool = 'pencil') {
  return enabledTools.includes(preferredTool) ? preferredTool : enabledTools[0];
}

/**
 * Resolves `options.ui.onSave`/`options.ui.onCancel` (task 3.8) to either the
 * host-supplied function or `null`. Pulled out for the same reason as
 * `shouldShowGalleryChrome`/`resolveEnabledTools`: a pure, options-only
 * check, unit-testable without a DOM. Duck-typed (`typeof fn === 'function'`)
 * rather than throwing on a misconfigured value - same typo-safety
 * precedent as those two: a non-function `options.ui.onSave` degrades to
 * "no host hook" (instance.save() still computes and returns the image, it
 * just skips notifying), not a thrown error out of mount().
 */
export function resolveUiCallback(options, name) {
  const fn = options?.ui?.[name];
  return typeof fn === 'function' ? fn : null;
}

/**
 * Validates `options.storage` (task 3.9) - a storage adapter per
 * `lib/storage-adapter.js`'s `{ load(id), save(record), list(), delete(id) }`
 * shape. Called only when `options.storage` is actually supplied (see
 * `mount()`); throws rather than degrading to a default the way
 * `shouldShowGalleryChrome`/`resolveEnabledTools`/`resolveUiCallback` do
 * for `options.ui.*` - those are cosmetic (a typo just leaves today's
 * default chrome/behavior in place), but a malformed storage adapter would
 * silently fail every persistence call downstream (`_setStorageAdapter`
 * has no way to know it's wrong) and could go unnoticed until a host
 * discovers its users' work was never actually saved. Same reasoning as
 * `validateHostElement`: a structurally critical argument fails loudly and
 * immediately, not silently.
 */
export function validateStorageAdapter(storage) {
  if (
    !storage ||
    typeof storage.load !== 'function' ||
    typeof storage.save !== 'function' ||
    typeof storage.list !== 'function' ||
    typeof storage.delete !== 'function'
  ) {
    throw new TypeError(
      'Pixi.mount(hostElement, options): options.storage must implement { load(id), save(record), list(), delete(id) }'
    );
  }
}

/**
 * Minimal per-instance event emitter backing `instance.on(event, handler)`
 * (task 3.5, "Change notifications" in
 * openspec/changes/embeddable-integration-api/specs/embeddable-editor-api/
 * spec.md). Pulled out as its own pure function for the same reason as
 * `validateHostElement`/`isImageDataLike`/`validateGetImageFormat`: no DOM
 * dependency, so `on()`/`emit()` dispatch is exercised directly by
 * `node --test` (`lib/pixi.test.js`) rather than only via the Playwright
 * smoke test that has to cover what actually triggers a `'change'` emit
 * (`js/workspace.js`'s `autoSave()`, which does need a real DOM).
 *
 * Supports multiple handlers per event (a `Set`, not a single slot) since
 * arbitrary host code registering independently may want more than one
 * listener on the same event. No `off()`/unsubscribe: the spec's scenario
 * only requires that "the host-registered change handler is invoked" when
 * a stroke commits - it doesn't ask for removal, and `destroy()` already
 * tears down the whole instance (a host that wants to stop listening can
 * simply stop calling into a destroyed instance). Adding unsubscribe here
 * ahead of an actual host need would be the same kind of scope creep
 * design.md's Risks section already warns against for the UI-options
 * surface, applied to events instead. A handler that throws is caught and
 * re-emitted through this same emitter's own `'error'` event (not logged),
 * so one bad listener can't break another handler on the same event, or
 * the commit/autosave it was invoked from - see `emit()`'s own comment for
 * why `'error'` itself is a narrow, guarded exception to that re-emit.
 */
export function createEventEmitter() {
  const listeners = new Map();
  const emitter = {
    on(event, handler) {
      if (typeof handler !== 'function') {
        throw new TypeError('instance.on(event, handler): handler must be a function');
      }
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    emit(event, ...args) {
      const handlers = listeners.get(event);
      if (!handlers) return;
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (err) {
          // Re-emit through this same emitter's own 'error' event (the
          // mechanism mount()'s createProjectWithId().catch() already uses)
          // instead of console.error - keeps a throwing handler isolated
          // without ever logging, matching the rest of this file/repo's
          // zero-console.* convention. Guarded against 'error' itself so a
          // broken 'error' handler can't recurse forever; that narrower
          // case is dropped silently rather than looping, the same
          // "isolate, don't propagate" trade-off this whole catch exists
          // for in the first place.
          if (event !== 'error') emitter.emit('error', err);
        }
      }
    },
  };
  return emitter;
}

export const Pixi = {
  /**
   * Mounts a Workspace editor into `hostElement`, replacing its contents.
   * Returns `{ loadImage(), getImage(), on(), destroy() }`; `destroy()` unmounts the editor
   * and leaves `hostElement` empty again. See this module's doc comment
   * for the single-active-instance limitation inherited from
   * `js/workspace.js`.
   *
   * `options.width`/`options.height` (default 32) size the blank canvas
   * the instance starts with - `loadImage()` (see the returned instance)
   * is the normal way to open real content on top of that blank start.
   *
   * `options.ui.gallery` (default `true`, task 3.6) shows or hides the
   * topbar's Gallery/navigation button (`#back-to-gallery-button`) - the
   * only piece of Gallery/navigation chrome this markup renders when
   * mounted. It's already wired to a no-op (`onRequestGallery: () => {}`,
   * there being no standalone Gallery to navigate to from a host page), so
   * showing it by default is dead-but-harmless, same as before this
   * option existed; `options.ui.gallery: false` is how a host opts into
   * removing it from a focused, single-canvas embed. See
   * `shouldShowGalleryChrome`'s doc comment for the exact default/opt-out
   * semantics.
   *
   * `options.ui.tools` (default: every tool, task 3.7) restricts
   * `#tools-sidebar` to only the named `data-tool` values (e.g.
   * `['pencil', 'eraser']`) - every other tool button is hidden and
   * disabled, unreachable by click or its keyboard shortcut. Omitting
   * `options.ui.tools` (or passing something that isn't a genuinely
   * restrictive array) leaves every tool available, matching every
   * pre-3.7 `mount()` caller's behavior unchanged - see
   * `resolveEnabledTools`'s doc comment for the exact fallback rules. If
   * the restricted set excludes Pencil (the editor's own hardcoded
   * default), the instance starts on the first tool named in
   * `options.ui.tools` instead - see `resolveInitialTool`'s doc comment.
   *
   * `options.ui.onSave`/`options.ui.onCancel` (both optional, task 3.8):
   * host-supplied notification hooks for the returned instance's
   * `save()`/`cancel()` methods (see those methods' own doc comments for
   * exactly what each does and why they're pure instance methods rather
   * than new in-canvas buttons - `WORKSPACE_MARKUP`'s own topbar/chrome is
   * unchanged by this option, unlike `options.ui.gallery`/`options.ui.tools`
   * above). Omitting either leaves `save()`/`cancel()` fully usable, just
   * silent - no behavior change from before this task for any caller that
   * doesn't supply them.
   *
   * `options.storage` (optional, task 3.9): a storage adapter (`{
   * load(id), save(record), list(), delete(id) }`, see
   * `lib/storage-adapter.js`) that every project-persistence call this
   * instance makes goes through instead of the default IndexedDB/Dexie
   * adapter - `createInMemoryAdapter()`/`createDexieProjectAdapter(db)`
   * are the two implementations that module ships; a host supplies its own
   * object shaped the same way to route persistence at its own backend.
   * Validated eagerly (`validateStorageAdapter`) and throws if malformed,
   * unlike `options.ui.*`'s soft-degrade-on-typo behavior - see that
   * function's doc comment for why. Omitting `options.storage` leaves the
   * existing default (Dexie-backed) adapter active, unchanged.
   *
   * Independent of `options.width`/`options.height`/`loadImage()`: this
   * instance is assigned one real project id at `mount()` time (not tied
   * to any adapter-stored record a host might already have - there is no
   * `options.projectId` to open an existing one) and autosaves against
   * that same id for its whole lifetime, including across `loadImage()`
   * calls, which only replace the canvas's *content*, not which project
   * record it's persisted as. See the `projectId`/`createProjectWithId`
   * comments inside this method for why a real id has to be generated
   * here at all - without one, every autosave silently no-ops regardless
   * of which adapter is active. `destroy()` restores the default adapter
   * (`_resetStorageAdapter()`) so this instance's `options.storage` can't
   * outlive it - see this module's doc comment on the single-active-
   * adapter limitation that inherits from `js/workspace.js`'s own `root`.
   *
   * Requires a real DOM: `hostElement.innerHTML`/
   * `hostElement.ownerDocument.createElement`, `requestAnimationFrame`, and
   * `CanvasView` (canvas 2d context) are all used directly inside this
   * method - untestable under `node --test` (see `validateHostElement`'s
   * doc comment above), verified instead by the Playwright smoke test
   * (task 3.11), same as this file's other DOM-touching helpers
   * (`blobToBase64`, `decodeToImageData`).
   */
  mount(hostElement, options = {}) {
    validateHostElement(hostElement);

    // options.storage (task 3.9): substitutes the adapter every project
    // persistence call in js/persistence.js goes through, for as long as
    // this instance is active. Validated before switching - see
    // validateStorageAdapter's doc comment for why a malformed adapter
    // throws here rather than degrading like options.ui.* does. Omitted
    // options.storage leaves the existing (default Dexie-backed) adapter
    // active, unchanged - a mounted instance with no custom adapter still
    // persists to IndexedDB, same as the standalone app.
    //
    // js/persistence.js's activeAdapter is module-level, single-slot state
    // (like js/workspace.js's own `root`, see this module's doc comment) -
    // this inherits the same "one active instance at a time" limitation
    // rather than trying to scope storage per-instance, per design.md's
    // Decisions (the mount API reuses js/'s existing module-level-state
    // architecture as-is). destroy() below calls _resetStorageAdapter() so
    // a torn-down instance's custom adapter can't leak into a later
    // mount() call or the standalone app sharing the same page - the same
    // kind of cross-instance leak already fixed for bindDomOnce()'s
    // listeners (task 3.2) and js/workspace.js's root (task 3.5).
    if (options.storage) {
      validateStorageAdapter(options.storage);
      _setStorageAdapter(options.storage);
    }

    const width = options.width ?? DEFAULT_CANVAS_SIZE;
    const height = options.height ?? DEFAULT_CANVAS_SIZE;

    // Two structural requirements on what gets passed as `root`, both
    // found via a Playwright repeated-mount/destroy regression test:
    //
    // 1. `#screen-workspace` must be a *descendant* of `root`, not `root`
    //    itself - js/workspace.js has two `document`-level keydown guards
    //    (`bindKonamiCode`, the Ctrl/Cmd+Z-or-Y shortcut handler) that do
    //    `root.querySelector('#screen-workspace')`, and `querySelector`
    //    never matches the element it's called on, only its descendants
    //    (mirrors how `document.querySelector('#screen-workspace')` finds
    //    index.html's `<main id="screen-workspace">` as a *child* of
    //    `document`, not `document` itself). An earlier version of this
    //    file put the id directly on the per-mount container - those two
    //    guards threw `Cannot read properties of null` on every keydown.
    //
    // 2. `root` must be a fresh object on every mount() call, never
    //    `hostElement` itself. js/workspace.js's bindDomOnce() (which
    //    wires the Undo/Redo buttons' click listeners, tool shortcuts,
    //    etc.) only re-runs when `domBoundRoot !== root` - it's meant to
    //    detect "a new instance is opening" without needlessly re-binding
    //    on every same-instance initWorkspace() call. But a host
    //    re-mounting into the *same* div after destroy() (an entirely
    //    reasonable, expected pattern - see design.md's single-active-
    //    instance note) passes that same div as `hostElement` both times;
    //    an earlier version of this file passed `hostElement` straight
    //    through as `root`, so the second mount's `root` was `===` the
    //    first's, bindDomOnce() silently skipped, and the freshly
    //    mounted instance's Undo/Redo buttons (among everything else
    //    bindDomOnce wires) had no listeners at all - inert, not broken
    //    with an error. A container element created fresh here, appended
    //    under `hostElement`, is never `===` across calls even when
    //    `hostElement` is.
    hostElement.innerHTML = '';
    const container = hostElement.ownerDocument.createElement('div');
    // `display: contents` so `container` generates no box of its own -
    // `#screen-workspace`'s `.workspace-screen { height: 100% }` (and
    // everything under it: `.workspace-body`'s flex row, the canvas
    // container's fit/zoom math) needs an unbroken chain of *definite*
    // heights up to `hostElement`; a `container` with default `display:
    // block` and auto height breaks that chain regardless of what height
    // `hostElement` itself has, collapsing the whole screen to zero
    // height (found via this Playwright smoke test's real pointer-draw
    // step, task 3.4/3.11 - clicks on the canvas hit the topbar/palette-
    // row instead, all collapsed to the same point). `display: contents`
    // keeps `container` as a real, distinct DOM node (still satisfies the
    // "fresh object every mount()" requirement above) while making
    // `screenEl` behave as hostElement's direct child for layout
    // purposes, exactly like the standalone app's `#screen-workspace`
    // being a direct child of `<body>`.
    container.style.display = 'contents';
    const screenEl = hostElement.ownerDocument.createElement('main');
    screenEl.id = 'screen-workspace';
    screenEl.className = 'screen workspace-screen';
    screenEl.innerHTML = WORKSPACE_MARKUP;
    container.appendChild(screenEl);
    hostElement.appendChild(container);

    const layerStack = new LayerStack(width, height);

    // Real project id (task 3.9), generated the same way
    // lib/pixel-engine/layers.js's Layer generates its own id
    // (crypto.randomUUID()) - not passed to js/workspace.js as `null` the
    // way every pre-3.9 mount() call did. Without a real id, saveProject()
    // (called from js/workspace.js's autoSave() on every commit) no-ops
    // forever (its documented "no-op if id doesn't exist" guard,
    // js/persistence.js), so a mounted instance never actually persisted
    // anything before this task - regardless of which adapter was active,
    // since the adapter was never even reached. Generated synchronously so
    // it can be handed to initWorkspace() below in the same synchronous
    // mount() call; the record itself is created in the background (see
    // createProjectWithId's own doc comment for why that's safe against
    // the first autoSave() racing it) rather than making mount() async,
    // which would change every existing caller's usage.
    const projectId = crypto.randomUUID();

    // Backs instance.on() (task 3.5) - one emitter per mounted instance,
    // not module-level state in js/workspace.js, so listeners registered
    // on one instance can never leak into a later mount()/destroy() cycle
    // reusing the same host element (see the "fresh object every
    // mount() call" reasoning above for why that kind of cross-instance
    // leak is a real, previously-hit failure mode in this file). Created
    // here, ahead of canvasView/startWorkspace below, so the
    // createProjectWithId() call right after it can emit 'error' through
    // the same emitter a host already listens on for 'change'.
    const events = createEventEmitter();

    // Fire-and-forget (not awaited, no mount()-level try/catch), matching
    // autoSave()'s own fire-and-forget calling convention (js/workspace.js)
    // - but unlike a single dropped autoSave() commit, a rejection here
    // (e.g. a broken host-supplied adapter) means this instance's
    // projectId never gets an initial record, so *every* subsequent
    // autoSave()'s saveProject() call for it silently no-ops for the rest
    // of the instance's lifetime (saveProject's documented "no-op if id
    // doesn't exist" guard). That compounding failure mode is worse than
    // an ordinary autoSave() rejection, so - unlike autoSave() - this one
    // is caught and re-surfaced as an 'error' event (see instance.on()'s
    // doc comment below) rather than left as a bare unhandled rejection a
    // host has no first-class way to detect.
    createProjectWithId(projectId, layerStack, options.name ?? 'Untitled').catch((err) => {
      // Guarded on `destroyed`, same as onChange below and for the same
      // reason: a host that calls destroy() immediately after mount() and
      // then sees this rejection land later still shouldn't get an 'error'
      // event fired against an instance it believes is fully torn down.
      if (!destroyed) events.emit('error', err);
    });

    // Baseline snapshot backing instance.cancel() (task 3.8) - "the state
    // at mount/last loadImage()", per that method's own doc comment.
    // Captured synchronously via layerStack.composite() (no DOM/canvas
    // dependency beyond what layerStack already owns internally) rather
    // than the toPNGBlob() round trip loadImage()/getImage() use elsewhere
    // in this file - a plain ImageData snapshot is all cancel() needs to
    // hand back to layerStack.loadImage(), and composite() is synchronous,
    // so no `destroyed`-after-await guard is needed around this capture the
    // way there is around every toPNGBlob()-based path below. Re-captured
    // after every successful loadImage() call (see that method) so
    // cancel() always reverts to the most recent deliberate host action,
    // not just the original mount().
    let baselineImageData = layerStack.composite();

    const canvasEl = screenEl.querySelector('#workspace-canvas');
    const canvasContainerEl = screenEl.querySelector('#workspace-canvas-container');
    const canvasView = new CanvasView(canvasEl, canvasContainerEl, layerStack);
    canvasView.resetView();
    canvasView.render();
    // Re-fit after the browser's first real paint: see js/app.js's
    // openWorkspace() for the same call and its doc comment (web font
    // loading can still be settling final layout when the first
    // resetView() above measures the container).
    requestAnimationFrame(() => {
      canvasView.resetView();
      canvasView.render();
    });

    let destroyed = false;

    const startWorkspace = () => {
      // Applied inside startWorkspace(), not just once after WORKSPACE_MARKUP
      // is inserted, so loadImage()'s re-init (which calls startWorkspace()
      // again against the same, already-hidden button) can't accidentally
      // regress this if a future change makes that re-init touch the
      // topbar's markup - classList.toggle() with an explicit second
      // argument is idempotent either way (task 3.6).
      screenEl.querySelector('#back-to-gallery-button')?.classList.toggle('hidden', !shouldShowGalleryChrome(options));
      // options.ui.tools (task 3.7): resolved once per startWorkspace() call
      // (not just once at mount()) for the same reason options.ui.gallery
      // is above - loadImage()'s re-init calls startWorkspace() again, and
      // both resolutions are pure/cheap, so recomputing costs nothing and
      // stays correct if `options` were ever mutated between calls.
      const enabledTools = resolveEnabledTools(options);
      return initWorkspace({
        // The same id for every startWorkspace() call across this
        // instance's lifetime (task 3.9) - including loadImage()'s re-init
        // below, which starts fresh *content* under the same mounted
        // instance, not a different project. autoSave() (js/workspace.js)
        // persists every commit against this one id via saveProject(),
        // which merges the new dimensions/layers into the existing record
        // rather than needing a fresh createProjectWithId() call per
        // loadImage() - see this file's mount()-level projectId comment.
        projectId,
        projectName: options.name ?? 'Untitled',
        layerStack,
        canvasView,
        onRequestGallery: () => {}, // no standalone Gallery to navigate to when mounted; dead even when the button is shown (options.ui.gallery, task 3.6)
        enabledTools,
        initialTool: resolveInitialTool(enabledTools),
        // Guarded on `destroyed`, not just `events.emit('change')` - see
        // this option's own reasoning below (`destroy()` doesn't stop
        // js/workspace.js's document-level Undo/Redo shortcuts from still
        // running against this instance's now-detached state, since it
        // only removes `container` from the DOM). Without this guard, a
        // host that calls destroy() and then triggers Ctrl+Z anywhere on
        // the page (unrelated host UI, stray keypress) would still get its
        // registered 'change' handler invoked - found by code review,
        // confirmed by tracing performUndo()/performRedo() -> autoSave()
        // -> this callback with no destroyed check.
        onChange: () => {
          if (!destroyed) events.emit('change');
        },
        root: container,
      });
    };

    startWorkspace();

    return {
      /**
       * Registers `handler` to be called on `event` (task 3.5). `'change'`
       * is fired from js/workspace.js's autoSave() choke point on every
       * committed drawing action (a completed stroke, a fill, an undo/redo
       * - anything that already triggers auto-save), matching the "Change
       * notifications" spec scenario ("the host-registered change handler
       * is invoked" when a stroke commits). `'error'` (task 3.9) fires if
       * `mount()`'s own initial `createProjectWithId()` call rejects (e.g.
       * `options.storage`'s `save()` throws) - unlike an ordinary
       * `autoSave()` rejection later on, that specific failure means this
       * instance's `projectId` never got an initial record, so every
       * subsequent autoSave() silently no-ops for the rest of the
       * instance's lifetime; `'error'` is this instance's only signal a
       * host has for that otherwise-invisible failure mode (see
       * `mount()`'s own comment at the `createProjectWithId()` call site).
       * Multiple handlers on the same event are all called, in
       * registration order; see createEventEmitter's doc comment for why
       * there's no off()/unsubscribe. Registering after
       * destroy() is harmless, not an error like loadImage()/getImage()
       * calling into a torn-down instance would be - the handler is just
       * never invoked, since `onChange` above is itself guarded on
       * `destroyed`: even though js/workspace.js's document-level
       * Undo/Redo shortcuts keep running against this instance's state
       * after destroy() (destroy() only removes `container` from the DOM,
       * it doesn't reset js/workspace.js's module-level state - a known,
       * pre-existing limitation of the "single active instance" design,
       * see mount()'s module doc comment), the resulting autoSave() calls
       * can no longer reach a registered handler.
       */
      on(event, handler) {
        events.on(event, handler);
      },
      /**
       * Replaces the mounted canvas's content with `pngBlobOrImageData` (a
       * PNG Blob or ImageData), resizing the canvas to match the image's
       * own dimensions - the mounted equivalent of `js/new-canvas.js`'s
       * flow, not an in-place edit of whatever was there before (see
       * `LayerStack.loadImage()`'s doc comment). Re-runs `initWorkspace()`
       * (same as `js/app.js`'s `openWorkspace()` opening a different
       * project) so the undo stack, tool/color selections, and Export
       * popover all reset to a fresh baseline rather than carrying over
       * state from whatever was on the canvas before this call - matches
       * loading a project into the standalone app, not resuming a stroke
       * mid-edit.
       *
       * Throws if called after `destroy()` - mirrors `destroy()`'s own
       * `destroyed` guard, but as a hard error rather than a silent no-op,
       * since (unlike a second `destroy()`) there's no reasonable "already
       * did what you asked" reading of calling `loadImage()` on a torn-down
       * instance; a host doing so almost certainly has a lifecycle bug
       * worth surfacing. Checked again after the (async) decode below, not
       * just on entry - `destroy()` can run while a Blob decode is still
       * in flight, and proceeding at that point would call
       * `canvasView.setLayerStack()`/`initWorkspace()` against a container
       * already removed from the host's DOM.
       *
       * Two overlapping `loadImage()` calls (e.g. a host firing a second
       * one before the first's Blob decode resolves) are not
       * synchronized - whichever call's `await` resolves last wins,
       * regardless of call order. Not addressed here; a host driving
       * `loadImage()` from user input (e.g. a file picker) is expected to
       * await one call before starting the next, the same assumption
       * `js/new-canvas.js`'s own image-import flow already makes.
       */
      async loadImage(pngBlobOrImageData) {
        if (destroyed) throw new Error('instance.loadImage(): called after destroy()');
        const imageData = await decodeToImageData(pngBlobOrImageData);
        if (destroyed) throw new Error('instance.loadImage(): called after destroy()');
        layerStack.loadImage(imageData);
        // Same instance, mutated in place above - canvasView.setLayerStack()
        // still needs calling because it's what resizes the <canvas>
        // element and repaints (resetView() + render()); a plain
        // canvasView.render() alone would draw the new content into a
        // canvas still sized for the old dimensions.
        canvasView.setLayerStack(layerStack);
        // Refresh cancel()'s baseline (task 3.8) - this loadImage() call is
        // itself a new "deliberate host action" checkpoint, same as mount().
        baselineImageData = layerStack.composite();
        startWorkspace();
      },

      /**
       * Reads the mounted canvas's current composited content back out,
       * independent of the UI's Export panel/button (task 3.4). Always
       * encodes via `layerStack.toPNGBlob()` with no arguments - the same
       * native-resolution, Background-included, reference-layer-excluded
       * PNG bytes `toPNGBlob()`'s own doc comment describes, and the same
       * method `js/workspace.js`'s `onExport` callback (the Export panel's
       * download path) already calls directly. That's "one encoding path,
       * not two" (design.md) without needing a shared helper alongside it:
       * `js/export.js` itself has no encoding logic of its own to
       * de-duplicate - it only builds the popover's scale/format/
       * transparent-background UI and hands the user's choice to
       * `onExport()`, which is workspace.js's call, not export.js's. This
       * method is a second, independent call site of the same
       * `toPNGBlob()` LayerStack method, not a rewritten copy of it.
       *
       * `options.format` (default `'png'`, one of `GET_IMAGE_FORMATS`)
       * selects the return shape, not a different encoding - see
       * `validateGetImageFormat`'s doc comment for why this is one axis,
       * not two. The first format returns the Blob as-is; the second
       * converts it to a base64 data URL via `FileReader`; the third
       * decodes it back to pixels via `decodeToImageData` (the same
       * Blob-decode helper `loadImage()` uses, reused rather than
       * duplicated) - a round trip through the encoder rather than reading
       * `layerStack.composite()` directly, so all three formats are
       * guaranteed to reflect identical pixels (background/reference-layer
       * handling included) rather than two independently-behaving paths
       * that could drift apart.
       *
       * Same `destroyed` guard and re-check-after-await pattern as
       * `loadImage()`, for the same reason: `destroy()` can run while the
       * PNG encode, or the second conversion step (the `FileReader` read
       * for `'base64'`, the re-decode for `'imagedata'`), is still in
       * flight - checked after *both* awaits, not just the first, since
       * either one alone leaves a window where `destroy()` could complete
       * while this call is still resolving.
       */
      async getImage(options = {}) {
        if (destroyed) throw new Error('instance.getImage(): called after destroy()');
        const format = options.format ?? 'png';
        validateGetImageFormat(format);
        const blob = await layerStack.toPNGBlob();
        if (destroyed) throw new Error('instance.getImage(): called after destroy()');
        if (format === 'png') return blob;
        const result = format === 'base64' ? await blobToBase64(blob) : await decodeToImageData(blob);
        if (destroyed) throw new Error('instance.getImage(): called after destroy()');
        return result;
      },

      /**
       * Computes the mounted canvas's current PNG (the same `toPNGBlob()`
       * path `getImage()` uses) and, if the host supplied
       * `options.ui.onSave`, invokes it with that Blob (task 3.8) - then
       * returns the Blob either way, so `save()` is a superset of
       * `getImage()`, not a separate encode path.
       *
       * A pure instance method with no in-canvas trigger of its own -
       * unlike `options.ui.gallery`/`options.ui.tools` (tasks 3.6/3.7),
       * this doesn't touch `WORKSPACE_MARKUP` or the topbar's
       * `#back-to-gallery-button`. See this module's `mount()` doc comment
       * for why: that button stays wired to `onRequestGallery`'s no-op
       * regardless of `options.ui.onSave`, so `save()`/`cancel()` work
       * identically whether or not `options.ui.gallery` hid the button -
       * a host that mounts with `gallery: false` (a fully custom embed,
       * exactly `options.ui`'s stated goal) still gets a working Save/
       * Cancel hook by building its own buttons outside the mounted
       * canvas and calling `instance.save()`/`instance.cancel()`, the same
       * way it already calls `loadImage()`/`getImage()`.
       *
       * Always callable, even when `options.ui.onSave` was never supplied
       * - it then behaves exactly like `getImage()` (compute and return
       * the PNG, notify nobody). This keeps the instance's method surface
       * uniform (`loadImage`/`getImage`/`on`/`save`/`cancel`/`destroy` all
       * always present) instead of conditionally existing based on what
       * `options.ui` happened to configure, and gives a host a cheap way
       * to opt into the notification later (`options.ui.onSave` can be
       * added on a later `mount()` call) without a different method shape.
       *
       * Same `destroyed` guard and re-check-after-await pattern as
       * `getImage()`, for the same reason (the encode is async;
       * `destroy()` can complete while it's in flight).
       */
      async save() {
        if (destroyed) throw new Error('instance.save(): called after destroy()');
        const blob = await layerStack.toPNGBlob();
        if (destroyed) throw new Error('instance.save(): called after destroy()');
        resolveUiCallback(options, 'onSave')?.(blob);
        return blob;
      },

      /**
       * Reverts the mounted canvas to `baselineImageData` - the state
       * captured at `mount()` or the most recent `loadImage()`, whichever
       * is later (see that variable's doc comment) - and, if the host
       * supplied `options.ui.onCancel`, invokes it afterward (task 3.8).
       *
       * What "cancel" means here, given `js/workspace.js`'s own
       * `backToGalleryButton` comment ("Every action auto-saves, so
       * there's nothing to lose by leaving"): nothing in IndexedDB is
       * ever at risk, since autosave already persisted every edit before
       * this call - there is no un-autosaving a stroke. What *is* real is
       * the in-memory canvas state a user has been drawing into since the
       * last checkpoint the host cares about (mount, or its last
       * `loadImage()`); `cancel()` discards that back to the checkpoint,
       * the same "start over from what I last deliberately loaded"
       * meaning `js/new-canvas.js`'s own New-canvas flow already has for
       * the standalone app, just host-triggered instead of menu-triggered.
       * A host's own storage layer (`options.storage`, task 3.9) committing
       * something durable beyond this instance's in-memory/adapter-backed
       * state is a separate concern `cancel()` doesn't need to know about -
       * it only ever touches the mounted canvas's own in-memory/adapter
       * state, the same surface every other instance method here already
       * touches; whatever was already autosaved under `projectId` before
       * this call stays exactly as autosaved.
       *
       * Same no-in-canvas-trigger reasoning as `save()` above applies
       * here too - see that method's doc comment.
       *
       * Reuses `loadImage()`'s own revert mechanics (`layerStack.
       * loadImage()` + `canvasView.setLayerStack()` + `startWorkspace()`)
       * rather than duplicating them, since reverting to a snapshot is
       * exactly what loading an image already does - `baselineImageData`
       * is just another ImageData-shaped source, not a special case.
       * Synchronous, unlike `loadImage()`/`getImage()`/`save()` - no
       * `toPNGBlob()`/decode step is needed since `baselineImageData` was
       * already captured as plain ImageData - so there's no
       * `destroyed`-after-await window to guard against, only the same
       * up-front check every other method has.
       */
      cancel() {
        if (destroyed) throw new Error('instance.cancel(): called after destroy()');
        layerStack.loadImage(baselineImageData);
        canvasView.setLayerStack(layerStack);
        startWorkspace();
        resolveUiCallback(options, 'onCancel')?.();
      },

      destroy() {
        if (destroyed) return;
        destroyed = true;
        container.remove();
        // Restores the default Dexie-backed adapter unconditionally (task
        // 3.9) - even when this instance never called _setStorageAdapter()
        // itself (no options.storage supplied), since it's harmless/
        // idempotent in that case and keeps this call site simple. Without
        // it, a custom options.storage would stay the module-level active
        // adapter (js/persistence.js) after this instance is gone - a
        // subsequent mount() with no options.storage, or the standalone
        // app sharing the same page, would silently keep persisting
        // through this destroyed instance's adapter instead of falling
        // back to IndexedDB. Same cross-instance-leak fix already applied
        // to bindDomOnce()'s listeners (task 3.2) and js/workspace.js's
        // root (task 3.5) - see this module's doc comment.
        _resetStorageAdapter();
      },
    };
  },
};
