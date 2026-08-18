// Owns the workspace <canvas> element, its 2D context, and pointer-driven
// draw/pan/zoom interaction. Renders a LayerStack's composited output;
// reports grid-coordinate draw events upward via handlers. Knows nothing
// about tools, colors, layers, or the undo stack.

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const ZOOM_STEP_FACTOR = 1.25; // per +/- button press or keyboard shortcut

export class CanvasView {
  #canvasEl;
  #containerEl;
  #layerStack;
  #ctx;
  #handlers = {};

  #baseScale = 1;
  #scale = 1;
  #panX = 0;
  #panY = 0;

  #pointers = new Map(); // pointerId -> { x, y }
  #drawing = false;
  #panMode = false; // Hand tool active - single-pointer drag pans instead of drawing
  #panning = false; // a pan drag is currently in progress
  #multiTouchActive = false;
  #pinchMidpoint = null;
  #pinchDist = 0;

  #selectionOverlayEl;
  #selectionRect = null;

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

  constructor(canvasEl, containerEl, layerStack) {
    this.#canvasEl = canvasEl;
    this.#containerEl = containerEl;
    this.#layerStack = layerStack;
    this.#ctx = canvasEl.getContext('2d');

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
    this.#referenceImgEl = document.createElement('img');
    this.#referenceImgEl.className = 'reference-original-overlay hidden';
    this.#referenceImgEl.alt = '';
    this.#containerEl.appendChild(this.#referenceImgEl);

    this.#aboveCanvasEl = document.createElement('canvas');
    this.#aboveCanvasEl.className = 'workspace-canvas-above-layer hidden';
    this.#aboveCtx = this.#aboveCanvasEl.getContext('2d');
    this.#containerEl.appendChild(this.#aboveCanvasEl);

    // A sibling overlay, not a canvas-drawn rectangle, so it never touches
    // pixel data — just a visual marker for the active selection (if any).
    // Appended last (after the two elements above) so it stays the
    // topmost sibling, as it always was.
    this.#selectionOverlayEl = document.createElement('div');
    this.#selectionOverlayEl.className = 'selection-overlay hidden';
    this.#containerEl.appendChild(this.#selectionOverlayEl);
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

  /** Fits the canvas to the container and centers it at 1x zoom ("Fit Screen"). */
  resetView() {
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

    const containerRect = this.#containerEl.getBoundingClientRect();
    const fitScale = Math.max(
      1,
      Math.floor(Math.min(containerRect.width / width, containerRect.height / height))
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

    this.#scale = 1;
    this.#panX = (containerRect.width - width * fitScale) / 2;
    this.#panY = (containerRect.height - height * fitScale) / 2;
    this.#applyTransform();
    this.#emitZoomChange();
  }

  /**
   * Steps the zoom in (`direction` > 0) or out (`direction` < 0) by a fixed
   * factor, anchored on the container's center so the same part of the
   * canvas stays under the middle of the screen. Clamped to
   * MIN_SCALE/MAX_SCALE, same as pinch zoom.
   */
  zoomStep(direction) {
    const containerRect = this.#containerEl.getBoundingClientRect();
    const cx = containerRect.left + containerRect.width / 2;
    const cy = containerRect.top + containerRect.height / 2;
    const factor = direction > 0 ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR;
    this.#zoomAroundPoint(cx, cy, cx, cy, factor, true);
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
      this.resetView();
      this.render();
      return;
    }

    const { width, height } = this.#layerStack;
    const containerRect = this.#containerEl.getBoundingClientRect();

    if (preset === '100') {
      this.#scale = 1 / this.#baseScale;
    } else if (preset === 'fill') {
      const coverRatio = Math.max(containerRect.width / width, containerRect.height / height);
      this.#scale = coverRatio / this.#baseScale;
    } else {
      return;
    }

    this.#panX = (containerRect.width - width * this.#baseScale * this.#scale) / 2;
    this.#panY = (containerRect.height - height * this.#baseScale * this.#scale) / 2;
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

  #applyTransform() {
    const transform = `translate(${this.#panX}px, ${this.#panY}px) scale(${this.#scale})`;
    // Every sibling element at the same origin gets the identical
    // transform, so they all track pan/zoom in lockstep with no separate
    // math per element - #aboveCanvasEl/#referenceImgEl
    // (reference-image-original-resolution) join #selectionOverlayEl in
    // reusing this same loop.
    for (const el of [this.#canvasEl, this.#aboveCanvasEl, this.#referenceImgEl, this.#selectionOverlayEl]) {
      el.style.transformOrigin = '0 0';
      el.style.transform = transform;
    }
  }

  #emitZoomChange() {
    this.#handlers.onZoomChange?.(this.getZoomPercent());
  }

  #toGridPoint(clientX, clientY) {
    const rect = this.#canvasEl.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * this.#layerStack.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * this.#layerStack.height);
    return { x, y };
  }

  #onPointerDown = (e) => {
    this.#canvasEl.setPointerCapture(e.pointerId);
    this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.#pointers.size === 1 && !this.#multiTouchActive) {
      if (this.#panMode) {
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

  #onPointerMove = (e) => {
    if (!this.#pointers.has(e.pointerId)) return;
    const prev = this.#pointers.get(e.pointerId);
    this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

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
    if (!this.#pointers.has(e.pointerId)) return;
    this.#pointers.delete(e.pointerId);

    if (this.#drawing && this.#pointers.size === 0) {
      this.#drawing = false;
      this.#handlers.onDrawEnd?.();
    }
    if (this.#panning && this.#pointers.size === 0) {
      this.#panning = false;
      this.#canvasEl.classList.remove('panning');
    }
    if (this.#pointers.size < 2) {
      this.#pinchMidpoint = null;
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
  }

  #updatePinch() {
    const [a, b] = this.#activePointerPositions();
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = this.#pinchDist > 0 ? dist / this.#pinchDist : 1;

    this.#zoomAroundPoint(this.#pinchMidpoint.x, this.#pinchMidpoint.y, midpoint.x, midpoint.y, ratio, true);

    this.#pinchMidpoint = midpoint;
    this.#pinchDist = dist;
  }

  /**
   * Shared zoom math for both pinch and button/keyboard zoom: whatever
   * canvas-space point was under (oldClientX, oldClientY) before the zoom
   * ends up under (newClientX, newClientY) after it. Button/keyboard zoom
   * passes the same point for old and new (the container center stays put);
   * pinch passes the old and new pinch midpoints (so a two-finger drag
   * pans and zooms in the same gesture, as it always has).
   */
  #zoomAroundPoint(oldClientX, oldClientY, newClientX, newClientY, ratio, clampToStepRange) {
    const containerRect = this.#containerEl.getBoundingClientRect();
    const anchorX = (oldClientX - containerRect.left - this.#panX) / this.#scale;
    const anchorY = (oldClientY - containerRect.top - this.#panY) / this.#scale;

    this.#scale = clampToStepRange ? clamp(this.#scale * ratio, MIN_SCALE, MAX_SCALE) : this.#scale * ratio;

    this.#panX = newClientX - containerRect.left - anchorX * this.#scale;
    this.#panY = newClientY - containerRect.top - anchorY * this.#scale;
    this.#applyTransform();
    this.#emitZoomChange();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
