---
title: "clipboard specification"
description: "Cut, Copy, and Paste of pixels between layers, projects, and other apps via the system clipboard."
type: spec
status: active
---

# clipboard Specification

## Purpose

Lets a user move pixels between layers, projects and other apps with Cut,
Copy and Paste, from the layer ⋯ menu's capsule strip or the keyboard. It
uses the system clipboard (a PNG), plus an in-app record of Pixi's own
last copy, so a copy pasted back into Pixi lands where it came from.
Implemented in `js/clipboard.js` and `js/workspace.js`.

## Requirements

### Requirement: Copy
Copy SHALL take the active layer's pixels inside the selection, or the
whole layer when there is no selection, cropped to the box around its
non-transparent pixels. It SHALL write that crop to the system clipboard
as a PNG and keep an in-app record of it: its position and, for a whole
layer, the layer's name, opacity and blend mode. Copy SHALL be disabled
when there is nothing to copy (an empty layer, or an empty area under the
selection) and SHALL work on a locked layer. When the system clipboard
can't take the image, the in-app record is still kept and the toast
"Copied inside Pixi only. This browser can't copy images to other apps."
is shown.

#### Scenario: Copying a whole layer
- **WHEN** there is no selection and the user chooses Copy on "Layer 2"
- **THEN** the system clipboard holds a PNG of Layer 2's content box, and
  nothing on the canvas changes

### Requirement: Cut
Cut SHALL be available only with a selection: it copies the selection
(as Copy does) and then clears that rectangle to transparent on the
active layer, exactly as the selection bar's Delete does, as one undo
step. With no selection Cut SHALL be disabled in the menu and Cmd/Ctrl+X
SHALL do nothing. Cut SHALL be refused on a locked layer.

Cut and Copy SHALL also be on the selection action bar (and the docked
layout's selection controls) whenever there is a selection, enabled by the
same rules as the layer menu's.

#### Scenario: No selection
- **WHEN** there is no selection
- **THEN** Cut is disabled in the menu, and Cmd/Ctrl+X changes nothing

### Requirement: Paste
Paste SHALL add a new layer directly above the active layer, in its
group, and make it active, as one undo step; existing layers SHALL never
change. The image SHALL be the system clipboard's image when there is
one. With no clipboard image, Pixi's own last copy SHALL be used only if
it never reached the system clipboard or the clipboard can't be read at
all; a copy that reached the clipboard is stale once the clipboard holds
something else. Otherwise the toast "Nothing to paste. Copy a layer or an
image first." is shown and nothing changes.
- An image that matches Pixi's own last copy SHALL be pasted 1:1 at the
  position it was copied from. A whole-layer copy SHALL keep its opacity
  and blend mode and be named after the source the way Duplicate names
  copies ("Layer 2 copy"); a selection copy SHALL be named "Pasted".
- Any other image SHALL be pasted 1:1 when it fits the canvas, otherwise
  scaled down with nearest-neighbour to fit, and centred, in a layer named
  "Pasted".
- At the 8-layer cap, the menu's Paste SHALL be disabled and
  Cmd/Ctrl+V SHALL show "Can't paste: 8 layers is the maximum. Delete or
  merge a layer first."

Paste SHALL stay enabled below the cap, since a browser can't see what is
on the clipboard without reading it.

#### Scenario: Copy and paste in place
- **WHEN** the user selects a sprite, chooses Copy, then Paste
- **THEN** a new "Pasted" layer appears above the active one with the
  sprite at the same position

#### Scenario: Pasting a screenshot
- **WHEN** the clipboard holds an image larger than the canvas and the
  user presses Cmd/Ctrl+V
- **THEN** a new "Pasted" layer holds the image scaled down to fit and
  centred

### Requirement: Clipboard keyboard shortcuts
Cmd/Ctrl+C SHALL copy, Cmd/Ctrl+X SHALL cut and Cmd/Ctrl+V SHALL paste,
running the same actions as the menu, while the workspace is showing.
None of them SHALL act while a text input, textarea, select or
contenteditable element has focus, while a modal sheet or the confirm
dialog is open, or while page text is selected, so text copy and paste
keep working in fields such as the layer rename field and the hex field.

#### Scenario: Text on the clipboard
- **WHEN** the user copies a layer in Pixi, then copies text in another
  app, then presses Cmd/Ctrl+V on the canvas
- **THEN** no layer is added and "Nothing to paste" is shown

#### Scenario: Copying text in the rename field
- **WHEN** the layer rename field has focus and the user presses Cmd/Ctrl+C
- **THEN** the browser copies the selected text and no layer is copied

### Requirement: Clipboard access within the user's gesture
Copy and Cut SHALL start the system clipboard write synchronously inside
the click or key press (the PNG may finish encoding afterwards, inside the
clipboard item's promise), so Safari keeps the user gesture. Cmd/Ctrl+V
SHALL read the paste event's files, needing no permission prompt. The
menu's Paste SHALL read with the async clipboard API; Safari's own Paste
confirmation, if dismissed, counts as no clipboard image.
