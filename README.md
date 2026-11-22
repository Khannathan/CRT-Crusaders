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

Drop a square PNG named by roster id into `src/assets/portraits/`, for example `CC-W001.png`. A `.png` replaces a `.webp` of the same name.

- 128 × 128 native (256 or 320 square also works), head and upper torso, eyes about 40% from the top, a few pixels of margin.
- Plain dark charcoal background (`#121116`); transparency is optional.
- Commit it and the next build picks it up; Sisters without a file show a placeholder.

## Adding enemy and UI art

Every built-in drawing can be replaced by dropping a PNG into a folder; nothing else needs to change.

- **Enemies:** `src/assets/enemies/<enemy id>.png`, square, 128 × 128 like portraits. Ids are in `src/data/enemies.ts`: `husk`, `acolyte`, `ringer`, `hound`, `wraith`, `choir`, `warden`, `priest`, `golem`, `lurker`, `pilgrim`, `thief`, `nun`, `bishop`, `abbess`.
- **UI pieces:** `src/assets/ui/<name>.png`. The file name picks what it replaces. Battle intent icons (24 × 24): `icon-attack`, `icon-aoe`, `icon-debuff`, `icon-summon`, `icon-charge`.
- **Backdrops:** `bg-hall` (Sanctum and Crusade) and `bg-altar` (Recruit), any size around 840 × 560; they are cropped to fit.
- **Menu icons:** 12 × 12 white-on-transparent PNGs, tinted in game: `ui-sigil`, `ui-sanctum`, `ui-seal`, `ui-tithe`, `ui-roster`, `ui-blade`, `ui-book`, `ui-lock`, `ui-shield`, `ui-flame`, `ui-swap`, `ui-close`.
- **UI skins (optional):** `ui-button`, `ui-button-pressed`, `ui-button-primary`, `ui-button-primary-pressed`, `ui-panel`, `ui-frame`, `ui-card`, `ui-chip`, `ui-badge`, `ui-tab-active` are 9-slices (corner sizes in `src/ui/skin.ts`); `ui-tabbar` (540 × 88), `ui-topbar` (540 × 56) and `ui-divider` are plain images. Without a file, the drawn look stays.
- **Battle and Sister page skins (optional):** `ui-skill`, `ui-skill-selected`, `ui-skill-rite`, `ui-unit-frame` (tinted), `ui-turn-frame`, `ui-bar-frame`, `ui-subtab`, `ui-subtab-active`, `ui-gear-slot` (tinted) are 9-slices; `ui-bar-hp`, `ui-bar-hp-enemy`, `ui-bar-zeal` are fill tiles stretched sideways; `ui-pip`, `ui-pip-full` (24 × 24 on screen), `ui-arrow` (points right) are plain images; `ui-vigil-candle` is a strip of frames, each one-third as wide as it is tall, full on the left to snuffed on the right.
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

