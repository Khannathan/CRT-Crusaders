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

Drop a square PNG named by roster id into `src/assets/portraits/`, for example `CC-W001.png`.

- 128 × 128 native (256 × 256 also works), head and upper torso, eyes about 40% from the top, a few pixels of margin.
- Plain dark charcoal background (`#121116`); transparency is optional.
- Commit it and the next build picks it up; crusaders without a file show a placeholder.

## Layout

- `src/config.ts` — design resolution (540 × 960) and palette anchors from the art guide.
- `src/data/` — classes, rarity rules and the starter cast. A new crusader is one row in `crusaders.ts` plus a portrait.
- `src/data/` also holds class skills (`skills.ts`), enemies and encounters (`enemies.ts`) and run relics (`relics.ts`).
- `src/systems/` — game rules with no drawing: `gacha.ts`, `combat.ts`, `crusade.ts` (run flow and rewards), `stats.ts`.
- `src/scenes/` — one file per screen.
- `src/ui/` — shared buttons, tab bar and placeholder portraits.
