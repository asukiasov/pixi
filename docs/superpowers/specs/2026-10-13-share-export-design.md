# Share and export — design

The Export popover becomes a Share popover: same options, plus a live
preview with file size, and three actions (Copy, Download, Share) in place
of the single Export button. Modelled on Procreate's Share menu (pick an
output, land in the OS share sheet) with Pixelmator Pro's export preview
and size estimate.

**In scope:** the flattened image (PNG/WebP/JPG at 1/2/4/8x, as today),
sent to the OS share sheet, copied to the clipboard, or downloaded.

**Out of scope:** remembering options between opens (they keep resetting
to 1x / PNG / opaque), a `.pixi` project file, layers as separate PNGs,
sharing the timelapse, and a scale default based on canvas size.

## 1. Entry point

- `#export-button`'s icon changes from `download` to `ios_share`; its
  `aria-label` and `data-tooltip` change from "Export PNG" to "Share".
- The More ⋯ menu item (`data-forward="export-button"`) becomes
  "Share / Export" with the `ios_share` icon.
- The popover heading changes from "Export" to "Share".
- Element IDs (`#export-button`, `#export-panel`, …) stay, so existing
  tests and the More-menu forwarding keep working.

## 2. Popover layout

Top to bottom:

1. **Preview row** (`#export-preview`): a thumbnail of the exact file that
   will go out, drawn with `image-rendering: pixelated` over a
   checkerboard (so transparency reads), fitted to a fixed box (about
   72px). Beside it: the project name, `W×H · FORMAT` (output dimensions,
   i.e. native × scale), and the encoded size (`~3 KB`, `1.2 MB`).
2. Scale 1x/2x/4x/8x, Format PNG/WebP/JPG, Transparent background —
   unchanged, including JPG disabling the toggle.
3. **Action row**: `#export-copy` (Copy), `#export-download` (Download),
   `#export-share` (Share). The last visible one is the accent-filled
   primary: Share where it exists, otherwise Download.

## 3. Behaviour

### Pre-rendering

iPad and macOS Safari reject `navigator.share()` and
`navigator.clipboard.write()` with `NotAllowedError` unless they run in
the click itself; awaiting an encode first loses the user activation. So
the blob is rendered **ahead of time**:

- On open, and on every scale/format/transparency change, the popover
  calls `render({ scale, format, skipBackground })` (from workspace.js,
  wrapping `layerStack.toPNGBlob`) and stores the resulting Blob.
- The same Blob drives the preview (object URL) and the size readout.
- While a render is pending, the three action buttons are disabled. A
  newer render supersedes an older one (a counter, so a slow 8x render
  finishing late can't overwrite a newer 1x).
- Copy needs a PNG, so when the format is WebP or JPG a second PNG blob
  is pre-rendered alongside for Copy.

### Share

- Visible only when `navigator.canShare?.({ files: [testFile] })` is true
  (iOS/iPadOS/macOS Safari, Android, Chrome on Windows/ChromeOS). Hidden
  elsewhere (Chrome on macOS, Firefox desktop).
- Calls `navigator.share({ files: [new File([blob], filename, { type })],
  title: projectName })` synchronously in the click handler.
- `AbortError` (user dismissed the sheet): nothing happens, popover stays
  open. Any other error: error toast "Couldn't share. Try Download
  instead." Success: popover closes.

### Copy

- Visible only when `navigator.clipboard?.write` and `ClipboardItem`
  exist.
- Writes `image/png` at the chosen scale and transparency. When the format
  is WebP or JPG the button reads "Copy PNG", because the clipboard only
  takes PNG reliably. JPG's flatten-to-white does not apply to the copy.
- Success: toast "Copied". The popover stays open, so you can copy again
  at another scale. Failure: error toast "Couldn't copy the image."

### Download

Unchanged: same filename rule (`<name>@<scale>x.<ext>`), JPG flatten to
white, reference-layer exclusion, and the existing confetti. Uses the
pre-rendered blob. Closes the popover.

## 4. Code structure

- `js/export.js` keeps owning the popover. `initExport` takes
  `render(options) → Promise<Blob>` and `onDownloaded()` (for the
  confetti) instead of `onExport`. Download, Copy and Share all live
  here.
- Pure helpers, exported for unit tests: `formatFileSize(bytes)`,
  `copyLabel(format)`, and `shareCapabilities(nav)` → `{ canShare,
  canCopy }` (takes a navigator-like object so tests can pass fakes).
- `js/workspace.js` passes `render` (wrapping
  `state.layerStack.toPNGBlob`) and `onDownloaded` (calls
  `celebrateExport`); its inline download code moves into `export.js`.
- Toasts go through the existing `js/toast.js`.

## 5. Testing

- Node unit tests: `formatFileSize`, `copyLabel`, `shareCapabilities`
  with share/clipboard present and absent, and the stale-render guard.
- WebKit (Playwright, persistent context): the preview appears, the size
  and dimensions update when scale changes, Download still saves the
  right file, Copy/Share visibility matches what the browser supports.
- Manual on iPad: tap Share → the system sheet opens with the PNG; Save
  Image puts it in Photos. Headless browsers can't open the real sheet.
- `web-design-guidelines` review before code review (touches
  `index.html`, CSS and popover interaction).

## 6. Docs on the same branch

- `docs/specs/export/spec.md`: Share, Copy, Preview and size, and Action
  row requirements; the popover requirement renamed to Share.
- `docs/ui-reference.md`: new IDs (`#export-preview`, `#export-copy`,
  `#export-share`) and the new icon/label.
- `docs/roadmap.md`: an entry for this change.
