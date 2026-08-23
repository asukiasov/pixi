## ADDED Requirements

### Requirement: Layer marking (multi-select) in the Layers panel
The Layers panel SHALL support marking multiple layers, distinct from the
single active layer (where new strokes go). Cmd/Ctrl+click on a layer row
SHALL toggle that layer in or out of the marked set without changing the
active layer. Shift+click on a layer row SHALL mark every layer between the
most recently clicked row and the clicked row (inclusive), replacing any
prior marks. A plain click (no modifier) on a layer row SHALL clear all
marks and set that layer as the active layer, exactly as it does today. The
Background layer (if present) SHALL NOT be markable. Marked layers SHALL be
shown with a visual treatment distinct from the active-layer highlight.

#### Scenario: Cmd/Ctrl+click toggles a layer's marked state
- **WHEN** the user Cmd/Ctrl+clicks an unmarked layer row
- **THEN** that layer becomes marked, the active layer is unchanged, and any
  other already-marked layers remain marked

#### Scenario: Cmd/Ctrl+click again unmarks a layer
- **WHEN** the user Cmd/Ctrl+clicks an already-marked layer row
- **THEN** that layer becomes unmarked, and the active layer and other marks
  are unchanged

#### Scenario: Shift+click marks a contiguous range
- **WHEN** the user clicks a layer row, then Shift+clicks a different layer
  row
- **THEN** every layer between the two rows (inclusive) becomes marked,
  replacing whatever was marked before

#### Scenario: Plain click clears marks
- **WHEN** the user clicks a layer row without holding Cmd/Ctrl or Shift
- **THEN** all marks are cleared and that layer becomes the active layer,
  same as today's single-selection behavior

#### Scenario: Background layer cannot be marked
- **WHEN** the user Cmd/Ctrl+clicks or Shift+clicks the Background layer's
  row
- **THEN** the Background layer does not become marked

### Requirement: Merge layers keyboard shortcut
While the Workspace screen is visible, Cmd/Ctrl+E SHALL trigger a merge:
merging the marked set if 2 or more layers are marked, otherwise merging the
active layer down into the layer directly below it.

#### Scenario: Shortcut merges the marked set
- **WHEN** 2 or more layers are marked and the user presses Cmd/Ctrl+E
- **THEN** exactly the marked layers are merged into one, per the "Merge
  marked layers" requirement

#### Scenario: Shortcut merges down when nothing extra is marked
- **WHEN** fewer than 2 layers are marked and the user presses Cmd/Ctrl+E
- **THEN** the active layer is merged into the layer directly below it, per
  the "Merge active layer down" requirement

#### Scenario: Shortcut is scoped to the Workspace screen
- **WHEN** a screen other than Workspace is visible and the user presses
  Cmd/Ctrl+E
- **THEN** no merge occurs

### Requirement: Merge marked layers
When 2 or more non-Background layers are marked and a merge is triggered,
the system SHALL composite those layers' pixel content - honoring each
layer's own opacity and blend mode, in their existing stacking order,
exactly as they already composite for on-screen rendering and export - into
one new layer. The source layers SHALL be removed from the stack and
replaced by the merged layer at the position of the bottom-most merged
layer. The merged layer SHALL take the name of the topmost marked layer,
use blend mode Normal, and use 100% opacity. The merged layer SHALL become
the active layer, and all marks SHALL be cleared.

#### Scenario: Merging three marked layers
- **WHEN** three marked layers (with a mix of opacity and blend mode
  settings) are merged
- **THEN** the resulting single layer's pixel content matches how those
  three layers already looked when composited together on-screen, the
  layer sits at the bottom-most of the three layers' former position, is
  named after the topmost of the three, uses Normal blend mode at 100%
  opacity, and is the active layer

#### Scenario: Marks are cleared after merging
- **WHEN** a marked-set merge completes
- **THEN** no layer remains marked

#### Scenario: Non-adjacent marked layers still merge into one
- **WHEN** the marked layers are not directly adjacent in the stack (other
  unmarked layers sit between them)
- **THEN** the merge still combines only the marked layers into one layer at
  the bottom-most marked position, and the unmarked layers in between keep
  their own positions relative to the remaining stack

### Requirement: Merge active layer down
When fewer than 2 non-Background layers are marked and a merge is
triggered, the system SHALL merge the active layer into the layer directly
below it, using the same compositing, naming (top layer of the pair, i.e.
the active layer, wins the name), blend mode, and opacity rules as the
"Merge marked layers" requirement. If the active layer is the bottom-most
layer, or is the only layer, the merge SHALL be a no-op.

#### Scenario: Merging the active layer into the layer below
- **WHEN** the active layer is not the bottom-most layer and a merge-down is
  triggered
- **THEN** the active layer and the layer directly below it are combined
  into one layer at the lower layer's former position, named after the
  (former) active layer, using Normal blend mode at 100% opacity, and that
  merged layer becomes active

#### Scenario: No-op when the active layer is already at the bottom
- **WHEN** the active layer is the bottom-most layer in the stack and a
  merge-down is triggered
- **THEN** no layers are merged and the stack is unchanged

#### Scenario: No-op when the canvas has only one layer
- **WHEN** the canvas has exactly one layer and a merge-down is triggered
- **THEN** no merge occurs

### Requirement: Background layer excluded from merging
The Background layer SHALL never be merged, whether as part of a marked-set
merge or as the source or target of a merge-down. A marked set SHALL never
include the Background layer (per the marking requirement). Merge-down
SHALL treat the Background layer as an invalid merge target: if the active
layer sits directly above the Background layer, merge-down is a no-op
exactly as if the active layer had no layer below it.

#### Scenario: Merge-down does not merge into the Background layer
- **WHEN** the active layer sits directly above the Background layer and a
  merge-down is triggered
- **THEN** no merge occurs and the Background layer is unchanged

### Requirement: Merging layers is undoable
Merging layers (marked-set merge or merge-down) SHALL be undoable/redoable
the same way other layer operations (add/delete/reorder/rename/visibility/
opacity/blend mode) are.

#### Scenario: Undoing a merge
- **WHEN** the user merges layers and then triggers Undo
- **THEN** the merged layers are removed, the original source layers
  reappear in their prior positions with their original content, opacity,
  blend mode, and names, and the previously active layer is active again
