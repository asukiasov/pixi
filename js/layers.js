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

class Layer {
  constructor(name, width, height, background = 'transparent') {
    this.id = crypto.randomUUID();
    this.name = name;
    this.engine = new PixelEngine(width, height, background);
    this.visible = true;
    this.opacity = 1;
    this.blendMode = 'normal';
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
    this.#layers = [new Layer('Layer 1', width, height, background)];
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

  setActiveLayer(index) {
    if (index < 0 || index >= this.#layers.length) return;
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
    this.#swap(index, index + 1);
    return true;
  }

  moveLayerDown(index) {
    if (index <= 0 || index >= this.#layers.length) return false;
    this.#swap(index, index - 1);
    return true;
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
      })),
      activeIndex: this.#activeIndex,
    };
  }

  /** Restores state previously captured by snapshot(). */
  restore(snapshot) {
    this.#layers = snapshot.layers.map((s) => {
      const layer = new Layer(s.name, this.#width, this.#height, 'transparent');
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
      })),
      activeLayerIndex: this.#activeIndex,
    };
  }

  /** Reconstructs a full LayerStack from a record produced by toProjectRecord(). */
  static fromProjectRecord(record) {
    const stack = new LayerStack(record.width, record.height, 'transparent');
    stack.#layers = record.layers.map((s) => {
      const layer = new Layer(s.name, record.width, record.height, 'transparent');
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
      const newLayer = new Layer(l.name, width, height, 'transparent');
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
      const newLayer = new Layer(l.name, newWidth, newHeight, 'transparent');
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
   */
  #compositeToCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = this.#width;
    canvas.height = this.#height;
    const ctx = canvas.getContext('2d');

    for (const layer of this.#layers) {
      if (!layer.visible) continue;

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

  /** The composited result as a PNG Blob, at native resolution. */
  toPNGBlob() {
    const canvas = this.#compositeToCanvas();
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }
}
