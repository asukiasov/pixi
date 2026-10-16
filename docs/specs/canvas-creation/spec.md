---
title: "canvas-creation specification"
description: "The New Canvas screen: choosing size and background to start an empty drawing."
type: spec
status: active
---

# canvas-creation Specification

## Purpose

Lets a user start a new pixel-art drawing by choosing its size and background,
producing an empty canvas the Workspace can draw on.

## Requirements

### Requirement: Size selection
The New Canvas screen SHALL offer size presets of 16×16, 32×32, 64×64, and
128×128 as picture tiles, preceded by a "Last used" tile, and SHALL also
accept a custom width and height. Each tile SHALL preview the chosen
background with a pixel grid at its size.

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

#### Scenario: Typed sizes select their tile
- **WHEN** the user types a size that equals a square preset
- **THEN** that preset's tile is selected
- **WHEN** the size matches no preset but equals the last-used size
- **THEN** the "Last used" tile is selected
- **WHEN** the size matches neither
- **THEN** a selected "Custom W×H" tile appears after the presets

#### Scenario: Swapping width and height
- **WHEN** the width and height differ and the user taps the swap button
- **THEN** the two values are exchanged and the selected tile re-syncs; the
  swap button is hidden for square sizes

### Requirement: Background selection
The New Canvas screen SHALL let the user choose a transparent or a white
background for the new canvas, as two picture tiles.

#### Scenario: Transparent background
- **WHEN** the user selects "transparent" and creates the canvas
- **THEN** every pixel starts fully transparent

#### Scenario: White background
- **WHEN** the user selects "white" and creates the canvas
- **THEN** every pixel starts opaque white

### Requirement: Remember the last choice
Creating a canvas SHALL store its size and background in the preferences,
and the New Canvas screen SHALL open with that size and background, on the
"Last used" tile (32×32 transparent before any canvas is created).

#### Scenario: Reopening New Canvas
- **WHEN** the user created a 40×20 white canvas and later opens New Canvas
- **THEN** "Last used" is selected with W 40, H 20 and the White background

### Requirement: Cancel
The New Canvas screen SHALL offer Cancel, which returns to the Gallery
without creating a project.

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

### Requirement: New Canvas presentation
The New Canvas screen SHALL show the same decorative artwork and scrim as
the Gallery, with its form in a centred frosted-glass card that falls
back to an opaque card when the user prefers reduced transparency. The
card holds the preset tiles on the left and an inspector (~260px: preset
summary, size, background, Cancel/Create) on the right; on phones they
stack and Cancel/Create stay pinned to the bottom of the screen.

#### Scenario: Moving from the Gallery to New Canvas
- **WHEN** the user taps "New Canvas" in the Gallery
- **THEN** the New Canvas form appears in a glass card over the same
  artwork the Gallery showed
