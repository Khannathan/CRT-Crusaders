# CRT Crusaders

A gothic gacha game about warrior-zealot crusaders, built for phones in portrait. Phaser 3 + TypeScript + Vite; WebGL first, with an Android APK planned via Capacitor.

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
- Commit it and the next build picks it up; crusaders without a file show a placeholder.

## Adding enemy and UI art

Every built-in drawing can be replaced by dropping a PNG into a folder; nothing else needs to change.

- **Enemies:** `src/assets/enemies/<enemy id>.png`, square, 128 × 128 like portraits. Ids are in `src/data/enemies.ts`: `husk`, `acolyte`, `ringer`, `hound`, `wraith`, `choir`.
- **UI pieces:** `src/assets/ui/<name>.png`. The file name picks what it replaces. Battle intent icons (24 × 24): `icon-attack`, `icon-aoe`, `icon-debuff`, `icon-summon`, `icon-charge`.
- **Backdrops:** `bg-hall` (Sanctum and Crusade) and `bg-altar` (Recruit), any size around 840 × 560; they are cropped to fit.
- **Menu icons:** 12 × 12 white-on-transparent PNGs, tinted in game: `ui-sigil`, `ui-sanctum`, `ui-seal`, `ui-tithe`, `ui-roster`, `ui-blade`, `ui-book`, `ui-lock`, `ui-shield`, `ui-flame`, `ui-swap`, `ui-close`.
- **Fonts:** `src/assets/fonts/` (Cinzel Decorative for titles, Crimson Pro for text, Vigil Pixel for numbers), declared in `src/fonts.css`. Colours live in `PAL` in `src/config.ts`; frames, headings and badges in `src/ui/theme.ts`.

## How a fight reads

Each enemy shows its next move above its card: the skill, the expected damage and who it will hit. Your crusaders show the damage heading their way (red when it would be lethal, grey when a shield blocks it). Tap an enemy to read its plan in full. A Taunt pulls single-target attacks away, Shift can step out of reach, and Foresight's delay breaks a boss's wind-up. The Choir Below changes phase at half HP and starts charging Requiem, a two-turn group attack.

Each class has three skills and a Rite. Stronger skills have cooldowns, shown on the button. Combos: the Censer's smoke Weakens, which the War-Sister's Charge punishes; Censer burns and Confessor poisons stack, Contagion spreads them, and Fan the Flames ignites the whole stack at once; Accuse sets up the Inquisitor, whose Sentence finishes anything under 30% HP. While choosing a target, each glowing card shows the expected damage, KILL or COMBO.

**Auto** and **Speed 2x** sit at the top of the battle screen and are remembered on the device. Auto uses the same player as the balance tests (`src/systems/autoplay.ts`), and `ENEMY_TUNE` in `combat.ts` scales enemy HP and attack against it.

## Layout

- `src/config.ts` — design resolution (540 × 960) and palette anchors from the art guide.
- `src/data/` — classes, rarity rules and the starter cast. A new crusader is one row in `crusaders.ts` plus a portrait.
- `src/data/` also holds class skills (`skills.ts`), enemies and encounters (`enemies.ts`) and run relics (`relics.ts`).
- `src/systems/` — game rules with no drawing: `gacha.ts`, `combat.ts`, `crusade.ts` (run flow and rewards), `stats.ts`.
- `src/scenes/` — one file per screen.
- `src/ui/` — shared buttons, tab bar and placeholder portraits.
