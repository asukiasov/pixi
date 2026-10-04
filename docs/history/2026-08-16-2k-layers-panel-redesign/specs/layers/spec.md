## ADDED Requirements

### Requirement: Layers panel shows a live thumbnail per layer
Each layer's row in the Layers panel SHALL show a thumbnail preview of
that layer's actual current pixel content, not a generic placeholder.
The thumbnail SHALL reflect the layer's content after any change (draw,
resize, rotate) the next time the panel re-renders.

#### Scenario: Thumbnail reflects drawn content
- **WHEN** the user draws on a layer and the Layers panel re-renders
- **THEN** that layer's thumbnail shows the new content

### Requirement: Opacity and Blend mode apply to the active layer via shared controls
The Layers panel SHALL offer one Opacity slider and one Blend mode
selector, editing whichever layer is currently active, rather than
separate controls duplicated in every row. Selecting a different layer
SHALL update these controls to reflect that layer's own Opacity and
Blend mode.

#### Scenario: Selecting a layer syncs the shared controls
- **WHEN** the user selects a different layer in the panel
- **THEN** the Opacity slider and Blend mode selector update to show
  that layer's own values

#### Scenario: Changing Opacity or Blend mode affects only the active layer
- **WHEN** the user adjusts the shared Opacity slider or Blend mode
  selector
- **THEN** only the currently active layer's opacity/blend mode changes
