import { listProjects, deleteProject } from './persistence.js';
import { confirmDialog } from './confirm-dialog.js';

/**
 * Wires the Gallery screen: project grid, "+ New Canvas", open, and
 * delete-with-confirm. Bind once; call the returned `refresh()` whenever
 * the Gallery becomes visible, since the project list can have changed
 * elsewhere (a new project created, an existing one auto-saved).
 */
export function initGallery({ onOpenProject, onNewCanvas }) {
  const grid = document.getElementById('gallery-grid');
  const emptyState = document.getElementById('gallery-empty-state');
  const newButton = document.getElementById('gallery-new-canvas-button');

  newButton.addEventListener('click', () => onNewCanvas());
  bindPawParadeEasterEgg();

  async function refresh() {
    const projects = await listProjects();
    grid.innerHTML = '';
    emptyState.classList.toggle('hidden', projects.length > 0);
    for (const project of projects) {
      grid.appendChild(buildProjectTile(project, onOpenProject, refresh));
    }
  }

  return { refresh };
}

const PAW_PARADE_CLICKS = 7; // rapid clicks on the "Pixi" title required
const PAW_PARADE_WINDOW_MS = 2000; // ...within this window, or the count resets
const PAW_PARADE_LENGTH = 10; // paw prints in the trail

/**
 * Easter egg: clicking the Gallery's "Pixi" title 7 times within 2
 * seconds sends a trail of paw prints walking across the screen - a nod
 * to the Hand tool's paw cursors (assets/cursors/pets*.svg). Purely
 * decorative, no state, self-removing.
 */
function bindPawParadeEasterEgg() {
  const title = document.querySelector('.gallery-header h1');
  if (!title) return;
  let clickCount = 0;
  let windowStart = 0;

  title.addEventListener('click', () => {
    const now = Date.now();
    if (now - windowStart > PAW_PARADE_WINDOW_MS) {
      clickCount = 0;
      windowStart = now;
    }
    clickCount++;
    if (clickCount >= PAW_PARADE_CLICKS) {
      clickCount = 0;
      pawParade();
    }
  });
}

function pawParade() {
  const trail = document.createElement('div');
  trail.className = 'paw-parade';
  document.body.appendChild(trail);
  for (let i = 0; i < PAW_PARADE_LENGTH; i++) {
    const paw = document.createElement('span');
    paw.className = 'paw-print';
    paw.textContent = '🐾';
    paw.style.left = `${(i / (PAW_PARADE_LENGTH - 1)) * 90 + 5}%`;
    paw.style.setProperty('--paw-offset', i % 2 === 0 ? '-10px' : '10px');
    paw.style.animationDelay = `${i * 0.12}s`;
    trail.appendChild(paw);
  }
  // Long enough for the slowest-delayed paw's animation to finish (see
  // .paw-print's 0.6s animation + up to ~1.1s of staggered delay).
  setTimeout(() => trail.remove(), 2200);
}

function buildProjectTile(project, onOpenProject, refresh) {
  const tile = document.createElement('div');
  tile.className = 'gallery-tile';
  tile.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    onOpenProject(project.id);
  });

  const img = document.createElement('img');
  img.className = 'gallery-thumbnail';
  if (project.thumbnail) {
    // Not revoked: thumbnails are tiny and the grid only rebuilds on
    // Gallery visits, not continuously — an accepted simplification for
    // this slice rather than tracked/cleaned-up object URLs.
    img.src = URL.createObjectURL(project.thumbnail);
  }

  const name = document.createElement('div');
  name.className = 'gallery-tile-name';
  name.textContent = project.name;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'gallery-tile-delete';
  deleteButton.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  deleteButton.title = 'Delete project';
  deleteButton.setAttribute('aria-label', 'Delete project');
  deleteButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const proceed = await confirmDialog({
      title: 'Delete project?',
      message: `Delete "${project.name}"? This can't be undone.`,
    });
    if (!proceed) return;
    await deleteProject(project.id);
    refresh();
  });

  tile.append(img, name, deleteButton);
  return tile;
}
