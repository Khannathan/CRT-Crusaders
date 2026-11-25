# CRT Crusaders

**Five hundred Sisters. Ten rival Orders. One war that never ends.**

CRT Crusaders is a dark-fantasy gacha RPG for phones, played in portrait. You command **Sisters**: fanatic zealots sworn to **10 rival Orders**, each serving a god that demands something terrible. Send them into crypts of undead clergy and purge everything that moves.

- **Play it now:** https://khannathan.github.io/CRT-Crusaders/ (every merge to `main` deploys here)
- **Stack:** Phaser 3 + TypeScript + Vite, WebGL first. An Android APK (Capacitor) comes last.
- **Screen:** 540 × 960 design resolution, portrait only. The CRT filter is added by the game, never painted into the art.

## The game in one screen

- **200 Sisters, 10 Orders, 20 per Order.** Iron Vigil, Ashen Mercy, Veiled Tribunal, Sepulcher Watch, Choir of the Pyre, Verdant Martyrdom, Drowned Litany, Confessors of Glass, Crimson Inquisition and Hallowed Belfry. Per Order: 1 Limited UR (the Patron Deity), 2 Limited SSRs, 2 URs, and 5 SSRs, 5 SRs and 5 Rs, one per role. A role's three classes are split across SSR, SR and R, so every Order still fields all 15 classes.
- **Ranks are rarity.** R Commanders and SR Legends are mortal; SSR Demigoddesses are half-divine; UR Deities are gods of their Order.
- **15 classes in 5 roles:** Tank (Hierophant, Sentinel, Martyr), Healer (Confessor, Hospitaller, Abbess), Buffer (Oracle, Cantor, Adjudicator), Melee (War-Sister, Executioner, Veilblade), Ranged (Censer, Arbalist, Exorcist). Every Sister has her own kit: skills, a passive, a Relic and a **Litany** (her ultimate).
- **Combat is real time.** Up to four Sisters walk onto a side-on field and fight on their own. You tap a Litany when her Zeal is full, focus a foe, or aim. Bosses answer with **Blasphemies**. There are no turns, rounds or ranks: durations and cooldowns are seconds, positions are the front line (the two foes nearest your Sisters), and Stagger delays a foe's next blow. A fight lasts about 30 to 45 seconds.
- **The Vigil never sleeps.** Your Vigil party fights the Pilgrim's Road on the Sanctum screen, open or closed, and gathers spoils for up to 12 hours.

## Where the faithful go

Five tabs along the bottom:

| Tab | What waits there |
| --- | --- |
| **Sanctum** | Home. The leader's splash, the Vigil, Matins (login calendar), Penance (dailies and weeklies), Missives, the Pass and the Chapter. |
| **Sisters** | The roster, each Sister's page (Grow, Vows, Skills, Gear), Confession bonds, the Inventory, the Reliquary, the Order Codex and the Order Book. |
| **Crusade** | The Pilgrim's Road on top, then four wings of modes (below). |
| **Altar** | The banners: one per Order, plus a two-week Limited banner for each Patron Deity. Gear and Hounds are summoned here too. |
| **Market** | The Shop: Gilt, Alms and Tithes counters, packs and daily offers. |

**Crusade wings**, each mode opening at a Rank of Faith:

- **The Crypts:** branching crypt maps climbed room by room, with Heresy tiers and acts; Hold the Line; the **Abyssal Crypt**, the endless gear farm; the Bell Tower.
- **Daily Labors:** Sworn Errands, Purge Hunts, Relic Trials and the Reliquary Procession.
- **The Contest:** the Ordeals, Chapter War and Rival Orders.
- **The Abyss:** Nightmare Raid and the Inquisition.

**Relics of War** is the gear system: six grades from Worn to Godforged, Item Power 1 to 800, rolled affix lines, Edicts and sets. Tables in `src/data/loot.ts`, rules in `src/systems/gear.ts`.

**Currencies:** Seals (pulls), Tithes (growth), Gilt (premium, earned in game for now) and Alms (from melting gear and spare Vow tokens). A UR is guaranteed by pull 80, and pity is shared across Order banners. Rules in `src/systems/gacha.ts`, `currency.ts` and `shop.ts`.

