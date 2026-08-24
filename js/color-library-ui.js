// Color Library panel - named, persisted palettes, add-to-palette, import
// from image, ramp generator, and the Color Library sequence toggle
// (Pencil/Brush). Reuses workspace.js's setForegroundColor/hexToRgba/
// rgbaToHex/getColorPickerCurrentColor/bindPanelHeaderCollapse/
// matrixRain/confettiBurst/disableRainbow exports rather than duplicating
// any of that logic. workspace.js calls back into this module's
// getColorSequenceColor/setLibrarySequenceEnabled/
// syncColorLibraryActiveSwatch directly (colorForSequenceIndex, the
// Rainbow swatch handler, syncActiveSwatch) - Color Library is a
// permanent part of the app, not an optional plugin, so there's no hook
// indirection between the two files, just ordinary (circular) ES module
// imports.

import {
  onWorkspaceReset,
  setForegroundColor,
  hexToRgba,
  rgbaToHex,
  getColorPickerCurrentColor,
  bindPanelHeaderCollapse,
  matrixRain,
  confettiBurst,
  disableRainbow,
  syncActiveSwatch,
} from './workspace.js';
import { decodeImageFile, downsampleToImageData } from './image-import.js';
import { confirmDialog } from './confirm-dialog.js';
import {
  createColorPalette,
  listColorPalettes,
  addColorToPalette,
  deleteColorPalette,
} from './persistence.js';
import { extractPalette } from './color-extraction.js';
import { generateColorRamp } from './color-ramp.js';
import { DEFAULT_MATERIAL_COLORS, PREDEFINED_PALETTES } from './default-color-library.js';

// Fixed internal sample grid for Color Library image import - purely a
// color-reduction step before median-cut clustering, never shown to the
// user. 64x64 = 4096 sample pixels, plenty to represent an image's color
// distribution regardless of the source image's actual resolution.
const COLOR_IMPORT_SAMPLE_SIZE = 64;
const COLOR_IMPORT_MIN_COUNT = 2;
const COLOR_IMPORT_MAX_COUNT = 32;
const COLOR_IMPORT_DEFAULT_COUNT = 8;

// Color ramp generator - step-count bounds and default, per spec.
const RAMP_MIN_STEPS = 3;
const RAMP_MAX_STEPS = 9;
const RAMP_DEFAULT_STEPS = 5;

/**
 * Named "magic palette" easter eggs: naming a new Color Library palette
 * one of these three words (case-insensitive, matched against the
 * trimmed "New palette" input) seeds it with a themed color set instead
 * of starting empty, plus a little flourish - a confetti burst in the
 * seeded palette's own colors for rainbow/gameboy, or matrixRain's own
 * effect for matrix (see newPaletteSave's listener) - alongside pixi's
 * own Konami code and the Gallery's paw parade as this app's other
 * hidden delighters. Kept small and genuinely gimmicky on purpose -
 * everything else themed lives in PREDEFINED_PALETTES instead, as
 * ordinary always-visible palettes rather than a typed-name trick.
 */
const MAGIC_PALETTES = {
  rainbow: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8b00ff'],
  gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  matrix: ['#003b00', '#008f11', '#00ff41', '#00ff41', '#0d1a0d'],
};

/**
 * Positions `panel` as a popover below `anchorEl`, clamped to the
 * viewport - flips above if it would overflow the bottom, clamped
 * horizontally too. Same unhide-to-measure-then-clamp pattern as
 * export.js/canvas-settings.js's own positionPanel (duplicated rather
 * than shared, matching that codebase's existing per-popover
 * convention).
 */
function positionPanelBelow(panel, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const margin = 8;

  let top = rect.bottom + 8;
  if (top + panelRect.height > window.innerHeight - margin) {
    top = rect.top - panelRect.height - 8;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - panelRect.height - margin));

  let left = rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - panelRect.width - margin));

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

// Named, persisted palettes of user-added colors. Module-level, not
// per-project - like pixi's own allBrushes, a session/global resource,
// loaded once from IndexedDB and refreshed after every mutation.
let colorPalettes = [];
let activePaletteId = null;
let sequenceEnabled = false;
let collapsed = false;

