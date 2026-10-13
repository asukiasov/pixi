// Ordered layer stack: each layer wraps a PixelEngine buffer plus display
// metadata (visibility/opacity/blend mode). Stack management (add/delete/
// reorder/rename/settings/active-layer tracking, snapshot/restore) is
// DOM-free and unit-testable; compositing needs a <canvas>, like
// PixelEngine.toPNGBlob(), so it isn't.

import { PixelEngine } from './engine.js';

export const MAX_LAYERS = 8;
/** Exported so js/layers-ui.js's Layers panel can populate its blend-mode select without duplicating this list. */
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay'];
/**
 * A reference image layer's two rendering modes (CFIX-5) - one named
 * source for every comparison/assignment here and in js/layers-ui.js.
 * The string values are what's persisted in saved project records, so
 * they must never change.
 */
export const REFERENCE_MODES = Object.freeze({ PIXELATED: 'pixelated', ORIGINAL: 'original' });
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
    this.referenceMode = REFERENCE_MODES.PIXELATED;
    // (reference-image-original-resolution) The original, undecoded
    // upload (a File/Blob) behind an 'original'-mode reference layer -
    // null unless referenceMode is (or was) 'original'. Kept on the Layer
    // itself, not module-scope in workspace.js (unlike the pre-existing
    // referenceImageSourceImage/referenceImageSmoothing pattern for the
    // pixelated fit), because it must survive toProjectRecord/
    // fromProjectRecord - see those methods' doc comments.
    this.originalSourceBlob = null;
    // The group this layer belongs to (LayerStack's groups), or null.
    // One level only; a group's members are always contiguous.
    this.groupId = null;
    // User-set pixel lock (layer-context-menu): refuses every action that
    // changes this layer's pixels (js/workspace.js's activeLayerEditable,
    // and the merges below). Unlike isBackground/isReferenceImage it
    // leaves reordering and grouping alone.
    this.locked = false;
  }
}

/** Copies the per-layer fields a rebuilt Layer (resize, rotate, restore) keeps. */
function copyLayerFields(from, to) {
  to.id = from.id;
  to.visible = from.visible;
  to.opacity = from.opacity;
  to.blendMode = from.blendMode;
  to.referenceMode = from.referenceMode ?? REFERENCE_MODES.PIXELATED;
  to.originalSourceBlob = from.originalSourceBlob ?? null;
  to.groupId = from.groupId ?? null;
  to.locked = !!from.locked;
}

