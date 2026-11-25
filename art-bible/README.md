# art-bible: start here

The art rules for CRT Crusaders, kept by Claude and read by ChatGPT. The copy on `main` is always the current one: read it fresh at the start of every chat, and trust it over any uploaded file, earlier chat or memory. **Read only:** art pull requests may never change this folder (the Art lane guard fails them).

## What to read for each job

| Job | Read |
| --- | --- |
| Any asset | the project instructions, then its row in `ASSETS_GUIDE.md` (name, size, background, pixel pass, delivery) |
| "What should I make next?" | `ART_QUEUE.md` |
| Order crucifix or insignia | `ASSETS_GUIDE.md` sections 3 and 3b, that Order's section of `order-bible.md` |
| One Sister | her card `roster-500/cards/<Order code>/<id>.md`, her Order's section of `order-bible.md`, her class's section of `class-bible.md` |
| Her battle sprite | also `sprite-plan/sprite-plan.md` and `sprite-plan/sprite-template-1024x1536.png` |
| Gear icons | `ASSETS_GUIDE.md` section 4 |
| Delivering anything | `ASSETS_GUIDE.md` section 5 (the GitHub art lane) |
| What the game is, where art shows | `GAME_OVERVIEW.md` |

**Finding a Sister:** `roster-500/names-and-epithets.csv` maps every name to her id. Ids are `<Order>-<rarity>-<class>` (for example `IV-SSR-CEN`, the Iron Vigil SSR Censer) or a top slot `<Order>-LUR`, `-LSSR1`, `-LSSR2`, `-UR1`, `-UR2`. Order codes: IV Iron Vigil, AM Ashen Mercy, VT Veiled Tribunal, SW Sepulcher Watch, CC Choir of the Pyre, TC Verdant Martyrdom, DL Drowned Litany, GC Confessors of Glass, RP Crimson Inquisition, HB Hallowed Belfry. `roster-500/README.md` explains the roster and has Aaron's progress tracker.

**Attaching images:** the image tool can't take a file straight from GitHub. The sprite template is also uploaded to the ChatGPT project; ask Aaron to attach approved art (insignia, bust, sprite, prop sheet) in the chat.

Each card file starts with her Order's one-line cloth and head note, then her card. Everything above her `ART PROMPTS` line is reference; the four prompts below it (PROP, BUST, SPRITE, SPLASH) are sent verbatim.

## Files in this folder

| File | What it is |
| --- | --- |
| `CHATGPT_PROJECT_INSTRUCTIONS.txt` | the system prompt pasted into the ChatGPT project (a copy, for reference) |
| `GAME_OVERVIEW.md` | the game and where each image shows |
| `ASSETS_GUIDE.md` | every asset type; crucifix, insignia and gear prompts; the GitHub art lane |
| `ART_QUEUE.md` | what to make next, in order, plus the knockout effect specs |
| `order-bible.md`, `class-bible.md` | the 10 Orders and 15 classes |
| `sprite-plan/` | battle sprite plan and registration template |
| `roster-500/` | roster README, names CSV, and `cards/<Order code>/<id>.md` (500 cards) |

## Elsewhere in the repo (read live)

| What | Where |
| --- | --- |
| Art already in the game | `src/assets/portraits/`, `splash/`, `full-body/`, `ui/`, `enemies/`, `enemy-full/` (file name = asset id) |
| Raw sprites, prop sheets, review copies, the art log | `art-inbox/` (see its README) |
| The roster as the game sees it | `src/data/roster.ts` (generated from the cards; never edit) |
| Orders, classes, story cast | `src/data/orders.ts`, `classes.ts`, `story.ts` |
| Game text voice | `docs/VOICE.md` |
| Live game | `https://khannathan.github.io/CRT-Crusaders/` |
| Art viewer (merged art only) | `https://khannathan.github.io/CRT-Crusaders/?artreview=<id>`: her art in battle, roster, Sanctum, Altar and bust views, with the pixel rig moves |

Code requests go in a "Code request for Claude" issue (label `for-claude`).
