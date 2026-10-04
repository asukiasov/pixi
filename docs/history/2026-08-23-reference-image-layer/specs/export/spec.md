## MODIFIED Requirements

### Requirement: Export composites visible layers
Exporting SHALL include only the layers marked visible, composited in
stacking order with their blend modes and opacities applied — the same
compositing rules used for on-screen rendering, before the scale, format,
and transparent-background options are applied. A reference image layer
(see the `layers` capability) SHALL always be excluded from this
compositing, regardless of its own visibility toggle, format, scale, or
the "Transparent background" toggle — it is a non-printing guide layer,
never baked into exported output.

#### Scenario: Hidden layers are excluded
- **WHEN** the user exports a project with one layer hidden
- **THEN** the downloaded file does not include that layer's content

#### Scenario: Reference image layer is excluded even when visible
- **WHEN** the user exports a project that has a visible reference image
  layer
- **THEN** the downloaded file does not include the reference image
  layer's content, in every format (PNG, WebP, JPG) and at every scale

#### Scenario: Reference image layer exclusion is independent of other toggles
- **WHEN** the user exports with any combination of scale, format, and the
  "Transparent background" toggle
- **THEN** the reference image layer is excluded from the result in every
  case, exactly as if it did not exist for export purposes
