## Purpose

Gives a developer forking Pixi a working, readable example of how to
sync a local project to Supabase Postgres against the reference
`projects` schema, without this repo shipping any live auth or sync
inside the actual app.

## ADDED Requirements

### Requirement: Example is not part of the shipped app
Code under `examples/supabase-sync/` SHALL NOT be imported, referenced,
or executed by any code path reachable from `index.html` or `js/app.js`.

#### Scenario: Loading Pixi in a browser
- **WHEN** `index.html` is loaded and the app initializes
- **THEN** no code from `examples/supabase-sync/` runs, and Pixi's
  behavior is identical to a version of the repo without that directory

### Requirement: Example takes an authenticated client as input, not auth itself
The sync example's functions SHALL accept an already-authenticated
Supabase client as a parameter. The example SHALL NOT implement, call,
or depend on any specific sign-in method.

#### Scenario: Using the example
- **WHEN** a developer wants to run the example
- **THEN** they must construct and authenticate their own Supabase
  client (however they choose to implement sign-in) and pass it in - the
  example provides no sign-in code of its own

### Requirement: Push a local project to Supabase
Given an authenticated client and a local project's data, the example
SHALL upsert a row into the `projects` table keyed by the project's
`id`, so an existing remote row is updated rather than duplicated.

#### Scenario: Pushing a project that has no remote row yet
- **WHEN** the example's push function runs with a project `id` that
  does not yet exist in the `projects` table
- **THEN** a new row is inserted with that `id`

#### Scenario: Pushing a project that already has a remote row
- **WHEN** the example's push function runs with a project `id` that
  already exists in the `projects` table
- **THEN** the existing row is updated in place, not duplicated

### Requirement: Pull remote changes via last-write-wins
Given an authenticated client, the example SHALL compare a local
project's last-known `updated_at` against the remote row's `updated_at`
and treat the more recent one as authoritative.

#### Scenario: Remote row is newer than the local copy
- **WHEN** the example's pull function runs and the remote `projects`
  row's `updated_at` is later than the local project's last-known
  `updated_at`
- **THEN** the example reports the remote version as the one to keep

#### Scenario: Local copy is newer than the remote row
- **WHEN** the example's pull function runs and the local project's
  last-known `updated_at` is later than the remote row's `updated_at`
- **THEN** the example reports the local version as the one to keep,
  leaving the remote row unchanged until the next push
