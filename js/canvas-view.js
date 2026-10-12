// Owns the workspace <canvas> element, its 2D context, and pointer-driven
// draw/pan/zoom interaction. Renders a LayerStack's composited output;
// reports grid-coordinate draw events upward via handlers. Knows nothing
// about tools, colors, layers, or the undo stack.

import { clearArea } from './layout.js';

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const ZOOM_STEP_FACTOR = 1.25; // per +/- button press or keyboard shortcut

// (6-add-tile-seamless-preview) (dx, dy) in canvas-CSS-widths/heights for
// each of the 8 .tile-preview-copy elements, in their fixed DOM order
// (index.html) - #resetView() positions copy `i` at
// (dx*cssWidth, dy*cssHeight) relative to #canvasEl's own (0, 0).
const TILE_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

import { pointerDownAction } from './pointer-policy.js';
import { containerToLocal, transformAround, snapAngle, angleDelta, rotatedSize, centredPan } from './view-transform.js';

export class CanvasView {
  #canvasEl;
  #containerEl;
  #layerStack;
  #ctx;
  #handlers = {};

  #baseScale = 1;
  #scale = 1;
  // View rotation in degrees, clockwise (js/view-transform.js). View
  // state like zoom: not saved, back to 0 whenever resetView() refits.
  #rotation = 0;
  #pinchAngle = 0;
  #gestureRotation = 0;
  #panX = 0;
  #panY = 0;

  #pointers = new Map(); // pointerId -> { x, y, type, gestureOnly }
  // Palm rejection (js/pointer-policy.js): ignored pointers never enter
  // #pointers, so they can't draw, pinch or cancel a stroke.
  #pencilOnly = false;
  #penSeen = false;
  #penDownId = null;
  #ignoredPointers = new Set();
  #drawing = false;
  #panMode = false; // Hand tool active - single-pointer drag pans instead of drawing
  #panning = false; // a pan drag is currently in progress
  #multiTouchActive = false;
  #pinchMidpoint = null;
  #pinchDist = 0;

  #selectionOverlayEl;
  #selectionRect = null;
  // Brush cursor (js/brush-cursor.js): an SVG in grid units laid over the
  // canvas, its two paths (light under dark) holding the footprint outline.
  #cursorEl;
  #cursorPaths = [];

  // (reference-image-original-resolution) Two more siblings, appended
  // between #canvasEl and #selectionOverlayEl (so the selection marquee
  // stays visually topmost, unchanged from before this existed), used
  // only when LayerStack.getRenderPlan() splits into more than one
  // segment - see #render()'s doc comment. #aboveCanvasEl is a second
  // same-size pixel-buffer <canvas>, exactly like #canvasEl, for the
  // stack's layers above an 'original'-mode reference layer.
  // #referenceImgEl is an <img>, not a <canvas>: an 'original'-mode
  // reference layer renders at its own native resolution, which a
  // same-size pixel buffer can't represent (see design.md's "Rendering"
  // section) - an <img> with `object-fit: contain` sized to the same CSS
  // box as #canvasEl lets the browser's own smooth bitmap scaling produce
  // the final on-screen size, never round-tripped through a tiny buffer.
  // Both start hidden (style.css's .hidden) and are only shown while
  // #render()'s current plan actually has a segment for them.
  #aboveCanvasEl;
  #aboveCtx;
  #referenceImgEl;
  #referenceObjectUrlBlob = null; // the Blob #referenceObjectUrl was created from, so we only re-create on an actual change
  #referenceObjectUrl = null;

  // (6-add-tile-seamless-preview) #wrapperEl is the 3x3 group's own
  // element (index.html's #workspace-tile-wrapper, #canvasEl's direct
  // parent) - #applyTransform() sets pan/zoom on this one element instead
  // of on #canvasEl and its overlay siblings individually (see that
  // method), so all 9 cells move/scale together; it replaces
  // #containerEl as the parent #referenceImgEl/#aboveCanvasEl/
  // #selectionOverlayEl are appended into, so they keep lining up with
  // #canvasEl exactly as before (#canvasEl's own position:absolute;
  // left:0;top:0 is unchanged - only its containing block moved one level
  // in). #tileCopyEls/#tileCopyCtxs are the 8 surrounding, read-only
  // copies (index.html's .tile-preview-copy elements); #TILE_OFFSETS
  // pairs them 1:1, in DOM order, with the (dx, dy) canvas-widths/heights
  // #resetView() positions each one at.
  #wrapperEl;
  #tileCopyEls = [];
  #tileCopyCtxs = [];
  #tilePreviewEnabled = false;
  // (5a-floating-shell) Returns {top, right, bottom, left} CSS px that
  // floating cards cover inside the container; Fit/Fill/100% size and
  // centre within what's left. Zero insets (the default - docked layout,
  // Pixi.mount() embeds) means the whole container, as before.
  #getClearInsets;

