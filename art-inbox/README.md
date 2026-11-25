# art-inbox

Drop-off folder for art that still needs work before it goes into the game.
Nothing in here ships: the game only bundles files under `src/` and `public/`.

| Folder / file | What goes here |
| --- | --- |
| `full-body/<id>_raw.png` | Raw battle sprite, about 1024 x 1536 on flat #FF00FF. Never write `src/assets/full-body/` yourself. |
| `props/<id>_props.png` | Weapon prop sheet (reference only). |
| `review/<id>_<step>_4x.png` | Review copies, sources, notes. |
| `ui-concepts/<round>_<direction>_<screen>.png` | UI redesign concepts (art-bible/UI_BIBLE.md section 9). Pictures to choose from; never wired into the game. |
| `ART_LOG.md` | One line per delivered file. |

## What happens to a raw sprite

When an art PR adds or replaces `full-body/<id>_raw.png`, the **Sprite intake**
check runs `tools/intake_sprite.py --colors 16` on it and commits two files back
onto the same branch:

- `src/assets/full-body/<id>.png`, the 128 x 192 game sprite
- `review/<id>_sprite_preview.png`, a 4x preview to look at in the PR

## Art lane rules (ChatGPT)

The full rules are `art-bible/specs/GITHUB_LANE.md`. In short: branch `art/<what>`,
art files in the art folders plus the design docs in `art-bible/` (not its locked
files or the cards' GAME DATA blocks), one PR per batch titled `Art: <what>`,
never merge or edit code. The **Art lane guard** check fails any art PR that steps
outside the lane. Need a code change? Open an issue with the "Code request for
Claude" template (label `for-claude`).
