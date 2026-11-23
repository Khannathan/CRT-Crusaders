#!/usr/bin/env python3
"""
Round 9 intake for the non-Sister art (crypt foes and bosses, Blasphemy poses, hunt
bosses, screen backgrounds, event scenes, gear/material icons, Deep Blasphemy and
Order mechanic icons). Takes the NATIVE PNGs ChatGPT delivered (one path per line in
a list file, later lines win) and writes game-ready files into src/assets:

  enemy-<id>[-blasphemy].png  128x192 -> enemy-full/<id>.png + a square bust in enemies/
  bg-*.png                    256x384 -> ui/
  event-*.png                 192x128 -> ui/
  gear-*.png, item-*.png      icons   -> ui/ (trimmed to the drawing, 1px margin)
  blasphemy-*.png, kw-*.png   32x32   -> ui/

Every image is palette-snapped (32 colours for figures and scenes, 24 for icons, no
dithering) and figures/icons get hard alpha, so they sit with the older art.
Names in SKIP (the redo list) are left out.

Usage: python3 tools/art-intake/round9.py <list.txt> [skip.txt]
"""
import os, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'src' / 'assets'
paths = [l.strip() for l in open(sys.argv[1]) if l.strip()]
skip = set(l.strip() for l in open(sys.argv[2])) if len(sys.argv) > 2 else set()
latest = {}
for p in paths: latest[os.path.basename(p)] = p

def snap(im, n, alpha):
    im = im.convert('RGBA'); a = np.array(im)[..., 3]
    rgb = Image.new('RGB', im.size, (0, 0, 0)); rgb.paste(im, mask=im.split()[3] if alpha else None)
    q = rgb.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    if not alpha: return q
    out = np.array(q.convert('RGBA')); out[..., 3] = np.where(a >= 128, 255, 0)
    out[a < 128] = 0
    return Image.fromarray(out)

def save(im, rel):
    dest = ROOT / rel; dest.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == 'RGBA':
        cols = im.getcolors(256)
        if cols is not None: im = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    im.save(dest, optimize=True)

def trim(im, pad=1):
    a = np.array(im)[..., 3]; ys, xs = np.nonzero(a > 0)
    return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + 1 + pad), min(im.height, ys.max() + 1 + pad)))

def square(im):
    s = max(im.size); out = Image.new('RGBA', (s, s)); out.alpha_composite(im, ((s - im.width) // 2, (s - im.height) // 2)); return out

def bust_box(im):
    """The square head-and-shoulders crop used for the battle bust (same rule as cut.py)."""
    a = np.array(im)[..., 3]; ys, xs = np.nonzero(a > 0); top, bot, l, r = ys.min(), ys.max(), xs.min(), xs.max()
    bh = bot - top + 1
    side = int(np.clip(bh * 0.5, 64, 96)) if bh > 90 else bh + 12
    head = np.nonzero(a[top:top + max(8, side // 3)].any(0))[0]
    cx = (head.min() + head.max()) // 2 if bh > 90 else (l + r) // 2
    y0 = max(0, top - 6) if bh > 90 else max(0, (top + bot) // 2 - side // 2)
    x0 = int(np.clip(cx - side // 2, 0, 128 - side))
    return x0, y0, side

def bust(crop, side):
    g = np.linspace(0, 1, side); vv = np.sqrt((g[None, :] - .5) ** 2 + (g[:, None] - .45) ** 2)
    bands = np.round(np.clip(vv * 1.6, 0, 1) * 3) / 3
    arr = np.zeros((side, side, 4)); arr[..., 3] = 255
    arr[..., :3] = np.array([58, 40, 54]) * (1 - bands)[..., None] + np.array([20, 15, 22]) * bands[..., None]
    bg = Image.fromarray(arr.astype('uint8')); bg.alpha_composite(crop)
    return bg.convert('RGB')

done = []
figs = {}
for name, p in sorted(latest.items()):
    if name in skip or name.startswith('sheet-'): continue
    im = Image.open(p)
    if name.startswith('enemy-'):
        figs[name[6:-4]] = snap(im, 32, True)
    elif name.startswith(('bg-', 'event-')):
        save(snap(im, 32, False), 'ui/' + name); done.append(name)
    elif name.startswith(('gear-', 'item-')):
        save(trim(snap(im, 24, True)), 'ui/' + name); done.append(name)
    elif name.startswith(('blasphemy-', 'kw-')):
        save(snap(im, 24, True), 'ui/' + name); done.append(name)
    else:
        print('unknown', name)
for n, im in sorted(figs.items()):
    save(im, f'enemy-full/{n}.png'); done.append('enemy-' + n)
    if n.endswith('-blasphemy'): continue
    x0, y0, side = bust_box(im)
    save(bust(im.crop((x0, y0, x0 + side, y0 + side)), side), f'enemies/{n}.png')
    if n + '-blasphemy' in figs:
        save(bust(figs[n + '-blasphemy'].crop((x0, y0, x0 + side, y0 + side)), side), f'enemies/{n}-blasphemy.png')
print(len(done), 'files written')
