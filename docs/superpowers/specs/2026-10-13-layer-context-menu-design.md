# Layer context menu — design

A redesign of the Layers row ⋯ menu, modelled on Pixelmator Pro for iPad's
layer menu. It adds Cut, Copy and Paste in a capsule strip at the top, a
Lock toggle, and Select Content, and regroups the existing items.

This covers item 8 (Copy, Cut, Paste with icons) of Part C, "Edit
actions", in `2026-10-13-glass-and-panel-polish-design.md`. Item 7 (a
visible Merge button) is not part of this design.

**Out of scope:** masks, submenus, Remove Background, Replace Layer, any
change to the group ⋯ menu, Copy/Cut buttons on the selection action bar,
and selections that aren't rectangles.

**Related work in progress:** Share & Export (a separate branch) adds a
Copy button that writes the whole picture to the clipboard. See
"Coordination with Share & Export" below.

## Context: what exists today

- `js/layers-ui.js`: `layerMenuItems()` and `groupMenuItems()` build item
  lists, and `openContextMenu()` renders them as a flat list into the one
  `#layer-menu` (Forma glass in the floating layout). The ⋯ button only
  appears on the active row, so the layer menu always acts on the active
  layer.
- **Pixi has no copy/paste.** The Selection tool makes a rectangle
  (`state.selection = { x, y, width, height }`). The selection action bar
  offers Clear selection and Delete, and Move drags the pixels.
- **"Locked" means two things today**, and neither can be set by the user:
  - The Background layer is position-locked (`#isPositionLocked`): it
    can't be reordered, but it can be drawn on.
  - The reference image layer can't be drawn on, because `setActiveLayer`
    refuses it.

  `LayerStack`'s `#isLocked` covers both cases for reorder, group and merge
  rules.
- `MAX_LAYERS` is 8.

## 1. Menu layout

```
[ ✂ Cut | ⧉ Copy | 📋 Paste ]     capsule strip
  Duplicate              ⌘J       library_add
  Lock  /  Unlock                 lock / lock_open
  Rename                          edit
  ─────
  Select Content                  select
  ─────
  Merge Down             ⌘E       merge
  Group ⌘G / Remove from Group    create_new_folder / folder_off
  Move Up                         arrow_upward
  Move Down                       arrow_downward
  ─────
  Delete Layer                    delete (danger)
```

- The strip and the first two groups follow Pixelmator's order. Pixi's own
  structure items form their own group below them, and Delete stays last.
- Duplicate's icon changes from `content_copy` to `library_add`, because
  Copy now uses `content_copy`.
- The group ⋯ menu is unchanged.

## 2. Cut, Copy, Paste

All three act on the active layer, from the menu or the keyboard.

| | With a selection | With no selection |
|---|---|---|
| **Copy** | The selection rectangle's pixels on this layer | The whole layer: its pixels, name, opacity and blend mode |
| **Cut** | Copy, then clear the rectangle | **Disabled** (⌘X does nothing) |
| **Paste** | Adds a new layer | Adds a new layer |

### Copy

- What gets copied is cropped to the bounding box of its non-transparent
  pixels, inside the selection if there is one. Other apps therefore get no
  transparent margins.
- Copy is disabled when there is nothing to copy: an empty layer, an empty
  area under the selection, or a reference layer.
- Copy works on a locked layer, because it doesn't change the layer.
- Copy writes two things:
  1. **To the system clipboard:** a PNG of the cropped pixels.
  2. **To an in-app record**, kept in module memory:
     `{ kind: 'layer' | 'selection', x, y, width, height, data, name, opacity, blendMode }`.
     `name`, `opacity` and `blendMode` are only set when `kind` is
     `'layer'`. The record doesn't survive a reload.

### Cut

- Cut is enabled only when there is a selection, the area under it has
  content, and the layer is neither locked nor a reference layer.
