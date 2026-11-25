# Asset specs (what the game uses today)

What the game code expects from every asset today. ChatGPT owns how assets look and how they are made. A file that doesn't match these names, sizes and backgrounds won't show correctly in the game until the code changes too. To change it, say so in the PR or a for-claude issue: Claude reviews it, flags big changes to Aaron, and updates the code and this file together once Aaron agrees.

## 1. Asset table

| Asset | File name | Native size | Background | Where it shows | Notes |
| --- | --- | --- | --- | --- | --- |
| Sister bust | portraits/<id>.png | 128 x 128 | flat dark | roster grid, pickers, chat | tight head-and-shoulders (card's BUST PROMPT); weapon may crop or be left out |
| Sister battle sprite | art-inbox/full-body/<id>_raw.png | drawn at ~1024 x 1536 | flat #FF00FF | battlefield, Sister page | drawn large with bold readable shapes, not shrunk or colour-cut (the bot does that); the Sprite intake bot turns it into full-body/<id>.png (128 x 192) |
| Sister splash | splash/<id>.png | 256 x 384 | full scene | pull reveal, Sister page, Sanctum | face and relic in the middle band |
| Weapon prop sheet | art-inbox/props/<id>_props.png | any | plain | not in game (reference only) | side view, full length |
| Enemy portrait | enemies/<enemy id>.png | 84 x 84 | flat dark | enemy cards, intents | head and shoulders, readable at 42 px |
| Enemy battle figure | enemy-full/<enemy id>.png | 128 x 192 | transparent | battlefield | full body facing the viewer's left (toward the Sisters), soles on row 184, rows 185-191 empty, inside x 6-122 and rows 10-184 |
| Boss Blasphemy pose | enemy-full/<boss id>-blasphemy.png | 128 x 192 | transparent | boss wind-up | same boss, same feet line, arms raised mid-Blasphemy |
| Order crucifix icon | ui/sigil-<order id>.png | 64 x 64 | transparent | Order badges, banners, Sister cards | see section 3; replaces the old Order sigils |
| Order insignia | ui/insignia-<order id>.png | 64 x 64 | transparent | worn on every Sister's pauldrons; art reference | see section 3b; make before any Sister of the Order |
| Order banner backdrop | ui/banner-<order id>.png | 192 x 128 | full scene | Altar banner | no figures in front; her sprite stands on it |
| Title key art | ui/title-keyart.png | 256 x 384 | full scene | title screen, the first image of every session | keep the top fifth and the middle band dark for the logo and the commandment line |
| Background | ui/bg-<place>.png | 256 x 384 | full scene | screens and crypt cards | portrait, cropped at the edges; keep the middle band clear |
| Event and chapter card | ui/event-<id>.png, ui/chapter-<n>.png | 192 x 128 | full scene | events, story chapters | one clear subject |
| Item, relic, Holy Symbol, gear icon | ui/item-, relic-, symbol-, gear-<id>.png | 56 x 56 | transparent | inventory, gear | one object, 2 px margin, black outline |
| Skill icon | ui/skill-<id>.png | 24 x 24 | transparent | skill buttons | one bold shape |
| Keyword and Blasphemy icon | ui/kw-<id>.png, ui/blasphemy-<id>.png | 32 x 32 | transparent | tooltips, boss bar | one bold shape |
| Map node | ui/node-<type>.png | 48 x 48 | transparent | crypt map | fight, elite, event, shrine, reliquary, boss |
| Menu icon | ui/ui-<name>.png | 24 x 24 | transparent | tab bar, buttons | pure white shape only; the game tints it |
| War hound portrait | ui/hound-<id>.png | 128 x 128 | flat dark | hound pages | like a Sister bust |
| Effect sprite | ui/fx-<litany or blasphemy>-<name>.png | 52 x 52 | transparent | Litany and Blasphemy bursts | one burst shape, bright core, dithered falloff, no background glow |
| Knockout effect sheet | art-inbox/review/fx-ko-<name>.png | see section 3 (painted big) | flat #FF00FF | every knockout | white and greys only (the game tints it), no pixel pass; the game hookup is still to be built, so it waits in art-inbox |
| UI skin (9-slice) | ui/ui-button, ui-panel, ui-frame, ui-card ... | button 96 x 64, panel 190 x 194, frame 176 x 172, card 106 x 154 | transparent | menus | ornament only in the corners; edges and middle repeat cleanly |
| Bars and dividers | ui/ui-bar-*, ui/ui-divider | bar 64 x 12, divider 243 x 24 | transparent | HP and Zeal bars | flat middle that can stretch |
| UI redesign concept | art-inbox/ui-concepts/<round>_<direction>_<screen>.png | screen 1080 x 1920 (tall 1080 x 2560), kit sheet 2048 x 2048 | opaque | not in game (Aaron picks a direction) | follow `UI_BIBLE.md` |

Paths are under `src/assets/` unless they start with `art-inbox/`. A new asset type or slot is a code change: ask in a for-claude issue first.

## 2. Rules the code depends on

- **Native size is the delivered size.** Every game file is delivered at exactly the native pixel size in the table (the game draws it 1:1 or at whole multiples). When replacing an existing file, match its exact pixel size and background; some icons are a few pixels under the table size, keep theirs.
- **Backgrounds** are exactly what the table says: opaque flat dark, opaque full scene, transparent (real alpha), or flat #FF00FF for anything the intake bot keys out.
- **File names and folders** are exactly the table's. Ids in file names are game ids (as in `src/data/`), never display names: for example `insignia-red-pilgrimage.png` for the Crimson Inquisition.
- **Format:** real PNG files. `.webp` only to replace an existing `.webp` splash, keeping its name. Each file under 12 MB.
- **Colours:** busts, splashes and other native-size assets arrive already finished; the game shows them as delivered. The battle sprite is cut to **16 colours** by the intake bot (`tools/intake_sprite.py --colors 16`) whatever colours it arrives with.
- **No text, frames or UI in the art** unless the asset is a lettered UI piece the request names. The game draws names, rarity, frames and numbers itself, mirrors battle sprites to face left (so nothing on a sprite may depend on its side), and adds the optional CRT filter on top (so no scanlines or screen effects in the art).
- **Menu icons** are pure white shapes on transparent: the game tints them.
- **Splash crop:** the game crops splashes for short and tall phones, so a Sister's head, face and hands stay well inside the frame, clear of the top and bottom edges.
- **Enemy battle figures** face the viewer's left (toward the Sisters) with soles on row 184, rows 185-191 empty, inside x 6-122 and rows 10-184.
- **Knockout effect sheets:** the game tints them (the Sister's Order colour, ember for foes, gold for bosses), so they carry no colour of their own: white and light greys only (#FFFFFF, #DDDDDD, #AAAAAA, #777777, plus #111111 outlines) on flat #FF00FF.
- **Review copies:** each bust also ships a 4x nearest-neighbour copy as `art-inbox/review/<id>_bust_4x.png` (Aaron and Claude review from it). Bust 4x = 512 x 512.
- **Battle sprites** follow `SPRITE_SPEC.md`.
- **UI redesign concepts** follow `UI_SPEC.md`; they are pictures for Aaron, never game assets.

## 3. Knockout effect sheets (frame layout the hookup will read)

| File | Export size | Frames | Game size per frame |
| --- | --- | --- | --- |
| `art-inbox/review/fx-ko-burst.png` | 1024 x 1024 | 2 x 2 grid of 512 x 512, read left to right, top to bottom; burst from the BOTTOM-LEFT corner | 128 x 128 |
| `art-inbox/review/fx-ko-impact.png` | 1024 x 1024 | 2 x 2 grid of 512 x 512 | 64 x 64 |
| `art-inbox/review/fx-ko-smoke.png` | 1024 x 256 | row of four 256 x 256 | 32 x 32 |
| `art-inbox/review/fx-ko-lines.png` | 1024 x 256 | row of four 256 x 256, streaks pointing RIGHT (the game rotates them) | 64 x 64 |
| `art-inbox/review/fx-ko-word.png` (optional, ask Aaron) | 1536 x 512 | one image, the only lettered effect, not tinted | 192 x 64 |

Painted at export size, not shrunk or colour-cut. What the effects look like is ChatGPT's call (ART_QUEUE.md).
