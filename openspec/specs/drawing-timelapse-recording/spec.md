# drawing-timelapse-recording Specification

## Purpose

Lets a user capture their drawing process as a replayable video, opt-in
and client-side only, for sharing or process proof — separate from and
unbounded by the existing session-only undo/redo snapshot stack.

## Requirements

### Requirement: Record toggle
The Workspace SHALL offer a Record toggle in the top bar. Turning it on
starts a new, empty in-memory recording buffer; turning it off (or
stopping via the review popover) ends capture without discarding the
buffer, opening the review popover.

#### Scenario: Starting a recording
- **WHEN** the user activates the Record toggle
- **THEN** a new recording buffer starts empty and the toggle visibly
  indicates recording is active

#### Scenario: Stopping a recording opens review
- **WHEN** the user deactivates the Record toggle while frames have been
  captured
- **THEN** capture stops and a review popover opens showing playback
  controls and a Save action, with no file downloaded yet

#### Scenario: Stopping with no captured frames
- **WHEN** the user activates then immediately deactivates the Record
  toggle before any commit occurs
- **THEN** the review popover does not open (nothing to review) and the
  toggle returns to its inactive state

### Requirement: Frame capture on commit
While recording is active, the system SHALL append one timestamped frame
(a composited snapshot of the canvas at that point) to the recording
buffer at every point the Workspace already commits a change (the same
commit points that push an undo snapshot). Frame capture SHALL NOT be
limited by the undo stack's 20-snapshot cap — the recording buffer is
independent and grows for the duration of the recording.

#### Scenario: Each committed stroke becomes a frame
- **WHEN** recording is active and the user completes a Pencil stroke
- **THEN** exactly one new frame reflecting the canvas after that stroke
  is appended to the recording buffer

#### Scenario: Recording outlasts the undo cap
- **WHEN** recording is active and the user commits more than 20 changes
  in a row
- **THEN** the recording buffer still contains a frame for every commit
  made while recording was active, even though the undo stack itself has
  discarded snapshots beyond its 20-entry cap

### Requirement: Client-side video export
The review popover SHALL offer playback speed and a Save action that
encodes the captured frames into a video file entirely client-side (no
network request to a backend) and downloads it, the same
download-a-file interaction as the existing image Export popover.

#### Scenario: Saving a recording downloads a video file
- **WHEN** the user clicks Save in the review popover
- **THEN** a video file containing the recorded frames, played back at
  the chosen speed, downloads to the user's device without any network
  request being made

### Requirement: Recording state is session-only
Recording buffer contents and on/off state SHALL NOT persist across a
page reload or navigation away from the Workspace — matching the existing
session-only pattern of other Workspace toggles (e.g. pixel-perfect
mode).

#### Scenario: Reloading discards an in-progress recording
- **WHEN** the user is recording (or has stopped but not yet saved) and
  reloads the page
- **THEN** the recording buffer is gone and Record starts back in its
  inactive, empty state on the reloaded page
