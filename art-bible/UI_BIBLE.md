# CRT Crusaders: UI Bible for the redesign concepts

This is the brief for **concept art of a full UI redesign**. It tells you what every screen in the game is for, what it must show, how big things must be on a phone, and how the redesign should look. You make **concepts only**: pictures of how screens could look. Nothing you make here goes into the game directly. Aaron picks a direction, then Claude rebuilds the screens in code and asks for the final UI skins as normal assets (ASSETS_GUIDE section 2).

Read this with: `GAME_OVERVIEW.md` (what the game is), `ASSETS_GUIDE.md` section 1 (PC-98 style) and section 5 (delivery), `order-bible.md` note 16 (Order colour swatches). The repo copy on `main` is always the current one.

**Screenshots of the game as it is today** live in `art-bible/ui-screens/`. Every file is a real capture at the game's own size, 540 x 960 (files ending `-tall` are 540 x 1280, the tallest phone shape), with the CRT filter off. Start with `00-overview-1.png` and `00-overview-2.png`: every screen on two sheets. Open the single screen file when you work on it. The screenshots show stand-in art (grey silhouettes) for Sisters whose art isn't made yet; that is expected.

---

## 1. What the redesign is for

The game works, but its screens grew one feature at a time. The redesign should make it feel like one object: a **fanatic war-cathedral you hold in your hand**, lit by candle and pyre, where every screen is a chapel, a reliquary or a war-table of the same building.

Goals, in order:

1. **Clarity at arm's length.** A player on a phone reads every number and finds every button on the first look. What to do next is always the brightest thing on screen.
2. **One family.** The same frame, button, tab, bar and badge everywhere. A player learns the kit once.
3. **The Sisters are the jewels.** UI chrome frames her art; it never competes with it. Rank (R, SR, SSR, UR) and Order must read instantly on every card.
4. **Grimdark zealotry, not church kitsch.** Iron, wax, bone, scorched parchment, blood-red seals, chain and nails. Holy things look dangerous.
5. **PC-98 to the bone.** It should look like the menu of a 1990 Japanese PC-98 dark-fantasy RPG that somehow runs on a phone.

What stays fixed (the code depends on it): the 540-wide portrait canvas, the five tabs and what lives under each, the order of the battle HUD (field above, party cards below), and the information each screen shows (section 7). Layout inside a screen, the look of every piece and how information is grouped are all open.

---

## 2. Canvas, layout and touch rules

| Rule | Value |
| --- | --- |
| Game width | **540** game pixels, always |
| Game height | **960** on a 9:16 phone, grows up to **1280** on tall phones (the live `GAME_H`). Design every screen for 960 first, then show what the extra height does |
| Top bar (currency bar) | 56 px tall, pinned to the top: Rank crest (opens Your Crest) at left with Power, three currency chips (Gilt, Seals, Tithes), a fullscreen toggle at right |
| Tab bar | 88 px tall, pinned to the **bottom of the live height**: Sanctum, Sisters, CRUSADE (raised centre medallion that may rise about 24 px above the bar), Altar, Market. Each tab can show a small "ready" dot |
| Sub-tab strip | 44 px, directly under the top bar on grouped screens (Sisters group, Altar group, Duties group) |
| Side margin | 18 px on both sides for text and controls; art may bleed to the edge |
| Content area | between the top bar (or sub-tabs) and the tab bar: about 816 px tall at 960 height. Long pages scroll inside it; the bars never scroll |
| Bottom controls | a screen's main action button sits just above the tab bar and moves down with it on tall phones. Never place a control at a fixed y near the bottom |
| Touch targets | every tappable thing at least **44 x 44** px (about 7 mm on a phone), main buttons **220-260 x 52-60**, at least 8 px between targets. Small badges can look small if their tap area is 44 px |
| Thumb zone | the most used actions sit in the bottom third; Back sits top right on mode screens (today) or top left (open to change, but keep it in the same place on every screen) |
| Safe area | the game already sits inside the phone's notch and gesture-bar insets, so draw nothing for notches. Keep text 8 px clear of every edge |
| Readability floors | the game never draws text smaller than: body 17 px, titles 20 px, pixel numbers 14 px, icons 18 px. Design with real sizes at least that big |
| Battle, pull reveal, title, story | full screen: no top bar, no tab bar |

