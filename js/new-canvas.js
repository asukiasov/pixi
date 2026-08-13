import { PixelEngine } from './engine.js';

const PRESETS = [16, 32, 64, 128];
const MIN_SIZE = 1;
const MAX_SIZE = 256;

function clampSize(value) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
}

/**
 * Wires up the New Canvas screen: size presets + custom size, background
 * choice, and a Create button that allocates a PixelEngine and hands it to
 * `onCanvasCreated`.
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

  createButton.addEventListener('click', () => {
    const customWidth = customWidthInput.value ? Number(customWidthInput.value) : null;
    const customHeight = customHeightInput.value ? Number(customHeightInput.value) : null;

    const width = clampSize(customWidth ?? selectedPreset);
    const height = clampSize(customHeight ?? selectedPreset);
    const background = currentBackground();

    const engine = new PixelEngine(width, height, background);
    onCanvasCreated(engine);
  });
}