- Cut copies first (as above), then clears the rectangle, exactly as the
  selection action bar's Delete does: the rectangle becomes transparent,
  on the Background layer too, since that's what Delete already does
  there. Cut and Delete share one function.
- Cut is one undo step.

### Paste

Paste always adds a **new layer**. It's inserted directly above the active
layer, in the active layer's group, and becomes active, the same way
`duplicateLayer` places its copy. Existing layers never change, so Paste
works whatever is locked. The selection is left as it is.

Where the pasted image goes depends on where it came from:

- **It matches the in-app record** (`matchesRecord`, below). It's pasted
  at the record's `x, y`, at 1:1.
  - If `kind` is `'layer'`, the new layer gets the record's opacity and
    blend mode, and is named after the source the way Duplicate names
    copies ("Layer 2 copy", "Layer 2 copy 2").
  - If `kind` is `'selection'`, the new layer is named "Pasted".
- **Anything else** (an image from another app, or any paste after a
  reload). It's pasted 1:1 if it fits the canvas. If it's bigger, it's
  scaled down with nearest-neighbour by `fitImageToCanvas(image, w, h,
  false)` from `js/image-import.js`. Either way it's centred, and the layer
  is named "Pasted".

Other rules:

- **Layer cap.** At the 8-layer cap, the menu's Paste is disabled and ⌘V
  shows the toast "Can't paste: 8 layers is the maximum".
- **Nothing to paste.** If the clipboard has no image, or reading it fails,
  the toast is "Nothing to paste". This includes the user dismissing
  Safari's Paste bubble.
- **Paste stays enabled** (below the cap). A browser can't check what's on
  the clipboard without reading it, so it can't be greyed out the way
  Pixelmator greys it out.
- **Undo.** Paste is one undo step.

### Keyboard

- ⌘C / Ctrl+C copies, ⌘X / Ctrl+X cuts, ⌘V / Ctrl+V pastes. They run the
  same functions as the menu.
- They're bound in `workspace.js`'s `bindDomOnce()` beside ⌘J and ⌘D.
- They're skipped while a text input, textarea or contenteditable element
  has focus, so native text copy and paste still works in the rename field
  and the hex field.

### Browser constraints

- **Writing (Copy, Cut).** `navigator.clipboard.write([new
  ClipboardItem({ 'image/png': blobPromise })])` is called synchronously
  inside the click or keydown handler, and the PNG encodes inside the
  promise. Safari accepts a promise here, which keeps the user-gesture
  requirement satisfied without encoding ahead of time.
- **Writing when `ClipboardItem` is missing.** The in-app record is still
  set, so pasting inside Pixi works, and the toast is "Copied inside Pixi
  only".
- **Reading with ⌘V.** Uses the `paste` event's
  `clipboardData.files` / `items`. This needs no permission prompt and
  works in Safari.
- **Reading from the menu's Paste.** Uses `navigator.clipboard.read()`.
  Safari shows its own "Paste" bubble, which the user taps, and Chromium
  may ask for permission once. If `clipboard.read` is missing, the menu
  Paste uses the in-app record only, or shows "Nothing to paste" if there
  is none.

### Coordination with Share & Export

- Both branches write PNGs to the clipboard. The write helper lives in
  `js/clipboard.js` as `writeImage(blobPromise)`. Whichever branch merges
  second reuses the other's helper rather than adding a second one.
- The Export branch doesn't bind ⌘C or ⌘V, so this branch owns those keys.
- The shared `.action-capsule` classes (section 4) suit Export's
  Copy/Download/Share row too.

## 3. Lock

**Meaning:** Lock protects the layer's pixels. Anything that would change
the layer's pixels is refused. Everything else still works:

| Still allowed on a locked layer | Refused on a locked layer |
|---|---|
| Reorder, group, ungroup | Any drawing tool: Pencil, Eraser, Brush, Fill, shapes |
| Visibility, opacity, blend mode | Move on the layer's content |
| Rename, Duplicate, Copy, Delete | Transform and Align actions |
| Being the active layer | Selection Delete, Cut |
| Canvas-wide resize, rotate, flip | Merge Down into it or from it, and multi-layer merge that includes it |

