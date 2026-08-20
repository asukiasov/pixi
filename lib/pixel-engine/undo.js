// Undo/redo stack of full buffer snapshots. Opaque to what a "snapshot" is —
// callers push whatever they want restored (e.g. a copy of the engine's
// pixel buffer) after each completed stroke or fill, not per-pixel.

const MAX_SNAPSHOTS = 20;

export class UndoStack {
  #snapshots = [];
  #pointer = -1; // index into #snapshots of the current state, -1 = none yet

  canUndo() {
    return this.#pointer > 0;
  }

  canRedo() {
    return this.#pointer < this.#snapshots.length - 1;
  }

  size() {
    return this.#snapshots.length;
  }

  /**
   * Commits a new snapshot as the current state. If the pointer isn't at
   * the top of the stack (i.e. the caller previously undid one or more
   * actions), every snapshot ahead of it is discarded first — otherwise a
   * stale future state could resurface after undo -> draw -> redo.
   */
  push(snapshot) {
    if (this.#pointer < this.#snapshots.length - 1) {
      this.#snapshots.length = this.#pointer + 1;
    }
    this.#snapshots.push(snapshot);
    if (this.#snapshots.length > MAX_SNAPSHOTS) {
      this.#snapshots.shift();
    }
    this.#pointer = this.#snapshots.length - 1;
  }

  /** Moves the pointer back one step and returns that snapshot, or undefined. */
  undo() {
    if (!this.canUndo()) return undefined;
    this.#pointer -= 1;
    return this.#snapshots[this.#pointer];
  }

  /** Moves the pointer forward one step and returns that snapshot, or undefined. */
  redo() {
    if (!this.canRedo()) return undefined;
    this.#pointer += 1;
    return this.#snapshots[this.#pointer];
  }
}
