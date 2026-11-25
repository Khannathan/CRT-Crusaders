# CRT Crusaders: Game Assets Guide for ChatGPT

Every asset type the game uses: its native size, background, where it shows and how to deliver it. Style and vibe rules from the project instructions (CHATGPT_PROJECT_INSTRUCTIONS.txt) apply to all of them. This guide lives in the game repo at `art-bible/ASSETS_GUIDE.md`; the repo copy on `main` is always the current one.

## 1. Rules for every asset

- **Style (the most important rule):** PC-98: every asset looks like it came from a late-1980s or early-1990s Japanese PC-98 computer game. Crisp hand-placed square pixels, anime-styled dark-fantasy characters with clean dark linework, heavy patterned dither for shading, skies and glows, high contrast. **At most 16 colours** per image, picked from a 4,096-colour palette (Sisters use exactly 16). Never painterly, HD, photoreal, 3D or modern cel-shaded anime; no anti-aliasing, blur, gradients, airbrush or bloom; no scanlines or CRT effects (the game adds them).
- **Vibe:** grimdark fanatic crusade, no technology. Steel, fire, wax, bone, blood, smoke. Fire is the main light. Divine things look terrible first, beautiful second.
- **Order colours:** anything tied to an Order uses that Order's lead and trim colours and its approved insignia (section 3b, order-bible.md).
- **Order first:** each Order's crucifix icon and insignia are made and approved before any of its Sisters.
- **Replacing a file:** open the current file in the repo first (`src/assets/...`) and match its exact pixel size, background (opaque or transparent) and framing. Many existing icons are trimmed a few pixels under the table size; keep the existing size. A brand-new file uses the table size.
- **No text** in any image unless the asset is a lettered UI piece the request names. No watermark, no frame unless the asset is a frame.
- **Delivery (PIXEL PASS), the same every time:** generate big (1024 px on the long side), then in Python:
  1. shrink to the native size (box filter for paintings, nearest-neighbour for clean pixel art);
  2. snap every colour to the 4,096 palette (each RGB channel rounded to a multiple of 17), using the Order swatches in order-bible.md note 16 for lead and trim;
  3. cut to the colour limit with a fixed 4x4 Bayer ordered dither at native pixel scale (never error diffusion);
  4. keep the background flat (one colour) or transparent as the table says;
  5. count the colours actually present, including the background, and check every channel is divisible by 17;
  6. export the native PNG plus an exact nearest-neighbour upscale (4x, or 8x for anything 64 px or smaller) and confirm it is exact.
  Report the real numbers. Name the file as the table says.
- **Checks per deliverable:** bust: opaque 128x128, flat dark, exactly 16 colours including the background, 4x copy 512x512, and look at the face at 64 px too. Splash: opaque 256x384, exactly 16 colours, 4x copy 1024x1536, head, face and hands clear of the top and bottom crop. Battle sprite: no pixel pass; run the sprite-plan section 7 preview. Weapon prop sheet: reference only, any size, plain flat light grey, no pixel pass.
- **Exception:** the Sister battle sprite is drawn large in the same PC-98 style with bold readable shapes and gets no pixel pass, because the game shrinks it (see sprite-plan.md).

## 2. Asset table