## Run it

```bash
npm install
npm run dev      # open the printed URL; --host lets a phone on the same Wi-Fi connect
npm test         # every rule and balance sim (vitest)
npm run build    # type-checks and writes the playable build to dist/
```

CI runs `npm test` and `npm run build` on every pull request; both must pass before a merge. Merging to `main` deploys to GitHub Pages.

## Art

All art is **PC-98 style**: crisp hand-placed pixels, anime dark-fantasy heroines, 16 colours per image from the 4,096-colour PC-98 palette, heavy patterned dithering. No scanlines in the art; the game adds the CRT look.

Art is made by Aaron in **ChatGPT**, which reads this repo and delivers through its own lane:

- **`art-bible/`** holds the art rules ChatGPT reads live: start at `art-bible/README.md`. It covers the Orders, classes, all 500 Sister cards, every asset's size and file name (`ASSETS_GUIDE.md`) and what to make next (`ART_QUEUE.md`). Claude keeps it; art pull requests may not change it.
- **ChatGPT's art lane:** ChatGPT opens pull requests from `art/<asset-id>` branches titled `Art: <what>`, with image files only. The **Art lane guard** check fails anything outside the art folders. A raw battle sprite goes to `art-inbox/full-body/<id>_raw.png`, and the **Sprite intake** check (`tools/intake_sprite.py --colors 16`) commits the 128 × 192 game sprite back to the branch. See `art-inbox/README.md` and ASSETS_GUIDE section 5.
- **Code requests from ChatGPT** go in a "Code request for Claude" issue (label `for-claude`).
- **Art review viewer:** add `?artreview=<id>` to the live address, for example https://khannathan.github.io/CRT-Crusaders/?artreview=IV-LUR, to see a Sister's merged art in battle, roster, Sanctum, Altar and bust views with the pixel rig moves.

Sisters without art yet show a class silhouette tinted by their Order. Where game art lives (file name = asset id):

| Art | Folder |
| --- | --- |
| Bust, 128 × 128 | `src/assets/portraits/<id>.png` |
| Battle sprite, 128 × 192 (made by the intake bot) | `src/assets/full-body/<id>.png` |
| Splash, 256 × 384 | `src/assets/splash/<id>.png` (+ a row in `src/data/splashFrames.ts`) |
| Enemies | `src/assets/enemies/`, `src/assets/enemy-full/` |
| UI, icons, sigils, insignias, backdrops, effects | `src/assets/ui/` |

## Sound

The OST is 16 SNES-style tracks in `src/assets/audio/` (OGG plus MP3 fallback; `tools/encode-music.sh` re-encodes); which screen plays what is `SCENE_MUSIC` in `src/audio/music.ts`. Sound effects are dark chiptune through a CRT TV speaker, in `src/assets/sfx/` (`tools/encode-sfx.sh`).

## Where the code lives

| Folder | What |
| --- | --- |
| `src/scenes/` | One file per screen. `FieldScene.ts` is the battle screen. |
| `src/systems/` | Game rules, no drawing. `field.ts` (real-time battle engine) over `combat.ts`, plus one file per mode (`crusade.ts`, `abyss.ts`, `tower.ts`, `campaign.ts`, ...). Tests sit beside each file. |
| `src/data/` | Orders, classes, enemies and tables. `roster.ts` is generated from the Sister cards (`tools/roster/`); never edit it by hand. Hand kits in `kits.ts`; everyone else uses generated kits (`kitGen.ts`). |
| `src/ui/` | Shared widgets, the tab bar, the mode list (`rites.ts`) and the theme. |
| `src/state/` | The save and its migrations. |
| `tools/` | Art intake, roster and audio scripts. |
| `docs/VOICE.md` | The voice bible. All game text follows it. |

## The voice

Every word on screen is a **Zealous sermon**: fervent, second person, short. Sworn, consecrated, purge, pyre. Never holy, righteous or radiant: these Orders are not good. Numbers stay exact. Read `docs/VOICE.md` before writing a single line.
