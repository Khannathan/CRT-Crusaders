"""Renames Sisters across the game from an id -> old -> new map, in one pass.

Safe to re-run with a corrected map: names already applied are left alone.

Usage (from the repo root):
    python3 -I tools/roster/apply_names.py /mnt/project-files/sister-bible/rename-map-2026-11-24.csv [--dry]

Every old full name and old first name (each unique in the roster) is matched in a
single regex pass and swapped for the same Sister's new full or first name, so a
new name that equals another Sister's old one is never renamed twice. Runs over
src/**/*.ts. Single-word new names (URs) stand in for both forms.
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
dry = '--dry' in sys.argv

# The game's current name for each id wins over the map's old_name, so the
# tool can be re-run after the map is corrected (current -> corrected name).
current = dict(re.findall(r'^  \{id: "([^"]+)", name: "([^"]+)"', (ROOT / 'src' / 'data' / 'roster.ts').read_text(encoding='utf-8'), re.M))
swap = {}
for r in rows:
    old, new = current.get(r['id'], r['old_name']).strip(), r['new_name'].strip()
    if old == new:
        continue
    of, nf = old.split()[0], new.split()[0]
    for a, b in ((old, new), (of, nf)):
        if a in swap and swap[a] != b:
            sys.exit(f'{a} is not unique in the map')
        swap[a] = b
if not swap:
    sys.exit('Every name already matches the map.')
# possessives and plain words alike; longest first so full names win
pat = re.compile(r"\b(" + '|'.join(sorted(map(re.escape, swap), key=len, reverse=True)) + r")\b")
# A lone first name right after another capitalised word is someone's surname: leave it.
fulls = {k for k in swap if ' ' in k}


def keep(text, m):
    if m.group(1) in fulls:
        return False
    before = re.search(r"([A-Z][a-z]+) $", text[max(0, m.start() - 30):m.start()])
    return bool(before) and before.group(1) not in TITLES


TITLES = {'Mother', 'Sister', 'Saint', 'Abbess', 'Prioress', 'Lady', 'Dame'}

# Old Chapter AI member names live here on purpose (they are not Sisters).
SKIP = {'src/systems/chapter.ts', 'src/data/crusaders.test.ts'}

hits = {}
for f in sorted((ROOT / 'src').rglob('*.ts')):
    if str(f.relative_to(ROOT)) in SKIP:
        continue
    text = f.read_text(encoding='utf-8')
    n = [0]

    def sub(m):
        if keep(text, m):
            return m.group(0)
        n[0] += 1
        return swap[m.group(1)]

    out = pat.sub(sub, text)
    if n[0]:
        hits[str(f.relative_to(ROOT))] = n[0]
        if not dry:
            f.write_text(out, encoding='utf-8')
for k, v in hits.items():
    print(f'{v:5d}  {k}')
