## ADDED Requirements

### Requirement: Opening a screen updates the URL
The app SHALL keep the URL's hash in sync with the currently visible
screen: `#/` (or an equivalent empty hash) for the Gallery, `#/new` for
the New Canvas screen, and `#/project/<id>` for the Workspace, where
`<id>` is the open project's existing stable id (`crypto.randomUUID()`,
unchanged from `js/persistence.js`'s `createProject`).

#### Scenario: Opening a project from the Gallery
- **WHEN** the user opens a project from the Gallery
- **THEN** the URL becomes `#/project/<id>` for that project's id

#### Scenario: Creating a new canvas
- **WHEN** the user finishes the New Canvas flow and a project is created
- **THEN** the URL becomes `#/project/<id>` for the newly created project

#### Scenario: Clicking "New canvas" from the Gallery
- **WHEN** the user clicks the Gallery's "+ new canvas" affordance
- **THEN** the URL becomes `#/new`

#### Scenario: Returning to the Gallery from the Workspace
- **WHEN** the user uses the Workspace's "back to gallery" affordance
- **THEN** the URL becomes `#/` (or an equivalent empty hash)

### Requirement: Reloading the page restores the URL's screen
On page load, the app SHALL read the current URL before deciding what
to show, rather than always defaulting to the Gallery.

#### Scenario: Reloading while a project is open
- **WHEN** the URL is `#/project/<id>` for a project that still exists
  in local storage, and the page is reloaded
- **THEN** the app opens directly to the Workspace showing that project,
  skipping the Gallery

#### Scenario: Reloading on the New Canvas screen
- **WHEN** the URL is `#/new` and the page is reloaded
- **THEN** the app opens directly to the New Canvas screen

#### Scenario: Reloading with no route or an unrecognized route
- **WHEN** the URL's hash is empty, `#/`, or does not match any known
  route, and the page is reloaded
- **THEN** the app opens to the Gallery

### Requirement: An unknown or deleted project id falls back to the Gallery
If the URL names a project id that cannot be found in local storage
(never existed, or was deleted), the app SHALL show the Gallery instead
and SHALL replace the stale URL rather than leaving it in place, so the
broken link does not persist in the browser's history or address bar.

#### Scenario: Loading a URL for a project id that doesn't exist
- **WHEN** the URL is `#/project/<id>` for an id with no matching local
  record, and the page is loaded
- **THEN** the app shows the Gallery, the URL updates to `#/` (or an
  equivalent empty hash), and no error is shown to the user or logged
  to the console

#### Scenario: A project is deleted while its URL is bookmarked
- **WHEN** a previously bookmarked `#/project/<id>` URL is opened after
  that project has since been deleted
- **THEN** the app shows the Gallery instead of an error or a blank
  Workspace

### Requirement: Back/Forward navigate between screens
The browser's Back and Forward buttons SHALL move between the Gallery,
New Canvas, and Workspace screens, matching the sequence of URLs the
user actually visited, without the app re-pushing a new history entry
in response to that navigation.

#### Scenario: Back from an opened project returns to the Gallery
- **WHEN** the user opens a project from the Gallery, then presses the
  browser's Back button
- **THEN** the Gallery is shown again and the URL reflects it (`#/` or
  equivalent)

#### Scenario: Forward re-opens the project
- **WHEN** the user has just gone Back from a project to the Gallery,
  then presses the browser's Forward button
- **THEN** the same project reopens in the Workspace

#### Scenario: Back/Forward through New Canvas
- **WHEN** the user visits Gallery → New Canvas → (creates a project,
  landing in the Workspace), then presses Back twice
- **THEN** the screens shown step back through Workspace → New Canvas →
  Gallery in that order, each matching the URL at that point in history

### Requirement: URL round-tripping is same-browser only
This capability SHALL NOT be relied upon to make a project accessible
to a different browser, device, or user than the one that created it.
A `#/project/<id>` URL identifies a project only in the local
IndexedDB store of the browser profile that has it; opening that same
URL where the project does not already exist locally SHALL fall back to
the Gallery (per the "unknown or deleted project id" requirement above),
not fetch or display the project from anywhere else. Cross-device or
cross-user access to a project by URL requires a backend, which does
not exist in this phase (see `openspec/roadmap.md`'s Phase 3).

#### Scenario: The same project URL opened in a different browser profile
- **WHEN** a `#/project/<id>` URL created on one browser profile is
  opened in a different browser profile that has never stored that
  project
- **THEN** the app shows the Gallery, the same as any other unknown
  project id — it does not attempt to fetch the project from a server
