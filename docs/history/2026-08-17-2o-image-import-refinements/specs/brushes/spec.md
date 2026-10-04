## MODIFIED Requirements

### Requirement: Custom brush creation
The Brushes panel SHALL offer an "add brush" control that opens a
pixel-grid editor (a grid the user clicks or drags across to toggle cells
on/off, independent of any project's canvas). Before drawing, the editor
SHALL let the user choose the grid's width and height, each independently
constrained to a minimum of 3 and a maximum of the current project's
canvas width/height respectively (so a brush can never be larger than the
canvas it would be used on). The editor SHALL also offer an "Import"
control that opens a file picker (`image/*`); choosing an image decodes
it - via the browser's standard bitmap decoder, falling back to an
`<img>`-element-based decode when that fails (covering formats such as
SVG that the standard decoder doesn't support) - and pre-fills the grid
at the editor's current width/height by thresholding the image to on/off
cells, instead of starting blank - alpha-based (mostly-opaque
downsampled regions become "on") when the image has any transparency,
falling back to brightness-based thresholding (darker regions become
"on") when the image is fully opaque. The imported result is a
monochrome silhouette only - the image's own colors are discarded,
matching every other brush's "placed in the current drawing color"
behavior. Changing the grid's size SHALL re-grid from a blank pattern
when no image has been imported (as before), or re-pixelate from the
stored source image at the new size when one has. Either way, the user
can still hand-edit cells before saving. Saving with a name adds it to
the brush picker as a new brush, usable exactly like a built-in one.
Canceling discards it (imported or hand-drawn).

#### Scenario: Creating a custom brush
- **WHEN** the user opens the brush editor, toggles a pattern of cells on,
  names it, and saves
- **THEN** a new brush with that pattern and name appears in the picker and
  can be placed like Heart or Circle

#### Scenario: Choosing a custom brush size
- **WHEN** the user opens the brush editor on a 32×32 canvas and sets the
  size to 5×12
- **THEN** the editor grid becomes 5 cells wide and 12 cells tall, and the
  saved brush uses that same size

#### Scenario: Size is bounded by the canvas
- **WHEN** the user attempts to set a dimension below 3 or above the
  current canvas's matching dimension
- **THEN** the value is clamped to the nearest valid size (3 at the low
  end, the canvas's width/height at the high end)

#### Scenario: Canceling brush creation
- **WHEN** the user opens the brush editor and cancels instead of saving
- **THEN** no new brush is added

#### Scenario: Importing a transparent-background image
- **WHEN** the user imports a PNG icon with a transparent background and
  an opaque silhouette
- **THEN** the editor's grid pre-fills with "on" cells matching the
  opaque region and "off" cells matching the transparent region, at the
  editor's current width/height

#### Scenario: Importing a fully-opaque image
- **WHEN** the user imports a JPG or other image with no transparency
- **THEN** the editor's grid pre-fills using brightness thresholding
  (darker regions become "on") instead of producing an all-"on" solid
  block

#### Scenario: Importing an SVG image
- **WHEN** the user imports an SVG file (a format the browser's standard
  bitmap decoder doesn't support)
- **THEN** the editor's grid pre-fills correctly via the `<img>`-element
  decode fallback, the same as any other supported format - not a silent
  no-op

#### Scenario: Imported brush uses the current drawing color, not the image's colors
- **WHEN** the user saves a brush created from an imported image and
  places it while drawing in a specific color
- **THEN** the placed pixels use that current drawing color, not any
  color sampled from the original image

#### Scenario: Resizing after import re-pixelates instead of clearing
- **WHEN** the user imports an image into the editor, then changes the
  width or height
- **THEN** the grid re-pixelates from the same source image at the new
  size, rather than clearing to blank

#### Scenario: Resizing with no import still clears, as before
- **WHEN** the user hand-draws in the editor (no image imported) and
  changes the width or height
- **THEN** the grid re-grids from a blank pattern, exactly as before this
  change

#### Scenario: Hand-editing an imported result before saving
- **WHEN** the user imports an image, then manually toggles a few cells
  in the resulting grid, then saves
- **THEN** the saved brush reflects the hand-edited pattern, not the raw
  pixelated result
