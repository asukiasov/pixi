"""Turn a generated mascot sheet into an app sprite (docs/mascot/README.md).

    python3 scripts/mascot-sprite.py docs/mascot/eraser.png assets/mascot/eraser.png [--preview out.png]

Needs Pillow and numpy (dev-only; the app itself has no Python). Steps:
removes the flat white background by flood fill from the edges, finds the
characters (the tall connected shapes, left to right), gives every loose
bit (dots, crumbs, splashes) to the character it is closest to, aligns
each frame on the head's "+" mark, and packs 256 x 256 frames into one
row as a 256-colour PNG.

Every sheet is cropped at the same scale (CROP source px -> 256), so the
axolotl is the same size for every tool. Printed margins below ~10 px
mean the drawing nearly touches the frame edge; negative ones mean it was
cut off.
"""
import argparse
from collections import deque

import numpy as np
from PIL import Image

OUT = 256
CROP = 380         # source px per frame (matches pencil.png)
CENTER_Y = 409     # source y of the crop centre
OFFSET_X = -10     # crop centre relative to the "+" mark
MARK_RGB = np.array([222, 150, 176])
BG_MIN = 228       # a pixel is background-white if every channel is above this
MAIN_MIN_HEIGHT = 150


def flood_background(img):
    h, w = img.shape[:2]
    white = img.min(axis=2) > BG_MIN
    bg = np.zeros((h, w), bool)
    q = deque([(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)]
              + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)])
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or bg[y, x] or not white[y, x]:
            continue
        bg[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return bg


def components(fg):
    h, w = fg.shape
    lab = np.zeros((h, w), int)
    comps = []
    for y0, x0 in zip(*np.where(fg)):
        if lab[y0, x0]:
            continue
        n = len(comps) + 1
        lab[y0, x0] = n
        q = deque([(y0, x0)])
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and fg[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        q.append((yy, xx))
        comps.append(np.array(pts))
    return lab, comps


def mark_x(img, pts):
    """x of the "+" mark: the mark-coloured pixels in the head's upper middle."""
    top, x0, x1 = pts[:, 0].min(), pts[:, 1].min(), pts[:, 1].max()
    best = None
    for y, x in pts:
        if top + 25 <= y <= top + 110 and np.abs(img[y, x] - MARK_RGB).sum() < 45:
            best = [] if best is None else best
            best.append(x)
    if not best:
        raise SystemExit(f'no "+" mark found in the character at x {x0}-{x1}')
    # The cheeks share the colour; the mark is the cluster nearest the middle.
    xs = np.array(best)
    mid = np.median(xs)
    return float(xs[np.abs(xs - mid) < 30].mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--frames', type=int, default=5)
    ap.add_argument('--preview')
    args = ap.parse_args()

    img = np.array(Image.open(args.src).convert('RGB')).astype(int)
    fg = ~flood_background(img)
    lab, comps = components(fg)
    heights = [c[:, 0].max() - c[:, 0].min() for c in comps]
    mains = sorted((i for i, hgt in enumerate(heights) if hgt >= MAIN_MIN_HEIGHT),
                   key=lambda i: comps[i][:, 1].min())
    if len(mains) != args.frames:
        raise SystemExit(f'found {len(mains)} characters, expected {args.frames}')

    owner = {i: k for k, i in enumerate(mains)}
    samples = [comps[i][::7] for i in mains]
    for i, pts in enumerate(comps):
        if i in owner:
            continue
        c = pts.mean(axis=0)
        owner[i] = int(np.argmin([np.min(np.hypot(*(s - c).T)) for s in samples]))

    strip = Image.new('RGBA', (OUT * args.frames, OUT))
    for k, i in enumerate(mains):
        ids = [j + 1 for j, o in owner.items() if o == k]
        alpha = np.isin(lab, ids)
        rgba = np.dstack([img, alpha * 255]).astype(np.uint8)
        ax = mark_x(img, comps[i])
        x0 = int(round(ax + OFFSET_X - CROP / 2))
        y0 = int(CENTER_Y - CROP / 2)
        tile = np.zeros((CROP, CROP, 4), np.uint8)
        sx0, sy0 = max(x0, 0), max(y0, 0)
        sx1, sy1 = min(x0 + CROP, img.shape[1]), min(y0 + CROP, img.shape[0])
        tile[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = rgba[sy0:sy1, sx0:sx1]
        ys, xs = np.where(alpha)
        print(f'frame {k + 1}: mark x {ax:.0f}, loose bits {len(ids) - 1}, margins '
              f'l {xs.min() - x0} r {x0 + CROP - 1 - xs.max()} '
              f't {ys.min() - y0} b {y0 + CROP - 1 - ys.max()}')
        strip.paste(Image.fromarray(tile).resize((OUT, OUT), Image.LANCZOS), (k * OUT, 0))

    strip.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE).save(args.dst, optimize=True)
    if args.preview:
        prev = Image.new('RGBA', strip.size, (236, 236, 240, 255))
        prev.alpha_composite(Image.open(args.dst).convert('RGBA'))
        prev.save(args.preview)


if __name__ == '__main__':
    main()
