import { LayerStack } from './layers.js';
import { createProject } from './persistence.js';

const PRESETS = [16, 32, 64, 128];
const MIN_SIZE = 1;
const MAX_SIZE = 256;

function clampSize(value) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
}

/**
 * Wires up the New Canvas screen: size presets + custom size, background
 * choice, and a Create button that allocates a LayerStack (one starting
 * layer at the chosen background), immediately persists it as a project
 * record (before any drawing happens), and hands
 * `{ layerStack, projectId }` to `onCanvasCreated`.
 */
export function initNewCanvasScreen({ onCanvasCreated }) {
  const presetButtons = document.querySelectorAll('#size-presets .preset-button');
  const customWidthInput = document.getElementById('custom-width');
  const customHeightInput = document.getElementById('custom-height');
  const backgroundRadios = document.querySelectorAll('input[name="background"]');
  const createButton = document.getElementById('create-canvas-button');

  let selectedPreset = 32;

  presetButtons.forEach((button) => {
    if (Number(button.dataset.size) === selectedPreset) button.classList.add('active');
    button.addEventListener('click', () => {
      selectedPreset = Number(button.dataset.size);
      presetButtons.forEach((b) => b.classList.toggle('active', b === button));
      customWidthInput.value = '';
      customHeightInput.value = '';
    });
  });

  function currentBackground() {
    return [...backgroundRadios].find((r) => r.checked)?.value ?? 'transparent';
  }

  createButton.addEventListener('click', async () => {
    const customWidth = customWidthInput.value ? Number(customWidthInput.value) : null;
    const customHeight = customHeightInput.value ? Number(customHeightInput.value) : null;

    const width = clampSize(customWidth ?? selectedPreset);
    const height = clampSize(customHeight ?? selectedPreset);
    const background = currentBackground();

    const layerStack = new LayerStack(width, height, background);
    const thumbnail = await layerStack.toPNGBlob();
    const record = await createProject(layerStack, undefined, thumbnail);
    onCanvasCreated({ layerStack, projectId: record.id });
  });
}
