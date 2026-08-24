// Brush editor "Import from image": wires the #brush-editor-import button
// (index.html, inside #brush-editor-panel) to js/brush-import.js's
// thresholdToGrid via workspace.js's setBrushEditorGrid/getBrushEditorSize.
// Restored from the Standard/Pro split (openspec/changes/archive/2026-08-
// 21-split-pixi-pro-repo) - merged back wired directly (no extension-hook
// indirection) per openspec/changes/merge-pixi-pro-into-standard/
// design.md.
//
// Reset points: since this module owns sourceImage privately (workspace.js
// doesn't know it exists), it adds its own listeners on the same buttons
// workspace.js's own bindBrushEditorOnce listens on (New Brush/open,
// Clear, Cancel, Save) to reset sourceImage - matching every reset point
// the pre-split code had.
//
// Width/height 'change' listeners: this module's init runs from
// workspace.js's bindDomOnce(), on the same #brush-editor-width/
// #brush-editor-height inputs workspace.js's own bindBrushEditorOnce
// listens on - both are wired within the same bindDomOnce() call, this
// one second (see the call order in bindDomOnce), so a naive same-tick
// re-application here would run after Standard's rebuildBrushEditorGrid
// and correctly see the rebuilt (empty) grid. queueMicrotask still defers
// the re-apply until after every synchronous 'change' listener for this
// event has finished, keeping this correct regardless of future
// reordering.

import { setBrushEditorGrid, getBrushEditorSize } from './workspace.js';
import { decodeImageFile, downsampleToImageData } from './image-import.js';
import { hasTransparency } from './image-import-extras.js';
import { thresholdToGrid } from './brush-import.js';

let sourceImage = null;

export function initBrushImport(root = document) {
  const importButton = root.querySelector('#brush-editor-import');
  const importInput = root.querySelector('#brush-editor-import-input');
  const addBrushButton = root.querySelector('#add-brush-button');
  const widthInput = root.querySelector('#brush-editor-width');
  const heightInput = root.querySelector('#brush-editor-height');
  const clearButton = root.querySelector('#brush-editor-clear');
  const cancelButton = root.querySelector('#brush-editor-cancel');
  const saveButton = root.querySelector('#brush-editor-save');

  function applySourceImage() {
    if (!sourceImage) return;
    const { width, height } = getBrushEditorSize();
    const useAlpha = hasTransparency(sourceImage);
    const imageData = downsampleToImageData(sourceImage, width, height);
    setBrushEditorGrid(thresholdToGrid(imageData, width, height, useAlpha));
  }

  importButton.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = ''; // reset first, so picking the same file twice still fires 'change'
    if (!file) return;
    const image = await decodeImageFile(file);
    if (!image) return; // unsupported/corrupt file - fail silently, no crash
    sourceImage = image;
    applySourceImage();
  });

  widthInput.addEventListener('change', () => queueMicrotask(applySourceImage));
  heightInput.addEventListener('change', () => queueMicrotask(applySourceImage));

  addBrushButton?.addEventListener('click', () => {
    sourceImage = null; // fresh editor open forgets any prior import
  });
  clearButton.addEventListener('click', () => {
    sourceImage = null;
  });
  cancelButton.addEventListener('click', () => {
    sourceImage = null;
  });
  saveButton.addEventListener('click', () => {
    sourceImage = null;
  });
}
