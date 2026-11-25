# CRT Crusaders: Art Queue

What to make next, in priority order (from a playthrough of a new player's first hour, 2026-11-24). Before starting an item, check the repo: if the file on `main` is already the new art, or an open `art/` pull request has it, skip to the next item. Aaron can always reorder this; his word in chat wins.

Every item follows the project instructions, ASSETS_GUIDE.md (size, background, pixel pass) and is delivered by ASSETS_GUIDE section 5.

## Why this order

Only 5 of 500 Sisters have art (IV-LUR Insomnia, IV-LSSR1 Excubia, TC-UR1 Cruentia, DL-SSR-EXE Gurges, VT-SSR-VEI Obscura). For a new player every other Sister is a grey class silhouette: in the pull reveal, the party picker, every fight. Enemies, the first boss, backgrounds and most UI are covered. What hurts most is the Sisters plus a few gold "holy" pieces that show many times an hour and are off-vibe for the zealot retheme.

## The queue

| # | Make | Files | Spec |
| --- | --- | --- | --- |
| 1 | **Iron Vigil crucifix + insignia** | `src/assets/ui/sigil-iron-vigil.png`, `src/assets/ui/insignia-iron-vigil.png` | ASSETS_GUIDE 3 and 3b. The first Order every player meets; unblocks items 6 and 10 |
| 2 | **Litany card remake** | `src/assets/ui/fx-litany-pillar.png`, `src/assets/ui/fx-litany-halo.png` | effect sprite row; match each existing file's size (about 51 x 51, transparent). Today a gold pillar and halo; remake as a **pyre pillar with falling ash** and a **burning wheel of eyes**. Plays for every Litany of a Sister without a splash, so all of them for a new player |
| 3 | **Title key art** | `src/assets/ui/title-keyart.png` | 256 x 384, full scene. The first image of every session (the title falls back to bg-hall until it lands). Keep the top fifth and the middle band dark for the logo and the commandment line. No figures' faces in those bands, no text |
| 4 | **bg-altar remake** | `src/assets/ui/bg-altar.png` (replace) | 256 x 384. Today a radiant gold altar; make it a grim pyre-altar of the Orders: black stone, wax, chains, firelight, a god's terrible regard. The first screen after the title, and the banner fallback |
| 5 | **bg-hall remake** | `src/assets/ui/bg-hall.png` (replace) | 256 x 384. Today a warm gold great hall; make it the Sanctum's war-hall: banners of the 10 Orders, braziers, trophies of purged heresy. Keep the middle band clear for the Sister who stands there |
| 6 | **Propugna (IV-UR1), full set** | card `art-bible/roster-500/cards/IV/IV-UR1.md` | prop sheet, bust, battle sprite, splash. She leads the march and speaks the game's second story line |
| 7 | **Knockout effects** | `art-inbox/review/fx-ko-burst.png`, `fx-ko-impact.png`, then `fx-ko-smoke.png`, `fx-ko-lines.png` | section below. Every enemy death in every fight. The game draws a code version today, so this is polish; the hookup is a code job (open a `for-claude` issue with the first PR) |
| 8 | **Gear grade icons: the 5 Worn and 5 Consecrated** | `src/assets/ui/gear-<slot>-worn.png`, `gear-<slot>-consecrated.png` | ASSETS_GUIDE 4. The first crypt's results hand over gear right away. Sworn and Anathema rows follow |
| 9 | **Crucifix + insignia: Crimson Inquisition and Drowned Litany** | `sigil-` and `insignia-red-pilgrimage.png`, `-drowned-litany.png` | ASSETS_GUIDE 3 and 3b. The next Orders with story Sisters. The other 7 Orders can follow in one sitting so all card badges match |
| 10 | **Fortitudo (IV-SSR-ORA), full set** | card `art-bible/roster-500/cards/IV/IV-SSR-ORA.md` | the story's omen-reader. After her: Confessora (RP-UR1) and Abyssa (DL-UR1), once item 9 is done |

## Needs Aaron's OK first (not in the ASSETS_GUIDE table)

- **Class emblems** (`src/assets/ui/class-<id>.png`, about 56 x 56, transparent): only 6 of 15 exist (warsister, hierophant, inquisitor, confessor, censer, oracle); the other 9 classes borrow one. Shown on every Sister card.
- **Crypt map node "miracle"** (`src/assets/ui/node-miracle.png`, 48 x 48, transparent): missing; the code draws a radiant halo over a cross, which is off-vibe.
- **Sharper stand-in silhouettes** (`src/assets/stand-in/`, a path ChatGPT may not write): what players see for 495 Sisters until real art lands. Would need Aaron's OK and a Claude change to the lane.

## Knockout effect sheets (item 7)

The game tints these per Sister (her Order colour), ember for foes and gold for bosses, so they carry **no colour of their own**.

- **Style:** PC-98 pixel art, the same look as the Sisters: crisp hard-edged pixels, bold even dither, no anti-aliasing, blur, gradients, bloom or glow haze; light drawn as hard pixel clusters. No scanlines.
- **Colours:** white and light greys only, 4 values: #FFFFFF, #DDDDDD, #AAAAAA, #777777, plus near-black #111111 outlines where noted.
- **Background:** flat #FF00FF. Nothing else in the image: no text, frame lines or labels.
- **Delivery:** paint big at the export size below. No pixel pass: do not shrink, cut colours or dither in Python. Deliver to `art-inbox/review/<name>.png`. With the first one, open a `for-claude` issue: "hook up knockout sheets from art-inbox/review/fx-ko-*.png".

1. **fx-ko-burst.png**, the blast where a fallen unit leaves the screen. Export 1024 x 1024: a 2 x 2 grid of four 512 x 512 frames (game size 128 x 128 each). Each frame: a fan of sharp light rays bursting from the BOTTOM-LEFT corner toward the top-right, a broken ring of light and a few square sparks. Frame 1 (top left) small, tight, very bright, short rays. Frame 2 (top right) biggest, rays reach the far corner, ring wide. Frame 3 (bottom left) rays thinning and breaking, sparks flying. Frame 4 (bottom right) fading fragments only. Theme: wrathful heavenly light; thin crosses or tiny feathers may appear in the sparks. No skulls or faces.
2. **fx-ko-impact.png**, on the knockout blow during the freeze. Export 1024 x 1024: 2 x 2 grid of four 512 x 512 frames (game size 64 x 64 each). A spiky impact star: frame 1 small and solid white, frame 2 a large 8-point star with a hollow centre, frame 3 cracking into shards, frame 4 a few shards left.
3. **fx-ko-smoke.png**, the trail behind a launched unit. Export 1024 x 256: a row of four 256 x 256 frames (game size 32 x 32 each). One chunky puff per frame, getting smaller and more broken: full round puff, a little smaller, breaking into three bits, two small scraps. Light grey with a white top edge, darker grey underside, thin near-black outline.
4. **fx-ko-lines.png**, speed lines behind the launched unit. Export 1024 x 256: a row of four 256 x 256 frames (game size 64 x 64 each). Straight streaks pointing RIGHT (the game rotates them), dense at the left end and thinning to the right; frames 1 to 4 flicker and shift slightly so they loop.
5. Optional, **fx-ko-word.png**: export 1536 x 512 (game size 192 x 64). The single word "SMITTEN!" in heavy gothic blackletter carved into stone, cracked edge, white rim light, slight upward tilt. Bone white and iron grey with near-black outline (not tinted). Shown for the last foe of a fight, or a boss. This is the one lettered asset; ask Aaron before making it.