// DOM refs, assigned once in initColorLibrary() - single active
// instance, same module-level-state pattern workspace.js itself uses.
let colorLibraryPanel = null;
let colorLibraryHeader = null;
let colorLibraryGrid = null;
let colorLibrarySelect = null;
let deletePaletteButton = null;
let addCurrentColorButton = null;
let addPaletteButton = null;
let newPaletteRow = null;
let newPaletteName = null;
let newPaletteSave = null;
let newPaletteCancel = null;
let librarySequencePanel = null;
let librarySequenceToggle = null;
let colorPickerAdd = null;
let colorPickerGenerateRamp = null;

function syncColorLibraryCollapse() {
  colorLibraryPanel.classList.toggle('collapsed', collapsed);
  colorLibraryHeader.setAttribute('aria-expanded', String(!collapsed));
}

/**
 * Fetches every palette from IndexedDB. Auto-creates one "Material"
 * palette, seeded with the full Material Design color system, whenever
 * none of the existing palettes is flagged `isDefault` - covers both
 * first-ever load (no palettes at all yet) and recovery for anyone who
 * deleted the default palette before deletion protection existed. The
 * panel should never end up with no populated, undeletable palette to
 * fall back to.
 *
 * First-ever load only also seeds every PREDEFINED_PALETTES entry as
 * an ordinary, deletable palette - unlike Material, these never come
 * back if deleted; they're starter content, not a required fallback.
 */
async function loadColorPalettes() {
  let palettes = await listColorPalettes();
  const isFirstEverLoad = palettes.length === 0;
  if (!palettes.some((p) => p.isDefault)) {
    const defaultPalette = await createColorPalette('Material', [...DEFAULT_MATERIAL_COLORS], true);
    palettes = [...palettes, defaultPalette];
  }
  if (isFirstEverLoad) {
    for (const [name, colors] of Object.entries(PREDEFINED_PALETTES)) {
      const created = await createColorPalette(name, [...colors]);
      palettes = [...palettes, created];
    }
  }
  colorPalettes = palettes;
  if (!colorPalettes.some((p) => p.id === activePaletteId)) {
    activePaletteId = colorPalettes[0].id;
  }
  renderColorLibraryPanel();
}

function renderColorLibraryPanel() {
  const sorted = [...colorPalettes].sort((a, b) => a.name.localeCompare(b.name));

  colorLibrarySelect.innerHTML = '';
  sorted.forEach((palette) => {
    const option = document.createElement('option');
    option.value = palette.id;
    option.textContent = palette.name;
    if (palette.id === activePaletteId) option.selected = true;
    colorLibrarySelect.appendChild(option);
  });
  colorLibrarySelect.classList.toggle('hidden', sorted.length <= 1);

  const active = colorPalettes.find((p) => p.id === activePaletteId);
  colorLibraryGrid.innerHTML = '';
  if (active && active.colors.length > 0) {
    active.colors.forEach((hex) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-library-swatch';
      swatch.style.background = hex;
      swatch.dataset.hex = hex.toLowerCase();
      swatch.title = hex;
      swatch.addEventListener('click', () => setForegroundColor(hexToRgba(hex)));
      colorLibraryGrid.appendChild(swatch);
    });
  } else if (active) {
    const empty = document.createElement('p');
    empty.className = 'color-library-empty';
    empty.textContent = 'No colors yet - add one from the color picker.';
    colorLibraryGrid.appendChild(empty);
  }

  deletePaletteButton.disabled = colorPalettes.length <= 1 || Boolean(active?.isDefault);

  syncActiveSwatch(); // re-derives fgHex/isRainbow from state and calls syncColorLibraryActiveSwatch below
}

async function addCurrentColorToActivePalette(rgba) {
  await addColorToPalette(activePaletteId, rgbaToHex(rgba));
  await loadColorPalettes();
}

/**
 * Called directly by workspace.js's syncActiveSwatch, with the same
 * `(fgHex, isRainbow)` Standard's own palette row uses, so this grid
 * highlights its own active swatch in sync with the palette row.
 */
export function syncColorLibraryActiveSwatch(fgHex, isRainbow) {
  if (!colorLibraryGrid) return; // called before initColorLibrary() has run
  colorLibraryGrid.querySelectorAll('.color-library-swatch').forEach((s) => {
    s.classList.toggle('active', !isRainbow && s.dataset.hex === fgHex);
  });
}

