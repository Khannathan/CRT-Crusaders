# Prepares the 9-slice skins (corner sizes in corners.json, mirrored in src/ui/skin.ts):
# cleans mid-edge ornaments so edges stretch, flattens panel centres, greys the badge.
import json
from PIL import Image, ImageOps
from skins import clean, fill_centre
C=json.load(open('corners.json'))
S='stage/ui/'
for k,c in C.items():
    im=Image.open(S+k+'.png').convert('RGBA')
    if k=='ui-rite-tile': im=im.resize((im.width//2,im.height//2),Image.NEAREST)
    if c: im=clean(im,c)
    if k in ('ui-panel','ui-rite-tile'): im=fill_centre(im,c)
    if k=='ui-badge':
        a=im.split()[3]; g=ImageOps.autocontrast(im.convert('L')); im=Image.merge('RGBA',(g,g,g,a))
    im.save(S+k+'.png',optimize=True)
import os
# ui-skill-litany has a full cross picture inside, so text can't sit on it; the flaming ui-skill-rite frame is used instead
os.remove(S+'ui-skill-litany.png')
im=Image.open(S+'ui-divider.png'); im.resize((im.width//2,im.height//2),Image.NEAREST).save(S+'ui-divider.png',optimize=True)
# Meters are thin (8-14px), so their frame and fills stay at the native grid
for k in ['ui-bar-frame','ui-bar-hp','ui-bar-hp-enemy','ui-bar-zeal','ui-bar-devotion','ui-bar-litany','ui-bar-litany-full','ui-bar-wrath','ui-bar-wrath-full','ui-bar-litany-frame','ui-bar-wrath-frame']:
    im=Image.open(S+k+'.png'); im.resize((im.width//2,im.height//2),Image.NEAREST).save(S+k+'.png',optimize=True)