| Asset | File name | Native size | Background | Where it shows | Notes |
| --- | --- | --- | --- | --- | --- |
| Sister bust | portraits/<id>.png | 128 x 128 | flat dark | roster grid, pickers, chat | tight head-and-shoulders (card's BUST PROMPT); weapon may crop or be left out |
| Sister battle sprite | art-inbox/full-body/<id>_raw.png | drawn at ~1024 x 1536 | flat #FF00FF | battlefield, Sister page | PC-98 style drawn large with bold readable shapes, no pixel pass; the Sprite intake bot turns it into full-body/<id>.png (128 x 192) |
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
| Knockout effect sheet | art-inbox/review/fx-ko-<name>.png | per ART_QUEUE.md (painted big) | flat #FF00FF | every knockout | white and greys only (the game tints it), no pixel pass; the game hookup is still to be built, so it waits in art-inbox |
| UI skin (9-slice) | ui/ui-button, ui-panel, ui-frame, ui-card ... | button 96 x 64, panel 190 x 194, frame 176 x 172, card 106 x 154 | transparent | menus | ornament only in the corners; edges and middle repeat cleanly |
| Bars and dividers | ui/ui-bar-*, ui/ui-divider | bar 64 x 12, divider 243 x 24 | transparent | HP and Zeal bars | flat middle that can stretch |

Paths are under `src/assets/` unless they start with `art-inbox/`. Ask before making any asset type not in this table.

## 3. Order crucifix icons (10 icons)

Each Order's crucifix is its holy symbol, shaped by what its god demands (order-bible.md, standing note 13). Only the Iron Vigil's is a cross. These icons replace the old Order sigils in the game.

**Specs for all ten:** 64 x 64 native, transparent background, the crucifix alone, centred, filling about 56 px with a 3-4 px margin, dark 1-2 px outline, at most 12 colours from the Order's palette plus black, a small dithered ember or glow at most, readable at 24 px. Generate at 1024 x 1024, then do the pixel pass and export ui/sigil-<order id>.png plus an 8x upscale. The ten should look like one set: same outline weight, same scale, same light from above.

**Prompt pattern:** PC-98 style pixel art icon: crisp square pixels, at most 12 colours from a 4,096-colour palette, patterned dithering, dark outline, transparent background. A single sworn emblem, centred, filling the frame: <shape>. Colours: <colours>. Grim, consecrated and terrible, lit from above by firelight. No text, watermark, frame, background, modern objects, anti-aliasing or blur.

| Order | File | Crucifix | Shape (paste into the prompt) | Colours |
| --- | --- | --- | --- | --- |
| Iron Vigil | ui/sigil-iron-vigil.png | the Burning Cross | an equal-armed cross whose four arms end in flames, on a small shield split black and white | ember-orange flames on bone-white and charcoal-black |
| Ashen Mercy | ui/sigil-ashen-mercy.png | the Mercy Stake | a single upright pyre stake rising from a bundle of firewood, a ring of embers circling its top like a crown | ash-white stake, wine-red embers, charcoal wood |
| Veiled Tribunal | ui/sigil-veiled-tribunal.png | the Veiled Scale | a sword standing point-down with a balance beam hung across its crossguard, one pan holding an open eye, a veil draped over the beam | dusk-violet veil, parchment pans, steel blade |
| Sepulcher Watch | ui/sigil-sepulcher-watch.png | the Keyed Coffin | a long six-sided coffin shape standing upright, pierced top to bottom by a great iron key, a small skull at the key's bow | bone-tan coffin, slate key, black outline |
| Choir of the Pyre | ui/sigil-candle-choir.png | the Singing Flame | a tall flame whose heart is an open, screaming mouth, rising from a crown of seven candles | candle-gold flame, wine-red mouth, wax-white candles |
| Verdant Martyrdom | ui/sigil-thorn-covenant.png | the Briar Wheel | a wheel of barbed briar with every thorn pointing inward, a bleeding rose at the hub and three drops of blood falling below | moss-green briar, blood-red rose and drops |
| Drowned Litany | ui/sigil-drowned-litany.png | the Drowning Anchor | an anchor whose crossbar stock is lashed with prayer-ribbons, a drowning stone tied at its crown, three wave lines across its shank | sea-teal anchor, parchment ribbons, black stone |
| Confessors of Glass | ui/sigil-glass-confession.png | the Shattered Mirror | a tall diamond-shaped mirror cracked into a star of shards from its centre, one open eye etched in the central shard | ice-blue glass, violet cracks, silver rim |
| Crimson Inquisition | ui/sigil-red-pilgrimage.png | the Brand of Asking | a long branding iron standing upright, its red-hot head a round seal stamped with a closed eye, a sealed writ wound around the shaft | blood-crimson writ and seal, red-hot gold head, black iron |
| Hallowed Belfry | ui/sigil-hollow-bell.png | the Bell-Gallows | a gallows frame, one upright and a beam, with a bell hanging from the beam on a braided rope | bell-bronze bell, parchment rope, black timber |

The file names keep the game's old Order ids (for example the Crimson Inquisition is red-pilgrimage); that is on purpose, so saves and code don't change.

## 3b. Order insignias (10 badges): make these FIRST

Each Order has one **insignia**: a flat heraldic badge that every Sister of that Order wears on **both pauldrons** (or shoulder plates on robed classes). It is how you tell the Orders apart at a glance, so it never changes between Sisters. The crucifix (section 3) is the Order's holy symbol and game icon; on Sisters only a Patron Deity shows it, at the centre of her halo.

**Order of work:** before the first Sister of an Order, make that Order's crucifix icon (section 3) and its insignia (this section), and get both approved. Then attach the approved insignia to every bust, battle sprite and splash of that Order's Sisters, so every one wears the identical badge.

**Specs for all ten:** 64 x 64 native, transparent background, the badge alone, flat and face-on, centred with a 3-4 px margin, dark 1-2 px outline, at most 8 colours from the Order's palette, no glow, readable at 16 px (it is about 5 game pixels wide on a battle sprite). Generate at 1024 x 1024, then do the pixel pass and export ui/insignia-<order id>.png plus an 8x upscale. All ten share one outline weight and scale.

**Prompt pattern:** PC-98 style pixel art badge: crisp square pixels, at most 8 colours from a 4,096-colour palette, flat heraldic shapes with little dither, dark outline, transparent background. A single flat armour insignia, face-on, centred, filling the frame: <badge>. Simple and bold enough to read when tiny. No text, watermark, frame, background, modern objects, anti-aliasing or blur.

| Order | File | Insignia | Badge (paste into the prompt) |
| --- | --- | --- | --- |
| Iron Vigil | ui/insignia-iron-vigil.png | the Vigil Shield | a heater-shield badge split bone-white and charcoal-black, an ember-orange burning cross on it |
| Ashen Mercy | ui/insignia-ashen-mercy.png | the Ash Roundel | a round ash-white badge ringed in wine, a black pyre stake crowned by an ember ring |
| Veiled Tribunal | ui/insignia-veiled-tribunal.png | the Verdict Seal | an angular black wax-seal badge edged in dusk violet, a parchment-white veiled balance scale on it |
| Sepulcher Watch | ui/insignia-sepulcher-watch.png | the Coffin Plate | a six-sided coffin-shaped bone-tan badge, a slate-dark iron key standing down its length |
| Choir of the Pyre | ui/insignia-candle-choir.png | the Choir Arch | a pointed gothic-arch badge in candle gold, a wine-red flame with an open screaming mouth on it |
| Verdant Martyrdom | ui/insignia-thorn-covenant.png | the Briar Wreath | a round moss-green wreath of barbed briar, a blood-red rose at its centre |
| Drowned Litany | ui/insignia-drowned-litany.png | the Drowned Drop | a teardrop-shaped sea-teal badge, a parchment-pale anchor on it |
| Confessors of Glass | ui/insignia-glass-confession.png | the Black Pane | a diamond of black mirror-glass in a cold silver frame, a white star-crack and one etched eye at its centre |
| Crimson Inquisition | ui/insignia-red-pilgrimage.png | the Asking Seal | a round blood-crimson seal with a scalloped edge, an antique-gold closed eye on it |
| Hallowed Belfry | ui/insignia-hollow-bell.png | the Belfry Bell | a bell-shaped bell-bronze badge, a black gallows-and-bell mark on it |

**On a Sister:** the same badge, painted, enamelled or embossed flat on the outer face of each pauldron, about the size of her palm, never hidden by hair, cape or wings. Confessors of Glass carry it etched into the glass of their shoulder plates.

## 4. Gear icons: Relics of War (26 icons)

Gear now has grades instead of rarities. Each of the 5 slots needs one icon per base grade, plus one icon for each named relic and one for the Godspark. Until these land, the game shows the old gear-<slot>-<rarity> icons.

**Specs for all of them:** 56 x 56 native, transparent background, one object, centred, 2 px margin, dark outline, at most 16 colours from the 4,096 palette, readable at 40 px. Generate at 1024 x 1024, then do the pixel pass and export ui/<file>.png plus an 8x upscale. Within a slot, the four grades should read as the same object getting grander: same angle, same outline weight, light from above.

**Prompt pattern:** PC-98 style pixel art item icon: crisp square pixels, at most 16 colours from a 4,096-colour palette, patterned dithering, dark outline, transparent background. A single piece of crusader war-gear, centred, filling the frame: <object>. Grade look: <grade look>. Grim, fanatic and battle-worn, lit from above by firelight. No text, watermark, frame, background, hands or figure, modern objects, anti-aliasing or blur.

**Slots (the <object>):**
- blade: a one-handed crusader weapon (sword, mace or flail head), shown diagonally, hilt bottom-left.
- habit: a sister's war habit, a torso of mail and cloth tabard, shown from the front.
- veil: a nun's veil worn over or with a helm, shown as a three-quarter head piece with no face inside.
- sabatons: a pair of armoured boots, side by side, toes to the right.
- rosary: a prayer-bead rosary with a heavy pendant, coiled.

**Grades (the <grade look>; file gear-<slot>-<grade>.png):**

| Grade | File suffix | Grade look (paste into the prompt) | Lead colours |
| --- | --- | --- | --- |
| Worn | -worn | battered, dented and rusted, patched cloth, no ornament | rust-brown, dull grey, faded cloth |
| Consecrated | -consecrated | clean steel, a stamped prayer seal with a short red ribbon, simple trim | cold steel-blue, wax-white seal |
| Sworn | -sworn | gilded edges, an engraved oath script band (no readable letters), a small wax seal | gold, black iron, oxblood |
| Anathema | -anathema | blackened and scorched metal, chained shut with a nail-pierced writ, faint ember glow in the cracks | ember-orange, char black, bone |

That is 20 icons: gear-blade-worn, gear-blade-consecrated, gear-blade-sworn, gear-blade-anathema, and the same four for habit, veil, sabatons and rosary.

**Named relics (file gear-<id>.png), all Iron Vigil (bone-white, charcoal, ember-orange, Burning Cross):**

| File | Name | Object (paste as <object>; grade look: "a saint's relic, ornate and singular, Iron Vigil Templar style") |
| --- | --- | --- |
| gear-unsleepingFlail.png | Flail of the Unsleeping Watch | a flail whose spiked head is a caged, open eye, the chain wrapped in prayer cord, a small Burning Cross on the pommel |
| gear-ashMail.png | Templar Ash-Mail | a bone-white mail hauberk with a charcoal tabard bearing a Burning Cross, ash drifting off its hem |
| gear-crossVisor.png | Visor of the Burning Cross | a great-helm under a white veil, its visor slit shaped like a cross that glows ember-orange |
| gear-pyreSabatons.png | Pyre-Walker Sabatons | charcoal sabatons with soles still smouldering, small flames licking up the greaves |
| gear-lastLantern.png | Lantern of the Last Watch | a rosary ending in a small iron lantern instead of a cross, a single ember burning inside |
| gear-vigiliaKey.png | Vigilia's Key of the Last Door (Godforged) | a rosary whose pendant is a great black key wreathed in red fire, a thin halo of red light behind it. This is the rarest item in the game: make it look divine and terrible. Lead colour godforged red (#D0263A) |

**Godspark (file item-spark1.png):** a small shard of red divine fire caught in a thorned iron reliquary cage, sparks flying off it. Lead colour godforged red.

The Edicts (12 gear powers) use text only for now; no icons needed.

## 5. Delivering art through GitHub (ChatGPT's lane)

ChatGPT connects to the game repo (Khannathan/CRT-Crusaders) to read the art bible, look at the game and deliver art. Claude writes the game code and keeps the art bible in the same repo, so ChatGPT stays strictly in the art lane below. Aaron merges everything. An automatic check, the **Art lane guard**, enforces this table on every art pull request.

**Reading:** anything in the repo: `art-bible/` (these rules and the cards), code, data, existing art, issues and pull requests. Always read from `main`.

**Writing: only these paths, only real image files (.png; .webp only to replace an existing .webp), each under 12 MB:**

| What | Path | Notes |
| --- | --- | --- |
| Sister bust | `src/assets/portraits/<id>.png` | after the pixel pass, 128 x 128 |
| Sister splash | `src/assets/splash/<id>.png` | after the pixel pass, 256 x 384; if `<id>.webp` already exists, replace that file instead and keep its name. Never add a new .webp |
| Raw battle sprite | `art-inbox/full-body/<id>_raw.png` | the large ~1024 x 1536 drawing on #FF00FF. Never write `src/assets/full-body/` yourself: the **Sprite intake** bot runs the game's intake at 16 colours and commits `src/assets/full-body/<id>.png` plus `art-inbox/review/<id>_sprite_preview.png` back onto your branch. Look at that preview in the PR |
| Weapon prop sheet | `art-inbox/props/<id>_props.png` | reference only |
| UI, icons, crucifixes, insignias, backgrounds, banners, events, items, gear, effects | `src/assets/ui/<file>.png` | only the exact file names this guide or ART_QUEUE.md lists |
| Enemy portrait / battle figure | `src/assets/enemies/<id>.png`, `src/assets/enemy-full/<id>.png` | only when the request names them |
| Review copies, knockout sheets, sources | `art-inbox/review/<name>.png` | PNG only; never inside `src/` |
| The art log | `art-inbox/ART_LOG.md` | one line per delivered file: date, file, size, colour count, which prompt made it, PR link |

**Never** (the guard fails the PR):
- add, edit or delete anything else: code, data, configs, tests, workflows, package files, `art-bible/` (read only: Claude keeps it), other docs;
- touch `src/assets/full-body/` (the bot writes it), `poses/`, `anim/`, `audio/`, `sfx/`, `fonts/` or `stand-in/`;
- delete or rename any file (replacing an image in place, same name, is allowed);
- push to `main`, force-push, merge or approve a pull request, or change any branch that doesn't start with `art/`. Claude's branches start with `claude/`; never touch them.

**How to deliver:**
1. Create a branch from the latest `main` named `art/<asset-id>`, for example `art/AM-SR-EXO` for one Sister or `art/insignia-set` for a set.
2. Commit only files from the table, with a message like `Art: AM-SR-EXO bust and splash`, and add one `ART_LOG.md` line per file.
3. Open one pull request per batch titled `Art: <what>`. In the body list every file with its real size and colour count and the prompt that made it.
4. Wait for the checks: **Art lane guard** (paths), **Sprite intake** (only when a raw sprite is in the PR) and **CI** (the game still builds). If one fails, fix it only by replacing your own art files on the same branch.
5. Do not merge. Aaron reviews and merges. Merged art shows on the live build within a few minutes: `https://khannathan.github.io/CRT-Crusaders/?artreview=<id>` opens the art viewer on that Sister (battle, roster, Sanctum, Altar and bust screens).

**Needs a code change?** Never make it. Open an issue with the **"Code request for Claude"** form (it adds the `for-claude` label): what you need, why, the related art PR and the files. Link it from your PR and carry on with other art.

**Talking to Claude:** use PR comments and `for-claude` issues. Claude doesn't watch GitHub on its own; Aaron points a Claude thread at them, and Claude answers there. Claude may comment on an art PR before Aaron merges it.
