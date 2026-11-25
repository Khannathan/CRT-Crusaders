# specs: the Coding Lead's locked files

Everything else in `art-bible/` belongs to ChatGPT, the art lead. This folder is what the game code depends on, kept by Claude, the Coding Lead. Art pull requests may not change it (the Art lane guard fails them). **If any other file disagrees with this folder, this folder wins.**

| File | What it fixes |
| --- | --- |
| `LOCKS.md` | the short list of everything locked (Aaron pastes it into ChatGPT's opener) |
| `CONTENT_RULES.md` | Aaron's standing rules (adults 21-35, non-explicit, no modern tech), the rank appearance ladder, and where the theme stands today (context only) |
| `ASSET_SPECS.md` | every asset's file name, folder, native size and background; knockout sheet layouts |
| `SPRITE_SPEC.md` | the battle sprite lines, zones and preview script the intake and pixel rig need |
| `UI_SPEC.md` | the 540 x 960 portrait screen, bars, touch and text sizes; UI concept sizes and names |
| `GITHUB_LANE.md` | what ChatGPT may write, how to deliver, how to ask Claude for changes |

Also locked outside this folder: `../CHATGPT_PROJECT_INSTRUCTIONS.txt`, `../roster/names-and-epithets.csv`, `../sprite-plan/sprite-template-1024x1536.png`, `../ui-screens/`, and the GAME DATA block at the top of every card. Claude refreshes the GAME DATA blocks from the game with `python3 tools/art_bible_data.py write`.

To change anything here: a "Code request for Claude" issue (label `for-claude`), Aaron's OK, then Claude changes the code and the spec in one pull request.