export class LayerStack {
  #layers; // bottom-to-top order
  // Layer groups (one level), in creation order: { id, name, visible,
  // opacity, collapsed }. Membership lives on each layer's groupId.
  #groups = [];
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
    // Added inside a group (directly above one of its members), it joins it.
    layer.groupId = this.#layers[this.#activeIndex]?.groupId ?? null;
    const insertAt = this.#activeIndex + 1;
    this.#layers.splice(insertAt, 0, layer);
    this.#activeIndex = insertAt;
    return layer;
  }

  /**
   * Copies the layer at `index` (pixels, opacity, blend mode, visibility)
   * into a new layer named "<name> copy" (numbered when taken) directly above it, and makes the
   * copy active. A copy of the Background layer is an ordinary layer.
   * Refused (null, stack unchanged) for the reference image layer, an
   * out-of-range index, or at MAX_LAYERS.
   */
  duplicateLayer(index) {
    const source = this.#layers[index];
    if (!source || source.isReferenceImage || this.#layers.length >= MAX_LAYERS) return null;
    const layer = new Layer(this.#copyName(source.name), this.#width, this.#height, 'transparent');
    layer.engine.data.set(source.engine.data);
    layer.opacity = source.opacity;
    layer.blendMode = source.blendMode;
    layer.visible = source.visible;
    layer.groupId = source.groupId;
    this.#layers.splice(index + 1, 0, layer);
    this.#activeIndex = index + 1;
    return layer;
  }

  /** "<name> copy", then "<name> copy 2", "copy 3"... - never "copy copy". */
  #copyName(sourceName) {
    const base = `${sourceName.replace(/ copy(?: \d+)?$/, '')} copy`;
    const taken = new Set(this.#layers.map((l) => l.name));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
    return name;
  }

  /**
   * Paste's new layer (layer-context-menu): `data` (RGBA, width*height*4)
   * in a layer directly above `index`, in its group, made active. Named
   * `name`, or after `copyOf` the way duplicateLayer names copies.
   * Refused (null) for a bad index or at MAX_LAYERS.
   */
  insertLayerAbove(index, { data, name = 'Pasted', copyOf = null, opacity = 1, blendMode = 'normal' }) {
    const below = this.#layers[index];
    if (!below || this.#layers.length >= MAX_LAYERS) return null;
    const layer = new Layer(copyOf ? this.#copyName(copyOf) : name, this.#width, this.#height, 'transparent');
    layer.engine.data.set(data);
    layer.opacity = opacity;
    layer.blendMode = blendMode;
    layer.groupId = below.groupId;
    this.#layers.splice(index + 1, 0, layer);
    this.#activeIndex = index + 1;
    return layer;
  }

  /** Sets the user pixel lock. Refused (false) for a bad index or the reference layer. */
  setLocked(index, locked) {
    const layer = this.#layers[index];
    if (!layer || layer.isReferenceImage) return false;
    layer.locked = !!locked;
    return true;
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
  addReferenceImageLayer(pixelData, name = 'Reference', { referenceMode = REFERENCE_MODES.PIXELATED, originalSourceBlob = null } = {}) {
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
    if (!Object.values(REFERENCE_MODES).includes(mode)) return false;
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
    this.#dropEmptyGroups();

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
    if (this.#crossGroupEdge(index, index + 1)) return true;
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
    if (this.#crossGroupEdge(index, index - 1)) return true;
    if (index <= 0 || index >= this.#layers.length) return false;
    if (this.#isPositionLocked(this.#layers[index]) || this.#isPositionLocked(this.#layers[index - 1])) return false;
    this.#swap(index, index - 1);
    return true;
  }

  /**
   * Up/Down at a group's edge (Photoshop's rule): a member whose
   * neighbour in that direction isn't in its group leaves the group, and
   * an ungrouped layer whose neighbour is a group member joins it - both
   * without moving. Returns whether it handled the move.
   */
  #crossGroupEdge(index, neighbourIndex) {
    const layer = this.#layers[index];
    if (!layer || this.#isLocked(layer)) return false;
    const neighbour = this.#layers[neighbourIndex];
    if (layer.groupId && neighbour?.groupId !== layer.groupId) {
      layer.groupId = null;
      this.#dropEmptyGroups();
      return true;
    }
    if (!layer.groupId && neighbour?.groupId) {
      layer.groupId = neighbour.groupId;
      return true;
    }
    return false;
  }

  /** Forgets groups with no members left. */
  #dropEmptyGroups() {
    const used = new Set(this.#layers.map((l) => l.groupId).filter(Boolean));
    this.#groups = this.#groups.filter((g) => used.has(g.id));
  }

  /** Every group, in creation order (not stack order). Live objects - change them through the setters. */
  getGroups() {
    return [...this.#groups];
  }

  getGroup(id) {
    return this.#groups.find((g) => g.id === id) ?? null;
  }

  /** Stack indices of a group's members, bottom to top. */
  groupMemberIndices(id) {
    return this.#layers.map((l, i) => (l.groupId === id ? i : -1)).filter((i) => i !== -1);
  }

  /**
   * Puts the layers at `indices` into a new group, gathered in their
   * current order at the topmost one's position. Refused (null) for no
   * layers, an out-of-range index, the Background or reference image
   * layer, or a layer already in a group (groups don't nest). The active
   * layer stays active.
   */
  groupLayers(indices, name) {
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    if (!sorted.length) return null;
    if (!sorted.every((i) => Number.isInteger(i) && this.#layers[i] && !this.#isLocked(this.#layers[i]) && !this.#layers[i].groupId)) return null;
    const active = this.#layers[this.#activeIndex];
    const members = sorted.map((i) => this.#layers[i]);
    for (let k = sorted.length - 1; k >= 0; k--) this.#layers.splice(sorted[k], 1);
    const insertAt = sorted[sorted.length - 1] - (sorted.length - 1);
    this.#layers.splice(insertAt, 0, ...members);
    let n = this.#groups.length + 1;
    while (this.#groups.some((g) => g.name === `Group ${n}`)) n++;
    const group = { id: crypto.randomUUID(), name: name ?? `Group ${n}`, visible: true, opacity: 1, collapsed: false };
    this.#groups.push(group);
    for (const layer of members) layer.groupId = group.id;
    this.#activeIndex = this.#layers.indexOf(active);
    return group;
  }

  /** Dissolves a group; its layers stay where they are. */
  ungroup(id) {
    for (const layer of this.#layers) if (layer.groupId === id) layer.groupId = null;
    this.#groups = this.#groups.filter((g) => g.id !== id);
  }

  renameGroup(id, name) {
    const group = this.getGroup(id);
    if (group) group.name = name;
  }

  setGroupVisibility(id, visible) {
    const group = this.getGroup(id);
    if (group) group.visible = visible;
  }

  setGroupOpacity(id, opacity) {
    const group = this.getGroup(id);
    if (group) group.opacity = Math.min(1, Math.max(0, opacity));
  }

  setGroupCollapsed(id, collapsed) {
    const group = this.getGroup(id);
    if (group) group.collapsed = collapsed;
  }

  /**
   * Deletes a group and its layers. Refused (false) when that would leave
   * no layers. The layer below the group becomes active (or the bottom one).
   */
  deleteGroup(id) {
    const members = this.groupMemberIndices(id);
    if (!members.length || members.length >= this.#layers.length) return false;
    const active = this.#layers[this.#activeIndex];
    this.#layers = this.#layers.filter((l) => l.groupId !== id);
    this.#groups = this.#groups.filter((g) => g.id !== id);
    const stillThere = this.#layers.indexOf(active);
    this.#activeIndex = stillThere !== -1 ? stillThere : Math.max(0, members[0] - 1);
    return true;
  }

  /**
   * Moves a whole group up (+1) or down (-1) past its neighbour - a single
   * layer, or a whole neighbouring group. Refused at the ends of the stack
   * and below the Background layer. The active layer stays active.
   */
  moveGroup(id, direction) {
    const members = this.groupMemberIndices(id);
    if (!members.length) return false;
    const bottom = members[0];
    const top = members[members.length - 1];
    const neighbourIndex = direction > 0 ? top + 1 : bottom - 1;
    const neighbour = this.#layers[neighbourIndex];
    if (!neighbour || this.#isPositionLocked(neighbour)) return false;
    const span = neighbour.groupId ? this.groupMemberIndices(neighbour.groupId).length : 1;
    const active = this.#layers[this.#activeIndex];
    const block = this.#layers.splice(bottom, members.length);
    this.#layers.splice(direction > 0 ? bottom + span : bottom - span, 0, ...block);
    this.#activeIndex = this.#layers.indexOf(active);
    return true;
  }

  /**
   * Drag-and-drop reorder: moves the layer at `fromIndex` so it ends up at
   * `toIndex` (an index into the stack without it), in group `groupId` or
   * none. Refused (false) when it would split a group, join a group away
   * from its members, put a locked layer in a group, or move the
   * Background or anything under it. The active layer stays active.
   */
  moveLayerTo(fromIndex, toIndex, groupId) {
    const layer = this.#layers[fromIndex];
    if (!layer || this.#isPositionLocked(layer)) return false;
    if (groupId && (this.#isLocked(layer) || !this.getGroup(groupId))) return false;
    const rest = this.#layers.filter((l) => l !== layer);
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > rest.length) return false;
    if (toIndex === 0 && rest[0]?.isBackground) return false;
    const below = rest[toIndex - 1];
    const above = rest[toIndex];
    if (groupId ? below?.groupId !== groupId && above?.groupId !== groupId : below?.groupId && below.groupId === above?.groupId) return false;
    const active = this.#layers[this.#activeIndex];
    rest.splice(toIndex, 0, layer);
    this.#layers = rest;
    layer.groupId = groupId ?? null;
    this.#dropEmptyGroups();
    this.#activeIndex = this.#layers.indexOf(active);
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
        groupId: l.groupId,
        locked: l.locked,
      })),
      groups: this.#groups.map((g) => ({ ...g })),
      activeIndex: this.#activeIndex,
    };
  }

  /** Restores state previously captured by snapshot(). */
  restore(snapshot) {
    this.#layers = snapshot.layers.map((s) => {
      const layer = new Layer(s.name, this.#width, this.#height, 'transparent', s.isBackground, s.isReferenceImage);
      copyLayerFields(s, layer);
      layer.engine.data.set(s.data);
      return layer;
    });
    this.#groups = (snapshot.groups ?? []).map((g) => ({ ...g }));
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
        groupId: l.groupId,
        locked: l.locked,
      })),
      groups: this.#groups.map((g) => ({ ...g })),
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
      copyLayerFields(s, layer);
      layer.engine.data.set(new Uint8ClampedArray(s.data));
      return layer;
    });
    // Records from before groups have neither field: no groups.
    stack.#groups = (record.groups ?? []).map((g) => ({ ...g }));
    stack.#dropEmptyGroups();
    stack.#activeIndex = record.activeLayerIndex;
    return stack;
  }

  /**
   * Replaces this stack's entire content with a single regular layer sized
   * to `imageData` (mount API's `instance.loadImage()`,
   * embeddable-integration-api task 3.3) - every existing layer is
   * discarded, unlike resize() which crops/pads each layer in place.
   * loadImage() is the mounted equivalent of opening a new canvas from an
   * existing image (New Canvas's own "start fresh" semantics), not an
   * edit of the current content, so there's nothing to preserve.
   * `imageData` is `{ data, width, height }` - a Uint8ClampedArray of RGBA
   * bytes, width*height*4 long, plus its dimensions - the same shape the
   * DOM `ImageData` type already has, so a caller can pass one directly.
   * The new layer is never flagged `isBackground` (an embedded host's
   * loaded image isn't the "locked white background" starting layer New
   * Canvas creates for a white-background preset - it can be transparent,
   * fully opaque, or anything in between, and should reorder/delete like
   * any other layer).
   *
   * Refuses (throws `RangeError`, stack left unchanged) if `imageData.data`
   * isn't exactly `width * height * 4` bytes long - `engine.data.set()`
   * would otherwise either silently zero-pad a too-short array (a subtly
   * corrupted image, no error at all) or throw an opaque native
   * `RangeError` from deep inside `Uint8ClampedArray.set()` for a
   * too-long one, neither of which points a caller at the actual mistake.
   */
  loadImage(imageData) {
    const expectedLength = imageData.width * imageData.height * 4;
    if (imageData.data.length !== expectedLength) {
      throw new RangeError(
        `LayerStack.loadImage(): imageData.data.length (${imageData.data.length}) must equal width*height*4 (${expectedLength})`
      );
    }
    this.#width = imageData.width;
    this.#height = imageData.height;
    this.#layers = [new Layer('Layer 1', this.#width, this.#height, 'transparent')];
    this.#groups = [];
    this.#layers[0].engine.data.set(imageData.data);
    this.#activeIndex = 0;
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
      copyLayerFields(l, newLayer);
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
      copyLayerFields(l, newLayer);
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
      // A group hides its members, and its opacity multiplies theirs (a
      // simplification of isolated group compositing - it differs only
      // where members overlap inside a half-transparent group).
      const group = layer.groupId ? this.getGroup(layer.groupId) : null;
      if (!layer.visible || (group && !group.visible)) continue;

      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = this.#width;
      layerCanvas.height = this.#height;
      const imageData = new ImageData(
        new Uint8ClampedArray(layer.engine.data),
        this.#width,
        this.#height
      );
      layerCanvas.getContext('2d').putImageData(imageData, 0, 0);

      ctx.globalAlpha = layer.opacity * (group ? group.opacity : 1);
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
   *
   * CFIX-6 (code-standards red-team): requires a DOM (via #compositeSubset,
   * same as toPNGBlob()/composite()) - only the refusal paths (invalid
   * input, out-of-range/locked indices, returning false before
   * #compositeSubset is reached) are unit-testable under plain Node with
   * no DOM shim. See lib/pixel-engine/layers.test.js's mergeLayers
   * describe block for what that split looks like in practice.
   */
  mergeLayers(indices) {
    if (!Array.isArray(indices)) return false;
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    if (sorted.length < 2) return false;
    const inRange = sorted.every((i) => Number.isInteger(i) && i >= 0 && i < this.#layers.length);
    if (!inRange) return false;
    if (sorted.some((i) => this.#isLocked(this.#layers[i]) || this.#layers[i].locked)) return false;

    const bottomIndex = sorted[0];
    const topIndex = sorted[sorted.length - 1];
    const name = this.#layers[topIndex].name;

    const composited = this.#compositeSubset(sorted);
    const imageData = composited.getContext('2d').getImageData(0, 0, this.#width, this.#height);
    const mergedLayer = new Layer(name, this.#width, this.#height, 'transparent');
    mergedLayer.engine.data.set(imageData.data);
    // Stays in the group when every source was in it.
    const groupIds = new Set(sorted.map((i) => this.#layers[i].groupId));
    mergedLayer.groupId = groupIds.size === 1 ? [...groupIds][0] : null;

    // Remove highest index first so earlier splices don't shift the
    // remaining indices out from under this loop.
    for (let k = sorted.length - 1; k >= 0; k--) {
      this.#layers.splice(sorted[k], 1);
    }
    this.#layers.splice(bottomIndex, 0, mergedLayer);
    // Landing between two members of a group (sources from inside and
    // outside it), it joins that group, so groups stay contiguous.
    const below = this.#layers[bottomIndex - 1];
    const above = this.#layers[bottomIndex + 1];
    if (!mergedLayer.groupId && below?.groupId && below.groupId === above?.groupId) mergedLayer.groupId = below.groupId;
    this.#dropEmptyGroups();
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
   *
   * CFIX-6 (code-standards red-team): requires a DOM on the success path -
   * delegates to mergeLayers(), see that method's doc comment.
   */
  mergeDown(index) {
    if (!Number.isInteger(index) || index <= 0 || index >= this.#layers.length) return false;
    const pair = [this.#layers[index], this.#layers[index - 1]];
    if (pair.some((l) => this.#isLocked(l) || l.locked)) return false;
    return this.mergeLayers([index - 1, index]);
  }

  /**
   * The composited result as ImageData, for live rendering. Requires a
   * DOM (via #compositeSubset), like toPNGBlob().
   *
   * `excludeReferenceImage` (6-add-tile-seamless-preview): forwarded to
   * #compositeToCanvas() unchanged - false by default (unlike
   * toPNGBlob(), which always forces it true), matching this method's own
   * pre-existing on-screen-rendering callers, which want a visible
   * 'pixelated'-mode reference layer included exactly as CanvasView's own
   * getRenderPlan()-driven rendering shows it. A caller compositing on
   * behalf of a *different* on-screen surface that doesn't also render a
   * visible 'original'-mode reference layer's separate, native-resolution
   * `<img>` alongside this result (js/canvas-view.js's tile-preview
   * copies, which have no such `<img>` of their own) should pass `true` -
   * otherwise that surface would show the reference layer's low-resolution
   * pixel-buffer content composited in, which appears nowhere else in the
   * app (getRenderPlan() always renders an 'original'-mode reference
   * layer as that separate `<img>` instead, never as part of either
   * raster segment).
   */
  composite({ excludeReferenceImage = false } = {}) {
    const canvas = this.#compositeToCanvas({ excludeReferenceImage });
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
   *
   * CFIX-6 (code-standards red-team): requires a DOM (via composite()/
   * #compositeSubset) on every path, single- or multi-segment alike.
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
    const needsSplit = !!refLayer && refLayer.referenceMode === REFERENCE_MODES.ORIGINAL && refLayer.visible && !!refLayer.originalSourceBlob;

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