**Pixel grid.** UI chrome (frames, buttons, bars, icons) is pixel art drawn on a **2-pixel grid**: one art pixel = 2 x 2 game pixels, the same as the backdrops. So the chrome of a 540 x 960 screen is really a 270 x 480 pixel picture. Text is the exception: the game renders text with real fonts on top, at full resolution.

**Nine-slice.** Every frame, panel, button and bar is stretched by the game to any size. So ornaments live in the **corners**, edges are a plain repeating strip, and the middle is flat or a quiet repeat. A frame with a big crest in the middle of its top edge can't be used for boxes of different widths (put a crest on top as a separate piece instead).

---

## 3. Visual direction

**PC-98 first.** Crisp square pixels, hard edges, heavy patterned (Bayer) dither for every gradient, glow and shadow, high contrast, dark backgrounds. Colours picked from the 4,096-colour palette (each RGB channel a multiple of 17: 00, 11, 22 ... FF). Never painterly, never soft gradients, blur, bloom, glass reflections, drop shadows or modern flat UI.

**Medieval, firelit, fanatical.** Materials: blackened iron and riveted plate, aged bronze, candle wax (drips, pooled seals), bone and ossuary details, scorched and nailed parchment, chain, thorns, stained glass in deep blood and gold, wax seals in rarity colours. Light: fire from below and behind, warm orange-gold on dark plum-black, cold moon-blue only as a rare accent. Holy symbols are terrifying: eyes on wings, nails, brands, burning crowns.

**Mood words:** consecrated, sworn, purge, decree, pyre, vigil, reliquary, war-chapel. Never cute, never clean-modern, never "light and holy".

### 3.1 Today's UI palette (start here; a direction may shift it)

| Role | Hex | 4,096 snap |
| --- | --- | --- |
| Ink background | #100D12 | #111111 |
| Panel | #1B151E | #221122 |
| Hairline / inner line | #493436 | #443333 |
| Button fill | #241A22 | #221122 |
| Button edge | #745157 | #775555 |
| Wine (primary action) | #63283A | #662233 |
| Wine light | #8E4154 | #884455 |
| Gold (highlight, numbers) | #EFBC79 | #EEBB77 |
| Gold edge | #AA7C4B | #AA7744 |
| Bronze | #8B6848 | #886644 |
| Ivory (main text) | #F0E2CA | #EEDDCC |
| Muted text | #B7A5A1 | #BBAAAA |
| Faint text | #A49198 | #AA9999 |
| Health (party) | #7ABA5A | #77BB55 |
| Damage / danger | #C27078 | #CC7777 |
| Wrath (boss) | #FF5A3A | #FF5533 |

**Rarity colours (fixed, players learn them):** R pale steel #B6ADB9, SR violet #C5A4D5, SSR gold #EFBC79, UR rose #E19CC4. A rarity shows as its letter badge plus its colour on the card edge or seal. Today the wax seals `seal-R/SR/SSR/UR` carry the rarity on the pull reveal.

**Order colours:** each of the 10 Orders has fixed swatches (order-bible note 16) and a crucifix icon (`ui/sigil-<order id>.png`) and insignia. Use the Order's colours only where the UI is about that Order: an Order banner, a Sister's card trim, the Order Book. The base chrome stays neutral (iron, wax, gold, wine) so ten Orders can sit side by side.

| Order | Lead / trim swatches |
| --- | --- |
| Iron Vigil | bone-white #DDDDCC, charcoal-black #333344, ember-orange #DD6622 |
| Ashen Mercy | ash-white #CCBBBB, wine #663333 |
| Veiled Tribunal | dusk violet #665588, parchment #CCBBAA |
| Sepulcher Watch | bone-tan #BBAA88, slate #333344 |
| Choir of the Pyre | candle gold #DD9966, wine #663333 |
| Verdant Martyrdom | moss green #557733, blood red #992233 |
| Drowned Litany | sea-teal #446677, parchment #CCBBAA |
| Confessors of Glass | ice blue #99BBCC, violet #665588 |
| Crimson Inquisition | blood crimson #992233, antique gold #DD9966 |
| Hallowed Belfry | bell bronze #886644, parchment #CCBBAA |

Some file names still use old Order ids (for example Crimson Inquisition files are `red-pilgrimage`). Always use the display names above in concepts.

### 3.2 The CRT filter is the game's job

The game has an optional CRT screen effect (Settings: On or Off, strength Subtle, Standard or Heavy): scanlines, colour bleed and a slight screen curve, added at runtime over everything. **Never paint scanlines, screen curve, glare or RGB fringes into the concepts.** Design for the clean image. A concept may show one extra copy "with CRT on" only if Aaron asks.