- **Leave and come back:** the tab bar stays on the crypt map, so you can visit the Roster or Sanctum mid-crusade and return from the Crusade tab. In a fight, **Menu** (top left) pauses on your turn and shows the tabs; the fight is kept exactly as it was until you return (Rite fights too, or abandon those for free).
- **Repeat crusades** (Rank IV): a crypt cleared at the chosen Heresy tier shows **Repeat** on its card. Your Sisters replay it 1, 3 or 5 times on Auto (real fights, rewards and wounds), stopping at the first defeat. Logic in `src/systems/autorun.ts`, shared with the balance tests' path policy.
- **The Bell Tower** (Rank VI): an endless climb of 60 floors that grow harder each step. Every 10th floor holds a boss, every 5th admits only one Order's Sisters, and every 8th only R and SR Sisters. Each floor pays once, on its first clear. Logic and tuning in `src/systems/tower.ts` (`floorDef`).
- **The Inquisition** (Rank VIII): every two weeks a new Edict bends every fight (half healing, a short candle, iron-clad or hasted heretics) across three hard trials. Each trial earns 0-3 Brands (win, no one fallen, within 8 rounds); 3, 6 and 9 Brands pay Seals, Tithes and SSR+ gear once per rotation. A Sister who wins one trial must rest for the other two, and two featured Orders fight at +20% ATK and HP. Tuning in `src/systems/inquisition.ts`.
- **Confession** (Rank V): every Sister has a bond, 0 to V. It grows when she wins fights (crypts and every Rite), keeps Vigil (2 per hour), or when you light a candle for her with Tithes. Each level adds +2% ATK and HP and opens one of her five confessions, read on the Confession screen (a gold dot marks new ones). Confession text is placeholder, built from her Order, class and hook in `src/systems/bonds.ts`. Optional art: `src/assets/ui/bg-confessional.png` behind the confession.
- **Weekly Pilgrimage:** crypt runs are always free. The first 3 victories each week (Monday reset) pay +4 Seals and +200 Tithes on top (`PILGRIMAGE_*` in `crusade.ts`), shown at the top of the Crusade screen.
- **Heresy tiers:** after clearing a crypt, pick Heresy I to V on its card (‹ ›). Each tier gives enemies +25% HP and attack, adds +30% rewards, and every second tier takes a round off the Vigil candle. Each tier opens after the one before it is cleared, and each first clear pays 3 Seals. Tuning is in `crusade.ts` (`HERESY_*`).
- **Orders:** 50 Sisters across 10 Orders (`src/data/orders.ts`), five per Order with two URs each. Two Sisters of the same Order in a party turn on a bonus, and three turn on a stronger one, shown on the Muster screen and each Sister's Roster card.
- **Order banners:** the Sealed Altar runs one banner per Order (‹ › to switch). Tap one of the Order's two URs to target it. A UR pull is the target half the time, and the next UR after a miss is always the target. Half of SSR pulls come from the banner's Order. Rules are in `src/systems/gacha.ts`.
- **Pull again:** the pull summary lists Sisters rarest first (UR top left down to R) and has **Again ×1** and **Again ×10** buttons on the same banner, with your Seals shown, so you never have to go back to the altar between pulls.
- **Banner pity:** the UR chance climbs about 6% per pull after 60 pulls without a UR, and pull 80 is always a UR. That count is shared across every Order banner and shown on the Altar. Each pull on an Order banner also gives one Relic Shard for that Order; at 150 shards you pick either of the Order's URs. Shards stay with their Order. Tune `UR_SOFT`, `UR_HARD`, `UR_SOFT_STEP` and `SPARK` in `src/systems/gacha.ts`.
- **Power:** one number for strength, in `src/systems/power.ts` (weights in `CP`). Offense is ATK with crit, scaled by speed; defense is weighted HP and armor; a role share lifts Menders and Mystics; Vow upgrades and signature passives add more. Shown on Roster cards, each Sister's page (top left), each worn piece (what it adds), the gear picker (▲/▼ if she swapped to it), Muster (party power) and the Sanctum (account power: your strongest four). The Vigil uses the same formula.
- **Recommended Power:** crypts (at the chosen Heresy), Bell Tower floors and Inquisition trials show the party power they ask for, next to yours: green when you meet it, orange within 80%, red below. It is the foes' power times `CP.recommend` (1.2, tuned so the starter party meets the Ossuary around level 5). Muster and the party pickers show it against the party you picked.
- **Roster sort and filter:** **Sort** cycles Power, Level, Rarity, Class, Order and Name (sworn Sisters always first). **Filter** picks any mix of rarities, classes and Orders, and can hide unsworn Sisters.
- **Passives:** SSR and UR Sisters carry a passive (lifesteal, thorns, bulwark, martyr, plague and more), listed in `src/data/crusaders.ts` and run in `src/systems/combat.ts`.
- **Vows (merging copies):** a duplicate pull gives that Sister a Vow token. On her Roster page (Oath tab), **Take Vow** spends a token and Tithes for a permanent Vow: +5% stats each, and skill upgrades at Vow 2 (first skill), Vow 4 (second skill) and Vow 5 (the Rite) for +25% effect and one less turn of cooldown. Copies past five pay Tithes instead.
- **Skills page:** the Skills tab lists her three skills and Rite with ranks, cooldowns and Vow upgrades, plus her passive.
- **Gear:** three slots (Blade, Habit, Rosary). Each piece has a rarity (R to UR), a main stat and up to three substats. Enhance to +10 with Tithes (substats grow at +3, +6 and +9), or melt spare pieces for Tithes. Fights sometimes drop gear, elites always drop one and bosses two, with better odds in harder crypts and Heresy. Gear found is lost on defeat. Rules are in `src/systems/gear.ts`.

## The Rites (Sanctum)

Side modes and daily duties sit under **The Rites** on the Sanctum (`src/ui/rites.ts`). A gold dot means something is waiting to be claimed.

