#!/usr/bin/env python3
"""
Intake for Sister pose sheets (see sister-bible/sprite-plan/sprite-plan.md).

ChatGPT draws each Sister one still (full-body/<id>.png, 128 x 192) and one pose
sheet: a 2 x 2 grid of four 128 x 192 poses in this order

    STRIKE  CAST
    LITANY  HURT

delivered native (256 x 384) and/or as the exact 4x export (1024 x 1536).
The game plays these poses for her attacks, skills, Litany, hits and death, and
builds the in-betweens in code (src/ui/sisterSprite.ts).

For every pose sheet found (a folder, a .zip or single .png files) this:
  1. shrinks the sheet to native 256 x 384 if needed (most common colour per block)
  2. makes every pixel fully opaque or fully clear (a flat #FF00FF background is keyed out)
  3. snaps colours to her still's palette (src/assets/full-body/<id>.png)
  4. moves each pose up or down so her feet stand on her still's floor line
and writes src/assets/poses/<id>.png. The game picks it up on the next build.

File names: anything that starts with her id and has "poses" in it, e.g.
IV-LUR_poses.png or IV-LUR_Paulina_Macra_Poses_R2_256x384.png. Pass --id to
name the Sister yourself when the file name doesn't start with it.

Usage: python3 tools/intake_poses.py [--id IV-LUR] <folder-or-zip-or-png> [more ...]
"""
import io
import re
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from intake_anims import FH, FW, floor_of, palette_of, shrink, snap, sources  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
STILLS = ROOT / 'src' / 'assets' / 'full-body'
OUT = ROOT / 'src' / 'assets' / 'poses'
NAME = re.compile(r'^([A-Z]{2}-[A-Z0-9]+(?:-[A-Z0-9]+)?|CC-W\d{3})_.*poses', re.I)
POSES = ['STRIKE', 'CAST', 'LITANY', 'HURT']


def key_magenta(img: Image.Image) -> Image.Image:
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a and r > 230 and b > 230 and g < 40:
                px[x, y] = (0, 0, 0, 0)
    return img


def cut(sheet: Image.Image, pal, floor):
    """The four poses at native size on her palette, feet on her floor line."""
    cw, ch = sheet.width // 2, sheet.height // 2
    out = Image.new('RGBA', (FW * 2, FH * 2))
    notes = []
    for i in range(4):
        cx, cy = (i % 2) * cw, (i // 2) * ch
        frame = shrink(key_magenta(sheet.crop((cx, cy, cx + cw, cy + ch))))
        frame = snap(frame, pal)
        f = floor_of(frame)
        if floor and f and f != floor:
            moved = Image.new('RGBA', frame.size)
            moved.paste(frame, (0, floor - f))
            frame = moved
            notes.append(f'{POSES[i]} feet moved {floor - f:+d}')
        out.paste(frame, ((i % 2) * FW, (i // 2) * FH))
    return out, notes


def save_indexed(img: Image.Image, dest: Path):
    """A palette PNG with her exact colours (a few KB). Octree quantizing shifts colours, so map them by hand."""
    colours = [c for _, c in (img.getcolors(1 << 16) or [])]
    opaque = sorted({c[:3] for c in colours if c[3] == 255})
    if len(opaque) > 255:
        img.save(dest, optimize=True)
        return
    index = {c: i + 1 for i, c in enumerate(opaque)}
    out = Image.new('P', img.size, 0)
    src, dst = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            p = src[x, y]
            if p[3] == 255:
                dst[x, y] = index[p[:3]]
    flat = [0, 0, 0] + [v for c in opaque for v in c]
    out.putpalette(flat + [0] * (768 - len(flat)))
    out.info['transparency'] = 0
    out.save(dest, optimize=True, transparency=0)


def main(argv):
    sid_arg = None
    if '--id' in argv:
        i = argv.index('--id')
        sid_arg = argv[i + 1].upper()
        argv = argv[:i] + argv[i + 2:]
    if not argv:
        print(__doc__)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    # Native sheets last, so they win over an export of the same drawing.
    found = sorted(sources(argv), key=lambda nd: '256x384' in nd[0] or len(nd[1]) < 60000)
    done = 0
    for name, data in found:
        m = NAME.search(name)
        if not m and not (sid_arg and 'pose' in name.lower()):
            continue
        sid = sid_arg or m.group(1).upper()
        sheet = Image.open(io.BytesIO(data)).convert('RGBA')
        if sheet.width * 3 != sheet.height * 2:
            print(f'{name}: {sheet.width}x{sheet.height} is not a 2 x 2 sheet of 128 x 192 poses, skipped')
            continue
        still_path = STILLS / f'{sid}.png'
        still = Image.open(still_path).convert('RGBA') if still_path.exists() else None
        pal = palette_of(still) if still else []
        out, notes = cut(sheet, pal, floor_of(still) if still else None)
        dest = OUT / f'{sid}.png'
        save_indexed(out, dest)
        done += 1
        extra = '' if still else ' (no still figure yet: colours and feet not checked)'
        print(f'{sid}: {name} {sheet.width}x{sheet.height} -> {dest.relative_to(ROOT)}{extra}' + (f' [{", ".join(notes)}]' if notes else ''))
    print(f'{done} pose sheet(s) ready.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
