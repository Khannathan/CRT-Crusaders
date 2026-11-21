# CRT Crusaders

A gothic gacha game about warrior-zealot Sisters, built for phones in portrait. Phaser 3 + TypeScript + Vite; WebGL first, with an Android APK planned via Capacitor.

## Run it

```bash
npm install
npm run dev      # open the printed URL; --host lets a phone on the same Wi-Fi connect
npm run build    # type-checks and writes the playable build to dist/
npm test         # gacha rules, combat rules, and crypt balance simulations (balance.test.ts prints win rates)
```

Every push to `main` deploys to GitHub Pages (Settings → Pages → Source: **GitHub Actions** must be turned on once).

## Adding portraits

Drop a square PNG named by roster id into `src/assets/portraits/`, for example `CC-W001.png`. A `.png` replaces a `.webp` of the same name, so the starter art from the UI preview (`CC-W001.webp` and so on) is overridden just by adding a PNG.

- 128 × 128 native (256 or 320 square also works), head and upper torso, eyes about 40% from the top, a few pixels of margin.
- Plain dark charcoal background (`#121116`); transparency is optional.
- Commit it and the next build picks it up; Sisters without a file show a placeholder.

## Adding enemy and UI art

Every built-in drawing can be replaced by dropping a PNG into a folder; nothing else needs to change.

- **Enemies:** `src/assets/enemies/<enemy id>.png`, square, 128 × 128 like portraits. Ids are in `src/data/enemies.ts`: `husk`, `acolyte`, `ringer`, `hound`, `wraith`, `choir`, `warden`, `priest`, `golem`, `lurker`, `pilgrim`, `thief`, `nun`, `bishop`, `abbess`.
- **UI pieces:** `src/assets/ui/<name>.png`. The file name picks what it replaces. Battle intent icons (24 × 24): `icon-attack`, `icon-aoe`, `icon-debuff`, `icon-summon`, `icon-charge`.
- **Backdrops:** `bg-hall` (Sanctum and Crusade) and `bg-altar` (Recruit), any size around 840 × 560; they are cropped to fit.
- **Menu icons:** 12 × 12 white-on-transparent PNGs, tinted in game: `ui-sigil`, `ui-sanctum`, `ui-seal`, `ui-tithe`, `ui-roster`, `ui-blade`, `ui-book`, `ui-lock`, `ui-shield`, `ui-flame`, `ui-swap`, `ui-close`.
- **Fonts:** `src/assets/fonts/` (Cinzel Decorative for titles, Crimson Pro for text, Vigil Pixel for numbers), declared in `src/fonts.css`; credits and licenses in `src/assets/fonts/licenses/`. Colours live in `PAL` in `src/config.ts`; frames, headings and badges in `src/ui/theme.ts`.

## How a fight reads

Each enemy shows its next move above its card: the skill, the expected damage and who it will hit. Your crusaders show the damage heading their way (red when it would be lethal, grey when a shield blocks it). Tap an enemy to read its plan in full. A Taunt pulls single-target attacks away, Shift can step out of reach, and Foresight's delay breaks a boss's wind-up. The Choir Below changes phase at half HP and starts charging Requiem, a two-turn group attack.

Each class has three skills and a Rite. Stronger skills have cooldowns, shown on the button. Combos: the Censer's smoke Weakens, which the War-Sister's Charge punishes; Censer burns and Confessor poisons stack, Contagion spreads them, and Fan the Flames ignites the whole stack at once; Accuse sets up the Inquisitor, whose Sentence finishes anything under 30% HP. While choosing a target, each glowing card shows the expected damage, KILL or COMBO.

**Auto** and **Speed 2x** sit at the top of the battle screen and are remembered on the device. Auto uses the same player as the balance tests (`src/systems/autoplay.ts`), and `ENEMY_TUNE` in `combat.ts` scales enemy HP and attack against it.

## Crypts and the map

Each crusade is a branching map, climbed from the bottom up: tap a glowing room, read what's inside (the enemies in a fight are listed), then Go. Rooms are fights, elite fights (tougher, pay a relic and a Seal), unknown events (a choice with stakes), shrines (heal) and reliquaries (pick a relic). The floor before the boss is always a rest. Maps are random each run.

