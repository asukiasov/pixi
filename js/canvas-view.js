// Owns the workspace <canvas> element, its 2D context, and pointer-driven
// draw/pan/zoom interaction. Reports grid-coordinate draw events upward via
// handlers; knows nothing about tools, colors, or the undo stack.

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;

export class CanvasView {
  #canvasEl;
  #containerEl;
  #engine;
  #ctx;
  #handlers = {};

  #baseScale = 1;
  #scale = 1;
  #panX = 0;
  #panY = 0;

  #pointers = new Map(); // pointerId -> { x, y }
  #drawing = false;
  #multiTouchActive = false;
  #pinchMidpoint = null;
  #pinchDist = 0;

  constructor(canvasEl, containerEl, engine) {
    this.#canvasEl = canvasEl;
    this.#containerEl = containerEl;
    this.#engine = engine;
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
  }

  setHandlers(handlers) {
    this.#handlers = handlers;
  }

  setEngine(engine) {
    this.#engine = engine;
    this.resetView();
    this.render();
  }

  /** Fits the canvas to the container and centers it at 1x zoom. */
  resetView() {
    const { width, height } = this.#engine;
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

    this.#scale = 1;
    this.#panX = (containerRect.width - width * fitScale) / 2;
    this.#panY = (containerRect.height - height * fitScale) / 2;
    this.#applyTransform();
  }

  render() {
    const { width, height, data } = this.#engine;
    const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
    this.#ctx.putImageData(imageData, 0, 0);
  }

  #applyTransform() {
    this.#canvasEl.style.transformOrigin = '0 0';
    this.#canvasEl.style.transform = `translate(${this.#panX}px, ${this.#panY}px) scale(${this.#scale})`;
  }

  #toGridPoint(clientX, clientY) {
    const rect = this.#canvasEl.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * this.#engine.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * this.#engine.height);
    return { x, y };
  }

  #onPointerDown = (e) => {
    this.#canvasEl.setPointerCapture(e.pointerId);
    this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.#pointers.size === 1 && !this.#multiTouchActive) {
      this.#drawing = true;
      this.#handlers.onDrawStart?.(this.#toGridPoint(e.clientX, e.clientY));
    } else if (this.#pointers.size === 2) {
      if (this.#drawing) {
        this.#drawing = false;
        this.#handlers.onDrawCancel?.();
      }
      this.#multiTouchActive = true;
      this.#beginPinch();
    }
    e.preventDefault();
  };

  #onPointerMove = (e) => {
    if (!this.#pointers.has(e.pointerId)) return;
    this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.#pointers.size === 1 && this.#drawing) {
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

    const containerRect = this.#containerEl.getBoundingClientRect();
    const anchorX = (this.#pinchMidpoint.x - containerRect.left - this.#panX) / this.#scale;
    const anchorY = (this.#pinchMidpoint.y - containerRect.top - this.#panY) / this.#scale;

    const ratio = this.#pinchDist > 0 ? dist / this.#pinchDist : 1;
    this.#scale = clamp(this.#scale * ratio, MIN_SCALE, MAX_SCALE);

    this.#panX = midpoint.x - containerRect.left - anchorX * this.#scale;
    this.#panY = midpoint.y - containerRect.top - anchorY * this.#scale;

    this.#pinchMidpoint = midpoint;
    this.#pinchDist = dist;
    this.#applyTransform();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