- **Rank of Faith:** an account level (Rank button, top right of the Sanctum). Every tracked deed earns Faith (`RANK_XP` in `src/systems/rank.ts`). Ranks open Rites one at a time (`UNLOCKS`, and `rank` on each Rite) and each rank leaves a gift of Seals and Tithes to claim. Older saves start with Faith for the progress they already have.

- **Penance:** five Daily Penance tasks (reset at local midnight) and six weekly Litany tasks (reset on Monday). Each finished task adds Devotion, and the Devotion bar pays Seals and Tithes at three marks. Tasks count from the game's own systems (`track()` in `src/systems/tasks.ts`), so Auto and the Vigil count too.
- **Relic Trials** (Rank III): one or two trials a weekday (Mon Blade gear and Ash, Tue Habit and Psalter, Wed Rosary, Thu Tithes and Ash, Fri Seals and Psalter; weekends open all seven), five tiers each. Three victories a day across all trials; a loss spends nothing. Stars: 1 for a win, 2 if no Sister falls, 3 if also by round 6. Three stars on a tier unlocks Sweep. Rules in `src/systems/trials.ts`. Side-mode fights use the Battle screen through `current.challenge` (`src/state/run.ts`).
- **Inventory and materials:** five families with three tiers each (`src/systems/items.ts`): Martyr's Ash (Ascension), Psalter Pages (skill levels), Blessed Iron (gear), Incense (the Reliquary) and Order Writs (Order Codex). Crypt rooms drop them (more and rarer at higher Heresy and in the Belfry, halved on defeat), as do the Vigil, the Ash and Psalter Trials, Tower floors, Penance and Litany marks and Inquisition marks. The Inventory (Sanctum) lists them with Seals, Tithes, Vow tokens and Relic Shards, and refines five of a tier into one of the next. Icons: `src/assets/ui/item-<id>.png` (96 x 96), drawn stand-ins until then.
- **Ascension:** at her level cap a Sister ascends for Martyr's Ash and Tithes (`src/systems/ascension.ts`): the cap goes 20, 30, 40, 50 and each ascension adds 5% to all stats.
- **Gilt, Alms and the Shop:** Gilt is the premium currency (300 to start; earned for now from first clears, new Heresy tiers, Rank gifts, Matins, Tower bosses, Litany and Inquisition marks). Alms come from melting gear, Vow tokens past a Sister's last Vow, and Penance marks. The Shop (Sanctum) has three counters: Gilt (Seals, material crates, an extra Trial victory, SSR+ gear; daily limits), the Almonry (six Alms offers drawn each day, one free refresh then 30 Gilt each) and Tithes (common materials, Seals, SR+ gear; weekly limits). Rules in `src/systems/currency.ts` and `src/systems/shop.ts`. Icons: `ui-gilt.png`, `ui-alms.png`, `ui-shop.png`.
- **Skill levels:** each of a Sister's four skills (three skills and her Rite) rises from level 1 to 5 in the Roster's Skills tab for Psalter Pages and Tithes (`src/systems/skillLevels.ts`). Each level adds 6% to the skill's damage, healing, shields and poison, and higher levels need Sister levels 5, 15, 25 and 35, so the last ones follow Ascension. Every level gained adds to Power.
- **Matins:** a 28-candle login calendar (`src/systems/matins.ts`). One candle a day; a missed day waits and never resets the count. Candle 28 gives a Vow token to a Sister you pick, then the calendar starts over.

## The Vigil (idle)

The Sanctum shows the Vigil: up to four Sisters fighting the chosen crypt's horrors on a loop, played by the Auto player. While the game is open or closed, the Vigil gathers Tithes, gear and Seals, up to 12 hours before it must be claimed. Stronger Sisters gather more (20% to 150% of the base rate), and the Belfry pays more once it is unlocked. Use ‹ › to change crypt and **Sisters** to change the watch; both claim first so nothing is lost. Rates are in `src/systems/vigil.ts` (`VIGIL_RATES`, `VIGIL_CAP_HOURS`).

## Layout

- `src/config.ts` — design resolution (540 × 960) and palette anchors from the art guide.
- `src/data/` — classes, rarity rules and the starter cast. A new Sister is one row in `crusaders.ts` plus a portrait.
- `src/data/` also holds class skills (`skills.ts`), enemies and encounters (`enemies.ts`) and run relics (`relics.ts`).
- `src/systems/` — game rules with no drawing: `gacha.ts`, `combat.ts`, `crusade.ts` (run flow and rewards), `stats.ts`.
- `src/scenes/` — one file per screen.
- `src/ui/` — shared buttons, tab bar and placeholder portraits.
