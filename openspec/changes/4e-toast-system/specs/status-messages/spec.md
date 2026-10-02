## Purpose

Gives Pixi one consistent, non-blocking way to tell the user that
something they did failed or can be undone, plus a rule for which
failures are worth telling them about.

## ADDED Requirements

### Requirement: Toast messages
The app SHALL show status messages as toasts: small non-blocking
messages anchored to the bottom-centre of the viewport (clear of device
safe areas) that never block interaction with the rest of the page. A
toast SHALL be either informational or an error, the two SHALL be
visually distinct in both light and dark themes, and errors SHALL NOT be
distinguished by color alone. Toasts SHALL remain visible when the
workspace interface is hidden.

#### Scenario: Showing an error
- **WHEN** a user-initiated action fails
- **THEN** an error toast appears describing what failed and what to do
  next, and the rest of the app stays usable

### Requirement: Toast lifetime and dismissal
Every toast SHALL have a dismiss control. Informational toasts SHALL
auto-dismiss after about 4 seconds and error toasts after about 8
seconds. The countdown SHALL pause while the pointer is over the toast or
keyboard focus is inside it, and resume when it leaves. At most 3 toasts
SHALL be visible at once; showing a fourth SHALL dismiss the oldest.

#### Scenario: Dismissing a toast
- **WHEN** the user activates a toast's dismiss control
- **THEN** that toast disappears immediately

#### Scenario: Reading a toast takes longer than its timeout
- **WHEN** the user hovers over or focuses a toast before it times out
- **THEN** it stays until the pointer or focus leaves, then its
  countdown resumes

#### Scenario: Too many toasts
- **WHEN** a fourth toast is shown while three are visible
- **THEN** the oldest is dismissed and three remain

### Requirement: Toast actions
A toast MAY carry one action button (e.g. "Undo"). Activating it SHALL
run the action and dismiss the toast.

#### Scenario: Using a toast action
- **WHEN** the user activates a toast's action button
- **THEN** the action runs once and the toast is dismissed

### Requirement: Toasts are announced to assistive technology
Informational toasts SHALL be announced politely, and error toasts
assertively, without moving keyboard focus.

#### Scenario: Screen reader hears an error
- **WHEN** an error toast appears
- **THEN** a screen reader announces its message without focus leaving
  the user's current control

### Requirement: When to surface a failure
A failure of an action the user directly started (importing a file,
exporting, saving a recording) SHALL be surfaced as an error toast. A
failure of a background operation SHALL fail silently, unless it means
the user's work may be lost: a failed autosave SHALL be surfaced once
and not repeated for each further failed save, until a save succeeds
again. Native blocking dialogs (`alert()`) SHALL NOT be used for status
messages.

#### Scenario: Unreadable image file
- **WHEN** the user picks a file that isn't a readable image for a brush
  import, palette import, or reference image layer
- **THEN** an error toast says the image couldn't be read and names the
  supported formats

#### Scenario: Timelapse export fails
- **WHEN** encoding a timelapse video fails
- **THEN** an error toast says the video couldn't be saved and suggests
  recording again, with no blocking dialog

#### Scenario: Autosave keeps failing
- **WHEN** several consecutive autosaves fail
- **THEN** exactly one error toast is shown for that streak, and another
  is shown only if saving fails again after a successful save