- Canvas-wide operations still apply to locked layers, because they change
  the document rather than one layer's artwork.
- Lock is separate from the Background layer's position lock, and the
  Background layer can be locked too. Reference layers already can't be
  drawn on, so Lock is not offered in their menu.

**Data** (`lib/pixel-engine/layers.js`):

- `Layer.locked`, default `false`. It's carried through `snapshot()`,
  `restore()` / `copyLayerFields`, and `toProjectRecord()`. A stored
  project without the field loads as unlocked.
- `duplicateLayer` gives an **unlocked** copy.
- New `LayerStack.setLocked(index, locked)`. It returns `false` and does
  nothing for a reference layer or a bad index.
- `mergeDown` and `mergeLayers` return `false` when any layer involved is
  `locked`. `mergeButtonState` in `layers-ui.js` greys Merge Down to match.

**Enforcement** (`js/workspace.js`):

- One helper, `activeLayerEditable()`, returns `false` when the active
  layer is locked. It's checked where each pixel-changing action starts:
  - pointerdown on a drawing tool
  - Move with layer content
  - each Transform and Align action. `getTransformTarget()` returns
    `disabled` for a locked layer, so the popover greys out.
  - selection Delete
  - Cut
- On a refusal: show the toast "Layer is locked" once per gesture, change
  nothing, and commit nothing.

**UI:**

- The menu item reads "Lock" (`lock`) or, on a locked layer, "Unlock"
  (`lock_open`). Toggling is one undo step, committed as the visibility
  toggle is.
- A locked row shows a small `lock` glyph next to its name. It's
  `aria-hidden`, and the row's accessible name gains ", locked".

## 4. Select Content

- Sets the selection to `contentBounds(engine, wholeCanvas)` of the layer,
  using `lib/pixel-engine/transform.js`. The selection overlay and the
  selection action bar update as they do for a drawn selection.
- Disabled on an empty layer.
- It's not an undo step, the same as drawing a selection.
- It's named "Select Content" rather than Pixelmator's "Load Selection",
  because Pixi's selection is the bounding rectangle, not an exact outline
  of the pixels.

## 5. Building the menu and the strip

**Item kinds** (`js/layers-ui.js`):

- `openContextMenu()` accepts a new item kind,
  `{ type: 'strip', items: [{ label, icon, disabled, onSelect }] }`. It
  renders a `div.action-capsule[role="group"][aria-label="Edit"]` holding
  one `button.action-capsule-segment[role="menuitem"]` per item, with the
  icon over the label.
- The existing ArrowUp/ArrowDown handler already walks every
  `[role="menuitem"]:not(:disabled)` in DOM order, so the strip needs no
  new key code. Left/right isn't added.
- The capsule fills the menu's width, with the menu's own inline padding
  around it.

**Testable state:**

- A pure `layerMenuState({ layer, layers, selection, atLayerCap })`
  returns the enabled/disabled flags and labels: `copy`, `cut`, `paste`,
  `duplicate`, `lock` (label and icon), `selectContent`, `merge`, `group`,
  `moveUp`, `moveDown`, `delete`.
- `layerMenuItems()` maps that state onto items. "Has content" comes from
  `contentBounds`, which `layerMenuItems()` passes in as a precomputed
  boolean, so the state function stays pure.

**Shared capsule CSS** (`style.css`):

- `.color-picker-actions` / `.color-picker-action` become the shared
  `.action-capsule` / `.action-capsule-segment`. The colour picker's
  Add/Ramp markup switches to the new names, and the old selectors are
  removed.
- It has its own `border-radius: 999px` and is not `.glass-pill`, because
  `js/layout.js` toggles that class per layout.
- Segments are at least 52px tall (the hit-target floor is 44px), divided
  by a 1px `--glass-border` line, with hover and focus-visible as today.
