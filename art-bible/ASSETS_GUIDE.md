# CRT Crusaders: Game Assets Guide for ChatGPT

> **Owned by ChatGPT, the art lead (since 2026-11-25).** Rewrite and reimagine freely. `specs/` describes what the game needs today; Claude reviews every PR and flags big changes to Aaron.

Every asset type the game uses: its native size, background, where it shows and how to deliver it. Style and vibe rules from the project instructions (CHATGPT_PROJECT_INSTRUCTIONS.txt) apply to all of them. This guide lives in the game repo at `art-bible/ASSETS_GUIDE.md`; the repo copy on `main` is always the current one.

## 1. Rules for every asset

- **Rendering.** Use the [approved EGA dungeon-crawler direction](ART_DIRECTION.md). Give faces clean retro anime planes, equipment a crisp silhouette, and backgrounds broad shadow shapes. Save a palette slot for the focal accent. Use the per-asset colour budgets below.
- **Vibe:** grimdark fanatic crusade with no modern or future technology: no guns, motors, electronics or sci-fi gear. Medieval craft is fine (forged steel, crossbows, siege engines, bells, censers, stained glass). Steel, fire, wax, bone, blood, smoke. Fire is the main light. Divine things look terrible first, beautiful second.
- **Order colours:** anything tied to an Order uses that Order's lead and trim colours and its approved insignia (section 3b, order-bible.md).
- **Order first:** each Order's crucifix icon and insignia are made and approved before any of its Sisters.
- **Replacing a file:** open the current file in the repo first (`src/assets/...`) and match its exact pixel size, background (opaque or transparent) and framing. Many existing icons are trimmed a few pixels under the table size; keep the existing size. A brand-new file uses the table size.
- **No text** in any image unless the asset is a lettered UI piece the request names. No watermark, no frame unless the asset is a frame.
- **Delivery (PIXEL PASS), the same every time:** generate big (1024 px on the long side), then in Python:
  1. shrink to the native size (box filter for paintings, nearest-neighbour for clean pixel art);
  2. snap every colour to the 4,096 palette (each RGB channel rounded to a multiple of 17), using the Order swatches in order-bible.md note 16 for lead and trim;
  3. reduce to the colour budget with the focal accent reserved. Apply ordered dither locally where a material needs a transition. Inspect eyes, fingers and emblem edges at native size;
  4. keep the background flat (one colour) or transparent as the table says;
  5. count the colours actually present, including the background, and check every channel is divisible by 17;
  6. export the native PNG plus an exact nearest-neighbour upscale (4x, or 8x for anything 64 px or smaller) and confirm it is exact.
  Report the real numbers. Name the file as the table says.
- **Checks per deliverable:** bust: opaque 128x128, flat dark, exactly 16 colours including the background, 4x copy 512x512, and look at the face at 64 px too. Splash: opaque 256x384, exactly 16 colours, 4x copy 1024x1536, head, face and hands clear of the top and bottom crop. Battle sprite: no pixel pass; run the sprite-plan section 7 preview. Weapon prop sheet: reference only, any size, plain flat light grey, no pixel pass.
- **Exception (UI concepts):** UI redesign concepts are pictures for Aaron to choose from, not game assets: no pixel pass, sizes and names from `UI_BIBLE.md` section 9, delivered to `art-inbox/ui-concepts/`.
- **Exception:** the Sister battle sprite is drawn large in the same EGA dungeon-crawler style with bold readable shapes and gets no pixel pass, because the game shrinks it (see sprite-plan.md).

## 2. Asset table

Moved to `specs/ASSET_SPECS.md` (file names, sizes, backgrounds the game uses today).

## 3. Order crucifix icons (10 icons)

Each Order's crucifix is its holy symbol, shaped by what its god demands (order-bible.md, standing note 13). Only the Iron Vigil's is a cross. These icons replace the old Order sigils in the game.

**Specs for all ten:** 64 x 64 native, transparent background, the crucifix alone, centred, filling about 56 px with a 3-4 px margin, dark 1-2 px outline, at most 12 colours from the Order's palette plus black, a small dithered ember or glow at most, readable at 24 px. Generate at 1024 x 1024, then do the pixel pass and export ui/sigil-<order id>.png plus an 8x upscale. The ten should look like one set: same outline weight, same scale, same light from above.

**Prompt pattern:** EGA dungeon-crawler style pixel art icon: crisp square pixels, at most 12 colours from a 4,096-colour palette, selective patterned dithering, dark outline, transparent background. A single sworn emblem, centred, filling the frame: <shape>. Colours: <colours>. Grim, consecrated and terrible, lit from above by firelight. No text, watermark, frame, background, modern objects, anti-aliasing or blur.

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

**Prompt pattern:** EGA dungeon-crawler style pixel art badge: crisp square pixels, at most 8 colours from a 4,096-colour palette, flat heraldic shapes with little dither, dark outline, transparent background. A single flat armour insignia, face-on, centred, filling the frame: <badge>. Simple and bold enough to read when tiny. No text, watermark, frame, background, modern objects, anti-aliasing or blur.

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

**Prompt pattern:** EGA dungeon-crawler style pixel art item icon: crisp square pixels, at most 16 colours from a 4,096-colour palette, selective patterned dithering, dark outline, transparent background. A single piece of crusader war-gear, centred, filling the frame: <object>. Grade look: <grade look>. Grim, fanatic and battle-worn, lit from above by firelight. No text, watermark, frame, background, hands or figure, modern objects, anti-aliasing or blur.

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

## 5. Delivering art through GitHub

Moved to `specs/GITHUB_LANE.md`.
