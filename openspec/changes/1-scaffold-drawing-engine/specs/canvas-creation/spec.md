## Purpose

Lets a user start a new pixel-art drawing by choosing its size and background,
producing an empty canvas the Workspace can draw on.

## ADDED Requirements

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
