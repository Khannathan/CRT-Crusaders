# art-bible: start here

The art and design bibles for CRT Crusaders. Since 2026-11-25 **ChatGPT is the art lead and owns this folder**: it reimagines the designs, rewrites the bibles and makes every piece of art. No existing art is kept; the goal is to replace all of it with better art. Claude, the Coding Lead, owns the game code, reviews every ChatGPT PR and request, and warns Aaron about big changes. Aaron decides.

The copy on `main` is always the current one: read it fresh at the start of every chat, and trust it over uploads, earlier chats or memory.

The seven-Order redesign is tracked in [Creative decisions](CREATIVE_DECISIONS.md), the [Orders](Orders/) and the [Races](Races/) register.

## Approved visual direction

Start with [EGA Dungeon Crawler with retro anime character art](ART_DIRECTION.md) and its Insomnia comparison before using the design bibles or card prompts.

## What the game uses today (changes here are requests: Claude reviews them and warns Aaron about big ones)

| What | Where |
| --- | --- |
| Aaron's standing rules, the rank appearance ladder, today's theme (context) | `specs/CONTENT_RULES.md` |
| Every asset's file name, size and background | `specs/ASSET_SPECS.md` |
| Battle sprite lines and preview | `specs/SPRITE_SPEC.md` and `sprite-plan/sprite-template-1024x1536.png` |
| Screen and UI concept rules | `specs/UI_SPEC.md` |
| How to deliver through GitHub | `specs/GITHUB_LANE.md` |
| Each Sister's game data (name, rank, class, weapon and relic names, kit) | the GAME DATA block at the top of her card |
| Names the game reads | `roster/names-and-epithets.csv` |
| Screenshots of the game as built | `ui-screens/` |

## ChatGPT's (rewrite, reorganise, add or remove freely)

| File | Today |
| --- | --- |
| `GAME_OVERVIEW.md` | the game and where each image shows |
| `ASSETS_GUIDE.md` | style rules and prompts for crucifixes, insignias and gear |
| `ART_QUEUE.md` | what to make next |
| `order-bible.md`, `class-bible.md` | the 10 Orders and 15 classes |
| `sprite-plan/sprite-plan.md` | class and rank staging for battle sprites |
| `UI_BIBLE.md` | the brief for UI redesign concepts |
| `roster/README.md`, `roster/cards/<Order code>/<id>.md` | the 200 Sisters (design text below each card's GAME DATA block) |

**Finding a Sister:** `roster/names-and-epithets.csv` maps every name to her id. Ids are `<Order>-<rarity>-<class>` (for example `IV-SSR-CEN`) or a top slot `<Order>-LUR`, `-LSSR1`, `-LSSR2`, `-UR1`, `-UR2`. Order codes: IV Iron Vigil, AM Ashen Mercy, VT Veiled Tribunal, SW Sepulcher Watch, CC Choir of the Pyre, TC Verdant Martyrdom, DL Drowned Litany, GC Confessors of Glass, RP Crimson Inquisition, HB Hallowed Belfry.

**Approved art** is what's merged on `main`: busts `src/assets/portraits/<id>.png`, sprites `src/assets/full-body/<id>.png` (raw drawing `art-inbox/full-body/<id>_raw.png`), splashes `src/assets/splash/<id>.png`, Order pieces `src/assets/ui/`. Work in progress sits in open pull requests on `art/` branches: check there first so nothing is made twice.

## Elsewhere in the repo (read live)

| What | Where |
| --- | --- |
| Art in the game today | `src/assets/portraits/`, `splash/`, `full-body/`, `ui/`, `enemies/`, `enemy-full/` (file name = asset id) |
| Raw sprites, references, review copies, the art log | `art-inbox/` |
| The roster as the game sees it | `src/data/roster.ts`, `weapons.ts`, `orders.ts`, `classes.ts` |
| Game text voice | `docs/VOICE.md` |
| Live game | `https://khannathan.github.io/CRT-Crusaders/` |
| Art viewer (merged art only) | `https://khannathan.github.io/CRT-Crusaders/?artreview=<id>` |