- **The Drowned Ossuary**: 5 floors, then the Choir Below.
- **The Sunken Belfry**: opens after the Ossuary is cleared. 6 floors, harder enemies, 1.6x rewards, then the Hollow Abbess.

Enemies with tricks: the Warden shields allies, the Mourning Priest heals them, the Reliquary Golem's armor shrugs off hits (poison and burns ignore armor), the Undertow Lurker drags a back-rank crusader to the front, the Bloated Pilgrim bursts when killed, the Candle Thief steals Zeal, the Plague Nun poisons everyone, and the Grave Bishop empowers itself and raises the dead.

Crypts live in `src/systems/crusade.ts` (`CRYPTS`), line-ups in `src/data/enemies.ts` (`ENCOUNTERS`), events in `src/data/events.ts`. Crypt card art: `src/assets/ui/bg-<crypt id>.webp` (falls back to `bg-hall`). Map icons: `node-fight`, `node-elite`, `node-event`, `node-shrine`, `node-reliquary`, `node-boss` (48 × 48), plus the intent icon `icon-buff`.

Order art: `src/assets/ui/banner-<order id>.webp` is the banner backdrop on the Sealed Altar (falls back to `bg-altar`), and `sigil-<order id>.png` (64 × 64) replaces the drawn Order sigil. Order ids: `iron-vigil`, `ashen-mercy`, `veiled-tribunal`, `sepulcher-watch`, `candle-choir`, `thorn-covenant`, `drowned-litany`, `glass-confession`, `red-pilgrimage`, `hollow-bell`.

## Reasons to keep going

- **Heresy tiers:** after clearing a crypt, pick Heresy I to V on its card (‹ ›). Each tier gives enemies +25% HP and attack, adds +30% rewards, and every second tier takes a round off the Vigil candle. Each tier opens after the one before it is cleared, and each first clear pays 3 Seals. Tuning is in `crusade.ts` (`HERESY_*`).
- **Orders:** 50 Sisters across 10 Orders (`src/data/orders.ts`), five per Order with two URs each. Two Sisters of the same Order in a party turn on a bonus, and three turn on a stronger one, shown on the Muster screen and each Sister's Roster card.
- **Order banners:** the Sealed Altar runs one banner per Order (‹ › to switch). Tap one of the Order's two URs to target it. A UR pull is the target half the time, and the next UR after a miss is always the target. Half of SSR pulls come from the banner's Order. Rules are in `src/systems/gacha.ts`.
- **Passives:** SSR and UR Sisters carry a passive (lifesteal, thorns, bulwark, martyr, plague and more), listed in `src/data/crusaders.ts` and run in `src/systems/combat.ts`.
- **Vows (merging copies):** a duplicate pull gives that Sister a Vow token. On her Roster page (Oath tab), **Take Vow** spends a token and Tithes for a permanent Vow: +5% stats each, and skill upgrades at Vow 2 (first skill), Vow 4 (second skill) and Vow 5 (the Rite) for +25% effect and one less turn of cooldown. Copies past five pay Tithes instead.
- **Skills page:** the Skills tab lists her three skills and Rite with ranks, cooldowns and Vow upgrades, plus her passive.
- **Gear:** three slots (Blade, Habit, Rosary). Each piece has a rarity (R to UR), a main stat and up to three substats. Enhance to +10 with Tithes (substats grow at +3, +6 and +9), or melt spare pieces for Tithes. Fights sometimes drop gear, elites always drop one and bosses two, with better odds in harder crypts and Heresy. Gear found is lost on defeat. Rules are in `src/systems/gear.ts`.

## Layout

- `src/config.ts` — design resolution (540 × 960) and palette anchors from the art guide.
- `src/data/` — classes, rarity rules and the starter cast. A new Sister is one row in `crusaders.ts` plus a portrait.
- `src/data/` also holds class skills (`skills.ts`), enemies and encounters (`enemies.ts`) and run relics (`relics.ts`).
- `src/systems/` — game rules with no drawing: `gacha.ts`, `combat.ts`, `crusade.ts` (run flow and rewards), `stats.ts`.
- `src/scenes/` — one file per screen.
- `src/ui/` — shared buttons, tab bar and placeholder portraits.
