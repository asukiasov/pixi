# embeddable-editor-api Specification

## Purpose

Lets a host application embed a Pixi editor instance inside its own page —
mounted into an element it owns, fed image data it owns, and read back
without depending on Pixi's own UI chrome — by downloading/vendoring the
repo's source into that application.

## Requirements

### Requirement: Mount into a host element
The system SHALL provide a function that mounts a Pixi editor instance
into a host-supplied DOM element and returns a handle to that instance,
without requiring the host page to be Pixi's own `index.html`.

#### Scenario: Mounting into an existing page
- **WHEN** a host application calls the mount function with an element it
  already has in its own DOM and no other Pixi markup present
- **THEN** a working editor (canvas, drawing tools) renders inside that
  element and is usable

### Requirement: Unmount releases resources
The mounted instance SHALL provide a way to unmount and release any
canvas, DOM, or event-listener resources it created, leaving the host
element as it was before mounting.

#### Scenario: Unmounting a mounted instance
- **WHEN** the host calls the instance's destroy/unmount method
- **THEN** the editor's DOM nodes and event listeners are removed from the
  host element, and no further editor activity occurs

### Requirement: Load an image into the editor
The mounted instance SHALL accept image data supplied by the host (at
minimum PNG bytes/Blob, and ImageData) and render it as the editing
surface's starting content, without the host needing to use any
in-app Import UI.

#### Scenario: Host supplies an existing PNG
- **WHEN** the host calls the instance's load method with PNG image data
  it already has
- **THEN** the editor displays that image as the current canvas content,
  ready for editing

### Requirement: Read the current image out of the editor
The mounted instance SHALL provide a way to retrieve the current edited
image, in at least PNG and ImageData form, without the host needing to
trigger the UI's Export control.

#### Scenario: Host reads the image after edits
- **WHEN** the host calls the instance's get-image method after the user
  has drawn on the canvas
- **THEN** the returned image data reflects every committed edit made so
  far, in the requested format

### Requirement: Change notifications
The mounted instance SHALL notify the host when the edited image changes,
so the host can react (e.g. enable a Save button) without polling.

#### Scenario: A stroke is committed
- **WHEN** the user completes a drawing action in the mounted editor
- **THEN** the host-registered change handler is invoked

### Requirement: Host controls which UI chrome is shown
The mount function SHALL accept options that let the host suppress
Pixi's own Gallery/navigation chrome and restrict which tools are
available, so the editor can run as a focused single-canvas surface
inside a larger host UI.

#### Scenario: Host hides the Gallery and restricts tools
- **WHEN** the host mounts an instance with Gallery disabled and a
  restricted tool list
- **THEN** the rendered editor shows no Gallery/navigation UI and offers
  only the specified tools
