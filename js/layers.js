// Ordered layer stack: each layer wraps a PixelEngine buffer plus display
// metadata (visibility/opacity/blend mode). Stack management (add/delete/
// reorder/rename/settings/active-layer tracking, snapshot/restore) is
// DOM-free and unit-testable; compositing needs a <canvas>, like
// PixelEngine.toPNGBlob(), so it isn't.

import { PixelEngine } from './engine.js';

const MAX_LAYERS = 8;
const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay'];
const BLEND_MODE_TO_COMPOSITE_OP = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
};
const MIME_TYPES = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
// No quality UI (see design.md's Non-Goals) - a fixed default keeps the
// Export popover simple; pixel art has little tolerance for visible
// compression artifacts anyway.
const LOSSY_QUALITY = 0.92;

class Layer {
  constructor(name, width, height, background = 'transparent', isBackground = false, isReferenceImage = false) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.engine = new PixelEngine(width, height, background);
    this.visible = true;
    this.opacity = 1;
    this.blendMode = 'normal';
    // Locked-in-position "Background" layer (Photoshop/Aseprite-style) -
    // set only for a white-background canvas's one starting layer (see
    // LayerStack's constructor), never reassigned afterward. See
    // moveLayerUp/moveLayerDown's reorder lock and workspace.js's Eraser
    // exception for the two places this actually changes behavior.
    this.isBackground = isBackground;
    // Locked, non-drawable "reference image" layer (reference-image-layer) -
    // a trace-over guide added via LayerStack.addReferenceImageLayer(),
    // never reassigned afterward. Independent of isBackground (a layer is
    // never both): reorder-locked like the Background layer (see
    // moveLayerUp/moveLayerDown), but additionally refused as an active
    // (drawing-target) layer by setActiveLayer, and always excluded from
    // export regardless of its own visibility - see
    // #compositeToCanvas's excludeReferenceImage option.
    this.isReferenceImage = isReferenceImage;
  }
}

export class LayerStack {
  #layers; // bottom-to-top order
  #activeIndex = 0;
  #width;
  #height;

  constructor(width, height, background = 'transparent') {
    this.#width = width;
    this.#height = height;
    // Only a white-background canvas's starting layer becomes the
    // Background layer - transparent canvases get a regular starting
    // layer, exactly as before this flag existed.
    this.#layers = [new Layer('Layer 1', width, height, background, background === 'white')];
  }

  get width() {
    return this.#width;
  }

  get height() {
    return this.#height;
  }

