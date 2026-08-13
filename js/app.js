import { initNewCanvasScreen } from './new-canvas.js';
import { initWorkspace } from './workspace.js';
import { CanvasView } from './canvas-view.js';

const screens = {
  newCanvas: document.getElementById('screen-new-canvas'),
  workspace: document.getElementById('screen-workspace'),
};

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

showScreen('newCanvas');

// Reused across every canvas created in a session, rather than recreated per
// canvas — see workspace.js for why (avoids re-binding DOM/pointer listeners).
let canvasView = null;

initNewCanvasScreen({
  onCanvasCreated(engine) {
    const canvasEl = document.getElementById('workspace-canvas');
    const containerEl = document.getElementById('workspace-canvas-container');

    showScreen('workspace');

    if (!canvasView) {
      canvasView = new CanvasView(canvasEl, containerEl, engine);
      canvasView.resetView();
      canvasView.render();
    } else {
      canvasView.setEngine(engine);
    }

    initWorkspace({
      engine,
      canvasView,
      onRequestNewCanvas: () => showScreen('newCanvas'),
    });
  },
});
