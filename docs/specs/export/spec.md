# export Specification

## Purpose

Lets a user get the current project out of Pixi as an image at a chosen
scale and format, optionally with a transparent background, by copying it
to the clipboard, downloading it, or handing it to the operating system's
share sheet - with a preview and file size of exactly what will go out.

## Requirements

### Requirement: Share popover
Share SHALL open as a popover anchored to the Share control in the top
bar (icon `ios_share`, label "Share"; in the floating layout, the More
menu's "Share / Export" item), using the same anchored-popover behavior
as Canvas Settings (positioned below the control, flipping above if that
would overflow the viewport, clamped horizontally, closable via an
explicit close button, clicking outside, Escape, or re-clicking the
control) rather than downloading immediately on click.

#### Scenario: Opening the Share popover
- **WHEN** the user clicks the Share control
- **THEN** the popover opens showing the preview, the scale multiplier,
  format selector, transparent-background control, and the action row,
  with no file downloaded, copied, or shared yet

#### Scenario: Closing without exporting
- **WHEN** the Share popover is open and the user presses Escape, clicks
  outside it, or clicks its close button
- **THEN** the popover closes and nothing is downloaded, copied, or shared

### Requirement: Scale multiplier
The Share popover SHALL offer a choice of 1x, 2x, 4x, or 8x scale, default
1x. The exported PNG's pixel dimensions SHALL be the canvas's native width
and height multiplied by the chosen scale, with each source pixel rendered
as a solid block of scale×scale output pixels (nearest-neighbor, no
smoothing/interpolation).

#### Scenario: Exporting at native resolution
- **WHEN** the user exports a 32×32 canvas at the default 1x scale
- **THEN** the downloaded PNG is 32×32 pixels

#### Scenario: Exporting upscaled
- **WHEN** the user selects 4x and exports a 32×32 canvas
- **THEN** the downloaded PNG is 128×128 pixels, with every source pixel
  reproduced as a sharp-edged 4×4 block of solid color (no blurring between
  adjacent source pixels)

### Requirement: Transparent-background override
The Share popover SHALL offer a "Transparent background" toggle, off by
default. When on, the Background layer (see the `layers` capability, if the
project has one) SHALL be composited as fully transparent for this export
only, instead of filling with its background color. When off, export SHALL
composite exactly as the canvas currently renders on-screen, including any
opaque Background layer. This toggle SHALL NOT alter the project's saved
layer data, its Background layer's color, or its on-screen rendering — it
affects only the exported file.

The toggle SHALL be disabled (visibly greyed out and non-interactive) and
forced off whenever JPG is the selected format, since JPG has no alpha
channel — see the Format selector requirement. Selecting PNG or WebP
re-enables it, without restoring whatever the toggle's on/off value was
before JPG was selected (it stays off until the user turns it on again).

#### Scenario: Overriding a white-background canvas to transparent
- **WHEN** the user exports a project whose Background layer is opaque
  white with "Transparent background" on
- **THEN** the downloaded PNG has a fully transparent background in place
  of the Background layer's fill, with all other layers composited on top
  unchanged, and the project's own layer data and rendering are unaffected

#### Scenario: Default export matches on-screen rendering
- **WHEN** the user exports a project with "Transparent background" off
- **THEN** the downloaded PNG matches exactly what compositing all visible
  layers produces on-screen, including an opaque Background layer if
  present

#### Scenario: Transparent-canvas project is unaffected by the toggle
- **WHEN** the user exports a project that has no Background layer (created
  with a transparent background) regardless of the toggle's state
- **THEN** the downloaded PNG is identical either way, since there is no
  opaque Background layer to override

#### Scenario: Selecting JPG disables the toggle
- **WHEN** the user has "Transparent background" checked and then selects
  JPG as the format
- **THEN** the toggle becomes disabled and unchecked, and the export
  composites the opaque Background layer (or flattens onto white — see
  Format selector) regardless of its prior state

### Requirement: Format selector
The Share popover SHALL offer a choice of PNG (default), WebP, or JPG.
PNG and WebP preserve the alpha channel from compositing (including any
transparency from the "Transparent background" toggle or a
transparent-background canvas). JPG has no alpha channel: exporting as JPG
SHALL flatten any transparent or removed-background area onto an opaque
white backdrop before encoding, rather than leaving that undefined (browser
default JPEG encoding of transparent canvas pixels renders as black, which
this requirement avoids).

#### Scenario: Exporting as WebP
- **WHEN** the user selects WebP and exports a project with transparency
- **THEN** the downloaded file is a `.webp` image with transparency
  preserved

#### Scenario: Exporting as JPG flattens transparency to white
- **WHEN** the user selects JPG and exports a transparent-background
  project (or a white-background project with "Transparent background"
  forced off per the disabled-toggle behavior)
- **THEN** the downloaded `.jpg` file has an opaque white background in
  place of any transparency, with all layer content composited on top
  unchanged

### Requirement: Export filename
The downloaded file SHALL be named from the project's current name (as set
in Canvas Settings, default "Untitled"), the chosen scale, and the chosen
format's extension, following the pattern
`<sanitized-project-name>@<scale>x.<ext>` (e.g. `My Sprite@4x.png`).
Characters not safe in a filename (`/ \ : * ? " < > |`) SHALL be replaced
with `-`; a name that sanitizes to empty SHALL fall back to `untitled`.
`<ext>` SHALL be `png`, `webp`, or `jpg` matching the selected format.