---

## 4. Typography

Three fonts ship with the game. Text is always set by the game, never baked into art.

| Font | Role | Look | Smallest size |
| --- | --- | --- | --- |
| **Cinzel Decorative** (bold) | Screen titles, Sister names, big moments ("EXECUTED!", "THE BELLS FALL SILENT") | carved Roman capitals with flourished letters | 20 px |
| **Crimson Pro** (regular and italic) | Body text, buttons, descriptions, quotes | bookish old-style serif | 17 px |
| **Vigil Pixel** | Numbers, small labels, timers, stats, chips ("LV 35", "POWER 40,187") | blocky pixel capitals, ASCII only | 14 px |

A redesign may propose a different display or pixel font if it fits PC-98 better (for example a chunky 8x16 PC-98 style bitmap face for labels). Name it in the PR as a suggestion; Claude checks the licence before anything changes.

**Lettering in concepts:** write the real words from the screenshots, short and correct, in lettering that looks like the role above. If the image tool garbles text, keep the block where it belongs at the right size; Claude reads the layout, not the spelling. Game text follows the voice in `docs/VOICE.md`: short imperatives, exact numbers, one "!" at most per line.

---

## 5. Component kit

Every concept round should show its components, not just whole screens. These are the pieces the game uses today (file names under `src/assets/ui/`); the redesign may restyle every one and may add new ones.

| Component | Today's file(s) | Where | States and notes |
| --- | --- | --- | --- |
| Button | `ui-button`, `ui-button-primary`, `-pressed`, `ui-button-disabled` | everywhere | normal (dark), primary (wine with gold edge), pressed, disabled. Optional small icon left of the label; optional second line in small gold pixel text ("Recruit x10 / 8 Seals") |
| Panel | `ui-panel` (190 x 194) | large boxes | heavy frame, corner ornaments only |
| Frame | `ui-frame` (176 x 172) | content cards, list rows | lighter frame with gold corner ticks |
| Sister card | `ui-card` | roster and every picker | see 5.1 |
| Sub-tab | `ui-subtab`, `ui-subtab-active` | strips of 3-6 tabs | inactive, active, "ready" dot |
| Tab bar | `ui-tabbar`, `ui-tab-active`, `ui-crusade` medallion | bottom | five tabs, raised centre medallion, ready dots |
| Top bar | `ui-topbar` | top | crest, Power, 3 currency chips |
| Chip | `ui-chip` | currencies, small tags | icon + number |
| Badge | `ui-badge`, `ui-badge-blessed` | rarity, NEW, FIRST, bonuses | small, tinted |
| Bars | `ui-bar-frame`, `ui-bar-hp`, `ui-bar-hp-enemy`, `ui-bar-zeal`, `ui-bar-devotion`, `ui-bar-litany(-frame)(-full)`, `ui-bar-wrath(-frame)(-full)` | HP, Zeal, progress, Litany chain, boss Wrath | flat stretchable middle; a "full" state that flickers or burns |
| Pips and marks | `ui-pip`, `ui-pip-full`, `ui-mark`, `ui-mark-ready`, `ui-mark-claimed`, `ui-ready-dot` | stars, steps, claim states | ready must be the loudest mark |
| Gear slot | `ui-gear-slot` | Sister Gear tab | empty, filled, rarity edge |
| Skill tile | `ui-skill`, `ui-skill-selected`, `ui-skill-rite`, `ui-skill-litany(-selected)`, `ui-rite-tile` | skills, Litany | normal, selected, ready |
| Battle unit frame | `ui-unit-frame`, `ui-turn-frame` | battle cards | |
| Divider | `ui-divider` (243 x 24) | under titles | |
| Menu icons | `ui-<name>` (24 x 24, white, the game tints them) | tabs, buttons | one bold silhouette each |
| Warning banner | `ui-blasphemy-warning` | boss Blasphemy | full-width band |
| Litany ready flare | `ui-litany-ready` | battle cards | |
| Candles | `ui-vigil-candle`, `ui-matins-candle`, `ui-matins-final`, `ui-flame` | Vigil, Matins, timers | animated in code |
| Lock, close, arrow, swap | `ui-lock`, `ui-close`, `ui-arrow`, `ui-swap` | | |
| Popup sheet | drawn in code | confirms, rewards, settings | dark scrim over the screen, one panel, one main button |
| Toast | drawn in code | short results ("Victory! +60 Candles.") | appears mid-screen, fades |

