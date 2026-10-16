---
title: "color-library specification"
description: "Named, locally saved color palettes and the colour bar that shows the active palette."
type: spec
status: active
---

# color-library Specification

## Purpose

Lets a user build and reuse their own named collections of colors,
persisted locally, beyond a single session — the "saved palettes" half of
custom color support that `2c2-color-panel` deferred. Since 2026-10-12 the
active palette is shown in the colour bar at the bottom of the Workspace
(it replaced both the fixed 16-swatch strip and the right-side Color
Library card; those 16 colours live on as the "Pixi Basics" palette).

## Requirements

### Requirement: Colour bar
The Workspace SHALL show the active palette in a colour bar at the bottom,
under the tool-options bar: a palette button (the palette's name and a
chevron) first, then every colour of the active palette as a swatch on one
row that scrolls sideways, then the Rainbow swatch and an "add current
colour" (+) button. The swatch matching the current foreground colour SHALL
be marked with a ring and scrolled into view. Swatches SHALL be round
everywhere they appear (colour bar, colour picker's Palettes tab and
History, import and ramp previews), and the active swatch SHALL be ringed.
On a phone-width window the palette button SHALL show only its chevron
(its name stays in its accessible label). The palette menu's list of
palettes SHALL scroll on its own once it outgrows its maximum height.

#### Scenario: Bar shows the active palette's colors
- **WHEN** the Workspace is open
- **THEN** every color in the currently active palette is a swatch in the
  colour bar, scrolling sideways if there are more than fit

#### Scenario: Clicking a swatch sets the foreground color
- **WHEN** the user taps a swatch in the colour bar
- **THEN** that color becomes the current foreground draw color

### Requirement: Palette menu
The palette button SHALL open a menu listing every palette alphabetically
with its colour count, the active one checked; choosing one makes it the
active palette. Below the list the menu SHALL offer New Palette…, Import
from Image…, Generate Ramp…, Edit Colors (checked while on), Standard
Libraries… and Delete Palette. New Palette… asks for a name in a small
popover by the palette button (Enter saves, Escape cancels); the import
and ramp previews open there too.

#### Scenario: Switching palettes
- **WHEN** the user opens the palette menu and chooses Kit Kat
- **THEN** the colour bar shows Kit Kat's colours and the button reads
  "Kit Kat"

### Requirement: Named palettes
Colors SHALL be organized into named palettes, not a single flat list.
Exactly one palette is active at a time, selected via a dropdown. When
more than one palette exists, the dropdown SHALL list them sorted
alphabetically by name. A new palette SHALL be creatable two ways: the
existing empty-and-named "+ New Palette" flow, or by importing an image -
opening a file picker (`image/*`), extracting a set of representative
colors from the chosen image (see the "Import palette from image"
requirement below), and naming/saving the result the same way.

#### Scenario: A fresh install starts with one default palette
- **WHEN** the user opens the Workspace for the first time (no palettes
  created yet)
- **THEN** one palette (named "Material", seeded with the full Material
  Design color system) exists and is active — see the "Default palette
  is seeded, not empty" requirement below

### Requirement: Import palette from image
The palette menu SHALL offer an "Import from Image" control that opens a
file picker (`image/*`); choosing an image decodes it, downsamples it to
a small fixed internal grid (a color-extraction step only, not shown to
the user), and extracts a set of representative colors via clustering
(grouping similar shades together and taking one representative color
per group, e.g. median-cut) rather than raw most-frequent-exact-color
counting. The number of colors to extract SHALL be adjustable by the
user. Extracted colors and controls SHALL be shown in a popover anchored
to the Import control - the same anchored-popover behavior as Canvas
Settings/Export (positioned below the control, flipping above if that
would overflow the viewport, clamped horizontally, closable via an
explicit close button, clicking outside, or Escape) - as a live preview:
adjusting the color count re-extracts and updates the preview before
anything is saved. Saving the preview SHALL create a new named palette
(prompting for a name the same way "+ New Palette" does) containing
exactly those colors and close the popover; canceling discards the
preview and closes the popover without creating a palette. Once saved,
an imported palette is a normal palette - addable to, deletable,
switchable - indistinguishable from one built by hand.

#### Scenario: Opening the import popover
- **WHEN** the user clicks the Import control and picks an image
- **THEN** the import popover opens showing the live swatch preview and
  color-count control, with no palette created yet

#### Scenario: Closing without importing
- **WHEN** the import popover is open and the user presses Escape,
  clicks outside it, or clicks its close button
- **THEN** the popover closes and no palette is created

#### Scenario: Importing an image creates a palette with adjustable color count
- **WHEN** the user imports an image and sets the color count to 8
- **THEN** the live preview shows 8 extracted swatches, clustered from
  the image's colors rather than its 8 most frequent exact pixel values

#### Scenario: Adjusting color count re-extracts the preview
- **WHEN** the user changes the color count from 8 to 16 while the import
  popover is open
