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

### Requirement: Home screen presentation
The Gallery SHALL show full-bleed decorative artwork behind a readability
scrim, a centred frosted-glass hero card holding the "Pixi" wordmark and
the New Canvas control, and the saved projects in a frosted-glass
"Recents" sheet across the bottom of the screen. The glass surfaces SHALL
fall back to opaque cards when the user prefers reduced transparency or
the browser can't blur, in both the light and dark themes.

#### Scenario: Reduced transparency
- **WHEN** the user's system prefers reduced transparency
- **THEN** the hero card and Recents sheet are drawn opaque, with no
  backdrop blur

#### Scenario: Narrow screens
- **WHEN** the Gallery is shown on a phone-width screen (390px)
- **THEN** the hero card and Recents sheet fit the width with no
  horizontal scrolling

### Requirement: Project grid
The Gallery SHALL display every saved project as a thumbnail with its
name, canvas size (width×height) and when it was last edited, ordered by
most-recently-updated first. Last edited SHALL read "Just now" under a
minute, relative minutes or hours under a day, "Yesterday" under two
days, and a short date after that (with the year only when it isn't the
current year).

#### Scenario: Multiple projects listed
- **WHEN** the user has edited project B more recently than project A
- **THEN** project B appears before project A in the Gallery

#### Scenario: Project details shown
- **WHEN** the Gallery lists a 32×32 project edited five minutes ago
- **THEN** its tile shows its name, "32×32" and "5 minutes ago"

### Requirement: Open a project
Tapping a project in the Gallery SHALL open it in the Workspace, fully
restored from its saved state. Each project SHALL also be reachable and
openable from the keyboard.

#### Scenario: Opening a project
- **WHEN** the user taps a project's thumbnail
- **THEN** the Workspace shows that project's layers exactly as last saved

#### Scenario: Opening a project from the keyboard
- **WHEN** the user tabs to a project and presses Enter
- **THEN** that project opens in the Workspace

### Requirement: Start a new canvas from the Gallery
The Gallery SHALL offer a "New Canvas" control that opens the New Canvas
screen.

#### Scenario: Starting a new canvas
- **WHEN** the user taps "New Canvas"
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
