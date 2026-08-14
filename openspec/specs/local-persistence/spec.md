# local-persistence Specification

## Purpose

Makes a canvas a durable project by saving it to the browser's IndexedDB
automatically, so closing the tab or reloading never loses work.

## Requirements

### Requirement: Project record
Every canvas SHALL be represented as a project record: an id, a name,
width/height, an ordered list of layers (each with its pixel data, name,
visibility, opacity, and blend mode), a thumbnail, and createdAt/updatedAt
timestamps.

#### Scenario: Project created alongside a new canvas
- **WHEN** the user creates a new canvas
- **THEN** a project record for it exists in IndexedDB immediately, before
  any drawing happens

### Requirement: Auto-save on every committed action
The system SHALL save the current project to IndexedDB after every
committed action (the same granularity as the undo stack: a completed
stroke, fill, layer change, or canvas resize/rotate), without a manual save
action. Per-pixel/in-progress drawing SHALL NOT trigger a save.

#### Scenario: Closing and reopening after a stroke
- **WHEN** the user completes a stroke and then closes and reopens the tab
- **THEN** the project reflects that stroke when reopened from the Gallery

#### Scenario: Mid-stroke drawing is not saved yet
- **WHEN** the user is mid-drag on a stroke that hasn't been released yet
- **THEN** no save has occurred for that in-progress stroke

### Requirement: Project load
The system SHALL be able to reconstruct a full layer stack (all layers,
their pixel data, and settings) from a saved project record.

#### Scenario: Opening a saved project
- **WHEN** the user opens a project from the Gallery
- **THEN** the Workspace shows every layer exactly as last saved, with the
  same active-layer selection it had when last edited

### Requirement: Project delete
The system SHALL be able to permanently remove a project record from
IndexedDB.

#### Scenario: Deleting a project
- **WHEN** a project is deleted
- **THEN** it no longer exists in IndexedDB and no longer appears in the
  Gallery

### Requirement: Thumbnail kept current
Each auto-save SHALL update the project's thumbnail to reflect the current
composited canvas.

#### Scenario: Thumbnail reflects latest edit
- **WHEN** the user draws a stroke and it auto-saves
- **THEN** the project's thumbnail (as shown in the Gallery) reflects that
  stroke
