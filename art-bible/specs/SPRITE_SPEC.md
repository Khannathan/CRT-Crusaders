# Battle sprite spec (locked by the Coding Lead)

The game's intake (`tools/intake_sprite.py`) and pixel rig (`src/ui/pixelRig.ts`) need every Sister's raw battle sprite drawn to these lines. ChatGPT owns her look, the class and rank staging and how the sprite is made; the registration below is fixed. The template `../sprite-plan/sprite-template-1024x1536.png` draws these lines (it is locked too). If anything else in `art-bible/` disagrees, this file wins.

## 1. How the game uses the sprite

1. **Intake** (`tools/intake_sprite.py`):
   - removes the #FF00FF background and crops to her outline;
   - shrinks her so the whole outline fits a 116 x 172 box, soles on row 184;
   - centres the outline on column 64 and cuts her colours down (to 16).

   So **everything counts**: a weapon tip, wing or halo sticking out past the box makes the game shrink her whole body to fit it. If she reaches further left than right, her body slides off the centre line.
2. **Pixel rig** (`src/ui/pixelRig.ts`) bends that one 128 x 192 still into idle, run, strike, cast, Litany and hurt. It expects her body on fixed rows and in fixed zones:

| Part of the 128 x 192 box | What the rig does there |
| --- | --- |
| Crown about row 17, chin 41, shoulders 48 | the upper body tips forward and back from the hips |
| Belt / hips rows 100-104 | the hinge between the tipping upper body and the planted legs |
| Knees about 144, soles on row 184 | the knees bend and the shins scissor when she runs; soles never move |
| **Core**: the middle column (about 22% of the width, columns 50-78) | head, spine and belly; it never swings or sways |
| **Weapon arm zone**: left of the core (viewer's left), below the shoulders | swings with every strike: her right arm and weapon live here |
| **Off-hand zone**: right of the core, below the shoulders | thrusts out for casts: her left hand, shield, book or chalice (or an Oracle's relic) live here |
| Anything outside the core | hair, cape, chains and loose cloth sway behind her motion |

If the drawing puts a part in the wrong zone, it moves wrongly. For example:
- a weapon laid across the core tears in half on a strike;
- hair hanging beside the weapon arm swings with the weapon;
- a halo above the crown line pushes her body down off the rows the rig expects.
## 2. The canvas and lines

- **About 1024 x 1536**, portrait, one full-body figure, nothing else. One game pixel is about 8 x 8 of hers.
- **Background:** flat pure magenta #FF00FF or transparent. She never uses magenta or hot pink, and nothing on her is see-through.
- **Hair top on the crown line** (row 17). A halo, crown spike or staff top may rise at most a hand higher, and never past the top limit (row 13).
- **Soles flat on the floor line** (row 184). Nothing goes below it: no weapon tip, cape hem, smoke or shadow.
- **Spine on the centre line**, and the whole outline inside the safe box. She should reach about as far left as right.
- **Facing:** three-quarters to the viewer's right, weapon in her right hand (viewer's left). The game mirrors her to face left, so nothing may depend on side (no lettering).

## 3. The stance

This one drawing is her idle, her run base and the start and end of every move.

- Upright, full height, weight even. Feet at least shoulder-width apart, with a clear gap of floor between the legs down to the boots.
- **Arms clear of the torso** from the elbow down, with background visible between forearm and body.
- **Weapon in the weapon arm zone**, held down and out, touching her only at the gripping hand. It never crosses her torso, thighs or belt line, and is never behind her head. A big weapon points down beside her leg instead of out wide.
- **Off hand in the off-hand zone:** shield, book, chalice or Oracle relic held out at her side, never in front of her chest, never pinned under her arm.
- **Free-hanging parts** (hair ends, veil, cape, chains, tassels, censer) hang straight and end in open space. Long hair falls down her back or over the off-hand shoulder, not beside the weapon arm.
- Cape, robe and skirt hems end at or above the ankles, or sit outside the legs, so both boots and the gap between them show.
- No crouch, kneel, twist, crossed arms, raised weapon, or one leg hidden behind the other. Card pose lines are for the splash only.

## 7. Checks before sending (ChatGPT runs these in Python; the Sprite intake bot then makes the real game sprite and a 4x preview in the PR)

Run this in Python on the image. It copies the game's intake (key out magenta, crop to her outline, fit the 116 x 172 box with soles on row 184, centre the outline on column 64), so the preview is exactly what the game will show:

```python
from PIL import Image
src = Image.open("sprite.png").convert("RGBA")
px = src.load()
for y in range(src.height):            # 1. key out the #FF00FF background
    for x in range(src.width):
        r, g, b, a = px[x, y]
        if r > 200 and b > 200 and g < 80: px[x, y] = (0, 0, 0, 0)
box = src.getchannel("A").point(lambda v: 255 if v >= 128 else 0).getbbox()
fig = src.crop(box); fw, fh = fig.size  # 2. crop to her outline
k = min(172 / fh, 116 / fw)             # 3. fit the safe box (wide things shrink her)
tw, th = max(1, round(fw * k)), max(1, round(fh * k))
small = fig.resize((tw, th), Image.BOX)
prev = Image.new("RGBA", (128, 192), (0, 0, 0, 0))
x0 = max(6, min(122 - tw, 64 - tw // 2)); prev.paste(small, (x0, 185 - th))
prev.save("preview_128x192.png")
prev.resize((512, 768), Image.NEAREST).save("preview_4x.png")
sil = Image.new("RGBA", prev.size, (255, 255, 255, 255)); sil.paste((0, 0, 0, 255), mask=prev.getchannel("A"))
sil.resize((43, 64), Image.BOX).save("silhouette_64.png")
a = prev.getchannel("A").load()
cols = [x for y in range(60, 100) for x in range(128) if a[x, y] >= 128]  # her torso, chest to belt
print("scale", round(k, 4), "fit by", "WIDTH (too wide)" if 116 / fw < 172 / fh else "height")
print("top row", 185 - th, "(crown line 17; less than 13 is wrong)")
print("torso centre column", round(sum(cols) / len(cols), 1), "(should be 60-68)")
```

- [ ] It fits by height, not width. If it says WIDTH, her weapon, wings or cape reach too far out: bring them in.
- [ ] The top row is 13-18 and the torso centre column is 60-68. If not, her halo or staff is too tall, or she reaches further one way than the other.
- [ ] Look at `preview_128x192.png` at 1x and `preview_4x.png`. Her face, grip, the gaps at her arms and legs, her facing and her insignia must read.
- [ ] Look at `silhouette_64.png`. Her class shape must still read.
- [ ] The background is pure #FF00FF or transparent everywhere, with no magenta or hot pink inside her and no holes through her.
- [ ] Report the printed numbers with the image.

Then look at it:

- [ ] One full-body figure, upright, three-quarters to the right, soles flat. Sent at full size with no pixel pass.
- [ ] Weapon in the weapon arm zone, touching her only at the hand, whole and inside the frame. Off-hand items in the off-hand zone.
- [ ] Gap between each forearm and the torso. Gap between the legs. Nothing long crosses the belt line.
- [ ] Hair, cape and chains hang free. Long hair is not beside the weapon arm.
- [ ] Wings, halo and crown are folded or small and under the crown line, as her rank row says.
- [ ] Bold readable shapes and a dark outline. No noise, grain, haze, speckle or loose particles.
- [ ] Her Order insignia on both pauldrons, matching the approved badge. Nothing carried beyond her held line.
- [ ] Same face, hair and marks as the approved bust; the weapon exactly as on the prop sheet.
- [ ] None of the template's lines, colours or words in the art, and no lettering.
