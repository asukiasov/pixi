// Ordered layer stack: each layer wraps a PixelEngine buffer plus display
// metadata (visibility/opacity/blend mode). Stack management (add/delete/
// reorder/rename/settings/active-layer tracking, snapshot/restore) is
// DOM-free and unit-testable; compositing needs a <canvas>, like
// PixelEngine.toPNGBlob(), so it isn't.

import { PixelEngine } from './engine.js';

const MAX_LAYERS = 8;
/** Pro extension point (split-pixi-pro-repo): exported so pixi-pro's Layers panel UI can populate its blend-mode select without duplicating this list. */
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay'];
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
    // (reference-image-original-resolution) Only meaningful when
    // isReferenceImage is true. 'pixelated' (default, matches every other
    // layer's implicit "nothing special") fits/downscales the source onto
    // this stack's fixed pixel grid, same as before this field existed -
    // engine.data always holds that fit, regardless of mode (see
    // getRenderPlan's doc comment for why). 'original' additionally
    // renders on-screen (only) at originalSourceBlob's native resolution,
    // via LayerStack.getRenderPlan()/CanvasView - export/thumbnails
    // (toPNGBlob) are unaffected by this field, they always use the
    // engine buffer and always exclude the reference layer either way.
    this.referenceMode = 'pixelated';
    // (reference-image-original-resolution) The original, undecoded
    // upload (a File/Blob) behind an 'original'-mode reference layer -
    // null unless referenceMode is (or was) 'original'. Kept on the Layer
    // itself, not module-scope in workspace.js (unlike the pre-existing
    // referenceImageSourceImage/referenceImageSmoothing pattern for the
    // pixelated fit), because it must survive toProjectRecord/
    // fromProjectRecord - see those methods' doc comments.
    this.originalSourceBlob = null;
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
  /**
   * `referenceMode` ('pixelated', default, or 'original') and
   * `originalSourceBlob` (the original upload, for 'original' mode - see
   * Layer's own doc comment) are optional (reference-image-original-
   * resolution); omitting both reproduces this method's exact prior
   * behavior (a pixelated-only reference layer).
   */
  addReferenceImageLayer(pixelData, name = 'Reference', { referenceMode = 'pixelated', originalSourceBlob = null } = {}) {
    if (this.#layers.length >= MAX_LAYERS) return null;
    if (this.#layers.some((l) => l.isReferenceImage)) return null;
    const layer = new Layer(name, this.#width, this.#height, 'transparent', false, true);
    layer.engine.data.set(pixelData);
    layer.referenceMode = referenceMode;
    layer.originalSourceBlob = originalSourceBlob;
    this.#layers.push(layer);
    return layer;
  }

  /**
   * (reference-image-original-resolution) Switches the reference image
   * layer's rendering mode ('pixelated' or 'original') in place - position,
   * name, opacity, visibility, and pixel data (engine.data - still the
   * pixelated fit either way, see Layer's referenceMode doc comment)
   * untouched. Refuses (returns false, unchanged stack) if there's no
   * reference image layer, or `mode` isn't one of the two valid values.
   */
  setReferenceMode(mode) {
    if (mode !== 'pixelated' && mode !== 'original') return false;
    const layer = this.#layers.find((l) => l.isReferenceImage);
    if (!layer) return false;
    layer.referenceMode = mode;
    return true;
  }

  /**
   * Overwrites the existing reference image layer's pixel data in place,
   * without touching its position, name, or any other layer - used when
   * the "smoothing" toggle changes (js/workspace.js's
   * referenceImageSmoothing) and the source image needs re-fitting at the
   * new setting, the same "re-derive from the stored source, don't
   * re-prompt" pattern the Brush editor's Import uses for W/H changes.
   * `pixelData` is a Uint8ClampedArray already sized to this stack's
   * width*height*4, as from js/image-import.js's fitImageToCanvas.
   * Refuses (returns false, unchanged stack) if there's no reference
   * image layer to update.
   */
  updateReferenceImageData(pixelData) {
    const layer = this.#layers.find((l) => l.isReferenceImage);
    if (!layer) return false;
    layer.engine.data.set(pixelData);
    return true;
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

  /**
   * The reference image layer is freely reorderable (moved up/down like
   * any regular layer) - unlike Background, which must always stay fixed
   * in its slot. Reordering is how the user gets it out from between
   * their drawing layers and the canvas view - see the reference-image-
   * layer follow-up's design.md for why an opacity-based fix was rejected
   * in favor of this. Only Background is position-locked; #isLocked below
   * (still isBackground || isReferenceImage) covers the separate
   * "non-drawable, non-mergeable, non-markable" restrictions, which are
   * unaffected by this and still apply to the reference layer regardless
   * of where it sits.
   */
  moveLayerUp(index) {
    if (index < 0 || index >= this.#layers.length - 1) return false;
    // Refuse if either swapped slot holds a position-locked layer - not
    // just the layer being moved. A swap moves *both* layers, so a
    // regular layer swapping into Background's slot would relocate it
    // just as much as moving it directly would.
    if (this.#isPositionLocked(this.#layers[index]) || this.#isPositionLocked(this.#layers[index + 1])) return false;
    this.#swap(index, index + 1);
    return true;
  }

  moveLayerDown(index) {
    if (index <= 0 || index >= this.#layers.length) return false;
    if (this.#isPositionLocked(this.#layers[index]) || this.#isPositionLocked(this.#layers[index - 1])) return false;
    this.#swap(index, index - 1);
    return true;
  }

  #isPositionLocked(layer) {
    return layer.isBackground;
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

  /**
   * Deep-copies current state for the undo stack. `referenceMode`/
   * `originalSourceBlob` (reference-image-original-resolution) are
   * included - restore() rebuilds fresh Layer instances, so anything not
   * captured here would be silently lost on undo/redo, including the
   * mode itself and (for 'original' mode) the source needed to keep
   * rendering it without a re-upload. `originalSourceBlob` is copied by
   * reference (a Blob is immutable), not cloned - same lightweight
   * treatment as every other non-pixel field here.
   */
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
        referenceMode: l.referenceMode,
        originalSourceBlob: l.originalSourceBlob,
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
      layer.referenceMode = s.referenceMode ?? 'pixelated';
      layer.originalSourceBlob = s.originalSourceBlob ?? null;
      return layer;
    });
    this.#activeIndex = snapshot.activeIndex;
  }

  /**
   * Plain-object representation suitable for storage (e.g. Dexie/IndexedDB):
   * each layer's pixel data becomes a standalone ArrayBuffer copy, not a
   * live typed-array view. No id/thumbnail/timestamps here - persistence.js
   * owns those.
   *
   * `referenceMode`/`originalSourceBlob` (reference-image-original-
   * resolution): `originalSourceBlob` is only ever non-null for a
   * reference layer that has been in 'original' mode, so a Pixelated-mode
   * reference layer (or a project with none) adds no extra stored data
   * beyond what every layer already stores - the field is simply `null`,
   * same footprint as before this field existed. Dexie stores a Blob
   * value directly (no base64/encoding step needed).
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
        referenceMode: l.referenceMode,
        originalSourceBlob: l.originalSourceBlob,
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
   * layer, not retroactively upgraded. `referenceMode` defaults
   * 'pixelated' the same way (reference-image-original-resolution); a
   * missing `originalSourceBlob` defaults null. Reconstructing the stored
   * Blob back into on-screen Original-mode rendering needs no async
   * decode step here - CanvasView derives an object URL from the Blob
   * directly when it renders a 'reference-original' segment (see
   * canvas-view.js), so this stays synchronous.
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
      layer.referenceMode = s.referenceMode ?? 'pixelated';
      layer.originalSourceBlob = s.originalSourceBlob ?? null;
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
      newLayer.referenceMode = l.referenceMode;
      newLayer.originalSourceBlob = l.originalSourceBlob;
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
      newLayer.referenceMode = l.referenceMode;
      newLayer.originalSourceBlob = l.originalSourceBlob;
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
   * Composites the layers at `indices` (bottom-to-top order, as given)
   * onto an offscreen canvas using native globalAlpha/
   * globalCompositeOperation, and returns that canvas. Requires a DOM,
   * like PixelEngine.toPNGBlob(). Hidden layers among `indices` are
   * skipped, same as the full-stack composite - a hidden layer contributes
   * nothing to what's visibly there to merge. Shared by #compositeToCanvas
   * (the full-stack case, for on-screen rendering/export) and
   * mergeLayers() (an arbitrary subset, for the Merge layers operation) so
   * both have exactly one compositing implementation.
   */
  #compositeSubset(indices) {
    const canvas = document.createElement('canvas');
    canvas.width = this.#width;
    canvas.height = this.#height;
    const ctx = canvas.getContext('2d');

    for (const i of indices) {
      const layer = this.#layers[i];
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

  /**
   * Composites all layers bottom-to-top, applying `skipBackground`
   * (Export's "Transparent background" override, which omits any layer
   * with `isBackground: true` from compositing entirely, as if it were
   * hidden - see the `export` capability spec for why this drops the
   * whole layer rather than just its fill color) and `excludeReferenceImage`
   * (reference-image-layer, which omits any layer with `isReferenceImage:
   * true`, unconditionally whenever the caller passes it - unlike
   * `skipBackground`, this isn't an opt-in toggle's value, it's forced
   * true by every export call site (toPNGBlob) and left false by
   * on-screen rendering (composite()), so a visible reference layer still
   * shows on-screen but never reaches an exported file - see the `export`
   * capability spec's exclusion requirement) before delegating to
   * #compositeSubset for the actual pixel work.
   */
  #compositeToCanvas({ skipBackground = false, excludeReferenceImage = false } = {}) {
    const indices = this.#layers
      .map((_, i) => i)
      .filter((i) => !(skipBackground && this.#layers[i].isBackground))
      .filter((i) => !(excludeReferenceImage && this.#layers[i].isReferenceImage));
    return this.#compositeSubset(indices);
  }

  /**
   * Merges the layers at `indices` (2 or more, none the Background layer)
   * into one new layer: composites their pixel content - honoring each
   * layer's own opacity/blend mode, via the same #compositeSubset path
   * used for on-screen rendering/export - then removes the source layers
   * and inserts the merged layer at the bottom-most source position. The
   * merged layer takes the name of the topmost (highest-index) source
   * layer, and always uses blend mode 'normal' at 100% opacity, since the
   * source layers' own opacity/blend mode is already baked into its
   * pixels. Becomes the active layer. Returns false (no-op) if fewer than
   * 2 distinct valid indices are given, any index is out of range, or any
   * refers to the Background layer.
   *
   * A hidden layer among `indices` contributes nothing to the merged
   * result (see #compositeSubset's `!layer.visible` skip) - same as it
   * already contributes nothing to the on-screen composite. Its pixel
   * content is still discarded from the stack once merged, recoverable
   * only via Undo, so marking a hidden layer for merge is a deliberate
   * "what you see is what gets merged" choice, not an oversight.
   */
  mergeLayers(indices) {
    if (!Array.isArray(indices)) return false;
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    if (sorted.length < 2) return false;
    const inRange = sorted.every((i) => Number.isInteger(i) && i >= 0 && i < this.#layers.length);
    if (!inRange) return false;
    if (sorted.some((i) => this.#isLocked(this.#layers[i]))) return false;

    const bottomIndex = sorted[0];
    const topIndex = sorted[sorted.length - 1];
    const name = this.#layers[topIndex].name;

    const composited = this.#compositeSubset(sorted);
    const imageData = composited.getContext('2d').getImageData(0, 0, this.#width, this.#height);
    const mergedLayer = new Layer(name, this.#width, this.#height, 'transparent');
    mergedLayer.engine.data.set(imageData.data);

    // Remove highest index first so earlier splices don't shift the
    // remaining indices out from under this loop.
    for (let k = sorted.length - 1; k >= 0; k--) {
      this.#layers.splice(sorted[k], 1);
    }
    this.#layers.splice(bottomIndex, 0, mergedLayer);
    this.#activeIndex = bottomIndex;
    return true;
  }

  /**
   * Merges the layer at `index` into the layer directly below it (Photoshop's
   * merge-down), via mergeLayers([index - 1, index]) - so the naming/blend
   * mode/opacity rules match exactly (the higher index, i.e. the layer being
   * merged down, wins the name). Refuses (no-op, returns false) when `index`
   * is the bottom-most layer (nothing below), out of range, the stack has
   * only one layer, or either layer in the pair is locked (Background or
   * reference image).
   */
  mergeDown(index) {
    if (!Number.isInteger(index) || index <= 0 || index >= this.#layers.length) return false;
    if (this.#isLocked(this.#layers[index]) || this.#isLocked(this.#layers[index - 1])) return false;
    return this.mergeLayers([index - 1, index]);
  }

  /** The composited result as ImageData, for live rendering. */
  composite() {
    const canvas = this.#compositeToCanvas();
    return canvas.getContext('2d').getImageData(0, 0, this.#width, this.#height);
  }

  /**
   * (reference-image-original-resolution) On-screen render instructions
   * for CanvasView, as an ordered (bottom-to-top) array of segments:
   * `{ type: 'raster', imageData }` (a same-size composited chunk of the
   * stack, exactly like composite()'s output) or `{ type:
   * 'reference-original', layer }` (the reference image layer, in
   * 'original' mode, to be rendered at its own native resolution instead
   * of through the fixed-size pixel buffer - see canvas-view.js).
   *
   * When there is no reference layer, or it's in 'pixelated' mode, or
   * it's hidden, this returns the same single-segment output composite()
   * always has (`[{ type: 'raster', imageData: <everything> }]`) - so a
   * canvas with no Original-mode reference layer renders exactly as
   * before this method existed. Only a *visible*, 'original'-mode
   * reference layer splits the plan: the raster is composited in two
   * pieces (the layers below the reference's stack index, and the layers
   * above it - either half omitted if empty), with a 'reference-original'
   * segment sandwiched between them, so on-screen stacking order matches
   * the Layers panel exactly at every reorder position. Reuses
   * #compositeSubset (already used by composite()/mergeLayers()) for both
   * raster pieces - no new compositing math.
   *
   * Distinct from composite()/toPNGBlob(), which are both left completely
   * unchanged by this method and by 'original' mode in general: export
   * and thumbnails never consult getRenderPlan(), so Original-mode
   * content can never leak into them (see design.md's "Export/thumbnail
   * exclusion: unaffected" decision).
   */
  getRenderPlan() {
    const refIndex = this.#layers.findIndex((l) => l.isReferenceImage);
    const refLayer = refIndex === -1 ? null : this.#layers[refIndex];
    // Also requires originalSourceBlob: a corrupted/partially-written
    // record (referenceMode: 'original' but no stored source - the exact
    // case design.md's Risks section names as the engine buffer's reason
    // to exist) must fall through to the single-segment path below, so
    // the layer still renders via its pixelated-fit engine buffer instead
    // of vanishing outright (excluded from both raster halves, with
    // nothing else to paint it).
    const needsSplit = !!refLayer && refLayer.referenceMode === 'original' && refLayer.visible && !!refLayer.originalSourceBlob;

    if (!needsSplit) {
      return [{ type: 'raster', imageData: this.composite() }];
    }

    const allIndices = this.#layers.map((_, i) => i);
    const belowIndices = allIndices.slice(0, refIndex);
    const aboveIndices = allIndices.slice(refIndex + 1);

    const plan = [];
    if (belowIndices.length) {
      const canvas = this.#compositeSubset(belowIndices);
      plan.push({ type: 'raster', imageData: canvas.getContext('2d').getImageData(0, 0, this.#width, this.#height) });
    }
    plan.push({ type: 'reference-original', layer: refLayer });
    if (aboveIndices.length) {
      const canvas = this.#compositeSubset(aboveIndices);
      plan.push({ type: 'raster', imageData: canvas.getContext('2d').getImageData(0, 0, this.#width, this.#height) });
    }
    return plan;
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
