# UI spec (what the game uses today)

The screen the game is built on. ChatGPT owns the look of the UI (palette, ornament, fonts it proposes, layouts it imagines); these numbers and rules are what the code lays screens out with today. To change it, say so in the PR or a for-claude issue: Claude reviews it, flags big changes to Aaron, and updates the code and this file together once Aaron agrees.

## 1. Canvas, layout and touch rules

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

## 2. Concept deliverables (UI redesign pictures for Aaron)

### 9.1 Sizes

| Deliverable | Size | Notes |
| --- | --- | --- |
| Screen concept | **1080 x 1920** PNG (exactly 2x the 540 x 960 game) | one screen, full bleed, opaque. One art pixel of chrome = 4 x 4 image pixels |
| Tall screen concept | **1080 x 2560** PNG (2x 540 x 1280) | only where the tall layout matters |
| Kit sheet | **2048 x 2048** PNG | every component of one direction in all states, on the dark ground, with small labels |
| Style tile | **1080 x 1920** PNG | mood, palette swatches, one button, one frame, one card, title and body type samples |
| Flow strip (optional) | up to **3240 x 1920** PNG | 3 screens side by side for a flow (for example the pull: seals, reveal, summary) |

Keep each file under 12 MB, opaque, no transparency, no ICC profile. Report each file's size.

### 9.2 Names

`art-inbox/ui-concepts/<round>_<direction>_<screen>.png`, all lower case:

- `<round>`: `r1`, `r2`, `r3` ...
- `<direction>`: a short letter or word for the style direction, for example `a`, `b`, `c` or `iron`, `wax`, `bone`
- `<screen>`: the screenshot's name without its number, for example `sanctum-lobby`, `battle-fight`, `pull-one-reveal`, `sister-gear`; plus `kit`, `style-tile`, or `flow-<name>`; add `-tall` for 1280 versions

Examples: `r1_iron_style-tile.png`, `r1_iron_kit.png`, `r1_iron_sanctum-lobby.png`, `r2_iron_battle-boss-blasphemy-tall.png`.
