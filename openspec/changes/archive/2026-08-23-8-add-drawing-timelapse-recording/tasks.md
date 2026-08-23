## 1. Frame capture

- [x] 1.1 Add a recording buffer module (e.g. `js/timelapse.js`) with
      start/stop/append-frame/clear operations, independent of
      `js/undo.js`'s `UndoStack`.
- [x] 1.2 Hook `js/workspace.js`'s `commit()` to append a frame (via
      `layerStack.composite()` → `canvas.toBlob('image/png')`, per
      design.md) to the recording buffer whenever recording is active.
- [x] 1.3 Confirm frame capture does not touch or get limited by
      `state.undoStack`'s 20-entry cap.

## 2. Record toggle and review popover

- [x] 2.1 Add the Record toggle to the top bar in `index.html`, near
      Export.
- [x] 2.2 Wire toggle on/off to start/stop the recording buffer in
      `js/workspace.js`; stopping with a non-empty buffer opens the
      review popover, stopping with an empty buffer does not (per spec).
- [x] 2.3 Build the review popover (structurally similar to
      `#export-panel`) with a playback-speed control and Save action.
- [x] 2.4 Style the toggle and popover in `css/*` (`style.css`, this
      repo's single stylesheet), consistent with `#export-panel`'s
      pattern.

## 3. Client-side encoding and export

- [x] 3.1 Implement Save: draw each buffered frame blob onto an offscreen
      canvas in sequence at the chosen playback speed, feeding a
      `captureStream()` + `MediaRecorder` (WebM output, per design.md).
- [x] 3.2 Trigger the download of the resulting video file on encoding
      completion, same download pattern as `#export-download`.
- [x] 3.3 Clear the recording buffer after a successful save (or on
      review-popover cancel).

## 4. Verification

- [x] 4.1 Serve the app locally and manually verify each spec scenario:
      start/stop recording, one frame per commit, recording past 20
      commits still captures every frame, Save downloads a playable video,
      empty-recording stop doesn't open review, and reload discards an
      in-progress recording.
- [x] 4.2 Confirm no network requests are made during recording or Save
      (client-side-only, per the confirmed scope).
- [x] 4.3 Update `docs/ui-reference.md` with the new toggle/popover's ids
      and behavior once implemented.
