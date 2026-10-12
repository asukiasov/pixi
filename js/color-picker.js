// Procreate-style colour picker panels inside #color-picker-popover: Disc
// (hue ring around a saturation/brightness square), Classic (a large
// saturation/brightness square with a hue slider), Value (H/S/B sliders;
// the R/G/B and hex fields are wired in js/workspace.js), Palettes (every
// Color Library palette), the current/previous colour pair and the history
// row. js/workspace.js owns opening/closing and which colour is edited;
// it calls open()/update() and gets picks back through `setColor`. Maths
// in js/color-math.js.

import { rgbToHsv, hsvToRgb, ringHue, squareSV, pushHistory } from './color-math.js';

const TAB_KEY = 'pixi-color-picker-tab';
const HISTORY_KEY = 'pixi-color-history';
const HISTORY_MAX = 10;
const DISC_SIZE = 232; // CSS px, the disc canvas is square
const RING_WIDTH = 22;
const CLASSIC_HEIGHT = 168;

const toHex = (rgba) => '#' + rgba.slice(0, 3).map((c) => c.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Per-device convenience only.
  }
}

/** Sizes a canvas's backing store to its CSS size times the device pixel ratio; returns a context drawing in CSS px. */
function prepareCanvas(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/** Saturation left to right, brightness bottom to top, at `hue`. */
function paintSquare(ctx, x, y, width, height, hue) {
  ctx.fillStyle = toHex(hsvToRgb({ h: hue, s: 1, v: 1 }));
  ctx.fillRect(x, y, width, height);
  const white = ctx.createLinearGradient(x, 0, x + width, 0);
  white.addColorStop(0, '#fff');
  white.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = white;
  ctx.fillRect(x, y, width, height);
  const black = ctx.createLinearGradient(0, y, 0, y + height);
  black.addColorStop(0, 'rgb(0 0 0 / 0)');
  black.addColorStop(1, '#000');
  ctx.fillStyle = black;
  ctx.fillRect(x, y, width, height);
}

/** A ring marker: white over dark, readable on any colour. */
function paintMarker(ctx, x, y, radius = 7) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgb(0 0 0 / 0.55)';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}

/**
 * @param {{
 *   root?: ParentNode,
 *   setColor: (rgba: number[]) => void,
 *   getPalettes: () => { name: string, colors: string[] }[],
 * }} options
 * @returns {{ open(rgba: number[]): void, update(rgba: number[]): void, close(): void } | null}
 */
export function initColorPicker({ root = document, setColor, getPalettes }) {
  const popover = root.querySelector('#color-picker-popover');
  const disc = root.querySelector('#color-disc');
  if (!popover || !disc) return null; // embeds keep the plain picker
  const classic = root.querySelector('#color-classic-square');
  const classicHue = root.querySelector('#color-classic-hue');
  const tabs = [...popover.querySelectorAll('[role="tab"]')];
  const panels = [...popover.querySelectorAll('[role="tabpanel"]')];
  const valueInputs = [...popover.querySelectorAll('.color-value-row input')];
  const previousButton = root.querySelector('#color-picker-previous');
  const currentSwatch = root.querySelector('#color-picker-current');
  const historyEl = root.querySelector('#color-picker-history');
  const palettesEl = root.querySelector('#color-picker-palettes');

  let hsv = { h: 0, s: 0, v: 0 };
  let previousHex = '#000000';
  let openedHex = '#000000';
  let history = readStorage(HISTORY_KEY, []);
  if (!Array.isArray(history)) history = [];
  let activeTab = readStorage(TAB_KEY, 'disc');
  if (!tabs.some((t) => t.dataset.panel === activeTab)) activeTab = 'disc';

  // Disc geometry, in CSS px.
  const centre = DISC_SIZE / 2;
  const outerR = centre - 2;
  const innerR = outerR - RING_WIDTH;
  const squareSide = Math.floor((innerR - 6) * Math.SQRT2);
  const squareX = centre - squareSide / 2;

  function currentHex() {
    return toHex(hsvToRgb(hsv));
  }

  function drawDisc() {
    const ctx = prepareCanvas(disc, DISC_SIZE, DISC_SIZE);
    ctx.clearRect(0, 0, DISC_SIZE, DISC_SIZE);
    const ring = ctx.createConicGradient(-Math.PI / 2, centre, centre);
    for (let i = 0; i <= 6; i++) ring.addColorStop(i / 6, toHex(hsvToRgb({ h: i * 60, s: 1, v: 1 })));
    ctx.lineWidth = RING_WIDTH;
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(centre, centre, (outerR + innerR) / 2, 0, Math.PI * 2);
    ctx.stroke();
    paintSquare(ctx, squareX, squareX, squareSide, squareSide, hsv.h);
    const a = ((hsv.h - 90) * Math.PI) / 180;
    paintMarker(ctx, centre + Math.cos(a) * (outerR + innerR) / 2, centre + Math.sin(a) * (outerR + innerR) / 2, 8);
    paintMarker(ctx, squareX + hsv.s * squareSide, squareX + (1 - hsv.v) * squareSide);
  }

  function drawClassic() {
    const width = classic.parentElement.clientWidth || DISC_SIZE;
    const ctx = prepareCanvas(classic, width, CLASSIC_HEIGHT);
    paintSquare(ctx, 0, 0, width, CLASSIC_HEIGHT, hsv.h);
    paintMarker(ctx, hsv.s * width, (1 - hsv.v) * CLASSIC_HEIGHT);
    classicHue.value = String(Math.round(hsv.h) % 360);
  }

  function syncValues() {
    const values = { h: Math.round(hsv.h) % 360, s: Math.round(hsv.s * 100), v: Math.round(hsv.v * 100) };
    for (const input of valueInputs) {
      const value = values[input.dataset.channel];
      input.value = String(value);
      input.nextElementSibling.textContent = input.dataset.channel === 'h' ? `${value}°` : `${value}%`;
    }
  }

  function renderHistory() {
    historyEl.innerHTML = '';
    for (const hex of history) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-picker-history-swatch';
      swatch.style.background = hex;
      swatch.title = hex;
      swatch.setAttribute('aria-label', `Recent color ${hex}`);
      swatch.addEventListener('click', () => pick(fromHex(hex)));
      historyEl.appendChild(swatch);
    }
    if (!history.length) {
      const empty = document.createElement('span');
      empty.className = 'color-picker-history-empty';
      empty.textContent = 'Colors you pick appear here.';
      historyEl.appendChild(empty);
    }
  }

  function renderPalettes() {
    palettesEl.innerHTML = '';
    const sorted = [...getPalettes()].sort((a, b) => a.name.localeCompare(b.name));
    for (const palette of sorted) {
      const section = document.createElement('section');
      section.className = 'color-picker-palette';
      const title = document.createElement('h3');
      title.textContent = palette.name;
      const grid = document.createElement('div');
      grid.className = 'color-picker-palette-grid';
      for (const hex of palette.colors) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-picker-palette-swatch';
        swatch.style.background = hex;
        swatch.title = hex;
        swatch.setAttribute('aria-label', `${palette.name} ${hex}`);
        swatch.addEventListener('click', () => pick(fromHex(hex)));
        grid.appendChild(swatch);
      }
      section.append(title, grid);
      palettesEl.appendChild(section);
    }
  }

  function redraw() {
    currentSwatch.style.background = currentHex();
    if (activeTab === 'disc') drawDisc();
    if (activeTab === 'classic') drawClassic();
    if (activeTab === 'value') syncValues();
  }

  /** A colour from a panel: becomes the edited colour. HSV is kept as given, so hue survives greys. */
  function pickHsv(next) {
    hsv = next;
    redraw();
    setColor(hsvToRgb(hsv));
  }

  function pick(rgba) {
    hsv = rgbToHsv(rgba);
    redraw();
    setColor(rgba);
  }

  function selectTab(name, { focus = false } = {}) {
    activeTab = name;
    writeStorage(TAB_KEY, name);
    for (const tab of tabs) {
      const selected = tab.dataset.panel === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== name;
    if (name === 'palettes') renderPalettes();
    redraw();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.panel));
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + step + tabs.length) % tabs.length;
      selectTab(tabs[next].dataset.panel, { focus: true });
    });
  });

  // Dragging on the disc: whichever part the press started on (ring or
  // square) keeps control until release.
  function bindDrag(canvas, regionAt, apply) {
    let region = null;
    const point = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width, height: rect.height };
    };
    canvas.addEventListener('pointerdown', (e) => {
      region = regionAt(point(e));
      if (!region) return;
      canvas.setPointerCapture?.(e.pointerId);
      apply(region, point(e));
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (region) apply(region, point(e));
    });
    const end = () => {
      region = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  bindDrag(
    disc,
    ({ x, y }) => {
      const r = Math.hypot(x - centre, y - centre);
      if (r >= innerR - 4 && r <= outerR + 4) return 'ring';
      if (x >= squareX - 6 && x <= squareX + squareSide + 6 && y >= squareX - 6 && y <= squareX + squareSide + 6) return 'square';
      return null;
    },
    (region, { x, y }) => {
      if (region === 'ring') pickHsv({ ...hsv, h: ringHue(x - centre, y - centre) });
      else pickHsv({ ...hsv, ...squareSV(x - squareX, y - squareX, squareSide, squareSide) });
    },
  );

  bindDrag(
    classic,
    () => 'square',
    (_, { x, y, width, height }) => pickHsv({ ...hsv, ...squareSV(x, y, width, height) }),
  );

  classicHue.addEventListener('input', () => pickHsv({ ...hsv, h: Number(classicHue.value) }));

  for (const input of valueInputs) {
    input.addEventListener('input', () => {
      const channel = input.dataset.channel;
      const value = Number(input.value);
      pickHsv({ ...hsv, [channel]: channel === 'h' ? value : value / 100 });
    });
  }

  previousButton.addEventListener('click', () => pick(fromHex(previousHex)));

  return {
    /** The picker is opening on `rgba`: it becomes the "previous" colour. */
    open(rgba) {
      hsv = rgbToHsv(rgba);
      previousHex = toHex(rgba);
      openedHex = previousHex;
      previousButton.style.background = previousHex;
      renderHistory();
      selectTab(activeTab);
    },
    /** The edited colour changed elsewhere (hex/RGB fields, swap, Eyedropper). */
    update(rgba) {
      if (toHex(rgba) === currentHex()) return; // our own pick echoing back
      hsv = rgbToHsv(rgba);
      if (!popover.classList.contains('hidden')) redraw();
    },
    /** Closing: a colour that changed while open goes into the history. */
    close() {
      const hex = currentHex();
      if (hex === openedHex) return;
      history = pushHistory(history, hex, HISTORY_MAX);
      writeStorage(HISTORY_KEY, history);
      openedHex = hex;
    },
  };
}
