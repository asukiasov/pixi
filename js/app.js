import { initNewCanvasScreen } from './new-canvas.js';
import { initWorkspace } from './workspace.js';
import { CanvasView } from './canvas-view.js';
import { initGallery } from './gallery.js';
import { loadProject } from './persistence.js';
import { LayerStack } from './layers.js';

const screens = {
  gallery: document.getElementById('screen-gallery'),
  newCanvas: document.getElementById('screen-new-canvas'),
  workspace: document.getElementById('screen-workspace'),
};

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

// Reused across every project opened/created in a session, rather than
// recreated per project — see workspace.js for why (avoids re-binding
// DOM/pointer listeners).
let canvasView = null;

function openWorkspace({ layerStack, projectId, projectName }) {
  const canvasEl = document.getElementById('workspace-canvas');
  const containerEl = document.getElementById('workspace-canvas-container');

  showScreen('workspace');

  if (!canvasView) {
    canvasView = new CanvasView(canvasEl, containerEl, layerStack);
    canvasView.resetView();
    canvasView.render();
  } else {
    canvasView.setLayerStack(layerStack);
  }

  initWorkspace({
    projectId,
    projectName,
    layerStack,
    canvasView,
    onRequestGallery: () => {
      showScreen('gallery');
      gallery.refresh();
    },
  });
}

const gallery = initGallery({
  onNewCanvas: () => showScreen('newCanvas'),
  async onOpenProject(id) {
    const record = await loadProject(id);
    const layerStack = LayerStack.fromProjectRecord(record);
    openWorkspace({ layerStack, projectId: id, projectName: record.name });
  },
});

initNewCanvasScreen({
  onCanvasCreated({ layerStack, projectId, projectName }) {
    openWorkspace({ layerStack, projectId, projectName });
  },
});

showScreen('gallery');
gallery.refresh();
