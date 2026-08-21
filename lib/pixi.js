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
// the standalone app) is active is unsupported.
//
// A host page must also load Pixi's stylesheet (`style.css`) for this
// markup to render correctly - `mount()` does not inject a `<link>` for
// it, since a host may want to scope/bundle it differently. See the mount
// API docs (task 4.1) for the exact requirement once written.

import { LayerStack } from './pixel-engine/layers.js';
import { CanvasView } from '../js/canvas-view.js';
import { initWorkspace } from '../js/workspace.js';

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

export const Pixi = {
  /**
   * Mounts a Workspace editor into `hostElement`, replacing its contents.
   * Returns `{ loadImage(), destroy() }`; `destroy()` unmounts the editor
   * and leaves `hostElement` empty again. See this module's doc comment
   * for the single-active-instance limitation inherited from
   * `js/workspace.js`.
   *
   * `options.width`/`options.height` (default 32) size the blank canvas
   * the instance starts with - `loadImage()` (see the returned instance)
   * is the normal way to open real content on top of that blank start.
   */
  mount(hostElement, options = {}) {
    validateHostElement(hostElement);

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

    const startWorkspace = () =>
      initWorkspace({
        projectId: null,
        projectName: options.name ?? 'Untitled',
        layerStack,
        canvasView,
        onRequestGallery: () => {}, // no standalone Gallery to navigate to when mounted; see options.ui.gallery (task 3.6)
        root: container,
      });

    startWorkspace();

    let destroyed = false;
    return {
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
       * `options.format` (default `'png'`) selects the return shape, not a
       * different encoding - see `validateGetImageFormat`'s doc comment
       * for why this is one axis, not two. `'png'` returns the Blob as-is;
       * `'base64'` converts it to a base64 data URL via `FileReader`;
       * `'imagedata'` decodes it back to pixels via `decodeToImageData`
       * (the same Blob-decode helper `loadImage()` uses, reused rather
       * than duplicated) - a round trip through the encoder rather than
       * reading `layerStack.composite()` directly, so all three formats
       * are guaranteed to reflect identical pixels (background/reference-
       * layer handling included) rather than two independently-behaving
       * paths that could drift apart.
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

      destroy() {
        if (destroyed) return;
        destroyed = true;
        container.remove();
      },
    };
  },
};
