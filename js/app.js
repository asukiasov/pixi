import { initNewCanvasScreen } from './new-canvas.js';
import { initWorkspace } from './workspace.js';
import { CanvasView } from './canvas-view.js';
import { initGallery } from './gallery.js';
import { loadProject } from './persistence.js';
import { LayerStack } from './layers.js';
import { parseRoute, navigate, onRouteChange } from './router.js';

const screens = {
  gallery: document.getElementById('screen-gallery'),
  newCanvas: document.getElementById('screen-new-canvas'),
  workspace: document.getElementById('screen-workspace'),
};

// Blocks Safari's native pinch-to-zoom of the whole page (bug: pinching
// over the right sidebar on iPad zoomed the entire app UI, not the
// canvas). style.css's `touch-action: pan-x pan-y` on html/body is the
// standards-based fix and is kept, but real iOS Safari has a long
// history of still triggering its native pinch-zoom via `gesturestart`/
// `gesturechange` (a WebKit-proprietary event pair, unrelated to
// touch-action) regardless of that CSS - this listens for those and
// cancels them everywhere. Safe to do unconditionally, including over
// the canvas: canvas-view.js's own pinch-zoom is built entirely from
// raw pointerdown/pointermove events, never gesturestart/gesturechange,
// so it's unaffected. `GestureEvent` doesn't exist outside
// WebKit/Safari, so this is a silent no-op everywhere else.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault());
});

// Flags iOS/iPadOS (including iPadOS 13+, which reports as "MacIntel"
// in the UA string - the maxTouchPoints check distinguishes it from an
// actual Mac) via a class on <html>, so style.css can scope the "Buzz"
// hover effect to it. A CSS media-query approach was tried first
// ((hover: hover) and (pointer: coarse), meant to target a hover-
// capable touchscreen) but Apple Pencil is a *precise* stylus - it
// reports `pointer: fine`, the same as a mouse - so that query excluded
// Pencil hover right along with the desktop mouse hover it was meant to
// exclude, and buzz stopped appearing on iPad entirely. CSS alone can't
// distinguish "a mouse is hovering" from "a Pencil is hovering" (both
// are fine+hover-capable); platform detection is the only way to keep
// buzz iPad-only without also catching desktop mice.
if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.documentElement.classList.add('ios-platform');
}

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

// Reused across every project opened/created in a session, rather than
// recreated per project — see workspace.js for why (avoids re-binding
// DOM/pointer listeners).
let canvasView = null;

// The project ID currently shown in the Workspace, if any. Used by the
// route-change handler to avoid redundantly reopening the project that's
// already on screen (e.g. a hashchange fired by our own `navigate()` call).
let currentWorkspaceProjectId = null;

function openWorkspace({ layerStack, projectId, projectName }) {
  const canvasEl = document.getElementById('workspace-canvas');
  const containerEl = document.getElementById('workspace-canvas-container');

  showScreen('workspace');
  currentWorkspaceProjectId = projectId;

  if (!canvasView) {
    canvasView = new CanvasView(canvasEl, containerEl, layerStack);
    canvasView.resetView();
    canvasView.render();
    // One-shot re-fit after the browser's first real paint: the very first
    // resetView() above can measure the container before web font loading
    // finishes settling the Workspace screen's final layout (seen as a
    // one-step-off Fit Screen/zoom-percent on the very first project
    // opened in a session). A second resetView() next frame corrects it;
    // harmless if nothing shifted, since resetView() is otherwise idempotent
    // for an unchanged container size.
    requestAnimationFrame(() => {
      canvasView.resetView();
      canvasView.render();
    });
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
      currentWorkspaceProjectId = null;
      gallery.refresh();
      navigate({ screen: 'gallery' });
    },
  });
}

/** Loads a project by ID and opens it in the Workspace. */
async function openProjectById(id) {
  const record = await loadProject(id);
  if (!record) {
    return false;
  }
  const layerStack = LayerStack.fromProjectRecord(record);
  openWorkspace({ layerStack, projectId: id, projectName: record.name });
  return true;
}

/** Shows the Gallery screen and refreshes its contents. */
function showGallery() {
  showScreen('gallery');
  currentWorkspaceProjectId = null;
  gallery.refresh();
}

const gallery = initGallery({
  onNewCanvas: () => {
    showScreen('newCanvas');
    navigate({ screen: 'newCanvas' });
  },
  async onOpenProject(id) {
    const opened = await openProjectById(id);
    if (opened) {
      navigate({ screen: 'workspace', projectId: id });
    }
  },
});

initNewCanvasScreen({
  onCanvasCreated({ layerStack, projectId, projectName }) {
    openWorkspace({ layerStack, projectId, projectName });
    navigate({ screen: 'workspace', projectId });
  },
});

// Reacts to Back/Forward (and any other external hash change) by
// re-deriving the visible screen from the URL. This only ever updates
// what's on screen — it must never itself call navigate(), or it would
// fight with the history entry the browser just navigated to.
onRouteChange(async (route) => {
  if (route.screen === 'workspace' && route.projectId) {
    if (route.projectId === currentWorkspaceProjectId) {
      return;
    }
    const opened = await openProjectById(route.projectId);
    if (!opened) {
      // Stale/deleted project ID reached via Back/Forward or a manually
      // edited URL: fall back to the Gallery and clear the bad hash so
      // it doesn't keep bouncing back here.
      showGallery();
      navigate({ screen: 'gallery' }, { replace: true });
    }
    return;
  }
  if (route.screen === 'newCanvas') {
    showScreen('newCanvas');
    return;
  }
  showGallery();
});

// Boot: read the URL first, rather than always defaulting to the Gallery.
async function boot() {
  const route = parseRoute();

  if (route.screen === 'workspace' && route.projectId) {
    const opened = await openProjectById(route.projectId);
    if (opened) {
      return;
    }
    // Unknown/deleted project ID in the URL — fall back to the Gallery
    // and clear the stale hash rather than leaving a dead link in place.
    showGallery();
    navigate({ screen: 'gallery' }, { replace: true });
    return;
  }

  if (route.screen === 'newCanvas') {
    showScreen('newCanvas');
    return;
  }

  showGallery();
}

boot();
