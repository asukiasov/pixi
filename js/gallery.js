import { listProjects, deleteProject } from './persistence.js';

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
  deleteButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const proceed = window.confirm(`Delete "${project.name}"? This can't be undone.`);
    if (!proceed) return;
    await deleteProject(project.id);
    refresh();
  });

  tile.append(img, name, deleteButton);
  return tile;
}
