## Context

`js/workspace.js`'s `commit()` is the single point that pushes a snapshot
onto `state.undoStack` (`js/undo.js`, capped at 20, session-only, no
persistence) after every completed stroke/fill/etc. Frame capture for
recording hooks the same point but writes to an independent, uncapped
buffer instead — see proposal.md for why the undo stack itself can't be
reused. `layerStack.composite()` (`js/layers.js`) already produces the
composited `ImageData` used for rendering and for the Eyedropper tool —
the natural source for a captured frame's pixel content.

## Goals / Non-Goals

**Goals:**
- Capture one frame per commit while recording, with no dependency on or
  interference with the existing undo stack's cap.
- Encode and download entirely client-side, no backend, matching the
  stack constraint confirmed with the user.

**Non-Goals:**
- Real-time/streaming encoding while drawing (frames may be buffered as
  raw `ImageData` and encoded only at Save time — see Decisions).
- Any in-canvas playback/scrubbing UI or ability to edit/trim frames
  before saving (proposal.md excludes both explicitly).
- Cross-session persistence of a recording.

## Decisions

- **Buffer raw frames, encode once at Save time — not a live
  `MediaRecorder` stream during drawing.** Capturing a `canvas.
  captureStream()` + `MediaRecorder` recording live, for the whole
  drawing session, would encode long idle gaps between strokes as
  static video (wasteful, and wrong for a "timelapse" - real time-lapses
  compress idle time away). Instead: buffer each frame's `ImageData` (or
  a `Blob` from `canvas.toBlob()` per frame, to bound memory - see Risks)
  as it's captured, then at Save time draw each buffered frame onto an
  offscreen canvas in sequence, feeding a fresh `captureStream()` +
  `MediaRecorder` at the chosen playback speed (e.g. N frames/second
  regardless of how much real time separated the original commits) —
  this is what makes it read as a timelapse rather than a real-time
  screen capture.
  - Alternative considered: record a live `MediaRecorder` stream for the
    session and speed it up afterward (video-level time compression).
    Rejected — still encodes idle time as data that then has to be
    edited out, and doing that edit client-side without a timeline UI
    (a declared non-goal) is awkward; per-frame buffering sidesteps it
    entirely since idle time between commits simply isn't captured.
- **Store frames as compressed `Blob`s (`canvas.toBlob('image/png')`),
  not raw `ImageData`.** At Pixi's max canvas size (128×128) raw RGBA
  `ImageData` is 64KB/frame uncompressed; a long recording session could
  reach hundreds of frames. PNG-compressed blobs are dramatically smaller
  for typical pixel-art content (large flat color regions) and canvas
  `toBlob` is already used elsewhere in the codebase for export, so no
  new encoding dependency.
- **WebM output via `MediaRecorder`, no format choice exposed.** Browser
  `MediaRecorder` support for canvas streams is WebM-only in the engines
  Pixi already targets; unlike image Export's PNG/WebP/JPG choice, this
  isn't a meaningful user-facing decision, so the review popover offers
  no format selector — keeps the popover simpler than `#export-panel`.

## Risks / Trade-offs

- [Long recording sessions accumulate many frame blobs in memory, with no
  cap] → acceptable for a first pass given the confirmed session-only,
  in-memory scope; if this proves an issue in practice, a frame-count
  warning or cap is a natural follow-up, not required by this change's
  spec.
- [Frame timestamps aren't literal real elapsed time (see the "buffer
  raw frames" decision) — a session with long pauses between strokes and
  one drawn in a rapid burst produce visually similar videos] → intended
  behavior for a timelapse, not a bug; if literal real-time playback is
  ever wanted, that's a different, larger feature (would need per-frame
  duration weighting), not this change.

## Open Questions

None — the encoding approach above resolves the design-level ambiguity;
exact playback-speed default/range is small enough to leave to
implementation without changing the spec.
