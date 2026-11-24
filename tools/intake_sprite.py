#!/usr/bin/env python3
"""
Clean pixel pass for a Sister's battle still (her 128 x 192 full-body sprite).

ChatGPT paints the Sister big (about 1024 x 1536, any size works) and sends the
raw image: NO shrinking, colour cutting or dithering on its side. Shrinking a
detailed painting with nearest-neighbour keeps one random pixel per block and
turns the detail into static (Acilia, AM-SSR-ABB, 2026-11-24), so that step
happens here instead, done properly:

  1. background out: kept if transparent, else a flat #FF00FF or a flat colour
     flooded in from the corners
  2. crop to her, then shrink with AREA AVERAGING (every source pixel counts)
     so she fits the sprite box: soles on row 184, crown no higher than row 12,
     inside x 6-122, centred on column 64
  3. every pixel fully opaque or fully clear (no soft fringe)
  4. contrast and colour lifted a touch (--punch, default 1.2; 1 = off), since
     averaging flattens them
  5. her colours cut to --colors (default 24, the UR cap; 16 for the EGA test) with no dithering, then lone
     speckle pixels merged into their neighbours
  6. a 1 px outline of her darkest colour round the silhouette (--no-outline to skip)

Writes src/assets/full-body/<id>.png (a small palette PNG); the game picks it
up on the next build and the pixel rig (src/ui/pixelRig.ts) animates it.

File names: anything that starts with her id, e.g. AM-SSR-ABB_raw.png or
AM-SSR-ABB_Acilia_Ahenobarba_Sprite_1024x1536.png. Pose sheets, busts,
splashes and weapon sheets in the same folder or zip are skipped. Pass --id to
name the Sister yourself.

Usage: python3 tools/intake_sprite.py [--id AM-SSR-ABB] [--colors 24] [--punch 1.2] [--no-outline] [--preview out.png] <folder|zip|png> [more ...]
"""
import io
import re
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from intake_anims import sources  # noqa: E402
from intake_poses import save_indexed  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'assets' / 'full-body'
NAME = re.compile(r'^([A-Z]{2}-[A-Z0-9]+(?:-[A-Z0-9]+)?|CC-W\d{3})_', re.I)
SKIP = re.compile(r'pose|bust|splash|weapon|prop|parts|portrait', re.I)

FW, FH = 128, 192
FEET = 184          # lowest row of her soles
TOP = 13            # highest row she may reach (the outline adds one above)
LEFT, RIGHT = 6, 122
MID = 64


def pixels(img: Image.Image):
    return list(img.get_flattened_data() if hasattr(img, 'get_flattened_data') else img.getdata())


def is_bg(c, ref, tol=28):
    return all(abs(int(a) - int(b)) <= tol for a, b in zip(c[:3], ref[:3]))


def key_background(img: Image.Image) -> Image.Image:
    """Clears the background: magenta anywhere, else a flat colour flooded in from the corners."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    alpha = img.getchannel('A')
    if alpha.getextrema()[0] < 128:  # already transparent somewhere
        return img
    magenta = False
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if r > 200 and b > 200 and g < 70:
                px[x, y] = (0, 0, 0, 0)
                magenta = True
    if magenta:
        # Her edge pixels mixed with the magenta: clearly pink-purple, much brighter in red AND blue than green.
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and r - g > 90 and b - g > 90 and abs(r - b) < 70:
                    px[x, y] = (0, 0, 0, 0)
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    ref = Counter(c[:3] for c in corners if c[3]).most_common(1)
    if not ref:
        return img
    ref = ref[0][0]
    # Flood fill from every border pixel that matches the background colour.
    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        c = px[x, y]
        if c[3] and not is_bg(c, ref):
            continue
        px[x, y] = (0, 0, 0, 0)
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    clear_pockets(img, ref)
    return img


def clear_pockets(img: Image.Image, ref, tol=20):
    """Background caught between her arm and body, her legs, a weapon: big enclosed patches of the background colour."""
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    big = max(64, w * h // 4000)
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if seen[i] or not px[sx, sy][3] or not is_bg(px[sx, sy], ref, tol):
                continue
            comp, stack = [], [(sx, sy)]
            seen[i] = 1
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                        c = px[nx, ny]
                        if c[3] and is_bg(c, ref, tol):
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
            if len(comp) >= big:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)


def defringe(img: Image.Image, k: float) -> Image.Image:
    """Shaves the soft edge (background mixed into her outer pixels) before shrinking: about a third of a sprite pixel."""
    from PIL import ImageFilter
    n = int(k / 3) * 2 + 1
    if n < 3:
        return img
    a = img.getchannel('A').point(lambda v: 255 if v >= 128 else 0).filter(ImageFilter.MinFilter(n))
    img = img.copy()
    img.putalpha(a)
    return img


def area_shrink(img: Image.Image, size) -> Image.Image:
    """Area-average shrink with premultiplied alpha, so clear pixels don't darken her edges."""
    r, g, b, a = img.split()
    from PIL import ImageChops
    pre = Image.merge('RGB', [ImageChops.multiply(ch, a) for ch in (r, g, b)])
    pre = pre.resize(size, Image.BOX)
    a2 = a.resize(size, Image.BOX)
    out = Image.new('RGBA', size)
    pp, ap, op = pre.load(), a2.load(), out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            al = ap[x, y]
            if al >= 128:
                c = pp[x, y]
                op[x, y] = tuple(min(255, round(v * 255 / al)) for v in c) + (255,)
    return out


