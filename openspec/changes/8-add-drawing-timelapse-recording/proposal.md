## Why

Procreate's signature export is a replayable video of the whole drawing
process, not just the final image — widely used for tutorials, social
sharing, and process proof. Pixi has no equivalent today.

Note: Pixi's existing undo/redo stack (`js/undo.js`) is a session-only
ring buffer capped at 20 full-canvas snapshots, discarded on reload — it
cannot be replayed into a timelapse (not enough history, and gone after a
page refresh). This proposal is scoped around a dedicated, opt-in live
capture instead, confirmed with the user as passive recording/export only
(no new animation-authoring or playback UI in the canvas) and encoded
entirely client-side, keeping it clear of the declared animation-timeline
non-goal and the static-site/no-custom-backend stack constraint.

## What Changes

- Add a "Record" toggle to the Workspace (top bar, near Export). While on,
  every committed change (the same commit points that already push an
  undo snapshot, per `js/workspace.js`'s `commit()`) also appends a
  timestamped frame — a composited canvas snapshot — to an in-memory
  recording buffer, independent of and unbounded by the 20-entry undo
  stack.
- Stopping recording opens a review popover (structurally similar to
  `#export-panel`) with playback speed/duration controls and a "Save
  video" action.
- Saving encodes the captured frames into a video client-side (canvas
  `captureStream()` + `MediaRecorder`, WebM output — no server involved)
  and downloads the result, the same download-a-file interaction as
  today's PNG/WebP/JPG export.
- Recording state (buffered frames, on/off) is session-only: reloading the
  page or navigating away from the Workspace discards an in-progress
  recording, same as other session-only Workspace state (pixel-perfect
  mode, etc.) — no new persisted data model, no IndexedDB schema change.
- Explicitly not in scope: editing/trimming captured frames, an in-canvas
  playback/scrubbing UI, or persisting a recording across a reload — all
  would start to resemble the declared animation-timeline non-goal and
  are left out.

## Capabilities

### New Capabilities
- `drawing-timelapse-recording`: opt-in live capture of drawing frames
  and client-side export to a video file.

### Modified Capabilities
(none — `export`'s existing image-export requirements are unchanged; this
adds a separate, video-specific export path rather than altering PNG/
WebP/JPG export)

## Impact

- `js/workspace.js`: hook into `commit()` to append a frame when
  recording is active; new record-toggle state and stop/review flow.
- New module (e.g. `js/timelapse.js`): frame buffer management and
  `MediaRecorder`-based encoding.
- `index.html`: new Record toggle in the top bar, new review popover.
- `css/*`: styling for the toggle and popover, consistent with
  `#export-panel`.
- No persistence/schema changes (session-only recording buffer).
