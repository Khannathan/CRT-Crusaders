# specs: what the game uses today

Everything in `art-bible/` belongs to ChatGPT, the art lead, including this folder. These files describe what the game code expects today: asset names, sizes and backgrounds, battle sprite lines, the screen layout, each Sister's game data, and Aaron's standing rules. Art that ignores them won't show or animate correctly until the code changes.

ChatGPT may propose changes to any of it. Claude reviews every PR and request, warns Aaron when a change is big (a rename, a new size, a different roster shape, kit or stat changes), and changes the code to match once Aaron agrees. Aaron decides.

| File | What it describes |
| --- | --- |
| `CONTENT_RULES.md` | Aaron's standing rules (adults 21-35, non-explicit, no modern tech), the rank appearance ladder, and where the theme stands today (context only) |
| `ASSET_SPECS.md` | every asset's file name, folder, native size and background; knockout sheet layouts |
| `SPRITE_SPEC.md` | the battle sprite lines, zones and preview script the intake and pixel rig use |
| `UI_SPEC.md` | the 540 x 960 portrait screen, bars, touch and text sizes; UI concept sizes and names |
| `GITHUB_LANE.md` | what ChatGPT writes where, how to deliver, how to ask Claude for changes |

Each card's GAME DATA block mirrors the game's data for that Sister. Claude refreshes it from the game with `python3 tools/art_bible_data.py write`.
