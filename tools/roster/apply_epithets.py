"""Sets each Sister's title in src/data/roster.ts to her epithet from the sister bible.

Usage (from the repo root):
    python3 -I tools/roster/apply_epithets.py /mnt/project-files/sister-bible/roster/names-and-epithets.csv

The CSV has id, name, epithet, ..., old_title. A Sister whose old title fights with
the other damage type from her class (TITLE_DMG) gets that type written as `dmg`,
so changing the title never changes how she hits. Run it again after
build_roster.py, or whenever the epithets change.
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROSTER = ROOT / 'src' / 'data' / 'roster.ts'
TITLE_DMG = {'Inquisitor': 'magic', 'Bone Archivist': 'physical', 'Dawn Martyr': 'magic', 'Witchfire Deacon': 'magic'}

rows = {r['id']: r for r in csv.DictReader(open(sys.argv[1], encoding='utf-8'))}
text = ROSTER.read_text(encoding='utf-8')
done = 0


def fix(m):
    global done
    line = m.group(0)
    sid = m.group(1)
    r = rows.get(sid)
    if not r:
        return line
    old = re.search(r'title: ("(?:[^"\\]|\\.)*")', line)
    if not old:
        return line
    old_title = json.loads(old.group(1))
    if r['name'] not in line:
        sys.exit(f"{sid}: name in the CSV ({r['name']}) is not the game's")
    line = line.replace(old.group(0), 'title: ' + json.dumps(r['epithet'], ensure_ascii=False), 1)
    dmg = TITLE_DMG.get(r.get('old_title') or old_title) or TITLE_DMG.get(old_title)
    if dmg and 'dmg:' not in line:
        line = line.replace(', age:', f', dmg: "{dmg}", age:', 1)
    done += 1
    return line


text = re.sub(r'^  \{id: "([^"]+)".*$', fix, text, flags=re.M)
ROSTER.write_text(text, encoding='utf-8')
print(f'{done} titles set.')
