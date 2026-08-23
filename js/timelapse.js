// Timelapse recording (drawing-timelapse-recording): an opt-in, in-memory
// capture of one composited frame per committed drawing action, encoded
// client-side into a downloadable WebM video on demand. Independent of and
// unbounded by lib/pixel-engine/undo.js's 20-entry UndoStack cap - see
// that change's proposal.md for why the undo stack itself can't be reused
// for this (session-only, no persistence, capped history).
//
// TimelapseRecorder itself is deliberately DOM-free (just start/stop/
// append/clear bookkeeping over an array of frame promises) so it's
// unit-testable under plain Node, matching lib/pixel-engine/undo.js's
// split from the DOM-touching parts of this file (captureFrame,
// encodeTimelapseVideo) - the same DOM/non-DOM split lib/pixel-engine/
// layers.js draws between its plain-object stack methods and
// composite()/toPNGBlob().

/**
 * Session-only frame buffer for a timelapse recording. `addFrame` is a
 * no-op while not recording, so call sites (js/workspace.js's commit())
 * can call it unconditionally on every commit without their own
 * if-recording guard.
 */
export class TimelapseRecorder {
  #frames = []; // Promise<Blob>, one per captured frame, in commit order
  #recording = false;

  get isRecording() {
    return this.#recording;
  }

  get frameCount() {
    return this.#frames.length;
  }

  /** Starts a new, empty recording. */
  start() {
    this.#frames = [];
    this.#recording = true;
  }

  /**
   * Stops capture without discarding the buffer - per the spec's "Stopping
   * a recording opens review" scenario, the caller decides what happens to
   * the buffered frames next (open the review popover, or clear() it on
   * cancel/save).
   */
  stop() {
    this.#recording = false;
  }

  /** Discards the buffer entirely - after a successful Save, or when the review popover is cancelled/closed unsaved. */
  clear() {
    this.#frames = [];
  }

  /**
   * Appends one frame to the buffer. `framePromise` is a Promise<Blob>
   * (from captureFrame() below) rather than an already-resolved Blob -
   * pushing the promise itself preserves commit order in the buffer
   * regardless of which frame's async PNG encode happens to finish first;
   * see getFrames().
   */
  addFrame(framePromise) {
    if (!this.#recording) return;
    this.#frames.push(framePromise);
  }

  /** Resolves to the buffered frames as Blobs, in commit order. */
  getFrames() {
    return Promise.all(this.#frames);
  }
}

/**
 * Composites `layerStack`'s current state (js/layers.js's composite() -
 * the same ImageData already used for on-screen rendering, so a captured
 * frame reflects exactly what's visible at that commit, per design.md's
 * Context - not toPNGBlob()'s export path, which always excludes a
 * reference image layer) onto a fresh offscreen canvas and returns a
 * Promise<Blob> of the PNG-encoded result, suitable for
 * TimelapseRecorder.addFrame(). The compositing itself (drawImage/
 * putImageData) happens synchronously inside this call, before the
 * returned promise settles - so the frame reflects the canvas exactly as
 * it was at call time, not whatever it happens to look like once the PNG
 * encode finishes.
 */
export function captureFrame(layerStack) {
  const imageData = layerStack.composite();
  const canvas = document.createElement('canvas');
  canvas.width = layerStack.width;
  canvas.height = layerStack.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Whether this browser can encode a timelapse at all - MediaRecorder with
 * canvas captureStream() support. Checked once by callers (e.g. to hide/
 * disable the Record toggle) rather than failing partway through a
 * recording session.
 */
export function isTimelapseSupported() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof document.createElement('canvas').captureStream === 'function'
  );
}

/**
 * Encodes `frames` (PNG Blobs, in playback order) into a WebM video via
 * canvas captureStream() + MediaRecorder - design.md's "buffer raw frames,
 * encode once at Save time" decision, not a live MediaRecorder stream
 * during drawing. Draws each frame onto an offscreen canvas in turn,
 * holding it for 1000/fps ms before advancing to the next - captureStream
 * (fps) samples that canvas at a fixed interval, so holding each frame for
 * one interval's worth of time is what gives the encoded video its
 * per-frame timing, entirely client-side (no network request). Resolves
 * to the encoded video Blob.
 */
export async function encodeTimelapseVideo(frames, { width, height, fps = 8 } = {}) {
  if (!frames.length) {
    throw new Error('encodeTimelapseVideo(): no frames to encode');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // First frame drawn before capture starts, so the recorder's very first
  // sample isn't a blank canvas. Every drawImage call below targets
  // (0, 0, width, height) explicitly rather than a bitmap's own native
  // size - a mid-recording canvas resize/rotate (js/workspace.js's
  // resizeCanvas()/rotateCanvas(), both routed through commit() like any
  // other edit) changes layerStack's dimensions partway through a
  // recording, so earlier-captured frames' PNGs can be a different native
  // size than `width`/`height` (the *final* dimensions, passed by the
  // caller). Scaling every frame to fill the encode canvas keeps the
  // video at one consistent size throughout with no cropped or blank
  // regions, at the cost of stretching frames captured before the
  // change - preferable to either artifact for what should be a rare
  // edge case.
  const bitmaps = await Promise.all(frames.map((blob) => createImageBitmap(blob)));
  ctx.drawImage(bitmaps[0], 0, 0, width, height);

  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.start();

  const frameDurationMs = 1000 / fps;
  for (let i = 1; i < bitmaps.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, frameDurationMs));
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmaps[i], 0, 0, width, height);
  }
  // Hold the final frame on screen for one interval too, so it isn't
  // cut off the instant it's drawn.
  await new Promise((resolve) => setTimeout(resolve, frameDurationMs));

  recorder.stop();
  await stopped;

  return new Blob(chunks, { type: mimeType });
}
