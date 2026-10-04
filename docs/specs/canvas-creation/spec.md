# canvas-creation Specification

## Purpose

Lets a user start a new pixel-art drawing by choosing its size and background,
producing an empty canvas the Workspace can draw on.

## Requirements

### Requirement: Size selection
The New Canvas screen SHALL offer size presets of 16×16, 32×32, 64×64, and
128×128, and SHALL also accept a custom width and height.

#### Scenario: User picks a preset size
- **WHEN** the user selects the 32×32 preset
- **THEN** the canvas is created at 32×32 pixels

#### Scenario: User enters a custom size
- **WHEN** the user enters custom width and height values within 1–256
- **THEN** the canvas is created at exactly those dimensions

#### Scenario: Custom size out of range is clamped
- **WHEN** the user enters a custom width or height outside the 1–256 range
- **THEN** the value is clamped to the nearest valid bound (1 or 256) before the
  canvas is created

### Requirement: Background selection
The New Canvas screen SHALL let the user choose a transparent or a white
background for the new canvas.

#### Scenario: Transparent background
- **WHEN** the user selects "transparent" and creates the canvas
- **THEN** every pixel starts fully transparent

#### Scenario: White background
- **WHEN** the user selects "white" and creates the canvas
- **THEN** every pixel starts opaque white

### Requirement: Hand-off to Workspace
Creating a canvas SHALL immediately switch the app to the Workspace screen with
the newly allocated canvas ready to draw on.

#### Scenario: Canvas created and shown
- **WHEN** the user confirms size and background on the New Canvas screen
- **THEN** the app displays the Workspace screen with a canvas of the chosen
  size and background, containing no strokes yet

### Requirement: Return to Gallery from Workspace
The Workspace screen SHALL offer a way back to the Gallery so the user can
open a different project or start a new one. Since every action auto-saves
(see the `local-persistence` capability), leaving the current canvas SHALL
NOT require confirmation — there is nothing to lose.

#### Scenario: User navigates back to the Gallery
- **WHEN** the user taps the Workspace's back control
- **THEN** the app displays the Gallery, and the previous project's current
  state remains saved exactly as it was

#### Scenario: Opening a different project after returning
- **WHEN** the user returns to the Gallery and opens a different project
- **THEN** the Workspace behaves identically to the first project (drawing,
  undo/redo, palette, layers, and export all work correctly, with no
  leftover state or duplicated event handling from the previous project)
