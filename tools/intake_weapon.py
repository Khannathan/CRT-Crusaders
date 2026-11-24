#!/usr/bin/env python3
"""
Intake for Sister weapon prop sheets (sister-bible CHATGPT_PROJECT_INSTRUCTIONS: step 1,
"her weapon and relic alone, side view, full length, plain background").

For every prop sheet found (a folder, a .zip or single .png files) this:
  1. clears the plain background (the colour of the sheet's corners, flooded in from the edges)
  2. crops to the weapon and relic, centred on a square
  3. shrinks it to 128 x 128 (most common colour per block, so pixel art stays crisp)
and writes src/assets/ui/weapon-<id>.png. The game shows it as her signature
weapon (Sister > Weapon tab) on the next build, in place of the class stand-in.

File names: anything that starts with her id and has "weapon" or "prop" in it, e.g.
IV-LUR_weapon.png or IV-LUR_Paulina_Macra_Prop_Sheet.png. Pass --id to name the
Sister yourself when the file name doesn't start with it.

Usage: python3 tools/intake_weapon.py [--id IV-LUR] <folder-or-zip-or-png> [more ...]
"""
import io
import re
import sys
from collections import Counter, deque
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from intake_anims import sources  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'assets' / 'ui'
NAME = re.compile(r'^([A-Z]{2}-[A-Z0-9]+(?:-[A-Z0-9]+)?)_.*(weapon|prop)', re.I)
SIZE = 128
TOL = 48


def clear_background(img: Image.Image) -> Image.Image:
    """Flood the corner colour in from the edges and make it clear."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    corners = Counter(px[x, y][:3] for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    bg = corners.most_common(1)[0][0]
    near = lambda p: p[3] < 128 or sum(abs(p[i] - bg[i]) for i in range(3)) <= TOL
    seen = bytearray(w * h)
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if not near(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return img


def square(img: Image.Image) -> Image.Image:
    box = img.getbbox()
    if not box:
        raise ValueError('nothing left after clearing the background')
    img = img.crop(box)
    side = max(img.size) + 4
    out = Image.new('RGBA', (side, side))
    out.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return out


def shrink(img: Image.Image) -> Image.Image:
    if img.width <= SIZE:
        return img.resize((SIZE, SIZE), Image.NEAREST)
    b = img.width / SIZE
    src = img.load()
    out = Image.new('RGBA', (SIZE, SIZE))
    dst = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            x0, y0 = int(x * b), int(y * b)
            x1, y1 = max(x0 + 1, int((x + 1) * b)), max(y0 + 1, int((y + 1) * b))
            c = Counter()
            for yy in range(y0, y1):
                for xx in range(x0, x1):
                    r, g, bl, a = src[xx, yy]
                    c[(r, g, bl, 255) if a >= 128 else (0, 0, 0, 0)] += 1
            # keep thin blades: any solid pixel in the block beats the clear background when it holds a quarter
            solid = [(k, n) for k, n in c.most_common() if k[3]]
            total = sum(c.values())
            dst[x, y] = solid[0][0] if solid and sum(n for _, n in solid) * 4 >= total else (0, 0, 0, 0)
    return out


def main(args):
    sid = None
    if args[:1] == ['--id']:
        sid, args = args[1], args[2:]
    if not args:
        sys.exit(__doc__)
    done = 0
    for name, data in sources(args):
        m = NAME.match(name)
        who = sid or (m and m.group(1).upper())
        if not who or not (sid or m):
            continue
        img = shrink(square(clear_background(Image.open(io.BytesIO(data)))))
        OUT.mkdir(parents=True, exist_ok=True)
        dest = OUT / f'weapon-{who}.png'
        img.save(dest)
        print(f'{name} -> {dest.relative_to(ROOT)}')
        done += 1
    if not done:
        sys.exit('No prop sheets found (names start with her id and contain "weapon" or "prop", or pass --id).')


if __name__ == '__main__':
    main(sys.argv[1:])
