#!/usr/bin/env python3
"""
Intake for Sister animation sheets (see Part 2 of art/crt-crusaders-full-art-redo.txt).

ChatGPT exports each sheet at 1024 x 1536: a 2 x 2 grid of 512 x 768 cells, one
frame per cell, each native pixel drawn as a 4 x 4 block. The game wants the
native size: 256 x 384 (four 128 x 192 frames), crisp, on the Sister's own palette.

For every <id>_<anim>.png found (a folder or a .zip) this:
  1. shrinks each cell 4x by taking the most common colour of each 4 x 4 block
  2. makes every pixel fully opaque or fully clear (no soft edges)
  3. snaps colours to the palette of her still figure (src/assets/full-body/<id>.png)
  4. moves each frame up or down so her feet stand on the same floor line as her still
     (except death, where she falls)
and writes src/assets/anim/<id>_<anim>.png. The game picks them up on the next build.

Usage: python3 tools/intake_anims.py <folder-or-zip> [more ...]
"""
import io
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STILLS = ROOT / 'src' / 'assets' / 'full-body'
OUT = ROOT / 'src' / 'assets' / 'anim'
ANIMS = ['idle', 'run', 'attack', 'skill', 'litany', 'hit', 'death', 'victory']
NAME = re.compile(r'(CC-W\d{3})_(' + '|'.join(ANIMS) + r')\.png$', re.I)
FW, FH = 128, 192


def sources(paths):
    for p in map(Path, paths):
        if p.is_dir():
            for f in sorted(p.rglob('*.png')):
                yield f.name, f.read_bytes()
        elif p.suffix.lower() == '.zip':
            with zipfile.ZipFile(p) as z:
                for n in sorted(z.namelist()):
                    if n.lower().endswith('.png') and not n.startswith('__MACOSX'):
                        yield Path(n).name, z.read(n)
        elif p.suffix.lower() == '.png':
            yield p.name, p.read_bytes()


def shrink(cell: Image.Image) -> Image.Image:
    """Most common colour of each block, so stray edge pixels never win."""
    w, h = cell.size
    bx, by = w / FW, h / FH
    src = cell.load()
    out = Image.new('RGBA', (FW, FH))
    dst = out.load()
    for y in range(FH):
        for x in range(FW):
            x0, y0 = int(x * bx), int(y * by)
            x1, y1 = max(x0 + 1, int((x + 1) * bx)), max(y0 + 1, int((y + 1) * by))
            c = Counter()
            for yy in range(y0, y1):
                for xx in range(x0, x1):
                    r, g, b, a = src[xx, yy]
                    c[(r, g, b, 255) if a >= 128 else (0, 0, 0, 0)] += 1
            dst[x, y] = c.most_common(1)[0][0]
    return out


def palette_of(still: Image.Image):
    data = still.get_flattened_data() if hasattr(still, 'get_flattened_data') else still.getdata()
    return sorted({p for p in data if p[3] == 255})


def snap(img: Image.Image, pal):
    if not pal:
        return img
    px = img.load()
    cache = {}
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if p[3] == 0:
                continue
            if p not in cache:
                cache[p] = min(pal, key=lambda q: (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2)
            px[x, y] = cache[p]
    return img


def floor_of(img: Image.Image):
    bbox = img.getchannel('A').getbbox()
    return bbox[3] if bbox else None


def main(args):
    if not args:
        print(__doc__)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    done = 0
    for name, data in sources(args):
        m = NAME.search(name)
        if not m:
            continue
        sid, anim = m.group(1).upper(), m.group(2).lower()
        sheet = Image.open(io.BytesIO(data)).convert('RGBA')
        still_path = STILLS / f'{sid}.png'
        still = Image.open(still_path).convert('RGBA') if still_path.exists() else None
        pal = palette_of(still) if still else []
        floor = floor_of(still) if still else None
        cw, ch = sheet.width // 2, sheet.height // 2
        out = Image.new('RGBA', (FW * 2, FH * 2))
        for i in range(4):
            cx, cy = (i % 2) * cw, (i // 2) * ch
            frame = snap(shrink(sheet.crop((cx, cy, cx + cw, cy + ch))), pal)
            f = floor_of(frame)
            if floor and f and anim != 'death' and f != floor:
                moved = Image.new('RGBA', frame.size)
                moved.paste(frame, (0, floor - f))
                frame = moved
            out.paste(frame, ((i % 2) * FW, (i // 2) * FH))
        dest = OUT / f'{sid}_{anim}.png'
        # A palette PNG: a few KB, like the still figures.
        colours = out.getcolors(1 << 16)
        (out.quantize(colors=256, method=Image.Quantize.FASTOCTREE) if colours and len(colours) <= 256 else out).save(dest, optimize=True)
        done += 1
        print(f'{sid} {anim}: {sheet.width}x{sheet.height} -> {dest.relative_to(ROOT)}' + ('' if still else ' (no still figure: colours not snapped)'))
    print(f'{done} sheet(s) ready.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