### 5.1 The Sister card (most important small piece)

Used by the roster and **every** party picker, 3 across: about **162 x 174** px (portrait 128 px tall plus a 46 px name strip). It must show, readable at that size:

- her bust art (128 x 128 source) with a rarity-coloured edge;
- **rarity** letter (R, SR, SSR, UR) top-left;
- **Order** crucifix icon top-right;
- **class** emblem and **level** ("LV 35") at the bottom of the portrait;
- **name** and **Power** number on the strip, with her **role** ("MELEE DPS", "HEALER");
- optional overlays: party slot number (1-4), a coloured pick ribbon (bane, physical, bonus), "NEW", locked.

Aaron likes today's 3-across size; keep it. Show a card in every state on the kit sheet.

### 5.2 Battle pieces

- **Party card** at the bottom of battle: 104 x 104 portrait, HP bar and Zeal bar under it. When Zeal is full the card flares and shows the Litany name or a call ("BREAK IT!", "BRACE!"). Tap casts the Litany; hold and drag aims it.
- **Boss bar** at the top: name, wide HP bar, and the **Wrath** bar under it. Today Wrath is a thin 3 px line: the redesign should make it a real, readable bar that visibly burns when full (full Wrath = Blasphemy next).
- **Blasphemy warning:** the boss's attack name across the screen in red plus a call ("Swallow! Leave the red!") and red danger zones on the floor.
- **Hosanna bar** ("CHOIR OF WRATH"): a party-wide bar above the cards; full, the player calls the Hosanna.
- **Top row:** stage name and timer at left, Auto, speed (1x), pause at right.
- Damage numbers, status icons over heads and the field itself are drawn by the battle engine. Concepts can restyle them but must keep them small and above the figures.

---

## 6. Navigation map

```
Title ─▶ Sanctum
Tabs: Sanctum | Sisters | CRUSADE | Altar | Market
Sanctum (lobby) ── crest ─▶ Your Crest ─▶ Rank of Faith, Settings, Chronicle, save tools
                ├─ left rail: Duties (Penance | Deeds | Novitiate), Missives, Matins, Pilgrim's Pass, Chapter
                ├─ right rail: Feast event, Limited Saint, Calendar, Novitiate
                └─ Onward! ─▶ Pilgrim's Road ─▶ party picker ─▶ battle ─▶ results
Sisters: Sisters (roster) | Bonds | Satchel | Relics | Codex | Book
         roster ─▶ Sister page: Grow | Vows | Skills | Gear | Weapon | Canon, splash view
CRUSADE hub: Road card ─▶ Pilgrim's Road
            Daily Labors: Sworn Errands, Purge Hunts, Relic Trials, Reliquary Procession
            The Crypts: Crypts (map runs), Hold the Line, Abyssal Crypt, Bell Tower
            The Contest: Ordeals, Chapter War, Rival Orders
            The Abyss: Nightmare Raid, Inquisition
            Feast event strip
            every mode ─▶ party picker or Muster ─▶ battle ─▶ results or report
Altar: Sisters (banners) | Gear (Saints' Armory) | Hounds (Kennel) | Record
       Recruit x1 / x10 ─▶ pull reveal: seals ─▶ one by one ─▶ summary
Market: Packs | Gilt | Almonry | Tithes
```

---

## 7. Screen inventory

Each entry: the screenshot(s), what the screen is for, what it **must** show, its controls, layout notes, and what it shares with other screens. "Must show" is the floor: you can regroup, restyle or reveal it on tap, but every item has to be reachable.

### 7.1 Title (`01-title`)
- **Purpose:** first image of every session; loading, then "Tap to begin the vigil".
- **Must show:** logo (`logo.png`), key art (`ui/title-keyart.png`, 256 x 384 scene), a one-line commandment, the tap prompt, a small build line at the bottom.
- **Controls:** tap anywhere. A candle-wick loading bar while it loads.
- **Notes:** full screen, no bars. Keep the top fifth and the middle band dark for the logo and line.

