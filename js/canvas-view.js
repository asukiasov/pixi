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

    // A sibling overlay, not a canvas-drawn rectangle, so it never touches
    // pixel data — just a visual marker for the active selection (if any).
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

  /** Fits the canvas to the container and centers it at 1x zoom ("Fit Screen"). */
  resetView() {
    const { width, height } = this.#layerStack;
    this.#canvasEl.width = width;
    this.#canvasEl.height = height;

    const containerRect = this.#containerEl.getBoundingClientRect();
    const fitScale = Math.max(
      1,
      Math.floor(Math.min(containerRect.width / width, containerRect.height / height))
    );
    this.#baseScale = fitScale;
    this.#canvasEl.style.width = `${width * fitScale}px`;
    this.#canvasEl.style.height = `${height * fitScale}px`;
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

  render() {
    this.#ctx.putImageData(this.#layerStack.composite(), 0, 0);
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
    this.#canvasEl.style.transformOrigin = '0 0';
    this.#canvasEl.style.transform = transform;
    // Sibling element at the same origin, so the identical transform keeps
    // it aligned with the canvas through pan/zoom with no separate math.
    this.#selectionOverlayEl.style.transformOrigin = '0 0';
    this.#selectionOverlayEl.style.transform = transform;
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
