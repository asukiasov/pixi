# Mascot sprites

Pixi's mascot is a pink axolotl. When the user picks a tool, it pops up in a
glass bubble at the top centre of the workspace for 3 seconds and plays a
short loop of itself using that tool. Pencil is the first one; the rest are
added tool by tool.

- Code: `js/mascot.js` (timing logic, tested in `test/mascot.test.js`),
  styles under "Tool mascot bubble" in `style.css`.
- Shipped sprites: `assets/mascot/<tool>.png`.
- This folder (`docs/mascot/`): source artwork and generator output. It is
  not loaded by the app.

## Sprite specs

Every tool's sprite follows these specs, so the bubble stays the same size
and the code stays the same.

### Frames

| | |
|---|---|
| Frames per tool | **3–6**, any count; **5** recommended |
| Time per frame | 200 ms |
| One loop | frames × 200 ms (5 frames = 1 s), repeating |
| Bubble on screen | 3 s (5 frames = 3 loops) |

The loop runs from the last frame straight back to frame 1, so the last
frame has to flow into the first. The frame count is set per tool in
`MASCOT_SPRITES` in `js/mascot.js`; nothing else changes.

### Size and layout

| | |
|---|---|
| One frame | **256 × 256 px**, square |
| Sheet | **frames × 256 wide, 256 high** (5 frames = 1280 × 256): one row, left to right in play order |
| Spacing | none: no gaps, borders or padding between frames |
| Shown at | 128 × 128 CSS px (2× for Retina) |

True pixel art is better if you can make it: draw each frame at
**64 × 64** (5 frames = sheet 320 × 64). The app scales it up without smoothing, so it
stays crisp and the file is tiny.

### Background

- **Transparent PNG** (RGBA). No white, no drop shadow, no glow, and no
  light halo around the outline.
- If the generator can't do transparency: **flat pure white `#FFFFFF`**,
  with no gradient, texture, noise or vignette. The white is removed by
  flood-filling from the edges, so any white detail (eye highlights, a
  light pencil tip) must be enclosed by the dark outline.

### Registration (no jitter)

- The axolotl is the same size and in the same place in every frame: feet
  on the same baseline, head centred on the same x.
- About 10% empty margin on every side. Nothing crosses a frame's edge:
  tail, tool, drawn line, sparkles.
- The axolotl is the same size across all tools, so every tool's bubble
  looks alike.

### Character

Keep it on-model with `pencil-sprite-2.png`: pink body, dark purple
outline, darker pink "+" mark on the forehead, blush cheeks, gills in pink,
blue, cyan and violet, short tail. The tool is drawn large and clearly
readable, since the bubble is small.

### File

- PNG with alpha, sRGB, under ~60 KB. A 256-color palette PNG keeps a
  5-frame sheet around 50 KB with no visible loss.
- Named after the tool's `data-tool` id: `assets/mascot/<tool>.png`.
- Tool ids: `pencil`, `eraser`, `bucket`, `brush`, `line`, `rectangle`,
  `ellipse`, `selection`, `move`, `hand`, `eyedropper`.
- To enable a tool's mascot, add `<tool>: { frames: N }` to
  `MASCOT_SPRITES` in `js/mascot.js`.

### Generator output

AI image generators rarely hit exact pixel sizes or transparency, and
rarely keep frames aligned. `scripts/mascot-sprite.py` turns a generated
sheet into the sprite:

```sh
python3 scripts/mascot-sprite.py docs/mascot/<tool>.png assets/mascot/<tool>.png --preview /tmp/<tool>-preview.png
```

It removes the white background, finds the characters, gives each loose
bit (dots, crumbs, splashes) to the nearest character, aligns every frame
on the head's "+" mark, and crops every tool at the same scale, so the
axolotl is the same size in all of them. It prints each frame's margins:
check none is negative (cut off), and look at the preview. It needs
Pillow and numpy, which are dev-only. The source sheet stays in this
folder as `<tool>.png`.

## Status

| Tool | Source | Sprite | Meets specs |
|---|---|---|---|
| pencil | `pencil-sprite-2.png` (5 frames; `pencil-sprite-1.png` was the earlier 3-frame version) | `assets/mascot/pencil.png` | Yes: 5 × 256 × 256, 51 KB |
| eraser | `eraser.png` | `assets/mascot/eraser.png` | Yes: 5 × 256 × 256, 56 KB |
| bucket | `bucket.png` | `assets/mascot/bucket.png` | Yes: 5 × 256 × 256, 59 KB |
| brush | `brush.png` | `assets/mascot/brush.png` | Yes: 5 × 256 × 256, 59 KB (paint stroke in frame 4 nearly touches the bottom edge) |
| rectangle | `rectangle.png` | `assets/mascot/rectangle.png` | Yes: 5 × 256 × 256, 50 KB |
| line, ellipse, selection, move, hand, eyedropper | — | — | Not made yet |

## Gemini prompt

Attach `pencil-sprite-2.png` as the character reference, then replace
`<TOOL>` and `<ACTION>` (for example "a big pink eraser" / "rubs out a
wobbly line, then holds the eraser up proudly").

```text
Pixel art sprite sheet of a game mascot: the same cute pink axolotl as in
the attached reference image. Keep it exactly on-model: pink body, dark
purple pixel outline, darker pink "+" mark on the forehead, pink blush
cheeks, gills in pink, blue, cyan and violet, short pink tail, simple happy
face.

The axolotl is holding <TOOL> and <ACTION>.

Layout: exactly 5 animation frames in one horizontal row, evenly spaced,
each frame the same width, a short looping animation read left to right.
Frame 5 must lead smoothly back into frame 1.

Consistency between frames: the axolotl is the same size and stands in the
same spot in all 5 frames, feet on the same ground line, head at the same
height. Only the arms, the tool and the expression change.

Each frame is a square with generous empty space around the character.
Nothing touches or crosses the frame edges, including the tail, the tool
and any effects.

Background: completely flat pure white (#FFFFFF), no shadows, no ground,
no gradient, no texture, no vignette, no text, no labels, no frame
numbers, no borders or dividers between frames.

Style: clean 16-bit pixel art with crisp square pixels and a dark outline,
limited palette, no anti-aliasing, no blur, no glow. The tool is drawn big
and easy to recognise at small size.
```