### 7.2 Sanctum lobby (`03-sanctum-lobby`, `02-sanctum-new-player`)
- **Purpose:** home. The chosen Keeper Sister's splash fills the screen; the idle Vigil fights on its own; the big button sends you onward.
- **Must show:** Keeper header ("Keeper of the Sanctum", her name, bond progress today); her splash behind everything; her speech bubble (tap her to talk); **left rail** of icon buttons with labels and ready dots: Duties, Missives, Matins, Pass, Chapter, Collect; **right rail** of event plaques with timers: Feast, Limited Saint, Calendar, Novitiate; **Vigil strip**: a live mini battle of the Vigil party, gathered Tithes, stage ("1-1"), hours banked; buttons **Claim**, **Fast: free**, **Sisters** (pick the Vigil party), **March: On/Off**; the big primary **Onward! 1-1** button above the tab bar.
- **New player:** no Sister yet: empty hall, one line, and one button "To the Altar!".
- **Notes:** this is the screen players see most. The splash must stay the hero: rails thin, translucent or framed in iron along the edges; the Vigil strip and Onward button own the bottom third.
- **Reuses:** top bar, tab bar, rail icon button, event plaque, primary button.

### 7.3 Your Crest and Settings (`04-your-crest`, `05-settings-sheet`)
- **Your Crest:** rank (Roman numeral) and Faith bar, Power, next gift; a grid of buttons: Rank of Faith, Change Keeper, Chronicle, Oath Record, Settings, Back up save, Restore save, Reset save; an "Almost there" strip of near goals.
- **Settings sheet:** music volume slider and Mute, Sound effects on/off, **CRT screen effect On/Off** and strength (Subtle, Standard, Heavy), Full screen, Screen shake, Back up save, Restore save, Done.
- **Notes:** a popup sheet over the dimmed screen. Reuse the popup sheet and toggle buttons.

### 7.4 Crusade hub (`06-crusade-hub`) and the four wings (`07`-`10`)
- **Purpose:** every way to fight, in one hub.
- **Must show:** the **Road hero card** (chapter, stage name, candles, next stage, Continue); a **daily blessing strip** ("Wednesday: +50% Relic Trial spoils"); four **wing tiles** with art, title, one-line purpose and a live status line: Daily Labors (e.g. "0 of 4 away"), The Crypts ("1 of 18 crypts open"), The Contest ("Penitent League"), The Abyss ("1 delve left today"); the **Feast event strip** with timer.
- **Wing pages:** a list of mode cards. Each card: art strip, name, one line, status chips (entries left, best, bonus tag such as "+50% today"), and a chevron. Daily Labors has a **Sweep all** button on top.
- **Notes:** the wing tile and mode card are one component family. They must show at a glance what is ready to play today.

### 7.5 Pilgrim's Road and party picker (`11-pilgrims-road`, `13-party-picker`)
- **Road:** a winding map of stage nodes (1-1 ... 5-10) through five chapters, each with a chest at stage 10; the current stage highlighted; a stage panel at the bottom: name, foes, Recommended Power vs Vigil Power, first-clear reward, **March: On/Off**, **Challenge**, **Auto-push**.
- **Party picker (sheet):** title (stage), Presets, Clear, a legend of pick marks (BANE, PHYSICAL...), Sort and Filter, the Sister card grid with slot numbers 1-4, Recommended vs Party Power, Hound row with Change, Order bonus chips ("Iron Vigil x2"), and **Back / Suggest / Fight**.
- **Notes:** the picker is shared by every mode; design it once.

### 7.6 Story scene (`12-story-scene`)
- Chapter title in display type, two figures (Sister and foe) as sprites, a dialogue box with speaker line and text, "Tap" prompt, Skip top right. Full screen.

### 7.7 Battle (`14-battle-start`, `15-battle-fight`, `16-battle-boss-blasphemy-tall`, `17-battle-litany-ready-tall`, `18-battle-litany-cut-in-tall`)
- **Purpose:** the real-time fight. Up to 4 Sisters (left) and foes (right) move and fight on their own; the player fires Litanies and calls the Hosanna.
- **Must show (top to bottom):** top row: stage name, timer ("0:02 · Candle 16s"), **Auto**, **speed**, **pause**; a one-line battle log ("Insomnia: Bolt of Consecrated Light"); boss name, **boss HP bar** and **Wrath bar**; stack counters ("Tide 2/5" with icons); the **field** (backdrop, figures, HP bars over heads, damage numbers, status icons); the **Hosanna bar** with its name; the **four party cards** with HP and Zeal.
- **Before the fight:** "Tap two Sisters to trade places. Tap one to hold the charge!" and a **Begin!** button with a countdown.
- **Blasphemy:** the red warning band, the attack name and a short call, red danger zones on the floor, the boss tinted red.
- **Litany ready:** the card flares and names the Litany; when cast, a splash cut-in and rays sweep the screen for a beat of slow motion.
- **Notes:** no top bar, no tab bar. The field needs most of the height; the HUD must stay thin. The party cards are the only thing the thumb touches; make "ready" impossible to miss.