/**
 * Called directly by workspace.js's colorForSequenceIndex. Returns an
 * rgba for the `index`-th placement from the active palette when the
 * Color Library sequence toggle is on, or null to fall through to the
 * plain foreground color.
 */
export function getColorSequenceColor(index) {
  if (!sequenceEnabled) return null;
  const active = colorPalettes.find((p) => p.id === activePaletteId);
  const colors = active?.colors ?? [];
  if (colors.length === 0) return null;
  return hexToRgba(colors[index % colors.length]);
}

/**
 * Color Library sequence toggle - one shared control for Pencil and
 * Brush. Mutually exclusive with Rainbow (both are per-pixel
 * color-cycling modes for the same applyPixel slot): selecting Rainbow
 * calls this directly with `false` (workspace.js's rainbow-swatch
 * handler); this toggle calls workspace.js's disableRainbow() directly
 * the other way.
 */
export function setLibrarySequenceEnabled(enabled) {
  sequenceEnabled = enabled;
  if (enabled) disableRainbow();
  librarySequenceToggle.classList.toggle('active', enabled);
}

export function initColorLibrary(root = document) {
  colorLibraryPanel = root.querySelector('#color-library-panel');
  colorLibraryHeader = root.querySelector('#color-library-header');
  colorLibraryGrid = root.querySelector('#color-library-grid');
  colorLibrarySelect = root.querySelector('#color-library-select');
  deletePaletteButton = root.querySelector('#delete-palette-button');
  addCurrentColorButton = root.querySelector('#add-current-color-button');
  addPaletteButton = root.querySelector('#add-palette-button');
  newPaletteRow = root.querySelector('#new-palette-row');
  newPaletteName = root.querySelector('#new-palette-name');
  newPaletteSave = root.querySelector('#new-palette-save');
  newPaletteCancel = root.querySelector('#new-palette-cancel');
  librarySequencePanel = root.querySelector('#library-sequence-options');
  librarySequenceToggle = root.querySelector('#library-sequence-toggle');
  colorPickerAdd = root.querySelector('#color-picker-add');
  colorPickerGenerateRamp = root.querySelector('#color-picker-generate-ramp');

  syncColorLibraryCollapse();
  bindPanelHeaderCollapse(colorLibraryHeader, () => {
    collapsed = !collapsed;
    syncColorLibraryCollapse();
  });

  colorLibrarySelect.addEventListener('change', () => {
    activePaletteId = colorLibrarySelect.value;
    renderColorLibraryPanel();
  });

  addCurrentColorButton.addEventListener('click', () => {
    addCurrentColorToActivePalette(getColorPickerCurrentColor());
  });

  colorPickerAdd?.addEventListener('click', async () => {
    await addCurrentColorToActivePalette(getColorPickerCurrentColor());
  });

  addPaletteButton.addEventListener('click', () => {
    closeImportPreview(); // mutually exclusive with the import preview row
    newPaletteName.value = '';
    newPaletteRow.classList.remove('hidden');
    newPaletteName.focus();
  });

  newPaletteCancel.addEventListener('click', () => {
    newPaletteRow.classList.add('hidden');
  });

  newPaletteSave.addEventListener('click', async () => {
    const name = newPaletteName.value.trim();
    if (!name) return; // nothing entered - no-op, stay open
    const magicName = name.toLowerCase();
    const magicColors = MAGIC_PALETTES[magicName];
    const created = await createColorPalette(name, magicColors ? [...magicColors] : []);
    activePaletteId = created.id;
    newPaletteRow.classList.add('hidden');
    await loadColorPalettes();
    if (magicColors) {
      if (magicName === 'matrix') {
        matrixRain();
      } else {
        const gridRect = colorLibraryGrid.getBoundingClientRect();
        confettiBurst(gridRect.left + gridRect.width / 2, gridRect.top, 24, 160);
      }
    }
  });

  deletePaletteButton.addEventListener('click', async () => {
    if (colorPalettes.length <= 1) return; // can't delete the only palette
    const active = colorPalettes.find((p) => p.id === activePaletteId);
    if (active?.isDefault) return; // can't delete the built-in default palette
    const proceed = await confirmDialog({
      title: 'Delete palette?',
      message: `Delete "${active?.name ?? 'this palette'}" and all its colors? This can't be undone.`,
    });
    if (!proceed) return;
    await deleteColorPalette(activePaletteId);
    activePaletteId = null; // loadColorPalettes falls back to the first remaining
    await loadColorPalettes();
  });

  // Import palette from image: file picker -> decode -> downsample once
  // (cached) -> extractPalette on demand, re-run live as the color-count
  // control changes. The preview itself is a popover, not an in-flow
  // row, so the color-count control never shifts as the swatch grid
  // above it gains/loses rows.
  const importPaletteButton = root.querySelector('#import-palette-button');
  const importInput = root.querySelector('#color-library-import-input');
  const importPreviewRow = root.querySelector('#import-preview-row');
  const importPreviewClose = root.querySelector('#import-preview-close');
  const importPreviewGrid = root.querySelector('#import-preview-grid');
  const importPreviewCount = root.querySelector('#import-preview-count');
  const importPreviewName = root.querySelector('#import-preview-name');
  const importPreviewSave = root.querySelector('#import-preview-save');
  const importPreviewCancel = root.querySelector('#import-preview-cancel');
  let importSampleImageData = null;
  let importPreviewColors = [];

  function renderImportPreview() {
    importPreviewGrid.innerHTML = '';
    for (const hex of importPreviewColors) {
      const swatch = document.createElement('div');
      swatch.className = 'color-library-swatch';
      swatch.style.background = hex;
      importPreviewGrid.appendChild(swatch);
    }
  }

  function reExtractImportPreview() {
    if (!importSampleImageData) return;
    const count = Math.min(
      COLOR_IMPORT_MAX_COUNT,
      Math.max(COLOR_IMPORT_MIN_COUNT, Math.round(Number(importPreviewCount.value)) || COLOR_IMPORT_DEFAULT_COUNT)
    );
    importPreviewCount.value = String(count);
    importPreviewColors = extractPalette(importSampleImageData, count);
    renderImportPreview();
  }

  function closeImportPreview() {
    importPreviewRow.classList.add('hidden');
    importSampleImageData = null;
    importPreviewColors = [];
    importInput.value = ''; // allow re-picking the same file
  }

  importPaletteButton.addEventListener('click', () => {
    importInput.click();
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const image = await decodeImageFile(file);
    if (!image) {
      importInput.value = ''; // unsupported/corrupt file - no-op, let the user retry
      return;
    }
    importSampleImageData = downsampleToImageData(image, COLOR_IMPORT_SAMPLE_SIZE, COLOR_IMPORT_SAMPLE_SIZE);
    importPreviewCount.value = String(COLOR_IMPORT_DEFAULT_COUNT);
    importPreviewName.value = '';
    newPaletteRow.classList.add('hidden'); // mutually exclusive with the plain "+ New Palette" row
    importPreviewRow.classList.remove('hidden');
    positionPanelBelow(importPreviewRow, importPaletteButton);
    reExtractImportPreview();
  });

  importPreviewCount.addEventListener('change', reExtractImportPreview);
  importPreviewCount.addEventListener('input', reExtractImportPreview);

  importPreviewClose.addEventListener('click', closeImportPreview);

  document.addEventListener('pointerdown', (e) => {
    if (importPreviewRow.classList.contains('hidden')) return;
    if (importPreviewRow.contains(e.target)) return;
    if (e.target === importPaletteButton || importPaletteButton.contains(e.target)) return;
    closeImportPreview();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !importPreviewRow.classList.contains('hidden')) closeImportPreview();
  });

  importPreviewCancel.addEventListener('click', () => {
    closeImportPreview();
  });

  importPreviewSave.addEventListener('click', async () => {
    const name = importPreviewName.value.trim();
    if (!name) return; // nothing entered - no-op, stay open
    const created = await createColorPalette(name, [...importPreviewColors]);
    activePaletteId = created.id;
    closeImportPreview();
    await loadColorPalettes();
  });

  // Generate ramp: a source color (whichever swatch the color-picker
  // popover is editing, or the current Foreground color from the Color
  // Library header) + step count -> generateColorRamp -> live preview ->
  // Confirm adds every generated color to the active palette, same
  // "extract, preview, then save" shape as the import-palette flow above.
  const rampPreviewRow = root.querySelector('#ramp-preview-row');
  const rampPreviewClose = root.querySelector('#ramp-preview-close');
  const rampPreviewGrid = root.querySelector('#ramp-preview-grid');
  const rampPreviewSteps = root.querySelector('#ramp-preview-steps');
  const rampPreviewConfirm = root.querySelector('#ramp-preview-confirm');
  const rampPreviewCancel = root.querySelector('#ramp-preview-cancel');
  const libraryGenerateRampButton = root.querySelector('#library-generate-ramp-button');
  let rampSourceHex = null;
  let rampPreviewColors = [];
  let rampAnchorEl = null;

  function renderRampPreview() {
    rampPreviewGrid.innerHTML = '';
    for (const hex of rampPreviewColors) {
      const swatch = document.createElement('div');
      swatch.className = 'color-library-swatch';
      swatch.style.background = hex;
      rampPreviewGrid.appendChild(swatch);
    }
  }

  function regenerateRampPreview() {
    if (!rampSourceHex) return;
    const steps = Math.min(
      RAMP_MAX_STEPS,
      Math.max(RAMP_MIN_STEPS, Math.round(Number(rampPreviewSteps.value)) || RAMP_DEFAULT_STEPS)
    );
    rampPreviewSteps.value = String(steps);
    rampPreviewColors = generateColorRamp(rampSourceHex, steps);
    renderRampPreview();
  }

  function closeRampPreview() {
    rampPreviewRow.classList.add('hidden');
    rampSourceHex = null;
    rampPreviewColors = [];
    rampAnchorEl = null;
  }

  function openRampPreview(rgba, anchorEl) {
    closeImportPreview(); // mutually exclusive with the other Color Library popovers
    rampSourceHex = rgbaToHex(rgba);
    rampAnchorEl = anchorEl;
    rampPreviewSteps.value = String(RAMP_DEFAULT_STEPS);
    rampPreviewRow.classList.remove('hidden');
    positionPanelBelow(rampPreviewRow, anchorEl);
    regenerateRampPreview();
  }

  colorPickerGenerateRamp?.addEventListener('click', () => {
    openRampPreview(getColorPickerCurrentColor(), colorPickerGenerateRamp);
  });

  libraryGenerateRampButton.addEventListener('click', () => {
    openRampPreview(getColorPickerCurrentColor(), libraryGenerateRampButton);
  });

  rampPreviewSteps.addEventListener('change', regenerateRampPreview);
  rampPreviewSteps.addEventListener('input', regenerateRampPreview);

  rampPreviewClose.addEventListener('click', closeRampPreview);
  rampPreviewCancel.addEventListener('click', closeRampPreview);

  rampPreviewConfirm.addEventListener('click', async () => {
    for (const hex of rampPreviewColors) {
      await addColorToPalette(activePaletteId, hex);
    }
    closeRampPreview();
    await loadColorPalettes();
  });

  document.addEventListener('pointerdown', (e) => {
    if (rampPreviewRow.classList.contains('hidden')) return;
    if (rampPreviewRow.contains(e.target)) return;
    if (rampAnchorEl && (e.target === rampAnchorEl || rampAnchorEl.contains(e.target))) return;
    closeRampPreview();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !rampPreviewRow.classList.contains('hidden')) closeRampPreview();
  });

  librarySequenceToggle.addEventListener('click', () => {
    setLibrarySequenceEnabled(!sequenceEnabled);
  });

  root.querySelectorAll('.tool-button[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      const visible = button.dataset.tool === 'pencil' || button.dataset.tool === 'brush';
      librarySequencePanel.classList.toggle('hidden', !visible);
    });
  });

  // Palettes are loaded once, the first time a project actually opens -
  // not eagerly at module-init (page load, before any workspace/project
  // exists) - mirroring pixi's own bindDomOnce "once ever" semantics for
  // this same call in the pre-split code. state (and so
  // renderColorLibraryPanel's read of the current foreground color)
  // doesn't exist yet at page load.
  let paletteLoaded = false;

  onWorkspaceReset(async () => {
    if (!paletteLoaded) {
      paletteLoaded = true;
      await loadColorPalettes(); // async; renders the panel once palettes arrive
    }
    collapsed = false;
    syncColorLibraryCollapse();
    setLibrarySequenceEnabled(false);
    librarySequencePanel.classList.remove('hidden'); // Pencil is the default tool
    closeImportPreview();
    closeRampPreview();
  });
}
