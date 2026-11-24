"""Builds src/data/roster.ts from the 500 Sister cards in the project's sister bible.

Usage (from the repo root):
    python3 -I tools/roster/build_roster.py /mnt/project-files/sister-bible/roster-500 > src/data/roster.ts

Each card gives her slot id (IV-LUR, IV-SSR-ARB, ...), name, Order, class,
title, rarity, age, relic and, for some, a hook. The 89 Sisters who return
from the old 90-Sister roster keep their old hook and are tagged with their
old id (`legacy`) so old saves move over. Everyone else gets a hook from the
class lines below (placeholders until her art and story arrive).

Then run apply_epithets.py: it sets each title to her epithet from
names-and-epithets.csv. (The cards have since moved to the epithet format; this
parser reads the earlier one, kept as roster.ts.)
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
cards_dir = Path(sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/sister-bible/roster-500')

CLASS_ID = {
    'Hierophant': 'hierophant', 'Sentinel': 'sentinel', 'Martyr': 'martyr',
    'Confessor': 'confessor', 'Hospitaller': 'hospitaller', 'Abbess': 'abbess',
    'Oracle': 'oracle', 'Cantor': 'cantor', 'Adjudicator': 'adjudicator',
    'War-Sister': 'warsister', 'Executioner': 'inquisitor', 'Veilblade': 'veilblade',
    'Censer': 'censer', 'Arbalist': 'arbalist', 'Exorcist': 'exorcist',
}

# Where each Order keeps its watch, for the hooks.
PLACE = {
    'Iron Vigil': ('the outer wall', 'the night watch'),
    'Ashen Mercy': ('the burned cities', 'the pyres'),
    'Veiled Tribunal': ('the Tribunal', 'the black veil'),
    'Sepulcher Watch': ('the ossuary', 'the tombs'),
    'Candle Choir': ('the Choir', 'the hymn'),
    'Thorn Covenant': ('the briar', 'the lash'),
    'Drowned Litany': ('the flooded abbey', 'the deep water'),
    'Glass Confession': ('the black glass', 'the mirror'),
    'Red Pilgrimage': ('the red road', 'the shrine road'),
    'Hollow Bell': ('the cracked belfry', 'the bell'),
}

HOOKS = {
    'hierophant': ['She carried the reliquary out of {p0} on her back and never set it down.', 'She has stood in front of the shrine at {p0} through three sieges.', 'She swears the saint in her shield whispers to her before every charge.'],
    'sentinel': ['She holds the door at {p0}, and nothing has come through it twice.', 'She was ordered to guard {p1}, and no one has ever relieved her.', 'She sleeps standing, sword in hand, and wakes swinging.'],
    'martyr': ['She has died twice at {p0}, and walked back both times.', 'She bleeds first so her Sisters do not have to.', 'She counts her wounds as prayers, and she has prayed a great deal.'],
    'confessor': ['She hears the sins of {p0} and cures the sinners, whether they like it or not.', 'She brews her cures from ash and holy water, and they burn going down.', 'She has never lost a patient she wanted to keep.'],
    'hospitaller': ['She carries the last cup through {p0}, and the dying wait for her.', 'She tends the wounded under fire and scolds them for bleeding.', 'She has dragged more Sisters back from the grave than she can name.'],
    'abbess': ['She rules her cloister at {p0} with a crook and a cord of thorns.', 'She heals with one hand and disciplines with the other.', 'She plants a thorn for every Sister she buries.'],
    'oracle': ['She reads the omens of {p1}, and they have never once been kind.', 'She saw her own death in the ash and decided to be late for it.', 'She speaks the doom aloud so her Sisters can outrun it.'],
    'cantor': ['She sings in {p0} so loudly the heretics lose their nerve.', 'She has not missed a note of the battle hymn in a hundred fights.', 'She sings the names of the fallen so the Lord can find them.'],
    'adjudicator': ['She keeps the ledger of {p0}, and every debt is paid in full.', 'She weighs every soul on her scales, and finds most of them wanting.', 'She has never once reversed a verdict.'],
    'warsister': ['She scourges herself before every fight at {p0}, and fights the harder for it.', 'She charges first, laughs loudest and bleeds most.', 'She has broken three flails on heretic skulls this year alone.'],
    'inquisitor': ['She names the heretics of {p0}, then she finishes them.', 'She has an axe for the guilty and a prayer for the rest.', 'She has never needed a second stroke.'],
    'veilblade': ['She slips through {p1} unseen and leaves only the guilty dead.', 'She hides a knife in her prayer book and another one somewhere worse.', 'She kisses her blade before every kill, and she kisses it often.'],
    'censer': ['She swings her censer through {p0} until the heretics choke.', 'She burns incense that only the faithful can breathe.', 'She lights her coals from the last pyre she tended.'],
    'arbalist': ['She has watched {p0} down a crossbow for a thousand nights.', 'She blesses every bolt by hand, and none of them miss.', 'She shoots the heretic first and reads his sins after.'],
    'exorcist': ['She carries a lantern through {p1}, and the dark gives way.', 'She traps what she burns out of the possessed and keeps it as a warning.', 'She has looked into the witchfire and it looked away first.'],
}

# The Living Saints' hooks, written for them.
SAINT_HOOKS = {
    'IV-LUR': 'She holds the keys to every gate of the Vigil, and she has never once opened one to the dark.',
    'AM-LUR': 'She walked out of the burning city with the last rites on her lips and her axe in her hands.',
    'VT-LUR': "She took the Tribunal's oath on a blade, and the blade agreed.",
    'SW-LUR': 'She brings the last cup to the dying, and the dead thank her.',
    'CC-LUR': "She judges the Choir's singers by the mirrors they cannot see.",
    'TC-LUR': 'She has bled on every altar of the Covenant, and every altar has flowered.',
    'DL-LUR': 'She saw the end of the world in a font and is still waiting for it.',
    'GC-LUR': 'She broke the first mirror of the Confession and judges by its shards.',
    'RP-LUR': 'She signed her oath in blood and has bled for it every day since.',
    'HB-LUR': 'She rang the cracked bell at midnight, and the dead rose to pray.',
}


# Game-side name fixes, where a bible name would break the naming rules (no surname may
# double as a first name). Tell the bible's owner so the card changes too.
NAME_FIX = {
    'VT-SSR-ARB': 'Mallia Calva',  # was Mallia Severa: "Severa" is Severa Ahala's first name
}


def h(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def clean_relic(r: str) -> str:
    r = r.strip().rstrip('.')
    return re.sub(r'^(a|an|the) ', '', r)


def old_roster():
    """The old 90-Sister roster (name -> old id, relic, hook), saved before the swap."""
    return json.loads((Path(__file__).parent / 'legacy-90.json').read_text())


def cards():
    out = []
    for f in sorted(cards_dir.glob('??-*.md')):
        t = f.read_text()
        for m in re.finditer(r"^### (\S+): ([^,(]+?)( \(LIMITED\))?, ([A-Za-z ]+)\n(?:\*\*LOCKED[^\n]*\n)?```text\n(.*?)\n```", t, re.S | re.M):
            sid, name, lim, rank, body = m.groups()

            def g(pat):
                x = re.search(pat, body, re.M)
                return x.group(1) if x else None
            cm = re.search(r"^Class: ([A-Za-z-]+) \(([A-Za-z ]+)\), titled (.+)$", body, re.M)
            am = re.search(r", age (\d+)", body)
            out.append(dict(
                id=sid, name=name.strip(), limited=bool(lim), rarity=g(r"^Rarity: (.+)$").split(' (')[0].replace('Limited ', ''),
                order=g(r"^Order: (.+)$"), cls=cm.group(1), title=cm.group(3).strip(), age=int(am.group(1)) if am else 27,
                hook=g(r"^Hook: (.+)$"), story=g(r"^Story link: (.+)$"),
                relic=g(r"^7 Relic \([^)]*\): (.+)$") or g(r"Relic: ([^.]+(?:\.[^ ][^.]*)*)\."),
            ))
    return out


def main():
    old = old_roster()
    rows = []
    for c in cards():
        o = old.get(c['name'])
        cid = CLASS_ID[c['cls']]
        if o:
            hook = o['hook']
        elif c['id'] in SAINT_HOOKS:
            hook = SAINT_HOOKS[c['id']]
        elif c['hook']:
            hook = c['hook']
        elif c['story'] and c['limited']:
            m = re.match(r"(Disciple|Sworn shield-sister) of ([^;]+); (.+)", c['story'])
            who = m.group(2).split()[0]
            hook = (f"She learned the faith at {who}'s feet, and {m.group(3)[4:]}" if m.group(1) == 'Disciple'
                    else f"She is {who}'s sworn shield-sister: {m.group(3)[4:]}")
            hook = hook.rstrip('.') + '.'
        else:
            lines = HOOKS[cid]
            p0, p1 = PLACE[c['order']]
            hook = lines[h(c['id']) % len(lines)].format(p0=p0, p1=p1)
        row = dict(id=c['id'], name=NAME_FIX.get(c['id'], c['name']), classId=cid, title=c['title'], rarity=c['rarity'], order=c['order'],
                   age=c['age'], hook=hook, relic=clean_relic(o['relic'] if o and not c['relic'] else c['relic']))
        if c['limited']:
            row['limited'] = True
        if o:
            row['legacy'] = o['id']
        rows.append(row)
    assert len(rows) == 500, len(rows)
    print('// Generated by tools/roster/build_roster.py from the sister bible cards (roster-500). Do not edit by hand:')
    print('// change the cards (or the script) and run it again.')
    print("import type { CrusaderDef } from './types';")
    print()
    print('/** The 500 Sisters: per Order a Living Saint, two Limited Commanders, two Saintesses, and a Commander, Officer and Conscript of each of the 15 classes. */')
    print('export const ROSTER: CrusaderDef[] = [')
    for r in rows:
        print('  ' + json.dumps(r, ensure_ascii=False).replace('"id"', 'id').replace('"name"', 'name').replace('"classId"', 'classId').replace('"title"', 'title').replace('"rarity"', 'rarity').replace('"order"', 'order').replace('"age"', 'age').replace('"hook"', 'hook').replace('"relic"', 'relic').replace('"limited"', 'limited').replace('"legacy"', 'legacy').replace(': ', ': ').replace('", ', '", ') + ',')
    print('];')


main()
