# gallery Specification

## Purpose

Gives the user a home screen to see, resume, and start pixel-art projects —
the app's entry point once projects can persist.

## Requirements

### Requirement: Gallery is the app's entry point
The Gallery screen SHALL be shown when the app loads, instead of New
Canvas.

#### Scenario: App loads with saved projects
- **WHEN** the user opens the app and has one or more saved projects
- **THEN** the Gallery is shown, listing those projects

#### Scenario: App loads with no saved projects
- **WHEN** the user opens the app for the first time (no saved projects)
- **THEN** the Gallery is shown with an empty state and a way to start a
  new canvas

### Requirement: Project grid
The Gallery SHALL display every saved project as a thumbnail with its name,
ordered by most-recently-updated first.

#### Scenario: Multiple projects listed
- **WHEN** the user has edited project B more recently than project A
- **THEN** project B appears before project A in the Gallery

### Requirement: Open a project
Tapping a project in the Gallery SHALL open it in the Workspace, fully
restored from its saved state.

#### Scenario: Opening a project
- **WHEN** the user taps a project's thumbnail
- **THEN** the Workspace shows that project's layers exactly as last saved

### Requirement: Start a new canvas from the Gallery
The Gallery SHALL offer a "+ New Canvas" control that opens the New Canvas
screen.

#### Scenario: Starting a new canvas
- **WHEN** the user taps "+ New Canvas"
- **THEN** the New Canvas screen is shown

### Requirement: Delete a project
The Gallery SHALL let the user delete a project, with a confirmation prompt
first, since deletion is permanent.

#### Scenario: Deleting a project
- **WHEN** the user deletes a project and confirms
- **THEN** it is removed from IndexedDB and no longer appears in the Gallery

#### Scenario: Canceling a delete
- **WHEN** the user starts deleting a project but declines to confirm
- **THEN** the project is unchanged and still appears in the Gallery