def place(fig: Image.Image) -> Image.Image:
    """Shrinks the cropped figure into the sprite box, soles on FEET, centred on MID."""
    box = fig.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox()
    if not box:
        raise ValueError('no figure found')
    fig = fig.crop(box)
    fw, fh = fig.size
    k = min((FEET + 1 - TOP) / fh, (RIGHT - LEFT) / fw)
    tw, th = max(1, round(fw * k)), max(1, round(fh * k))
    small = area_shrink(defringe(fig, 1 / k), (tw, th))
    out = Image.new('RGBA', (FW, FH))
    x = max(LEFT, min(RIGHT - tw, MID - tw // 2))
    out.paste(small, (x, FEET + 1 - th))
    return out


def punch(img: Image.Image, amount: float) -> Image.Image:
    """Averaging pixels flattens light and colour a little; win it back so she doesn't look washed out."""
    if amount == 1:
        return img
    from PIL import ImageEnhance
    a = img.getchannel('A')
    rgb = ImageEnhance.Contrast(img.convert('RGB')).enhance(amount)
    rgb = ImageEnhance.Color(rgb).enhance(1 + (amount - 1) * 0.75)
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out


def quantize(img: Image.Image, n: int) -> Image.Image:
    """Her colours cut to n with no dithering (max-coverage, so small accent hues like a teal lining survive)."""
    opaque = [p for p in pixels(img) if p[3] == 255]
    if not opaque:
        return img
    strip = Image.new('RGB', (len(opaque), 1))
    strip.putdata([p[:3] for p in opaque])
    pal_img = strip.quantize(n, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE)
    pal = pal_img.getpalette()[: n * 3]
    cols = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
    out = img.copy()
    px = out.load()
    cache = {}
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if p[3] != 255:
                px[x, y] = (0, 0, 0, 0)
                continue
            c = cache.get(p[:3])
            if c is None:
                c = min(cols, key=lambda q: (q[0] - p[0]) ** 2 * 3 + (q[1] - p[1]) ** 2 * 4 + (q[2] - p[2]) ** 2 * 2)
                cache[p[:3]] = c
            px[x, y] = c + (255,)
    return out


def despeckle(img: Image.Image) -> Image.Image:
    """A pixel unlike all 8 neighbours, with one colour holding 5+ of them, takes that colour (kills static, keeps lines)."""
    src = img.copy().load()
    out = img.copy()
    dst = out.load()
    for y in range(1, img.height - 1):
        for x in range(1, img.width - 1):
            p = src[x, y]
            if p[3] != 255:
                continue
            ns = [src[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
            if any(q == p for q in ns):
                continue
            c, k = Counter(q for q in ns if q[3] == 255).most_common(1)[0] if any(q[3] == 255 for q in ns) else (None, 0)
            if c and k >= 5:
                dst[x, y] = c
    return out


def outline(img: Image.Image) -> Image.Image:
    """A 1 px ring of her darkest colour round the outside of her silhouette."""
    px = img.load()
    cols = {p[:3] for p in pixels(img) if p[3] == 255}
    if not cols:
        return img
    dark = min(cols, key=lambda c: c[0] * 3 + c[1] * 4 + c[2] * 2) + (255,)
    out = img.copy()
    dst = out.load()
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < img.width and 0 <= ny < img.height and px[nx, ny][3]:
                    if ny <= FEET or dy:  # never grow below the soles
                        dst[x, y] = dark
                    break
    # Keep rows under the soles empty.
    for y in range(FEET + 1, img.height):
        for x in range(img.width):
            dst[x, y] = (0, 0, 0, 0)
    return out


def clean(raw: Image.Image, colors=24, ring=True, amount=1.2) -> Image.Image:
    fig = punch(place(key_background(raw)), amount)
    fig = despeckle(quantize(fig, colors - (1 if ring else 0)))
    return outline(fig) if ring else fig


def report(img: Image.Image) -> str:
    box = img.getchannel('A').getbbox()
    cols = len({p for p in pixels(img) if p[3] == 255})
    return f'{cols} colours, box x {box[0]}-{box[2] - 1}, rows {box[1]}-{box[3] - 1}'


def main(argv):
    opts = {'--id': None, '--colors': '24', '--punch': '1.2', '--preview': None}
    ring = True
    rest = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in opts:
            opts[a] = argv[i + 1]
            i += 2
        elif a == '--no-outline':
            ring = False
            i += 1
        else:
            rest.append(a)
            i += 1
    if not rest:
        print(__doc__)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    found = sorted(sources(rest), key=lambda nd: -len(nd[1]))  # biggest (rawest) file first
    done = set()
    for name, data in found:
        if SKIP.search(name):
            continue
        m = NAME.search(name)
        sid = (opts['--id'] or (m.group(1) if m else '')).upper()
        if not sid or sid in done:
            continue
        raw = Image.open(io.BytesIO(data))
        if raw.width < 2 * FW:
            print(f'{name}: {raw.width}x{raw.height} is already small; send the raw big image instead. Skipped.')
            continue
        img = clean(raw, int(opts['--colors']), ring, float(opts['--punch']))
        save_indexed(img, OUT / f'{sid}.png')
        done.add(sid)
        print(f'{sid}: {name} -> src/assets/full-body/{sid}.png ({report(img)})')
        if opts['--preview']:
            prev = Image.new('RGBA', (FW * 4, FH * 4), (28, 20, 30, 255))
            prev.alpha_composite(img.resize((FW * 4, FH * 4), Image.NEAREST))
            prev.save(opts['--preview'])
    if not done:
        print('No raw Sister image found (file names start with her id, e.g. AM-SSR-ABB_raw.png).')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