- **THEN** the preview updates to show 16 newly extracted swatches,
  without requiring the image to be re-imported, and without shifting
  the position of the color-count control itself (the popover is a
  fixed-position surface, not in-flow content)

#### Scenario: Similar shades are grouped, not duplicated
- **WHEN** the user imports an image containing a smooth gradient or
  anti-aliased edges between two colors
- **THEN** the extracted palette reflects genuinely distinct colors from
  across the image rather than being dominated by many near-identical
  shades from the gradient/edge pixels

#### Scenario: Saving the import preview creates a normal palette
- **WHEN** the user names and saves the import preview
- **THEN** a new palette with that name and the previewed colors appears
  in the palette dropdown (in alphabetical position), becomes active,
  the popover closes, and the palette behaves identically to a hand-built
  one (colors can be added, removed via palette deletion, or switched
  away from)

#### Scenario: Canceling an import discards the preview
- **WHEN** the user opens the import popover and cancels instead of
  saving
- **THEN** the popover closes, no new palette is created, and the
  previously active palette remains active

### Requirement: Default palette is seeded, not empty
The auto-created first-ever palette ("Material") SHALL start populated
with a fixed, built-in list of colors (the Material Design color system —
primary colors plus their tint/shade rows, the grayscale row, and
black/white) rather than empty. Revised from this change's original
Default-palette design, which started empty; requested directly once the
empty starting state shipped and felt like a dead end with nothing to
pick from.

#### Scenario: First-ever load shows a populated palette
- **WHEN** the user opens the Workspace for the first time
- **THEN** the "Material" palette's swatch grid already shows its full
  built-in color set, immediately selectable — not an empty-state message


#### Scenario: Creating a new palette
- **WHEN** the user creates a new palette and names it
- **THEN** it appears in the dropdown (in alphabetical position among
  existing palettes) and becomes the active palette

#### Scenario: Switching the active palette
- **WHEN** the user selects a different palette from the dropdown
- **THEN** the swatch grid updates to show that palette's colors, and
  subsequent "add color" actions add to it instead of the previous one

### Requirement: Add color to the active palette
The color-picker popover (from `2c2-color-panel`) SHALL offer an "add to
palette" action that adds its current color to the active named palette.

#### Scenario: Adding a color
- **WHEN** the user picks a color in the popover and adds it to the
  palette
- **THEN** a new swatch for that exact color appears in the active
  palette's grid, immediately selectable

### Requirement: Palettes persist across sessions and projects
Palettes (and their colors) SHALL be stored in IndexedDB, available in
every project and surviving a page reload — unlike `2c2`'s prior
session-only `customSwatches`.

#### Scenario: Palette survives a reload
- **WHEN** the user adds a color to a palette, reloads the page, and
  opens any project
- **THEN** that palette and its added color are still present

#### Scenario: Palette is not scoped to one project
- **WHEN** the user adds a color to a palette while project A is open,
  then opens project B
- **THEN** the same palette (with that color) is available in project B

### Requirement: Deleting a palette requires confirmation and protects the default
Deleting a palette SHALL show a confirmation dialog before removing it
(asking "are you sure?", not deleting on the first click) and SHALL be
unavailable both when it is the only remaining palette and when it is the
built-in default ("Material") palette, regardless of how many other
palettes exist — there must always be at least one populated, undeletable
palette to fall back to. Added directly: the delete control originally
had neither protection, so the built-in default (and, before this
requirement, any palette) could be removed with a single accidental
click and no way to undo it.

#### Scenario: Deleting a palette asks for confirmation
- **WHEN** the user clicks delete on a non-default palette that isn't the
  only one
- **THEN** a confirmation dialog appears before anything is deleted;
  confirming deletes it, canceling leaves it untouched

#### Scenario: The default palette can never be deleted
- **WHEN** the built-in "Material" palette is active, even if other
  palettes exist
- **THEN** its delete control is disabled

#### Scenario: The only remaining palette can never be deleted
- **WHEN** exactly one palette exists (default or otherwise)
- **THEN** its delete control is disabled

### Requirement: Remove a single color from a palette
The palette menu SHALL offer an "Edit Colors" toggle that switches
the swatch grid into an edit mode. In edit mode every swatch SHALL show a
visible remove cue and SHALL be labelled as a remove action for assistive
technology, and activating a swatch (click, tap, Apple Pencil tap, or
keyboard) SHALL remove exactly that one occurrence of the color from the
active palette, persisted the same way added colors are, instead of
setting it as the Foreground color. Edit mode SHALL end when the toggle
is activated again, when Escape is pressed, when the active palette
changes, or when the workspace is reset. The built-in default
("Material") palette SHALL never lose its last remaining color.

#### Scenario: Removing a color
- **WHEN** the user turns on edit mode and taps a swatch
- **THEN** that color disappears from the active palette's grid, the
  Foreground color is unchanged, and the removal survives a page reload