- `.action-capsule-segment:disabled` gets `opacity: 0.4` and
  `cursor: default`, with no hover background.

**Icons:** add `content_cut`, `content_paste`, `lock_open` and `select` to
`index.html`'s `icon_names=` list, kept in alphabetical order.
`content_copy`, `library_add` and `lock` are already there.

## 6. Modules

| Module | Change |
|---|---|
| `js/clipboard.js` (new) | Pure: `cropToContent(source, rect)` (`source` is `{ data, width, height }`) → `{ x, y, width, height, data } \| null`; `matchesRecord(record, decoded)` (true when sizes match, alpha is within ±1, and colour is within `ceil(255 / alpha)` where alpha isn't 0; this allows for the browser's premultiplied-alpha rounding in a PNG round trip); `placeOnCanvas(region, canvasWidth, canvasHeight)` → a full-canvas RGBA buffer with `region` stamped at its `x, y`. Images from other apps go through `fitImageToCanvas(image, w, h, false)`, which already centres them. Browser wiring: `writeImage(blobPromise)`, `readImage()`, `imageFromPasteEvent(e)`, and the in-app record (`setRecord`, `getRecord`). |
| `js/workspace.js` | `copyActive()`, `cutActive()`, `pasteImage(source)` and `selectActiveContent()`, exported for `layers-ui.js`. Also `activeLayerEditable()` with its checks, and the ⌘C/⌘X/⌘V bindings. |
| `lib/pixel-engine/layers.js` | `locked`; `setLocked`; merge refusals; `insertLayerAbove(index, { name, data, opacity, blendMode })` for Paste, which shares placement and naming with `duplicateLayer`. |
| `js/layers-ui.js` | Strip item kind, `layerMenuState`, new order, Lock/Unlock, row lock glyph. |
| `style.css`, `index.html` | `.action-capsule` refactor, row lock glyph, icon names. |

## 7. Testing

**Unit tests (node, `test/`):**

- `clipboard.test.js`:
  - `cropToContent`: an empty area gives null, the crop is tight, and a
    selection is clipped to the canvas.
  - `matchesRecord`: an exact match, a match within rounding, different
    sizes, different pixels, colour ignored where alpha is 0.
  - `placeOnCanvas`: stamps in place, and clips a region that hangs off
    the canvas.
- `LayerStack`:
  - `locked` round-trips through snapshot/restore and `toProjectRecord`.
  - A record without `locked` loads unlocked.
  - `setLocked` refuses a reference layer.
  - Merges refuse locked layers.
  - Duplicate gives an unlocked copy.
  - `insertLayerAbove`: placement, group, naming, the cap.
- `layerMenuState`:
  - Cut is disabled with no selection, and on a locked layer.
  - Copy is disabled on an empty layer.
  - Paste is disabled at the cap.
  - The Lock label and icon flip.
  - Select Content is disabled when the layer is empty.

**WebKit via Playwright** (a persistent context, see the headless-testing
note):

- The menu opens and shows the order and disabled states above.
- Locking a layer, then a pencil stroke, leaves the pixels unchanged and
  shows the toast.
- Select Content sets the selection rectangle.
- Copy then ⌘V adds a new layer with the same pixels in place.
- A synthetic `paste` event with a foreign PNG adds a centred layer.

**On the iPad (manual):**

- The menu Paste with Safari's Paste bubble.
- Copying from Pixi into Photos or Notes.
- Pasting a screenshot into Pixi.

**Before code review:** a `web-design-guidelines` pass over the menu and
strip markup and CSS.

## 8. Docs on the same branch

- `docs/specs/layers/spec.md`: menu layout, Lock, Select Content.
- New `docs/specs/clipboard/spec.md`: Cut, Copy, Paste, the keyboard, and
  the browser fallbacks.
- `docs/ui-reference.md`: the menu, the strip, the row lock glyph.
- `docs/roadmap.md`: a new entry.
