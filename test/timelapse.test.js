import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TimelapseRecorder } from '../js/timelapse.js';

// TimelapseRecorder is deliberately DOM-free (see js/timelapse.js's doc
// comment) so its buffer bookkeeping is unit-testable under plain Node -
// `addFrame` is fed plain resolved promises here rather than real
// canvas.toBlob() Blobs, standing in for whatever captureFrame() would
// have produced.

describe('TimelapseRecorder', () => {
  test('starts inactive with an empty buffer', () => {
    const recorder = new TimelapseRecorder();
    assert.equal(recorder.isRecording, false);
    assert.equal(recorder.frameCount, 0);
  });

  test('start() activates recording and resets the buffer', () => {
    const recorder = new TimelapseRecorder();
    recorder.start();
    assert.equal(recorder.isRecording, true);
    assert.equal(recorder.frameCount, 0);
  });

  test('addFrame() is a no-op while not recording', () => {
    const recorder = new TimelapseRecorder();
    recorder.addFrame(Promise.resolve('frame'));
    assert.equal(recorder.frameCount, 0);
  });

  test('addFrame() appends while recording', () => {
    const recorder = new TimelapseRecorder();
    recorder.start();
    recorder.addFrame(Promise.resolve('a'));
    recorder.addFrame(Promise.resolve('b'));
    assert.equal(recorder.frameCount, 2);
  });

  test('stop() ends capture without discarding the buffer', () => {
    const recorder = new TimelapseRecorder();
    recorder.start();
    recorder.addFrame(Promise.resolve('a'));
    recorder.stop();
    assert.equal(recorder.isRecording, false);
    assert.equal(recorder.frameCount, 1);
    recorder.addFrame(Promise.resolve('b'));
    assert.equal(recorder.frameCount, 1, 'addFrame after stop() is a no-op');
  });

  test('clear() empties the buffer', () => {
    const recorder = new TimelapseRecorder();
    recorder.start();
    recorder.addFrame(Promise.resolve('a'));
    recorder.clear();
    assert.equal(recorder.frameCount, 0);
  });

  test('recording past 20 frames is not capped (unlike UndoStack)', () => {
    const recorder = new TimelapseRecorder();
    recorder.start();
    for (let i = 0; i < 25; i++) recorder.addFrame(Promise.resolve(i));
    assert.equal(recorder.frameCount, 25);
  });

  test('getFrames() resolves to frames in commit order, regardless of resolution order', async () => {
    const recorder = new TimelapseRecorder();
    recorder.start();
    // Deliberately resolve out of call order (3rd frame resolves first) -
    // getFrames() must still return them in the order addFrame() was
    // called, not resolution order.
    let resolveSecond;
    const second = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    recorder.addFrame(Promise.resolve('first'));
    recorder.addFrame(second);
    recorder.addFrame(Promise.resolve('third'));

    const framesPromise = recorder.getFrames();
    resolveSecond('second');
    const frames = await framesPromise;
    assert.deepEqual(frames, ['first', 'second', 'third']);
  });

  test('getFrames() resolves to an empty array when nothing was captured', async () => {
    const recorder = new TimelapseRecorder();
    const frames = await recorder.getFrames();
    assert.deepEqual(frames, []);
  });
});