  constructor(canvasEl, containerEl, layerStack, { getClearInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 }) } = {}) {
    this.#getClearInsets = getClearInsets;
    this.#canvasEl = canvasEl;
    this.#containerEl = containerEl;
    this.#layerStack = layerStack;
    this.#ctx = canvasEl.getContext('2d');
    this.#wrapperEl = canvasEl.parentElement;
    this.#tileCopyEls = [...this.#wrapperEl.querySelectorAll('.tile-preview-copy')];
    this.#tileCopyCtxs = this.#tileCopyEls.map((el) => el.getContext('2d'));
    // Matches every other transformed element's own former transform-origin
    // (see #applyTransform()'s doc comment) - translate()/scale() then
    // reproduce the exact on-screen position #canvasEl used to compute
    // for itself alone, so #zoomStep()/#zoomAroundPoint()'s pan/zoom math
    // (unchanged by this feature) still holds.
    this.#wrapperEl.style.transformOrigin = '0 0';

    // Required so Chrome/mobile browsers don't intercept two-finger
    // gestures as native page pinch-zoom/scroll before our own handlers see
    // them. This only reliably surfaces as a bug on an actual phone.
    this.#containerEl.style.touchAction = 'none';
    this.#canvasEl.style.touchAction = 'none';

    canvasEl.addEventListener('pointerdown', this.#onPointerDown);
    canvasEl.addEventListener('pointermove', this.#onPointerMove);
    canvasEl.addEventListener('pointerup', this.#onPointerUp);
    canvasEl.addEventListener('pointercancel', this.#onPointerUp);

    // DOM order matters here (paints later siblings on top, no z-index
    // involved): #referenceImgEl MUST be appended before #aboveCanvasEl,
    // not after - it represents the stack segment *below* #aboveCanvasEl's
    // (the layers above the reference), so it has to paint underneath it,
    // exactly the opposite of the append order that would put it visually
    // on top regardless of the reference layer's actual stack position.
    // Appended into #wrapperEl, not #containerEl - see the field comment
    // above.
    this.#referenceImgEl = document.createElement('img');
    this.#referenceImgEl.className = 'reference-original-overlay hidden';
    this.#referenceImgEl.alt = '';
    this.#wrapperEl.appendChild(this.#referenceImgEl);

    this.#aboveCanvasEl = document.createElement('canvas');
    this.#aboveCanvasEl.className = 'workspace-canvas-above-layer hidden';
    this.#aboveCtx = this.#aboveCanvasEl.getContext('2d');
    this.#wrapperEl.appendChild(this.#aboveCanvasEl);

    // A sibling overlay, not a canvas-drawn rectangle, so it never touches
    // pixel data — just a visual marker for the active selection (if any).
    // Appended last (after the two elements above) so it stays the
    // topmost sibling, as it always was.
    this.#selectionOverlayEl = document.createElement('div');
    this.#selectionOverlayEl.className = 'selection-overlay hidden';
    this.#wrapperEl.appendChild(this.#selectionOverlayEl);

    // Above the selection marquee. Hover is reported for mouse and pen
    // only: a finger has no hover and covers whatever is under it.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    this.#cursorEl = document.createElementNS(SVG_NS, 'svg');
    this.#cursorEl.setAttribute('class', 'brush-cursor hidden');
    this.#cursorEl.setAttribute('aria-hidden', 'true');
    for (const tone of ['brush-cursor-light', 'brush-cursor-dark']) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', tone);
      this.#cursorEl.appendChild(path);
      this.#cursorPaths.push(path);
    }
    this.#wrapperEl.appendChild(this.#cursorEl);
    canvasEl.addEventListener('pointerleave', this.#onPointerLeave);

    // Mac trackpad twist (Safari's WebKit-only gesture events; js/app.js
    // already stops their native page zoom). Rotation only. On iPad a
    // touch pinch fires these alongside pointer events, which already
    // turn the view - so they're skipped while any pointer is down.
    containerEl.addEventListener('gesturestart', () => {
      this.#gestureRotation = 0;
    });
    containerEl.addEventListener('gesturechange', (e) => {
      if (this.#pointers.size || !this.#layerStack) return;
      const delta = e.rotation - this.#gestureRotation;
      this.#gestureRotation = e.rotation;
      this.#zoomAroundPoint(e.clientX, e.clientY, e.clientX, e.clientY, 1, false, delta);
    });
    containerEl.addEventListener('gestureend', (e) => {
      if (this.#pointers.size || !this.#layerStack) return;
      this.#snapRotation({ x: e.clientX, y: e.clientY });
    });
  }

  setHandlers(handlers) {
    this.#handlers = handlers;
  }

  setLayerStack(layerStack) {
    this.#layerStack = layerStack;
    this.resetView();
    this.render();
  }

  /**
   * Whether single-pointer drag pans the view instead of drawing — the
   * Hand tool. Two-finger touch pan/pinch (see #onPointerDown/#onPointerMove's
   * `#pointers.size === 2` branch) is unaffected either way.
   */
  setPanMode(enabled) {
    this.#panMode = enabled;
    // Hand-cursor while the tool is active; a separate 'panning' class
    // (toggled per-drag below) swaps it to the "grabbing" cursor while a
    // pan is actually in progress, matching every other pixel-art tool's
    // open-hand/closed-hand convention.
    this.#canvasEl.classList.toggle('pan-mode', enabled);
    if (!enabled) this.#canvasEl.classList.remove('panning');
  }

  /**
   * Whether the Move tool is active - just swaps in the standard CSS
   * `move` cursor keyword (no custom artwork, no pressed-state variant,
   * unlike Hand's grab/grabbing paw cursors - see style.css).
   */
  setMoveMode(enabled) {
    this.#canvasEl.classList.toggle('move-mode', enabled);
  }

  /**
   * Whether the 3x3 seamless-tile preview is on. #render() skips
   * repainting the 8 copy canvases entirely while this is off (design.md:
   * "negligible cost ... only happens while tile-preview is on"); turning
   * it on here also repaints immediately, so the copies show the current
   * canvas content right away rather than staying blank/stale until the
   * next commit.
   */
  setTilePreviewEnabled(enabled) {
    this.#tilePreviewEnabled = enabled;
    this.#wrapperEl.classList.toggle('tile-preview-active', enabled);
    if (enabled) this.render();
  }

  /**
   * Fits the canvas to the container and centers it at 1x zoom ("Fit
   * Screen"). Also straightens the view, unless `keepRotation` (the Fit
   * preset), which fits the turned canvas's bounding box instead.
   */
  resetView({ keepRotation = false } = {}) {
    if (!keepRotation) this.#rotation = 0;
    const { width, height } = this.#layerStack;
    this.#canvasEl.width = width;
    this.#canvasEl.height = height;
    // (reference-image-original-resolution) #aboveCanvasEl mirrors
    // #canvasEl's own pixel-buffer/CSS-box size exactly - it holds the
    // same kind of same-size raster content, just a different stack
    // segment (see #render()). #referenceImgEl has no pixel buffer of
    // its own (it's an <img>); it only needs the same CSS box, set
    // below, so an 'original'-mode reference image's `object-fit:
    // contain` sizing is computed against the same footprint the pixel
    // canvases occupy.
    this.#aboveCanvasEl.width = width;
    this.#aboveCanvasEl.height = height;

    const area = this.#clearArea();
    const turned = rotatedSize(width, height, this.#rotation);
    const fitScale = Math.max(
      1,
      Math.floor(Math.min(area.width / turned.width, area.height / turned.height))
    );
    this.#baseScale = fitScale;
    this.#canvasEl.style.width = `${width * fitScale}px`;
    this.#canvasEl.style.height = `${height * fitScale}px`;
    this.#aboveCanvasEl.style.width = `${width * fitScale}px`;
    this.#aboveCanvasEl.style.height = `${height * fitScale}px`;
    this.#referenceImgEl.style.width = `${width * fitScale}px`;
    this.#referenceImgEl.style.height = `${height * fitScale}px`;
    // Explicit width/height attributes too, not just CSS - the img's own
    // pan/zoom sizing already comes entirely from the style properties
    // above (re-applied on every resetView()/zoom change), but setting
    // these avoids the element having no intrinsic size at all before its
    // first layout pass (Web Interface Guidelines: images need explicit
    // width/height).
    this.#referenceImgEl.width = width * fitScale;
    this.#referenceImgEl.height = height * fitScale;
    // Transparency checkerboard (see style.css): one checker square per
    // artwork pixel, so a 2x2 checker tile spans 2 pixels' worth of CSS px.
    this.#canvasEl.style.backgroundSize = `${fitScale * 2}px ${fitScale * 2}px`;

    // (6-add-tile-seamless-preview) Each copy is positioned +-1 canvas
    // CSS width/height away from #canvasEl's own (0, 0) (TILE_OFFSETS),
    // sized/checkerboarded to match it exactly (same as #aboveCanvasEl
    // above) - since #wrapperEl's transform-origin is '0 0' (constructor)
    // just like #canvasEl's own used to be, #applyTransform()'s single
    // translate/scale on #wrapperEl positions/scales every copy the same
    // way it used to position #canvasEl alone, with no zoom-math changes
    // needed anywhere else.
    const cssWidth = width * fitScale;
    const cssHeight = height * fitScale;
    this.#tileCopyEls.forEach((el, i) => {
      const [dx, dy] = TILE_OFFSETS[i];
      el.width = width;
      el.height = height;
      el.style.left = `${dx * cssWidth}px`;
      el.style.top = `${dy * cssHeight}px`;
      el.style.width = `${cssWidth}px`;
      el.style.height = `${cssHeight}px`;
      el.style.backgroundSize = `${fitScale * 2}px ${fitScale * 2}px`;
    });

    this.#scale = 1;
    this.#centre(area);
    this.#applyTransform();
    this.#emitZoomChange();
  }

  /** Pans so the canvas's centre sits on the middle of `area`, at the current zoom and rotation. */
  #centre(area) {
    const { width, height } = this.#layerStack;
    const pan = centredPan(area, width * this.#baseScale, height * this.#baseScale, this.#scale, this.#rotation);
    this.#panX = pan.panX;
    this.#panY = pan.panY;
  }

  #view() {
    return { panX: this.#panX, panY: this.#panY, scale: this.#scale, rotation: this.#rotation };
  }

  #setView(view) {
    this.#panX = view.panX;
    this.#panY = view.panY;
    this.#scale = view.scale;
    this.#rotation = view.rotation;
    this.#applyTransform();
    this.#emitZoomChange();
  }

  /** The view rotation in degrees, [0, 360). */
  getRotation() {
    return ((Math.round(this.#rotation) % 360) + 360) % 360;
  }

  /**
   * Turns the view by `degrees` around the middle of the clear area (the
   * Zoom menu's Rotate View Left/Right), landing on a right angle when
   * close to one.
   */
  rotateBy(degrees) {
    const containerRect = this.#containerEl.getBoundingClientRect();
    const area = clearArea(containerRect, this.#getClearInsets());
    const centre = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    const target = snapAngle(this.#rotation + degrees);
    this.#setView(transformAround(this.#view(), centre, centre, this.#scale, angleDelta(this.#rotation, target)));
  }

  /** Straightens the view and refits (the Zoom menu's Reset Rotation). */
  resetRotation() {
    this.resetView();
    this.render(); // resetView() clears the canvas buffer - see setZoomPreset('fit')
  }

  /** The container area left clear by floating cards (see #getClearInsets). */
  #clearArea() {
    return clearArea(this.#containerEl.getBoundingClientRect(), this.#getClearInsets());
  }

  /**
   * Steps the zoom in (`direction` > 0) or out (`direction` < 0) by a fixed
   * factor, anchored on the center of the clear area (the container, minus
   * any floating cards) so the same part of the canvas stays under the
   * middle of what's visible. Clamped to
   * MIN_SCALE/MAX_SCALE, same as pinch zoom.
   */
  zoomStep(direction) {
    const containerRect = this.#containerEl.getBoundingClientRect();
    const area = clearArea(containerRect, this.#getClearInsets());
    const cx = containerRect.left + area.x + area.width / 2;
    const cy = containerRect.top + area.y + area.height / 2;
    const factor = direction > 0 ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR;
    this.#zoomAroundPoint(cx, cy, cx, cy, factor, true);
  }

  /**
   * Shifts the pan offset by (dx, dy) CSS pixels, zoom unchanged. Used by
   * js/workspace.js's hide-all-UI toggle (4d-hide-all-ui) to cancel out
   * the container's own move when the surrounding chrome hides/shows, so
   * the drawing stays put on screen instead of jumping by the tool rail's
   * width and the top bar's height.
   */
  panBy(dx, dy) {
    this.#panX += dx;
    this.#panY += dy;
    this.#applyTransform();
  }

  /**
   * Jumps to a named zoom preset. '100' bypasses MIN_SCALE/MAX_SCALE
   * deliberately — see design.md: a small canvas can legitimately need a
   * scale below MIN_SCALE to reach exactly one canvas pixel per CSS pixel.
   * 'fill' likewise bypasses the clamp and does not floor its cover ratio
   * (unlike Fit's fitScale), so it always fully covers the container
   * rather than under-covering and leaving a gap.
   */
  setZoomPreset(preset) {
    if (preset === 'fit') {
      // resetView() assigns canvasEl.width/height, which always clears
      // the canvas's drawing buffer in the browser (even to the same
      // numeric value) - every other caller of resetView() follows it
      // with a render() to repaint from the layer data; this one must
      // too, or the artwork visibly vanishes until something else
      // (e.g. the next stroke) happens to trigger a render.
      this.resetView({ keepRotation: true });
      this.render();
      return;
    }

    const { width, height } = this.#layerStack;
    const area = this.#clearArea();

    if (preset === '100') {
      this.#scale = 1 / this.#baseScale;
    } else if (preset === 'fill') {
      const turned = rotatedSize(width, height, this.#rotation);
      const coverRatio = Math.max(area.width / turned.width, area.height / turned.height);
      this.#scale = coverRatio / this.#baseScale;
    } else {
      return;
    }

    this.#centre(area);
    this.#applyTransform();
    this.#emitZoomChange();
  }

  /** Current effective zoom (baseScale x scale) as a whole-number percentage. */
  getZoomPercent() {
    return Math.round(this.#baseScale * this.#scale * 100);
  }

  /**
   * (reference-image-original-resolution) Renders LayerStack.getRenderPlan()'s
   * ordered segments across up to three sibling elements instead of always
   * putImageData-ing one flat raster onto #canvasEl: #canvasEl always
   * takes whichever raster segment sits *below* an 'original'-mode
   * reference layer (or the single, whole-stack raster, when there's no
   * such split - the plan's own single-segment shape for that case, so
   * this reproduces the exact prior behavior whenever no visible
   * 'original'-mode reference layer exists), #referenceImgEl takes the
   * 'reference-original' segment (if present), and #aboveCanvasEl takes
   * the raster segment above it (if present). DOM order (set in the
   * constructor) already places these three in the right visual stacking
   * order, so no z-index math is needed here - only content and
   * show/hide per segment presence.
   */
  render() {
    const plan = this.#layerStack.getRenderPlan();
    const refPos = plan.findIndex((s) => s.type === 'reference-original');
    const belowSeg = refPos === -1 ? plan[0] : (plan[refPos - 1] ?? null);
    const refSeg = refPos === -1 ? null : plan[refPos];
    const aboveSeg = refPos === -1 ? null : (plan[refPos + 1] ?? null);

    if (belowSeg) {
      this.#ctx.putImageData(belowSeg.imageData, 0, 0);
    } else {
      // No layers below the reference (it's bottom-most) - nothing to
      // paint into #canvasEl itself; its transparency checkerboard shows
      // through as if this segment didn't exist.
      this.#ctx.clearRect(0, 0, this.#canvasEl.width, this.#canvasEl.height);
    }

    if (aboveSeg) {
      this.#aboveCtx.putImageData(aboveSeg.imageData, 0, 0);
      this.#aboveCanvasEl.classList.remove('hidden');
    } else {
      this.#aboveCanvasEl.classList.add('hidden');
    }

    if (refSeg && refSeg.layer.originalSourceBlob) {
      const layer = refSeg.layer;
      // Re-derive the <img> src only when the underlying Blob actually
      // changed (not on every render() call, which happens on every
      // pointermove while drawing) - createObjectURL/revokeObjectURL
      // otherwise churns a new blob: URL many times a second for no
      // reason. Same object reference, same URL, reused across renders.
      if (layer.originalSourceBlob !== this.#referenceObjectUrlBlob) {
        if (this.#referenceObjectUrl) URL.revokeObjectURL(this.#referenceObjectUrl);
        this.#referenceObjectUrlBlob = layer.originalSourceBlob;
        this.#referenceObjectUrl = layer.originalSourceBlob ? URL.createObjectURL(layer.originalSourceBlob) : null;
        this.#referenceImgEl.src = this.#referenceObjectUrl ?? '';
      }
      this.#referenceImgEl.style.opacity = layer.opacity;
      // The app's four blend modes (normal/multiply/screen/overlay) are
      // also valid CSS mix-blend-mode keywords, so this maps 1:1 onto the
      // same names #compositeToCanvas's BLEND_MODE_TO_COMPOSITE_OP uses
      // for the raster segments - no lookup table needed.
      this.#referenceImgEl.style.mixBlendMode = layer.blendMode;
      this.#referenceImgEl.classList.remove('hidden');
    } else {
      this.#referenceImgEl.classList.add('hidden');
      // The reference segment disappeared (layer deleted/hidden/switched
      // to Pixelated mode, or a different project with no reference layer
      // was loaded into this same long-lived CanvasView - see js/app.js's
      // single reused instance) - revoke the now-orphaned object URL
      // rather than leaving it live until some future Blob happens to
      // replace it, which could be never for the rest of the session.
      if (this.#referenceObjectUrl) {
        URL.revokeObjectURL(this.#referenceObjectUrl);
        this.#referenceObjectUrl = null;
        this.#referenceObjectUrlBlob = null;
      }
    }

    // (6-add-tile-seamless-preview) Skipped entirely while off, per
    // design.md - putImageData on 8 small canvases is cheap, but there's
    // no reason to pay it on every commit unless the preview is actually
    // visible. Deliberately the full flattened artwork rather than the
    // render-plan segments above: the surrounding copies are a read-only
    // preview of the drawn artwork, not a second surface that needs to
    // reproduce an 'original'-mode reference layer's separate, non-pixel-
    // buffer rendering. In the common case (no reference-layer split),
    // belowSeg.imageData above already *is* that full composite -
    // getRenderPlan()'s own doc comment: a single-segment plan is
    // `[{ type: 'raster', imageData: this.composite() }]` - so this reuses
    // it instead of paying for a second #compositeToCanvas()+getImageData
    // pass on every commit/pointermove (this branch's reused composite
    // still includes a visible *'pixelated'*-mode reference layer, same
    // as #canvasEl itself always has - unaffected by the split-case fix
    // below, which only ever applies to the *'original'*-mode split
    // case). The (rarer) split-reference case needs its own fresh
    // composite() call, since belowSeg/aboveSeg there are partial, not
    // the full stack - and must pass `excludeReferenceImage: true`, or it
    // would bake the 'original'-mode reference layer's low-resolution
    // pixel-buffer content into the copies, which appears nowhere else in
    // the app (getRenderPlan() always renders that layer as a separate,
    // native-resolution `<img>` instead - see #referenceImgEl above -
    // which the copies have no equivalent overlay for).
    if (this.#tilePreviewEnabled) {
      const composite =
        refPos === -1 ? belowSeg.imageData : this.#layerStack.composite({ excludeReferenceImage: true });
      for (const ctx of this.#tileCopyCtxs) {
        ctx.putImageData(composite, 0, 0);
      }
    }
  }

  /**
   * Shows (and positions) or hides the selection overlay. `rect` is in
   * grid coordinates: { x, y, width, height }, or null to hide it.
   */
  setSelectionRect(rect) {
    this.#selectionRect = rect;
    if (!rect) {
      this.#selectionOverlayEl.classList.add('hidden');
      return;
    }
    this.#selectionOverlayEl.classList.remove('hidden');
    this.#selectionOverlayEl.style.left = `${rect.x * this.#baseScale}px`;
    this.#selectionOverlayEl.style.top = `${rect.y * this.#baseScale}px`;
    this.#selectionOverlayEl.style.width = `${rect.width * this.#baseScale}px`;
    this.#selectionOverlayEl.style.height = `${rect.height * this.#baseScale}px`;
    this.#applyTransform();
  }

  /**
   * Shows the brush cursor: `d` is a path in pixel units relative to the
   * grid point `at` ({x, y}). Hidden by hideCursor() or an empty `d`.
   */
  setCursorPath(d, at) {
    if (!d || !this.#layerStack) {
      this.hideCursor();
      return;
    }
    const { width, height } = this.#layerStack;
    this.#cursorEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.#cursorEl.style.width = `${width * this.#baseScale}px`;
    this.#cursorEl.style.height = `${height * this.#baseScale}px`;
    for (const path of this.#cursorPaths) {
      path.setAttribute('d', d);
      path.setAttribute('transform', `translate(${at.x} ${at.y})`);
    }
    this.#cursorEl.classList.remove('hidden');
  }

  hideCursor() {
    this.#cursorEl.classList.add('hidden');
  }

  /**
   * The selection overlay's on-screen box (client pixels, at the current
   * pan and zoom), or null while no selection is shown. Read by the
   * floating selection action bar (5f-selection-action-bar).
   */
  getSelectionClientRect() {
    if (this.#selectionOverlayEl.classList.contains('hidden')) return null;
    return this.#selectionOverlayEl.getBoundingClientRect();
  }

  /**
   * The single choke point for everything that moves the canvas or the
   * selection overlay on screen: Hand-tool pan, zoom steps, wheel/keyboard
   * zoom, pinch, panBy, presets, resetView and setSelectionRect all end
   * here, so `onViewChange` (5f-selection-action-bar) fires for each.
   */
  #applyTransform() {
    // (6-add-tile-seamless-preview) A single transform on #wrapperEl (the
    // tile-preview group) replaces the old per-element loop: #canvasEl
    // and its overlay siblings (#aboveCanvasEl/#referenceImgEl/
    // #selectionOverlayEl, all direct children of #wrapperEl now, same as
    // #canvasEl) and the 8 copy canvases all move/scale together as one
    // rigid subtree. #wrapperEl's transform-origin is '0 0' (constructor)
    // and its own layout position is left:0;top:0 (style.css), identical
    // to what #canvasEl's used to be - so this reproduces the exact same
    // on-screen position/scale math #canvasEl computed for itself alone,
    // just applied to the whole group. The rotate() (view rotation) is why
    // #toGridPoint() maps through js/view-transform.js rather than
    // getBoundingClientRect(), whose box is axis-aligned.
    this.#wrapperEl.style.transform = `translate(${this.#panX}px, ${this.#panY}px) rotate(${this.#rotation}deg) scale(${this.#scale})`;
    this.#handlers.onViewChange?.();
  }

  #emitZoomChange() {
    this.#handlers.onZoomChange?.(this.getZoomPercent(), this.getRotation());
  }

  #toGridPoint(clientX, clientY) {
    const containerRect = this.#containerEl.getBoundingClientRect();
    const local = containerToLocal({ x: clientX - containerRect.left, y: clientY - containerRect.top }, this.#view());
    return { x: Math.floor(local.x / this.#baseScale), y: Math.floor(local.y / this.#baseScale) };
  }

  /** Draw Only With Apple Pencil (Prefs). Off restores the plain rules. */
  setPencilOnly(enabled) {
    this.#pencilOnly = enabled;
  }

  #onPointerDown = (e) => {
    this.#ignoredPointers.delete(e.pointerId); // ids can be reused
    const action = pointerDownAction({
      pointerType: e.pointerType,
      pencilOnly: this.#pencilOnly,
      penSeen: this.#penSeen,
      penDown: this.#penDownId !== null,
    });
    if (action === 'ignore') {
      // Captured too, so its pointerup arrives even off the canvas.
      this.#canvasEl.setPointerCapture(e.pointerId);
      this.#ignoredPointers.add(e.pointerId);
      e.preventDefault();
      return;
    }
    if (action === 'pen') {
      this.#penSeen = true;
      this.#penDownId = e.pointerId;
      this.#dropTouchPointers();
    }

    this.#canvasEl.setPointerCapture(e.pointerId);
    const gestureOnly = action === 'gesture';
    this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, gestureOnly });
    this.#reportHover(e);

    if (this.#pointers.size === 1 && !this.#multiTouchActive) {
      // A finger in Pencil mode never draws; it can still pan with Hand.
      if (gestureOnly && !this.#panMode) {
        // waits for a second finger to pinch
      } else if (this.#panMode) {
        this.#panning = true;
        this.#canvasEl.classList.add('panning');
      } else {
        this.#drawing = true;
        this.#handlers.onDrawStart?.(this.#toGridPoint(e.clientX, e.clientY));
      }
    } else if (this.#pointers.size === 2) {
      if (this.#drawing) {
        this.#drawing = false;
        this.#handlers.onDrawCancel?.();
      }
      this.#panning = false;
      this.#multiTouchActive = true;
      this.#beginPinch();
    }
    e.preventDefault();
  };

  /**
   * The Pencil just landed: any finger already down is a resting palm.
   * It stops counting - mid-pinch or not - and stays ignored until lifted.
   */
  #dropTouchPointers() {
    for (const [id, pointer] of this.#pointers) {
      if (pointer.type !== 'touch') continue;
      this.#pointers.delete(id);
      this.#ignoredPointers.add(id);
    }
    if (this.#pointers.size === 0) {
      this.#multiTouchActive = false;
      this.#pinchMidpoint = null;
      if (this.#panning) {
        this.#panning = false;
        this.#canvasEl.classList.remove('panning');
      }
    }
  }

  /** Hover (or press) position for the brush cursor - null hides it. */
  #reportHover(e) {
    const show = e.pointerType !== 'touch' && this.#pointers.size <= 1 && !this.#multiTouchActive;
    this.#handlers.onHover?.(show ? this.#toGridPoint(e.clientX, e.clientY) : null);
  }

  #onPointerLeave = (e) => {
    // A captured pointer (mid-stroke) keeps its cursor until release.
    if (!this.#pointers.has(e.pointerId)) this.#handlers.onHover?.(null);
  };

  #onPointerMove = (e) => {
    this.#reportHover(e);
    if (!this.#pointers.has(e.pointerId)) return;
    const prev = this.#pointers.get(e.pointerId);
    this.#pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });

    if (this.#pointers.size === 1 && this.#panning) {
      // Hand tool: pan by the raw client-pixel delta, same math the
      // two-finger pan branch below already uses (via #zoomAroundPoint's
      // ratio=1 case), just without any zoom change.
      this.#panX += e.clientX - prev.x;
      this.#panY += e.clientY - prev.y;
      this.#applyTransform();
    } else if (this.#pointers.size === 1 && this.#drawing) {
      this.#handlers.onDrawMove?.(this.#toGridPoint(e.clientX, e.clientY));
    } else if (this.#pointers.size === 2) {
      this.#updatePinch();
    }
    e.preventDefault();
  };

  #onPointerUp = (e) => {
    if (this.#ignoredPointers.delete(e.pointerId)) return;
    if (!this.#pointers.has(e.pointerId)) return;
    this.#pointers.delete(e.pointerId);
    if (e.pointerId === this.#penDownId) this.#penDownId = null;

    // A lifted Pencil leaves nothing under the cursor (a hover-capable
    // iPad reports the next hover move and shows it again); a mouse
    // released off the canvas got no pointerleave while captured.
    const { x, y } = this.#toGridPoint(e.clientX, e.clientY);
    const outside = x < 0 || y < 0 || x >= this.#layerStack.width || y >= this.#layerStack.height;
    if (e.pointerType === 'pen' || outside || e.type === 'pointercancel') this.#handlers.onHover?.(null);

    if (this.#drawing && this.#pointers.size === 0) {
      this.#drawing = false;
      this.#handlers.onDrawEnd?.();
    }
    if (this.#panning && this.#pointers.size === 0) {
      this.#panning = false;
      this.#canvasEl.classList.remove('panning');
    }
    if (this.#pointers.size < 2 && this.#pinchMidpoint) {
      const around = this.#pinchMidpoint;
      this.#pinchMidpoint = null;
      this.#snapRotation(around);
    }
    if (this.#pointers.size === 0) {
      this.#multiTouchActive = false;
    }
  };

  #activePointerPositions() {
    return [...this.#pointers.values()];
  }

  #beginPinch() {
    const [a, b] = this.#activePointerPositions();
    this.#pinchMidpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.#pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    this.#pinchAngle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }

  /** Two fingers: zoom by their spread, turn by their twist, pan by their midpoint - all at once. */
  #updatePinch() {
    const [a, b] = this.#activePointerPositions();
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = this.#pinchDist > 0 ? dist / this.#pinchDist : 1;
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

    this.#zoomAroundPoint(this.#pinchMidpoint.x, this.#pinchMidpoint.y, midpoint.x, midpoint.y, ratio, true, angleDelta(this.#pinchAngle, angle));

    this.#pinchMidpoint = midpoint;
    this.#pinchDist = dist;
    this.#pinchAngle = angle;
  }

  /** After a twist: settle on a right angle if within a few degrees of one, around the last pinch midpoint. */
  #snapRotation(around) {
    const target = snapAngle(this.#rotation);
    const delta = angleDelta(this.#rotation, target);
    if (Math.abs(delta) < 1e-6) {
      this.#rotation = target; // just normalise
      return;
    }
    const containerRect = this.#containerEl.getBoundingClientRect();
    const p = { x: around.x - containerRect.left, y: around.y - containerRect.top };
    this.#setView(transformAround(this.#view(), p, p, this.#scale, delta));
  }

  /**
   * Shared zoom math for both pinch and button/keyboard zoom: whatever
   * canvas-space point was under (oldClientX, oldClientY) before the zoom
   * ends up under (newClientX, newClientY) after it. Button/keyboard zoom
   * passes the same point for old and new (the container center stays put);
   * pinch passes the old and new pinch midpoints (so a two-finger drag
   * pans and zooms in the same gesture, as it always has).
   */
  #zoomAroundPoint(oldClientX, oldClientY, newClientX, newClientY, ratio, clampToStepRange, deltaDegrees = 0) {
    const containerRect = this.#containerEl.getBoundingClientRect();
    const scale = clampToStepRange ? clamp(this.#scale * ratio, MIN_SCALE, MAX_SCALE) : this.#scale * ratio;
    const from = { x: oldClientX - containerRect.left, y: oldClientY - containerRect.top };
    const to = { x: newClientX - containerRect.left, y: newClientY - containerRect.top };
    this.#setView(transformAround(this.#view(), from, to, scale, deltaDegrees));
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