### 7.8 Results and battle report (`19-victory-results`)
- **Victory:** "EXECUTED!" title, stage line, three **star candles** with conditions (No Sister fell, Chain of 3, Under 45 s), "Most Zealous" Sister with her full figure and a line in a speech box, reward tiles with FIRST/NEW tags, each Sister's level and EXP bar, buttons **Again**, **Map**, **Onward!**.
- **Battle report** (after timed fights such as Hunts; no screenshot yet): "Battle Report" title, each Sister's portrait, damage, share bar and "Most Zealous" tag, "Tap to go on".

### 7.9 Muster and Crypt runs (`20-muster`, `21-crypt-campfire`, `22-crypt-map`)
- **Muster:** party of four in rank slots I-IV (portrait, name, role), Hound row, Party Power vs Recommended, Order bonus chips, the bane line, Sort and Filter, card grid, **Clear / Suggest / March into the dark**.
- **Campfire:** two-to-four Sisters around a fire; each shows likes (♥) and dislikes (✗); a Morale bar; "Tap a Sister to speak"; **Skip the fire**.
- **Crypt map:** crypt name, spoils so far, a branching map of nodes (fight, elite, event, shrine, reliquary, boss: `ui/node-*.png`), the party's four portraits with HP, **Retreat (keep spoils)**.

### 7.10 Mode briefing screens (`23-abyssal-crypt`, `24-hunt-boss-brief-tall`, `49`-`57`)
- **Pattern:** title and one line; a hero box (the foe or the mode, with art); a difficulty or tier stepper; "Its ways" list (each mechanic and its answer); recommended Sisters; records and reward ladder; the main action button (Descend, Hunt, Fight, Climb, Judge...).
- **Notes:** one template for all of them: Abyssal Crypt, Purge Hunts, Bell Tower, Nightmare Raid, Inquisition, Chapter, Feast event, Rival Orders, Relic Trials, Hold the Line, Reliquary Procession. Long pages scroll; the main action should stay reachable (pinned above the tab bar or at the top of the list).

### 7.11 Roster (`25-roster-grid`)
- **Purpose:** every Sister you own.
- **Must show:** Sisters sub-tab strip (Sisters, Bonds, Satchel, Relics, Codex, Book), count ("26 / 500 sworn"), Quick Vow, Sort, Filter, help, the 3-across card grid. Long press a card for her quick card.

### 7.12 Sister page (`26`-`31`)
- **Purpose:** everything about one Sister.
- **Must show:** her splash with her pixel figure in front (view toggle: Both, Splash, Sprite), previous/next arrows and "4 / 500", Power, Back, help; **name** in display type, epithet line, rank and class and role ("Living Saint · Arbalist · Ranged DPS"), Order with icon, level and stars; stat row **HP, ATK, ARM, SPD, BOND**; tab strip **Grow, Vows, Skills, Gear, Weapon, Canon**; then the tab body:
  - **Grow:** level and cap, EXP bar, materials and costs, Ascend button, Order favour text, lore.
  - **Vows:** star tier, Vow tokens, what the next Vow gives, Take the Vow, Vow gifts list.
  - **Skills:** each skill: name, type and cooldown, level badge, description, upgrade cost.
  - **Gear:** Auto-equip best, five slots (Blade, Habit, Veil, Rosary, Sabatons) with Equip, set bonuses (Relics of War loot: rarity, Edicts, item power).
  - **Weapon:** her signature weapon: tier name (Divine Arsenal...), name, description, awakening steps.
  - **Canon:** canonization rank and traits after level 50.
- **Splash view:** tap the art for her full splash, "Tap to close".
- **Notes:** the art must own the top 40 %; tabs and body below. The body scrolls.

