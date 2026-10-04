# pluggable-storage-adapter Specification

## Purpose

Decouples project persistence from a hardcoded IndexedDB/Dexie
implementation, so a host application embedding Pixi can supply its own
storage backend while the standalone app keeps its existing local-first
behavior unchanged.

## Requirements

### Requirement: Storage adapter interface
The system SHALL define a storage adapter interface covering, at minimum,
loading a project record by id, saving a project record, listing project
records, and deleting a project record by id — used by every code path
that currently persists project data.

#### Scenario: Two adapters satisfy the same call sites
- **WHEN** the default adapter and a host-supplied adapter both implement
  the interface
- **THEN** the rest of the system persists and retrieves projects
  identically regardless of which adapter is active

### Requirement: Default adapter preserves standalone behavior
When no host-supplied adapter is provided, the system SHALL use the
existing IndexedDB/Dexie-backed adapter, with no change to the standalone
app's local-first, sign-in-free behavior.

#### Scenario: Running the app standalone, unchanged
- **WHEN** Pixi runs as the standalone app (not embedded) exactly as
  before this change
- **THEN** projects persist to IndexedDB automatically as they did prior
  to this change, with no user-visible difference

### Requirement: Host-supplied adapter used when embedding
A host application SHALL be able to supply its own storage adapter when
mounting an editor instance, and every persistence operation for that
instance SHALL go through the supplied adapter instead of IndexedDB.

#### Scenario: Host provides a custom backend
- **WHEN** a host mounts an editor instance with its own storage adapter
  (e.g. backed by its own database)
- **THEN** save/load/list/delete operations for that instance's projects
  go through the host's adapter, and no IndexedDB writes occur for it
