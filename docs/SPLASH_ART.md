# Splash art: how it is made and shown

Approved by Aaron on 2026-11-27 after a test on real phones. The test sheets
and the scripts that made them are in the project files under `splash-spec-test/`.

## The spec

| | |
| --- | --- |
| Master | 1024 x 1536 PNG, 2:3 portrait, full colour, opaque. Never edited, moved or copied by any tool |
| Where masters live | Outside this repository for now (their storage is still being decided). `tools/build_splash.py` refuses a master inside the repo |
| Shipping file | `src/assets/splash/<id>.webp`, 512 x 768, full RGB, no transparency |
| Resize | Lanczos, once, from the master |
| WebP | Lossy, quality 90, method 6. A Sister can get her own quality (85 or more) or lossless in `tools/splash_settings.json` |
| Size | About 170 KB is normal. A warning from 250 KB, a hard cap at 400 KB |
| Look | No pixel pass and no palette cut. The CRT look is the game's screen filter, never part of the file |
| Tracking | `tools/splash_manifest.json`: for each Sister, the master's file name and SHA-256 fingerprint, the settings, and the shipping file's own fingerprint |

Why 512 x 768: the game draws into a screen 540 pixels wide on every phone, so a
splash never shows more than about 540 of its pixels across. A 1024 master would
be shrunk to half on screen and download 17 times bigger, and it takes 6 MB of
memory against 1.5 MB.

## Making a splash

```
python3 tools/build_splash.py <path to her master.png> <Sister id>
```

It writes her `.webp`, removes an older `.png` or `.jpg` of hers, records her row
in the manifest and reminds you to add her framing row. Then commit the `.webp`,
the manifest and the framing row together. Rebuild from the master to change a
splash; the check fails a file that no longer matches its manifest row.

`python3 tools/build_splash.py --check` runs in CI: every splash must be a 512 x 768
opaque WebP with a matching manifest row. The splashes made before this spec are
listed as `legacy` in `tools/splash_settings.json` and only get the size cap.

## Framing

`src/data/splashFrames.ts` has one row per splash: `[focus x, head, feet, zoom?]`,
as fractions of the image. Screens crop around it: head to knees on her page, the
Altar banner and the Litany cut-in; head to toe on the pull reveal; her face kept
in view on the Sanctum lobby. `zoom` (default 1) moves the head-to-knees crop
closer (above 1) or wider (below 1) for one Sister. Measure the row on her master.
A head drawn at the very top of the image needs its row most, or the default
crop cuts it off. Tapping her on her Sister page shows the whole uncropped painting.

## Filtering

Each time a splash is drawn, `splashFilter` sets its texture filter from the draw
scale. At its own size or bigger (scale 0.98 and up: the Sister page, the full
view, the Altar banner, the Sanctum), it uses hard pixels, which keep the painted
pixel clusters crisp. Smoothing there blurs her face. Shrunk (the pull reveal at
about 0.66, the Litany cut-in at about 0.8), it is smoothed, because hard pixels
would drop whole rows of pixels and break her eyes.

## Memory

A splash takes 1.5 MB once decoded, whatever its file size. The game keeps the 12
most recently used ones (enough for a 10-pull reveal or a Sister page and its
neighbours) and frees older ones that nothing on screen still shows
(`trimSplashes` in `src/ui/placeholderPortrait.ts`). A freed splash loads again
from the browser's cache when it is needed.

## Later

A zoom view could load a second, 1024 x 1536 copy made from the same master only
while it is open. That is the one place the master's extra detail would show.