  getLayers() {
    return [...this.#layers];
  }

  getActiveIndex() {
    return this.#activeIndex;
  }

  getActiveLayer() {
    return this.#layers[this.#activeIndex];
  }

  /**
   * A reference image layer can never become the active (drawing-target)
   * layer - see the "Reference image layer is non-drawable" requirement.
   * Refusing here is the single choke point every drawing tool relies on
   * (they all resolve their target through getActiveLayer()), so no
   * per-tool check is needed elsewhere.
   */
  setActiveLayer(index) {
    if (index < 0 || index >= this.#layers.length) return;
    if (this.#layers[index].isReferenceImage) return;
    this.#activeIndex = index;
  }

  /** Adds a transparent layer directly above the active one, up to MAX_LAYERS. */
  addLayer(name = `Layer ${this.#layers.length + 1}`) {
    if (this.#layers.length >= MAX_LAYERS) return null;
    const layer = new Layer(name, this.#width, this.#height, 'transparent');
    const insertAt = this.#activeIndex + 1;
    this.#layers.splice(insertAt, 0, layer);
    this.#activeIndex = insertAt;
    return layer;
  }

  /**
   * Adds a locked reference image layer to the top of the stack, seeded
   * from `pixelData` (a Uint8ClampedArray of RGBA bytes, width*height*4
   * long, matching this stack's own dimensions - callers fit/scale the
   * source image to that size before calling this, see
   * js/image-import.js's fitImageToCanvas). Refuses (returns null,
   * unchanged stack) if a reference image layer already exists (at most
   * one per canvas) or the 8-layer cap is already reached. Does NOT
   * change the active layer - unlike addLayer, a reference layer is
   * never a drawing target, so there's nothing to activate.
   */
  addReferenceImageLayer(pixelData, name = 'Reference') {
    if (this.#layers.length >= MAX_LAYERS) return null;
    if (this.#layers.some((l) => l.isReferenceImage)) return null;
    const layer = new Layer(name, this.#width, this.#height, 'transparent', false, true);
    layer.engine.data.set(pixelData);
    this.#layers.push(layer);
    return layer;
  }

  /**
   * Removes the layer at `index`, refusing if it's the only one. If the
   * removed layer was active, the layer directly below it becomes active
   * (or the new topmost layer, if the removed one was at the bottom).
   */
  deleteLayer(index) {
    if (this.#layers.length <= 1) return false;
    if (index < 0 || index >= this.#layers.length) return false;

    const wasActive = index === this.#activeIndex;
    this.#layers.splice(index, 1);

    if (wasActive) {
      this.#activeIndex = index > 0 ? index - 1 : this.#layers.length - 1;
    } else if (index < this.#activeIndex) {
      this.#activeIndex -= 1;
    }
    return true;
  }

  moveLayerUp(index) {
    if (index < 0 || index >= this.#layers.length - 1) return false;
    // Refuse if either swapped slot holds a locked layer (Background or
    // reference image) - not just the layer being moved. A swap moves
    // *both* layers, so a regular layer swapping into a locked layer's
    // slot would relocate it just as much as moving it directly would.
    if (this.#isLocked(this.#layers[index]) || this.#isLocked(this.#layers[index + 1])) return false;
    this.#swap(index, index + 1);
    return true;
  }

  moveLayerDown(index) {
    if (index <= 0 || index >= this.#layers.length) return false;
    if (this.#isLocked(this.#layers[index]) || this.#isLocked(this.#layers[index - 1])) return false;
    this.#swap(index, index - 1);
    return true;
  }

  #isLocked(layer) {
    return layer.isBackground || layer.isReferenceImage;
  }

  #swap(i, j) {
    [this.#layers[i], this.#layers[j]] = [this.#layers[j], this.#layers[i]];
    if (this.#activeIndex === i) this.#activeIndex = j;
    else if (this.#activeIndex === j) this.#activeIndex = i;
  }

  renameLayer(index, name) {
    const layer = this.#layers[index];
    if (layer) layer.name = name;
  }

  setVisibility(index, visible) {
    const layer = this.#layers[index];
    if (layer) layer.visible = visible;
  }

  setOpacity(index, opacity) {
    const layer = this.#layers[index];
    if (layer) layer.opacity = Math.min(1, Math.max(0, opacity));
  }

  setBlendMode(index, blendMode) {
    const layer = this.#layers[index];
    if (layer && BLEND_MODES.includes(blendMode)) layer.blendMode = blendMode;
  }

  /** Deep-copies current state for the undo stack. */
  snapshot() {
    return {
      layers: this.#layers.map((l) => ({
        id: l.id,
        name: l.name,
        data: l.engine.data.slice(),
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        isBackground: l.isBackground,
        isReferenceImage: l.isReferenceImage,
      })),
      activeIndex: this.#activeIndex,
    };
  }

  /** Restores state previously captured by snapshot(). */
  restore(snapshot) {
    this.#layers = snapshot.layers.map((s) => {
      const layer = new Layer(s.name, this.#width, this.#height, 'transparent', s.isBackground, s.isReferenceImage);
      layer.id = s.id;
      layer.engine.data.set(s.data);
      layer.visible = s.visible;
      layer.opacity = s.opacity;
      layer.blendMode = s.blendMode;
      return layer;
    });
    this.#activeIndex = snapshot.activeIndex;
  }

  /**
   * Plain-object representation suitable for storage (e.g. Dexie/IndexedDB):
   * each layer's pixel data becomes a standalone ArrayBuffer copy, not a
   * live typed-array view. No id/thumbnail/timestamps here - persistence.js
   * owns those.
   */
  toProjectRecord() {
    return {
      width: this.#width,
      height: this.#height,
      layers: this.#layers.map((l) => ({
        id: l.id,
        name: l.name,
        data: l.engine.data.slice().buffer,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        isBackground: l.isBackground,
        isReferenceImage: l.isReferenceImage,
      })),
      activeLayerIndex: this.#activeIndex,
    };
  }

  /**
   * Reconstructs a full LayerStack from a record produced by
   * toProjectRecord(). `isBackground`/`isReferenceImage` default falsy
   * (`s.isBackground`/`s.isReferenceImage` read `undefined`) for records
   * saved before those fields existed - see design.md's Migration/Risk
   * note: an old project's starting layer simply behaves as a regular
   * layer, not retroactively upgraded.
   */
  static fromProjectRecord(record) {
    const stack = new LayerStack(record.width, record.height, 'transparent');
    stack.#layers = record.layers.map((s) => {
      const layer = new Layer(s.name, record.width, record.height, 'transparent', !!s.isBackground, !!s.isReferenceImage);
      layer.id = s.id;
      layer.engine.data.set(new Uint8ClampedArray(s.data));
      layer.visible = s.visible;
      layer.opacity = s.opacity;
      layer.blendMode = s.blendMode;
      return layer;
    });
    stack.#activeIndex = record.activeLayerIndex;
    return stack;
  }

  /**
   * Changes canvas dimensions, anchored at the top-left corner, applied to
   * every layer: shrinking crops content beyond the new bounds; growing
   * pads the new area transparently.
   */
  resize(width, height) {
    const copyWidth = Math.min(this.#width, width);
    const copyHeight = Math.min(this.#height, height);

    this.#layers = this.#layers.map((l) => {
      const newLayer = new Layer(l.name, width, height, 'transparent', l.isBackground, l.isReferenceImage);
      newLayer.id = l.id;
      newLayer.visible = l.visible;
      newLayer.opacity = l.opacity;
      newLayer.blendMode = l.blendMode;
      for (let y = 0; y < copyHeight; y++) {
        for (let x = 0; x < copyWidth; x++) {
          newLayer.engine.setPixel(x, y, l.engine.getPixel(x, y));
        }
      }
      return newLayer;
    });
    this.#width = width;
    this.#height = height;
  }

  /**
   * Rotates every layer 90 degrees clockwise ('cw') or counter-clockwise
   * ('ccw'). Width and height swap when the canvas isn't square.
   */
  rotate90(direction) {
    const oldWidth = this.#width;
    const oldHeight = this.#height;
    const newWidth = oldHeight;
    const newHeight = oldWidth;

    this.#layers = this.#layers.map((l) => {
      const newLayer = new Layer(l.name, newWidth, newHeight, 'transparent', l.isBackground, l.isReferenceImage);
      newLayer.id = l.id;
      newLayer.visible = l.visible;
      newLayer.opacity = l.opacity;
      newLayer.blendMode = l.blendMode;
      for (let y = 0; y < oldHeight; y++) {
        for (let x = 0; x < oldWidth; x++) {
          const color = l.engine.getPixel(x, y);
          const [nx, ny] =
            direction === 'cw' ? [oldHeight - 1 - y, x] : [y, oldWidth - 1 - x];
          newLayer.engine.setPixel(nx, ny, color);
        }
      }
      return newLayer;
    });
    this.#width = newWidth;
    this.#height = newHeight;
  }

  /**
   * Composites all visible layers bottom-to-top onto an offscreen canvas
   * using native globalAlpha/globalCompositeOperation, and returns that
   * canvas. Requires a DOM, like PixelEngine.toPNGBlob().
   *
   * `skipBackground` (Export's "Transparent background" override) omits
   * any layer with `isBackground: true` from compositing entirely, as if
   * it were hidden - see the `export` capability spec for why this drops
   * the whole layer rather than just its fill color.
   *
   * `excludeReferenceImage` (reference-image-layer) omits any layer with
   * `isReferenceImage: true`, unconditionally whenever the caller passes
   * it - unlike `skipBackground`, this isn't an opt-in toggle's value,
   * it's forced true by every export call site (toPNGBlob) and left
   * false by on-screen rendering (composite()), so a visible reference
   * layer still shows on-screen but never reaches an exported file. See
   * the `export` capability spec's exclusion requirement.
   */
  #compositeToCanvas({ skipBackground = false, excludeReferenceImage = false } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = this.#width;
    canvas.height = this.#height;
    const ctx = canvas.getContext('2d');

    for (const layer of this.#layers) {
      if (!layer.visible) continue;
      if (skipBackground && layer.isBackground) continue;
      if (excludeReferenceImage && layer.isReferenceImage) continue;

      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = this.#width;
      layerCanvas.height = this.#height;
      const imageData = new ImageData(
        new Uint8ClampedArray(layer.engine.data),
        this.#width,
        this.#height
      );
      layerCanvas.getContext('2d').putImageData(imageData, 0, 0);

      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = BLEND_MODE_TO_COMPOSITE_OP[layer.blendMode] ?? 'source-over';
      ctx.drawImage(layerCanvas, 0, 0);
    }
    return canvas;
  }

  /** The composited result as ImageData, for live rendering. */
  composite() {
    const canvas = this.#compositeToCanvas();
    return canvas.getContext('2d').getImageData(0, 0, this.#width, this.#height);
  }

  /**
   * The composited result as an image Blob.
   *
   * `scale` (default 1) upscales the composited image via a second
   * offscreen canvas with image smoothing disabled, so each source pixel
   * becomes a sharp-edged scale×scale block - no blending at pixel
   * boundaries. `skipBackground` (default false) is passed straight
   * through to #compositeToCanvas() - see its doc comment. `format`
   * (default 'png') selects PNG, WebP, or JPG; JPG has no alpha channel,
   * so it's flattened onto an opaque white backdrop before encoding
   * instead of leaving transparent pixels to the browser's default
   * (black). Calling with no arguments reproduces the exact
   * native-resolution PNG, Background-included output this method
   * always produced. A reference image layer (reference-image-layer), if
   * present, is always excluded here regardless of its own visibility -
   * this isn't one of the caller-supplied options, it's unconditional on
   * every call, since export is the one place that guide layer must
   * never appear.
   *
   * Note this exclusion is unconditional on toPNGBlob itself, not just
   * the Export popover's call site - so gallery/project thumbnails
   * (js/workspace.js's autoSave, js/new-canvas.js), which also call
   * toPNGBlob with no options, never show the reference layer either.
   * Deliberate: a thumbnail is a preview of the finished artwork, closer
   * in spirit to an export than to the live on-screen canvas, so this is
   * the more useful default even though the `export` capability spec
   * only constrains actual downloaded files.
   */
  toPNGBlob({ skipBackground = false, scale = 1, format = 'png' } = {}) {
    let canvas = this.#compositeToCanvas({ skipBackground, excludeReferenceImage: true });
    const needsWhiteFlatten = format === 'jpg';
    if (scale > 1 || needsWhiteFlatten) {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = this.#width * scale;
      outCanvas.height = this.#height * scale;
      const ctx = outCanvas.getContext('2d');
      if (needsWhiteFlatten) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
      canvas = outCanvas;
    }
    const mimeType = MIME_TYPES[format] ?? MIME_TYPES.png;
    // The quality argument is ignored by the lossless PNG encoder, so
    // passing it unconditionally is harmless - simpler than branching.
    return new Promise((resolve) => canvas.toBlob(resolve, mimeType, LOSSY_QUALITY));
  }
}
