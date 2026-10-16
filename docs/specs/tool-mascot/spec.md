---
title: "tool-mascot specification"
description: "The axolotl mascot bubble that appears when the user picks a tool."
type: spec
status: active
related:
  - docs/mascot/README.md
---

# tool-mascot Specification

## Purpose

Gives Pixi a bit of personality: when the user picks a tool, the mascot
(a pink axolotl) briefly appears using that tool. Added tool by tool;
sprite specs are in `docs/mascot/README.md`.

## Requirements

### Requirement: Mascot bubble on tool pick
When the user picks a tool that has a mascot sprite (click or keyboard
shortcut), the app SHALL show a bubble at the top centre of the
workspace, just below the top bar, playing that tool's sprite as a
looping animation. The bubble SHALL disappear after 3 seconds. Tools with
a sprite: Pencil, Eraser, Bucket, Brush, Rectangle, Line.

#### Scenario: Picking the Pencil
- **WHEN** the user picks the Pencil while another tool is active
- **THEN** the mascot bubble appears and loops the Pencil animation, and
  hides itself 3 seconds later

#### Scenario: Picking the active tool again
- **WHEN** the user picks the tool that is already active
- **THEN** the bubble does not appear or restart

#### Scenario: Switching tools while it shows
- **WHEN** the bubble is showing and the user picks a different tool
- **THEN** the bubble hides at once, and shows that tool's animation
  instead if it has one

### Requirement: Only on a user pick
The bubble SHALL appear only when the user picks a tool. It SHALL NOT
appear when a project opens with a tool already active, or when the
Eyedropper hands control back to the previous tool.

#### Scenario: Eyedropper returns to the Pencil
- **WHEN** the user picks a color with the Eyedropper and the app
  switches back to the Pencil
- **THEN** no bubble appears

### Requirement: Never in the way
The bubble SHALL be decorative: hidden from assistive technology, never
receiving pointer input (drawing under it works), and hidden along with
the rest of the interface when the interface is hidden. With reduced
motion requested, it SHALL show a single still frame instead of the loop.

#### Scenario: Drawing under the bubble
- **WHEN** the bubble is showing and the user draws where it sits
- **THEN** the stroke lands on the canvas as if the bubble were not there

### Requirement: Can be turned off
The Prefs sheet SHALL have a Show Mascot switch in its Tools group, on
by default and saved with the other prefs. While it is off, picking a
tool SHALL NOT show the bubble.

#### Scenario: Picking a tool with Show Mascot off
- **WHEN** Show Mascot is off and the user picks the Pencil
- **THEN** no bubble appears

#### Scenario: Turning it off while the bubble shows
- **WHEN** the bubble is showing and the user turns Show Mascot off
- **THEN** the bubble hides at once

#### Scenario: Turning it back on
- **WHEN** the user turns Show Mascot back on
- **THEN** nothing appears until the next tool pick, which shows the
  bubble as usual