### 7.13 Satchel, Reliquary, Order Book (`32-satchel`, `33-reliquary`, `34-order-book`)
- **Satchel:** currencies in two rows of four (Gilt, Seals, Tithes, Alms, Vows, Stigmata, Shards, Gear), then one row per material family (name, what it's for, three tier icons with counts). Tap to read, refine 5 into 1.
- **Reliquary:** tabs Relics and Order Codex; a tree of relic nodes in three columns (Wrath, Faith, Zeal), lit or dark, costs.
- **Order Book:** per Order: crucifix, creed quote, the Sisters collected as busts with rarity, reward for the set, Change keeper.

### 7.14 Altar: banners, Armory, Kennel (`35-altar-banner`, `36-armory-gear-banner`, `37-kennel`)
- **Altar banner:** sub-tabs (Sisters, Gear, Hounds, Record); banner title and time left ("Insomnia's Vigil · Limited · Leaves in 4d 22h"); the featured UR and two SSRs standing as sprites on the Order banner backdrop ("Tap a Sister for her splash"); next banner, All Sisters, Rates; pity line ("UR within 80 · SSR+ within 13") and **Saint's Favor 0 / 150** with Claim her; **Recruit x1 (1 Seal)** and **Recruit x10 (8 Seals · weekly)**.
- **Armory:** same pattern for gear: featured set, pity, Pull x1 / x10 for Armory Writs, The Forge.
- **Kennel:** hounds: featured hound, Call x1 / x10, odds line, a grid of owned hounds.
- **Notes:** the banner art is the hero. Costs and pity must be exact and visible next to the pull buttons.

### 7.15 Pull reveal (`38-pull-seals`, `39-pull-one-reveal`, `40-pull-summary`)
- **Seals:** "Ten oaths, sealed in wax"; ten wax seals in two rows; each seal's colour is the rarity inside; "Break the seals!", **Skip to all ten**.
- **One reveal:** rays, her splash (or her figure on a frame when there is no splash), name, epithet, rank and class, "NEWLY SWORN" or the duplicate's Vow, "Tap to return to the table". The screen flashes her rarity colour; UR and Patron Deities get the biggest moment.
- **Summary:** "Sworn", ten cards with name, rarity and NEW, Seals left, **Again x1**, **Again x10**, Oath Record, To the Altar, See roster.
- **Notes:** full screen, no bars. This is the gacha's emotional peak: design the UR moment with care.

### 7.16 Market (`41-market`)
- Sub-tabs Packs, Gilt, Almonry, Tithes; "Limits reset daily"; balances; a 2-column grid of offers: icon, name, limit ("1 left today"), price button with currency icon. A sold-out state.

### 7.17 Duties, Matins, Pass, Missives, Calendar, Rank (`42`-`47`)
- **Duties:** sub-tabs Penance, Deeds, Novitiate; daily and weekly tabs; a devotion bar with chests; a list of tasks with progress, reward and **Go** or **Claim**.
- **Matins:** a 28-candle login calendar; today's candle lit; **Light the candle!**.
- **Pilgrim's Pass:** tier track with free and sworn (paid) rewards, Sworn for 600 Gilt, Claim all.
- **Missives:** letters with rewards, Claim all.
- **Calendar:** the week's daily boosts as a 7-day strip, then this week's and next week's events with times.
- **Rank of Faith:** rank numeral, Faith bar, next gift, the list of what each rank opens.
- **Notes:** all list screens: one row component with icon, text, progress and one button.

### 7.18 Other mode screens (`48`-`57`)
Sworn Errands, Bell Tower, Nightmare Raid, Inquisition, Chapter, Feast event, Rival Orders, Relic Trials, Hold the Line, Reliquary Procession. They follow 7.10 (briefing) or 7.17 (list). Use the screenshots for their exact content.

### 7.19 Popups and overlays
- **Confirm sheet:** title, up to 8 short lines, one main button and Back. Used for spending, claiming and warnings.
- **Reward popup:** reward icons with counts, one button.
- **Tooltip / glossary:** tap a keyword or currency for a short box ("tap a currency to see where it comes from").
- **Quick card:** long press a Sister for a compact card.
- **Toasts:** one line mid-screen.

---

## 8. Do's and don'ts

**Do**
- Design at 540 x 960 first and show the 1280 tall version for at least the Sanctum, a list screen and battle.
- Keep the top bar and the tab bar identical on every screen that has them.
- Make the next action the brightest thing (primary wine-and-gold button, ready dot, flare).
- Put ornaments in corners so frames stretch; keep edges plain.
- Show rarity and Order on every Sister card.
- Use the real words and numbers from the screenshots.
- Keep it PC-98: hard pixels, patterned dither, limited colours, dark grounds, firelight.
- Show every component in all its states on a kit sheet.

**Don't**
- Don't paint scanlines, CRT curve, glare or screen noise (the game adds them).
- Don't use soft gradients, blur, bloom, glass, drop shadows, rounded modern cards or flat-design icons.
- Don't put text, numbers or names into anything meant to become a skin.
- Don't shrink text below the floors (body 17, titles 20, pixel numbers 14, icons 18) or targets below 44 px.
- Don't cover a Sister's face with UI on the Sanctum, Sister page or reveal.
- Don't remove information a screen must show (section 7); regroup it instead.
- Don't use real-world religious symbols or another game's UI.
- Don't make it cute, clean or "holy and bright": this church is at war and on fire.
- Don't change Sister art, Order insignia or crucifix icons inside a concept; use them as they are on main.

---

## 9. Concept deliverables

Concepts are pictures for Aaron to choose from. They are **never wired into the game**: they go to `art-inbox/ui-concepts/` through an art pull request (ASSETS_GUIDE section 5), and Claude rebuilds the chosen design in code later.

### 9.1 Sizes

| Deliverable | Size | Notes |
| --- | --- | --- |
| Screen concept | **1080 x 1920** PNG (exactly 2x the 540 x 960 game) | one screen, full bleed, opaque. One art pixel of chrome = 4 x 4 image pixels |
| Tall screen concept | **1080 x 2560** PNG (2x 540 x 1280) | only where the tall layout matters |
| Kit sheet | **2048 x 2048** PNG | every component of one direction in all states, on the dark ground, with small labels |
| Style tile | **1080 x 1920** PNG | mood, palette swatches, one button, one frame, one card, title and body type samples |
| Flow strip (optional) | up to **3240 x 1920** PNG | 3 screens side by side for a flow (for example the pull: seals, reveal, summary) |

Colours: snap every colour to the 4,096 palette (channels multiples of 17). The chrome of one direction uses **at most 16 colours** shared by all its screens (the game art inside, such as splashes, keeps its own). No ICC profile, no transparency on screen concepts. Keep each file under 12 MB.

The pixel pass in ASSETS_GUIDE section 1 does **not** apply to concepts (they are not game assets): generate, then in Python resize to the exact size above with nearest-neighbour if needed and snap colours. Report the size and chrome colour count.

### 9.2 Names

`art-inbox/ui-concepts/<round>_<direction>_<screen>.png`, all lower case:

- `<round>`: `r1`, `r2`, `r3` ...
- `<direction>`: a short letter or word for the style direction, for example `a`, `b`, `c` or `iron`, `wax`, `bone`
- `<screen>`: the screenshot's name without its number, for example `sanctum-lobby`, `battle-fight`, `pull-one-reveal`, `sister-gear`; plus `kit`, `style-tile`, or `flow-<name>`; add `-tall` for 1280 versions

Examples: `r1_iron_style-tile.png`, `r1_iron_kit.png`, `r1_iron_sanctum-lobby.png`, `r2_iron_battle-boss-blasphemy-tall.png`.

### 9.3 Rounds

1. **Round 1: directions.** Two or three clearly different directions. For each: a style tile, a kit sheet, the Sanctum lobby and the battle HUD (`battle-fight`). Aaron picks one (or mixes).
2. **Round 2: core screens** in the chosen direction: title, Sanctum lobby (960 and tall), Crusade hub, battle (fight, Blasphemy, Litany ready), results, Altar banner, pull reveal (seals, one reveal, summary), roster grid, Sister page (one tab), crypt map, Market, a briefing screen (7.10) and a list screen (7.17), a confirm popup.
3. **Round 3: everything else**, grouped by template, plus the final kit sheet.
4. **After approval** Claude lists the final UI skins in `ART_QUEUE.md` as normal assets (exact file names, sizes and 9-slice corners); you then make those as game assets through the usual art lane.

### 9.4 Delivering

- Branch `art/ui-concepts-<round>` from main, files only in `art-inbox/ui-concepts/`, plus one `art-inbox/ART_LOG.md` line per file.
- One pull request per round titled `Art: UI concepts <round>`. In the body, for each image: its file, size, chrome colour count, and two lines on what it changes and why.
- Never edit code, `src/assets/` or `art-bible/` for a concept. Never merge.
- Need something from Claude (a fresh screenshot, a missing screen, a question about what a screen does)? Open a "Code request for Claude" issue (label `for-claude`).
