// Cut, Copy and Paste for layers (layer-context-menu). The pure helpers
// (crop, match, place) are unit-tested; the in-app record remembers where
// Pixi's own last copy came from, which a PNG on the system clipboard
// can't; the browser wrappers at the bottom are the only code that
// touches navigator.clipboard. js/workspace.js drives all of it.

import { contentBounds } from '../lib/pixel-engine/transform.js';

/**
 * The non-transparent pixels of `source` ({ data, width, height }) inside
 * `rect`, cropped tight, or null if there are none. `rect` is clamped to
 * the canvas first.
 */
export function cropToContent(source, rect) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(source.width, rect.x + rect.width);
  const y1 = Math.min(source.height, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return null;
  const bounds = contentBounds(source, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  if (!bounds) return null;
  const data = new Uint8ClampedArray(bounds.width * bounds.height * 4);
  for (let y = 0; y < bounds.height; y++) {
    const from = ((bounds.y + y) * source.width + bounds.x) * 4;
    data.set(source.data.subarray(from, from + bounds.width * 4), y * bounds.width * 4);
  }
  return { ...bounds, data };
}

/**
 * Whether `decoded` (ImageData-shaped) is Pixi's own last copy coming
 * back from the system clipboard. A PNG round trip through a canvas can
 * shift values by premultiplied-alpha rounding, more so the fainter the
 * pixel: alpha may differ by 1, colour by ceil(255 / alpha), and colour
 * is ignored where alpha is 0.
 */
export function matchesRecord(record, decoded) {
  if (!record || !decoded || record.width !== decoded.width || record.height !== decoded.height) return false;
  const a = record.data;
  const b = decoded.data;
  for (let i = 0; i < a.length; i += 4) {
    const alpha = a[i + 3];
    if (Math.abs(alpha - b[i + 3]) > 1) return false;
    if (alpha === 0) continue;
    const tolerance = Math.ceil(255 / alpha);
    for (let c = 0; c < 3; c++) {
      if (Math.abs(a[i + c] - b[i + c]) > tolerance) return false;
    }
  }
  return true;
}

/** A canvas-sized RGBA buffer with `region` stamped at its x, y; off-canvas parts are dropped. */
export function placeOnCanvas(region, canvasWidth, canvasHeight) {
  const out = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  for (let y = 0; y < region.height; y++) {
    const cy = region.y + y;
    if (cy < 0 || cy >= canvasHeight) continue;
    for (let x = 0; x < region.width; x++) {
      const cx = region.x + x;
      if (cx < 0 || cx >= canvasWidth) continue;
      const from = (y * region.width + x) * 4;
      out.set(region.data.subarray(from, from + 4), (cy * canvasWidth + cx) * 4);
    }
  }
  return out;
}

// Pixi's own last copy: { kind: 'layer' | 'selection', x, y, width,
// height, data } plus name/opacity/blendMode for 'layer', and
// onSystemClipboard once the PNG write settles. Memory only, so after a
// reload every paste counts as coming from another app.
let record = null;

/**
 * The record to paste when the clipboard gave no image, or null. A copy
 * that reached the system clipboard is stale once the clipboard holds
 * something else (text, say), so it's only used when it never got there
 * (no ClipboardItem, write refused) or the clipboard can't be read at
 * all (`canReadClipboard` false).
 */
export function recordFallback(current, canReadClipboard) {
  if (!current) return null;
  return current.onSystemClipboard === true && canReadClipboard ? null : current;
}

export function setRecord(next) {
  record = next;
}

export function getRecord() {
  return record;
}

/** A PNG of an RGBA region ({ width, height, data }). */
export function regionToPngBlob(region) {
  const canvas = document.createElement('canvas');
  canvas.width = region.width;
  canvas.height = region.height;
  canvas.getContext('2d').putImageData(new ImageData(region.data, region.width, region.height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

/**
 * Writes a PNG (a Blob, or a Promise of one) to the system clipboard.
 * Call it synchronously from the click or keydown handler: the write
 * starts before the first await, and Safari accepts a promise inside
 * ClipboardItem, so the encode can finish after the gesture without
 * losing it. Resolves false when the API is missing or the write fails.
 */
export async function writeImage(blobOrPromise) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobOrPromise })]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first image on the system clipboard, or null (no image, no API,
 * refused, or Safari's Paste bubble dismissed). For the menu's Paste;
 * Cmd/Ctrl+V reads the paste event instead (imageFromPasteEvent).
 */
export async function readImage() {
  if (!navigator.clipboard?.read) return null;
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return await item.getType(type);
    }
  } catch {
    // Refused or dismissed - same as an empty clipboard.
  }
  return null;
}

/** The first image file in a `paste` event, or null. */
export function imageFromPasteEvent(e) {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
  }
  return null;
}

/** A decoded image's pixels at 1:1. */
export function imageToImageData(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height);
}
