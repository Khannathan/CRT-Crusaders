#!/usr/bin/env python3
"""
Splash art builder and checker (docs/SPLASH_ART.md).

Build: makes a Sister's shipping splash from her master.
    python3 tools/build_splash.py <master.png> <sister id>
  - The master is a 1024 x 1536 (2:3) full-colour PNG. It is opened read-only and
    never changed, moved or copied. Masters live outside this repository (their
    storage is still undecided), so a master path inside the repo is refused.
  - Writes src/assets/splash/<id>.webp: 512 x 768, Lanczos, full RGB, WebP lossy
    at quality 90, method 6 (or her override in tools/splash_settings.json).
    No pixel pass, no palette cut: the CRT look is a screen filter in the game.
  - Removes an older <id>.png/.jpg splash so the game picks up the new file.
  - Records the master's fingerprint (SHA-256) and the settings in
    tools/splash_manifest.json, so every shipping file traces back to its master.

Check (CI): python3 tools/build_splash.py --check
  Every splash in src/assets/splash must be a 512 x 768 WebP without alpha, at
  most 400 KB (a warning from 250 KB), with a manifest row whose fingerprint
  matches the file. Splashes made before this spec are listed as legacy in
  tools/splash_settings.json and only get the size cap.

Needs Pillow (pip install pillow).
"""
import datetime
import hashlib
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPLASH_DIR = os.path.join(ROOT, 'src', 'assets', 'splash')
SETTINGS = os.path.join(ROOT, 'tools', 'splash_settings.json')
MANIFEST = os.path.join(ROOT, 'tools', 'splash_manifest.json')
FRAMES = os.path.join(ROOT, 'src', 'data', 'splashFrames.ts')

MASTER_SIZE = (1024, 1536)
SHIP_SIZE = (512, 768)
WARN_BYTES = 250 * 1024
MAX_BYTES = 400 * 1024
MIN_QUALITY = 85


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def load(path, empty):
    if not os.path.exists(path):
        return empty
    with open(path) as f:
        return json.load(f)


def save(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write('\n')


def settings_for(settings, sid):
    s = dict(settings.get('default', {}))
    s.update(settings.get('overrides', {}).get(sid, {}))
    s.pop('note', None)
    return s


def inside(path, folder):
    path, folder = os.path.realpath(path), os.path.realpath(folder)
    return os.path.commonpath([path, folder]) == folder


def build(master, sid):
    if not os.path.isfile(master):
        sys.exit(f'No master at {master}')
    if inside(master, ROOT):
        sys.exit('Masters stay outside the game repository (docs/SPLASH_ART.md). Point to the file where it is kept.')
    if not sid.replace('-', '').isalnum():
        sys.exit(f'"{sid}" is not a Sister id')
    settings = load(SETTINGS, {})
    s = settings_for(settings, sid)
    quality, lossless = int(s.get('quality', 90)), bool(s.get('lossless', False))
    if not lossless and quality < MIN_QUALITY:
        sys.exit(f'Quality {quality} is below the floor of {MIN_QUALITY}')

    fingerprint = sha256(master)
    with Image.open(master) as im:
        if im.size != MASTER_SIZE:
            sys.exit(f'Master is {im.size[0]} x {im.size[1]}; it must be {MASTER_SIZE[0]} x {MASTER_SIZE[1]}')
        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
            if im.convert('RGBA').getextrema()[3][0] < 255:
                print('Note: the master has transparent pixels; the splash is flattened onto black.')
        rgba = im.convert('RGBA')
    flat = Image.new('RGB', rgba.size, (0, 0, 0))
    flat.paste(rgba, mask=rgba.getchannel('A'))
    ship = flat.resize(SHIP_SIZE, Image.LANCZOS)

    os.makedirs(SPLASH_DIR, exist_ok=True)
    out = os.path.join(SPLASH_DIR, f'{sid}.webp')
    if lossless:
        ship.save(out, lossless=True, quality=100, method=6)
    else:
        ship.save(out, quality=quality, method=6)
    for ext in ('png', 'jpg'):
        old = os.path.join(SPLASH_DIR, f'{sid}.{ext}')
        if os.path.exists(old):
            os.remove(old)
            print(f'Removed the older {sid}.{ext}')

    manifest = load(MANIFEST, {})
    manifest[sid] = {
        'master': os.path.basename(master),
        'master_sha256': fingerprint,
        'master_size': list(MASTER_SIZE),
        'size': list(SHIP_SIZE),
        'resize': 'lanczos',
        'webp': 'lossless' if lossless else f'lossy q{quality} method 6',
        'bytes': os.path.getsize(out),
        'sha256': sha256(out),
        'built': datetime.date.today().isoformat(),
    }
    save(MANIFEST, manifest)
    kb = os.path.getsize(out) / 1024
    print(f'{sid}: {out} ({kb:.0f} KB, {manifest[sid]["webp"]}), master {fingerprint[:12]}')
    if kb * 1024 > WARN_BYTES:
        print(f'Warning: {kb:.0f} KB is above the {WARN_BYTES // 1024} KB guideline.')
    if f"'{sid}'" not in open(FRAMES).read():
        print(f"Reminder: add her framing row to src/data/splashFrames.ts ('{sid}': [focus x, head, feet]).")


def check():
    settings = load(SETTINGS, {})
    legacy = set(settings.get('legacy', []))
    manifest = load(MANIFEST, {})
    errors, warnings = [], []
    files = sorted(f for f in os.listdir(SPLASH_DIR) if not f.startswith('.'))
    seen = set()
    for f in files:
        path = os.path.join(SPLASH_DIR, f)
        sid, ext = os.path.splitext(f)
        seen.add(sid)
        size = os.path.getsize(path)
        if size > MAX_BYTES:
            errors.append(f'{f}: {size // 1024} KB is over the {MAX_BYTES // 1024} KB cap')
        elif size > WARN_BYTES:
            warnings.append(f'{f}: {size // 1024} KB is above the {WARN_BYTES // 1024} KB guideline')
        if sid in legacy:
            continue
        if ext != '.webp':
            errors.append(f'{f}: splashes ship as .webp, built from the master by tools/build_splash.py')
            continue
        with Image.open(path) as im:
            if im.size != SHIP_SIZE:
                errors.append(f'{f}: {im.size[0]} x {im.size[1]}, must be {SHIP_SIZE[0]} x {SHIP_SIZE[1]}')
            if im.mode != 'RGB':
                errors.append(f'{f}: has transparency ({im.mode}); splashes are opaque')
        row = manifest.get(sid)
        if not row:
            errors.append(f'{f}: no row in tools/splash_manifest.json (build it with tools/build_splash.py)')
        elif row.get('sha256') != sha256(path):
            errors.append(f'{f}: does not match its manifest row; rebuild it from the master instead of editing it')
    for sid in manifest:
        if sid not in seen:
            errors.append(f'tools/splash_manifest.json: {sid} has no splash file')
    for sid in legacy:
        if sid not in seen:
            warnings.append(f'tools/splash_settings.json: legacy {sid} has no splash file any more; drop it from the list')
    for w in warnings:
        print(f'::warning::{w}' if os.environ.get('GITHUB_ACTIONS') else f'Warning: {w}')
    for e in errors:
        print(f'::error::{e}' if os.environ.get('GITHUB_ACTIONS') else f'Error: {e}')
    print(f'{len(files)} splashes checked, {len(errors)} problems.')
    return 1 if errors else 0


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--check']:
        sys.exit(check())
    if len(args) != 2:
        sys.exit(__doc__)
    build(*args)
