# ChatGPT's GitHub lane

ChatGPT is the art lead. It reads the whole repo and writes art and the design bibles through pull requests. Claude, the Coding Lead, owns the code and the guard. It reviews every pull request and request, flags big changes to Aaron, and merges once checks pass and nothing needs Aaron's call. Aaron decides. An automatic check, the **Art lane guard** (`tools/art_guard.py`), enforces this page on every pull request whose branch starts with `art/` or whose title starts with `Art:`.

## Reading

Anything in the repo: `art-bible/`, code, data, existing art, issues and pull requests. Always read from `main`.

## Writing

**1. Art files** (real PNGs under 12 MB; `.webp` only to replace an existing `.webp`; add or replace, never delete or rename):

| What | Path |
| --- | --- |
| Sister bust | `src/assets/portraits/<id>.png` |
| Sister splash | `src/assets/splash/<id>.png` (or replace an existing `<id>.webp`) |
| Raw battle sprite | `art-inbox/full-body/<id>_raw.png`. Never write `src/assets/full-body/` yourself: the **Sprite intake** bot makes `src/assets/full-body/<id>.png` and `art-inbox/review/<id>_sprite_preview.png` on your branch |
| Weapon prop sheets and other references | `art-inbox/props/<id>_props.png` |
| UI pieces, icons, insignias, crucifixes, backgrounds, banners, events, items, gear, effects | `src/assets/ui/<file>.png`, only names in ASSET_SPECS.md or ART_QUEUE.md |
| Enemy portraits and battle figures | `src/assets/enemies/<id>.png`, `src/assets/enemy-full/<id>.png` |
| UI redesign concepts | `art-inbox/ui-concepts/<name>.png` (UI_SPEC.md section 2) |
| Review copies, knockout sheets | `art-inbox/review/<name>.png` |
| The art log | `art-inbox/ART_LOG.md` (one line per delivered file; `IDENTITY LOCK <id>: ...` lines if you keep that method) |

**2. The design bibles: everything in `art-bible/`** (`.md`, `.txt`, `.png`, `.csv`), which you may rewrite, reorganise, add to, rename or delete. That includes `specs/` and each card's GAME DATA block, but those describe what the game uses today: a change there is a request for a game change, so say so in the PR. Claude reviews it, tells Aaron if it's big, and updates the game to match once he agrees.

## Never (the guard fails the PR)

- touch code, data, configs, tests, tools, workflows, package files, `docs/`, or anything not listed above;
- touch `src/assets/full-body/` (the bot writes it), `poses/`, `anim/`, `audio/`, `sfx/`, `fonts/` or `stand-in/`;
- push to `main`, force-push, merge or approve a pull request, or change a branch that doesn't start with `art/` (Claude's start with `claude/`).

## How to deliver

1. Branch from the latest `main`: `art/<what>`, for example `art/AM-SR-EXO`, `art/insignia-set` or `art/bible-orders`.
2. Commit only allowed files.
3. One pull request per batch, titled `Art: <what>`. For images, list each file's real size and colour count. For bible changes, say in a few lines what changed and why.
4. Wait for the checks: **Art lane guard**, **Sprite intake** (only with a raw sprite) and **CI**. If one fails, fix it on the same branch.
5. Don't merge. Claude looks at it and merges once the checks pass, then tells Aaron. Merged art shows on the live build within minutes: `https://khannathan.github.io/CRT-Crusaders/?artreview=<id>`.

## Talking to Claude

Need a code change, a new asset slot, a changed spec, a rename, new Order colours, or fresh screenshots? Open an issue with the **"Code request for Claude"** form (label `for-claude`): what, why, and the related PR. Link it from your PR and carry on. Claude doesn't watch GitHub on its own; Aaron points Claude at it. Claude treats requests as proposals and brings them to Aaron.