#### Scenario: Picking a color outside edit mode is unchanged
- **WHEN** edit mode is off and the user taps a swatch
- **THEN** that color becomes the Foreground color and nothing is
  removed

#### Scenario: Duplicates are removed one at a time
- **WHEN** a palette contains the same color twice and the user removes
  one of those swatches in edit mode
- **THEN** exactly one swatch of that color remains

#### Scenario: Leaving edit mode
- **WHEN** edit mode is on and the user activates the toggle again,
  presses Escape, or switches to a different palette
- **THEN** edit mode ends and tapping a swatch picks it again

#### Scenario: The default palette keeps at least one color
- **WHEN** edit mode is on for the built-in "Material" palette and only
  one color remains
- **THEN** that swatch can't be removed

#### Scenario: A user palette can be emptied
- **WHEN** the user removes the last color of a non-default palette
- **THEN** the palette remains and shows its existing empty-state message

### Requirement: Undo a single-color removal
Removing a single color in edit-colors mode SHALL show an informational
toast naming the removed color, with an "Undo" action. Activating Undo
SHALL put the color back at its original position in the palette it was
removed from, persisted, even if the user has since switched palettes.
Only the most recent removal SHALL be undoable: a new removal SHALL
dismiss the previous removal's Undo toast. If restoring fails, an error
toast SHALL say so.

#### Scenario: Undoing a removal
- **WHEN** the user removes a color and then activates "Undo" on the
  toast
- **THEN** the color reappears in the same position in that palette and
  survives a reload

#### Scenario: Only the latest removal offers Undo
- **WHEN** the user removes two colors in a row
- **THEN** only the second removal's Undo toast is shown, and using it
  restores that color to its exact position

### Requirement: Add the current color from anywhere
The colour bar SHALL end with a + button that adds the current Foreground
color to the active palette, independent of the color-picker popover's own
"Add to palette" button.

#### Scenario: Adding the current color on any platform
- **WHEN** the user taps the colour bar's + button
- **THEN** the current Foreground color is added to the end of the active
  palette

### Requirement: Generate color ramp
The system SHALL offer a "Generate ramp" action that takes a source color
and a step count (3-9, default 5) and produces that many colors stepped
from dark to light through the source hue, previewed before being added
to the active palette. The action is available both from the color
picker popover (for the color currently being edited) and from the
palette menu (for the current foreground color).

#### Scenario: Generating a ramp shows a preview before saving
- **WHEN** the user picks a source color and step count and triggers
  "Generate ramp"
- **THEN** a preview row of that many colors is shown before anything is
  added to the active palette

#### Scenario: Confirming adds all ramp colors to the active palette
- **WHEN** the user confirms a generated ramp preview
- **THEN** every color in the ramp is added to the active palette as an
  ordinary swatch, and the colour bar scrolls to show them

#### Scenario: Canceling discards the preview
- **WHEN** the user cancels a generated ramp preview instead of confirming
- **THEN** no colors are added to the active palette

#### Scenario: Step count changes the preview live
- **WHEN** the user changes the step count while a ramp preview is open
- **THEN** the preview regenerates to show the new number of steps from
  the same source color, without needing to reopen the action

#### Scenario: Ramp is ordered dark to light
- **WHEN** a ramp is generated
- **THEN** the resulting colors are ordered from darkest to lightest, with
  the source color's hue recognizable across the sequence rather than the
  ramp desaturating to flat gray at either extreme

### Requirement: Standard libraries
The user SHALL be able to open a Standard Libraries sheet listing the
palettes that ship with Pixi - Pixi Basics (the colours of the former fixed
bottom strip), the starter palettes (Vaporwave, Sunset, Ocean, Candy,
Autumn, Galaxy, Pastel, Monochrome, Old Money, Kit Kat, M&M's, Snickers),
PICO-8 and Game Boy - each with its colours and an Add button. The list
SHALL be downloaded from the site (`assets/palettes/standard.json`) when
the sheet opens, falling back to the same list built into the app when
the download fails. Add SHALL create a new palette with that name and
colours and make it active; it SHALL NOT change, replace or merge into
any existing palette. A standard palette whose name the library already
has (case-insensitive) SHALL show as Added instead.

#### Scenario: Restoring a deleted standard palette
- **WHEN** the user has deleted Kit Kat and opens Standard Libraries
- **THEN** Kit Kat shows Add; tapping it creates Kit Kat again with its
  original colours, as the active palette

#### Scenario: User's own palettes are untouched
- **WHEN** the user has edited their Kit Kat palette and opens Standard
  Libraries
- **THEN** Kit Kat shows Added and the user's palette is not changed

#### Scenario: Offline
- **WHEN** the standard list can't be downloaded
- **THEN** the sheet shows the built-in list and works the same

### Requirement: Pixi Basics for existing libraries
A library created before Pixi Basics existed SHALL get it added once, the
next time the app loads, unless it already has a palette by that name. It
SHALL NOT be re-added after the user deletes it.
