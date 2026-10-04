## Purpose

Makes Pixi's pixel data model (drawing buffer, layer compositing, undo/
redo) usable by a developer outside the Pixi app, by giving it a clear
location and self-contained documentation — with no packaging, install
step, or new distribution channel required.

## ADDED Requirements

### Requirement: Standalone folder with no external dependencies
The pixel data model SHALL live in a single folder, separate from
Pixi-app-specific code, containing only itself and standard browser APIs —
no import of any Pixi app file, and no third-party dependency.

#### Scenario: Folder copied out of the repo in isolation
- **WHEN** a developer copies the folder into an empty project, with
  nothing else from the Pixi repo present
- **THEN** every file in the folder resolves its imports successfully and
  the code runs in a browser with no missing references

### Requirement: Self-contained usage documentation
The folder SHALL include documentation that fully explains its own usage
without requiring any other Pixi document — what capabilities it exposes,
how to construct and use them, and one complete usage example covering
drawing, layering, undo/redo, and producing image output.

#### Scenario: Reading only the folder's own documentation
- **WHEN** a developer has only this folder (no access to the rest of the
  Pixi repo's docs) and reads its documentation
- **THEN** they can determine what the library provides and how to
  perform a complete draw-composite-undo-export workflow, without
  consulting any other source

### Requirement: No app behavior change
Extracting the pixel data model into its own folder SHALL NOT change any
externally observable behavior of the Pixi app itself.

#### Scenario: App functionality before and after extraction
- **WHEN** the Pixi app is used for drawing, layering, undo/redo, and
  export, before and after this extraction
- **THEN** the app's behavior and existing automated test suite results
  are identical in both cases

### Requirement: No new distribution mechanism
Obtaining the pixel data model SHALL require nothing beyond downloading or
copying files from the public GitHub repository — no package registry
publication, no build step, and no CDN-hosted bundle.

#### Scenario: A developer wants to use the library
- **WHEN** a developer wants to integrate the pixel data model into their
  own project
- **THEN** copying the folder's files from the GitHub repository at a
  given commit or tag is sufficient; no `npm install` of a Pixi package,
  no CDN URL, and no build tooling is required