#### Scenario: Default filename
- **WHEN** a project named "My Sprite" is exported at the default 1x scale
  in PNG format
- **THEN** the downloaded file is named `My Sprite@1x.png`

#### Scenario: Filename reflects scale and format
- **WHEN** the same project is exported at 4x scale in WebP format
- **THEN** the downloaded file is named `My Sprite@4x.webp`

#### Scenario: Unsafe characters are sanitized
- **WHEN** a project is named `Sword/Shield: v2` and exported
- **THEN** the downloaded filename replaces `/` and `:` with `-` (e.g.
  `Sword-Shield- v2@1x.png`)

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

### Requirement: Preview and size
The Share popover SHALL show a preview of the exact file the current
options produce, drawn with hard pixel edges over a checkerboard, together
with the project name, the output dimensions and format
(`<width×scale>×<height×scale> · <FORMAT>`), and the encoded file size
(exact bytes under 1 KB, `~N KB` under 1 MB, `N.N MB` above). The preview
and size SHALL update whenever scale, format, or the transparent-background
toggle changes; while the new output is being prepared, the action buttons
SHALL be disabled. If several changes overlap, only the newest one's
output SHALL be shown and used.

#### Scenario: Changing scale updates the preview
- **WHEN** the popover is open on a 32×32 project at 1x PNG and the user
  selects 8x
- **THEN** the dimensions read `256×256 · PNG` and the size reflects the
  8x file

### Requirement: Action row
The Share popover SHALL offer Copy, Download, and Share actions in one row,
in that order. Share SHALL be shown only when the browser can share files
(`navigator.canShare({ files })`), and Copy only when it can write images
to the clipboard (`navigator.clipboard.write` and `ClipboardItem`). The
rightmost visible action SHALL be styled as the primary action: Share
where available, otherwise Download. Each action SHALL use the output
already prepared for the current options, without re-encoding at click
time.

#### Scenario: Browser without a share sheet
- **WHEN** the browser does not support sharing files
- **THEN** the Share action is hidden and Download is the primary action

### Requirement: Download
Download SHALL save the prepared file under the name defined by the
Export filename requirement, run the export celebration, and close the
popover.

#### Scenario: Downloading
- **WHEN** the user selects 4x and WebP on a project named "My Sprite" and
  clicks Download
- **THEN** a file named `My Sprite@4x.webp` is saved and the popover closes

### Requirement: Share
Share SHALL hand the prepared file (named per the Export filename
requirement, titled with the project name) to the operating system's share
sheet. If the user dismisses the sheet, nothing else SHALL happen and the
popover SHALL stay open. If sharing fails for any other reason, an error
toast "Couldn't share. Try Download instead." SHALL be shown. After a
completed share the popover SHALL close.

#### Scenario: Sharing to Photos on iPad
- **WHEN** the user taps Share on iPad Safari and picks Save Image
- **THEN** the image is saved to Photos and the popover closes

#### Scenario: Dismissing the share sheet
- **WHEN** the user opens the share sheet and dismisses it
- **THEN** no error is shown and the popover stays open

### Requirement: Copy
Copy SHALL write a PNG image at the chosen scale and transparency to the
clipboard, whatever format is selected, because the clipboard only
accepts PNG reliably; when WebP or JPG is selected the button SHALL read
"Copy PNG" instead of "Copy". JPG's flatten-to-white does not apply to the
copied PNG. On success, an info toast "Copied" SHALL be shown and the
popover SHALL stay open; on failure, an error toast "Couldn't copy the
image." SHALL be shown.

#### Scenario: Copying with JPG selected
- **WHEN** the user selects JPG and clicks "Copy PNG"
- **THEN** a PNG of the image is on the clipboard and "Copied" is shown
